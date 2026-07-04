from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta, date
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.models.theatre import TheatreCase, TheatreCaseStatus, PreOpChecklist
from app.schemas.theatre import (
    TheatreCaseCreate, PreOpChecklistCreate, PostOpCreate, CompleteCase, CancelCase,
    PreOpChecklistResponse, TheatreCaseResponse, TheatreCaseDetailResponse,
)
import uuid

router = APIRouter(prefix="/theatre", tags=["theatre"])

_SURGICAL_ROLES = (UserRole.doctor, UserRole.surgical_lead, UserRole.admin)
_READ_ROLES = (UserRole.doctor, UserRole.nurse, UserRole.clinician, UserRole.surgical_lead, UserRole.admin)
_CHECKLIST_ROLES = (UserRole.nurse, UserRole.doctor, UserRole.surgical_lead, UserRole.admin)
_COMPLETE_ROLES = (UserRole.doctor, UserRole.nurse, UserRole.surgical_lead, UserRole.admin)

# Statuses that free up the theatre slot
_INACTIVE_STATUSES = (TheatreCaseStatus.cancelled, TheatreCaseStatus.completed)


async def _check_room_conflict(
    db: AsyncSession,
    theatre_room: str,
    scheduled_start: datetime,
    duration_minutes: int,
    exclude_id: str | None = None,
) -> TheatreCase | None:
    """Return an existing conflicting theatre case for the room, or None.

    Fetches the room's active cases for the same calendar day and checks time
    overlap in Python (SQLite-compatible; no interval arithmetic) — same
    approach as the appointments double-booking check.
    """
    day_start = scheduled_start.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    stmt = (
        select(TheatreCase)
        .where(
            TheatreCase.theatre_room == theatre_room,
            TheatreCase.scheduled_start >= day_start,
            TheatreCase.scheduled_start < day_end,
            TheatreCase.status.notin_(list(_INACTIVE_STATUSES)),
        )
    )
    if exclude_id:
        stmt = stmt.where(TheatreCase.id != exclude_id)

    result = await db.execute(stmt)
    candidates = result.scalars().all()

    new_start = scheduled_start
    new_end = scheduled_start + timedelta(minutes=duration_minutes)

    for case in candidates:
        existing_start = case.scheduled_start
        if existing_start.tzinfo is None:
            existing_start = existing_start.replace(tzinfo=timezone.utc)
        existing_end = existing_start + timedelta(minutes=case.estimated_duration_minutes)
        # Overlap: new starts before existing ends AND new ends after existing starts
        if new_start < existing_end and new_end > existing_start:
            return case
    return None


async def _get_case_or_404(db: AsyncSession, case_id: str) -> TheatreCase:
    result = await db.execute(select(TheatreCase).where(TheatreCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Theatre case not found")
    return case


@router.post("/cases", response_model=TheatreCaseResponse, status_code=http_status.HTTP_201_CREATED)
async def book_theatre_case(
    body: TheatreCaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_SURGICAL_ROLES)),
):
    patient_result = await db.execute(select(Patient).where(Patient.id == body.patient_id))
    if not patient_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    enc_result = await db.execute(select(Encounter).where(Encounter.id == body.encounter_id))
    if not enc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Encounter not found")

    scheduled_start = body.scheduled_start
    if scheduled_start.tzinfo is None:
        scheduled_start = scheduled_start.replace(tzinfo=timezone.utc)

    conflict = await _check_room_conflict(
        db, body.theatre_room, scheduled_start, body.estimated_duration_minutes
    )
    if conflict:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail={
                "message": "Theatre room already booked for this time",
                "conflict_id": conflict.id,
            },
        )

    case = TheatreCase(
        id=str(uuid.uuid4()),
        patient_id=body.patient_id,
        encounter_id=body.encounter_id,
        admission_id=body.admission_id,
        surgeon_id=body.surgeon_id,
        anaesthetist_id=body.anaesthetist_id,
        theatre_room=body.theatre_room,
        procedure_name=body.procedure_name,
        procedure_code=body.procedure_code,
        scheduled_start=scheduled_start,
        estimated_duration_minutes=body.estimated_duration_minutes,
        created_by_id=current_user.id,
    )
    db.add(case)
    await db.flush()
    await db.refresh(case)
    return case


@router.get("/cases", response_model=list[TheatreCaseResponse])
async def list_theatre_cases(
    case_status: TheatreCaseStatus | None = Query(None, alias="status"),
    surgeon_id: str | None = Query(None),
    patient_id: str | None = Query(None),
    case_date: date | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_READ_ROLES)),
):
    stmt = select(TheatreCase)
    if case_status:
        stmt = stmt.where(TheatreCase.status == case_status)
    if surgeon_id:
        stmt = stmt.where(TheatreCase.surgeon_id == surgeon_id)
    if patient_id:
        stmt = stmt.where(TheatreCase.patient_id == patient_id)
    if case_date:
        day_start = datetime(case_date.year, case_date.month, case_date.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        stmt = stmt.where(
            TheatreCase.scheduled_start >= day_start,
            TheatreCase.scheduled_start < day_end,
        )
    stmt = stmt.order_by(TheatreCase.scheduled_start).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/cases/{case_id}", response_model=TheatreCaseDetailResponse)
async def get_theatre_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_READ_ROLES)),
):
    result = await db.execute(
        select(TheatreCase)
        .options(selectinload(TheatreCase.checklist))
        .where(TheatreCase.id == case_id)
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Theatre case not found")
    return case


@router.post(
    "/cases/{case_id}/preop-checklist",
    response_model=PreOpChecklistResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_preop_checklist(
    case_id: str,
    body: PreOpChecklistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_CHECKLIST_ROLES)),
):
    case = await _get_case_or_404(db, case_id)

    existing = await db.execute(select(PreOpChecklist).where(PreOpChecklist.case_id == case_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Pre-op checklist already exists for this case",
        )

    if case.status not in (TheatreCaseStatus.booked, TheatreCaseStatus.pre_op):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add a pre-op checklist to a case with status={case.status.value}",
        )

    checklist = PreOpChecklist(
        id=str(uuid.uuid4()),
        case_id=case_id,
        consent_signed=body.consent_signed,
        fasting_confirmed=body.fasting_confirmed,
        site_marked=body.site_marked,
        anaesthesia_review_done=body.anaesthesia_review_done,
        bloods_available=body.bloods_available,
        notes=body.notes,
        completed_by_id=current_user.id,
    )
    db.add(checklist)

    case.status = TheatreCaseStatus.pre_op
    case.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(checklist)
    return checklist


@router.post("/cases/{case_id}/start", response_model=TheatreCaseResponse)
async def start_operation(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_SURGICAL_ROLES)),
):
    case = await _get_case_or_404(db, case_id)

    if case.status != TheatreCaseStatus.pre_op:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Case must be in pre_op state to start",
        )

    checklist_result = await db.execute(select(PreOpChecklist).where(PreOpChecklist.case_id == case_id))
    checklist = checklist_result.scalar_one_or_none()
    if (
        not checklist
        or not checklist.consent_signed
        or not checklist.fasting_confirmed
        or not checklist.site_marked
        or not checklist.anaesthesia_review_done
    ):
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pre-op checklist incomplete: consent, fasting, site marking and "
                   "anaesthesia review must all be confirmed",
        )

    case.status = TheatreCaseStatus.in_theatre
    case.operation_started_at = datetime.now(timezone.utc)
    case.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(case)
    return case


@router.post("/cases/{case_id}/post-op", response_model=TheatreCaseResponse)
async def record_post_op(
    case_id: str,
    body: PostOpCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_SURGICAL_ROLES)),
):
    case = await _get_case_or_404(db, case_id)

    if case.status != TheatreCaseStatus.in_theatre:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Case must be in_theatre to record post-op notes",
        )

    case.operation_notes = body.operation_notes
    case.findings = body.findings
    case.complications = body.complications
    case.operation_ended_at = datetime.now(timezone.utc)
    case.status = TheatreCaseStatus.recovery
    case.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(case)
    return case


@router.post("/cases/{case_id}/complete", response_model=TheatreCaseResponse)
async def complete_case(
    case_id: str,
    body: CompleteCase,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_COMPLETE_ROLES)),
):
    case = await _get_case_or_404(db, case_id)

    if case.status != TheatreCaseStatus.recovery:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Case must be in recovery to be completed",
        )

    case.recovery_notes = body.recovery_notes
    case.recovery_discharged_at = datetime.now(timezone.utc)
    case.status = TheatreCaseStatus.completed
    case.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(case)
    return case


@router.patch("/cases/{case_id}/cancel", response_model=TheatreCaseResponse)
async def cancel_case(
    case_id: str,
    body: CancelCase,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_SURGICAL_ROLES)),
):
    case = await _get_case_or_404(db, case_id)

    if case.status in (TheatreCaseStatus.completed, TheatreCaseStatus.cancelled):
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Case is {case.status.value} and cannot be cancelled",
        )

    case.status = TheatreCaseStatus.cancelled
    case.cancellation_reason = body.cancellation_reason
    case.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(case)
    return case
