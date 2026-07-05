from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from datetime import datetime, timezone, date
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.mortuary import DeathRecord, MortuaryAdmission, MortuaryStatus
from app.schemas.mortuary import (
    DeathRecordCreate, DeathRecordResponse, DeathRecordDetailResponse,
    MortuaryIntakeCreate, FamilyNotificationCreate, BodyReleaseCreate,
    MortuaryAdmissionResponse,
)
import uuid

router = APIRouter(prefix="/mortuary", tags=["mortuary"])

# Only clinicians certify death; the burial permit is an official document.
_CAN_CERTIFY = (UserRole.doctor, UserRole.clinician, UserRole.admin)
_CAN_READ = (UserRole.doctor, UserRole.nurse, UserRole.clinician, UserRole.admin)
_CAN_INTAKE = (UserRole.nurse, UserRole.doctor, UserRole.admin)
_CAN_NOTIFY = (UserRole.nurse, UserRole.doctor, UserRole.clinician, UserRole.admin)
_CAN_RELEASE = (UserRole.doctor, UserRole.admin)


def _generate_certificate_number(seq_val: int) -> str:
    return f"DC{seq_val:06d}"


def _generate_permit_number(seq_val: int) -> str:
    return f"BRP{seq_val:06d}"


async def _next_cert_seq(db: AsyncSession) -> int:
    """Postgres sequence; SQLite (dev/tests) falls back to row count + 1."""
    if db.get_bind().dialect.name == "postgresql":
        return (await db.execute(text("SELECT nextval('death_cert_seq')"))).scalar_one()
    count = (await db.execute(select(func.count()).select_from(DeathRecord))).scalar_one()
    return count + 1


async def _next_permit_seq(db: AsyncSession) -> int:
    """Postgres sequence; SQLite (dev/tests) falls back to issued-permit count + 1."""
    if db.get_bind().dialect.name == "postgresql":
        return (await db.execute(text("SELECT nextval('burial_permit_seq')"))).scalar_one()
    count = (
        await db.execute(
            select(func.count())
            .select_from(MortuaryAdmission)
            .where(MortuaryAdmission.release_permit_number.is_not(None))
        )
    ).scalar_one()
    return count + 1


async def _get_death_record_or_404(death_id: str, db: AsyncSession) -> DeathRecord:
    result = await db.execute(select(DeathRecord).where(DeathRecord.id == death_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Death record not found")
    return record


async def _get_intake_or_404(intake_id: str, db: AsyncSession) -> MortuaryAdmission:
    result = await db.execute(select(MortuaryAdmission).where(MortuaryAdmission.id == intake_id))
    intake = result.scalar_one_or_none()
    if not intake:
        raise HTTPException(status_code=404, detail="Mortuary intake not found")
    return intake


# ── Death certification ───────────────────────────────────────────────────────

@router.post("/deaths", response_model=DeathRecordResponse, status_code=status.HTTP_201_CREATED)
async def certify_death(
    body: DeathRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_CAN_CERTIFY)),
):
    patient_result = await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.is_deleted == False)
    )
    if not patient_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")

    existing_result = await db.execute(
        select(DeathRecord).where(DeathRecord.patient_id == body.patient_id)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Death record already exists for this patient",
                "certificate_number": existing.certificate_number,
            },
        )

    certificate_number = _generate_certificate_number(await _next_cert_seq(db))

    record = DeathRecord(
        id=str(uuid.uuid4()),
        patient_id=body.patient_id,
        encounter_id=body.encounter_id,
        admission_id=body.admission_id,
        date_of_death=body.date_of_death,
        place_of_death=body.place_of_death,
        immediate_cause=body.immediate_cause,
        underlying_cause=body.underlying_cause,
        contributing_conditions=body.contributing_conditions,
        certificate_number=certificate_number,
        certified_by_id=current_user.id,
        notes=body.notes,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.get("/deaths", response_model=list[DeathRecordResponse])
async def list_death_records(
    patient_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_CAN_READ)),
):
    stmt = select(DeathRecord)
    if patient_id:
        stmt = stmt.where(DeathRecord.patient_id == patient_id)
    if date_from:
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import DATE
        stmt = stmt.where(cast(DeathRecord.date_of_death, DATE) >= date_from)
    if date_to:
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import DATE
        stmt = stmt.where(cast(DeathRecord.date_of_death, DATE) <= date_to)
    stmt = stmt.order_by(DeathRecord.date_of_death.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/deaths/{death_id}", response_model=DeathRecordDetailResponse)
async def get_death_record(
    death_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_CAN_READ)),
):
    record = await _get_death_record_or_404(death_id, db)
    intake_result = await db.execute(
        select(MortuaryAdmission).where(MortuaryAdmission.death_record_id == death_id)
    )
    intake = intake_result.scalar_one_or_none()
    return DeathRecordDetailResponse(
        **DeathRecordResponse.model_validate(record).model_dump(),
        mortuary_admission=MortuaryAdmissionResponse.model_validate(intake) if intake else None,
    )


# ── Mortuary intake ───────────────────────────────────────────────────────────

@router.post(
    "/deaths/{death_id}/intake",
    response_model=MortuaryAdmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def mortuary_intake(
    death_id: str,
    body: MortuaryIntakeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_CAN_INTAKE)),
):
    await _get_death_record_or_404(death_id, db)

    existing_result = await db.execute(
        select(MortuaryAdmission).where(MortuaryAdmission.death_record_id == death_id)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail="Mortuary intake already exists for this death record"
        )

    intake = MortuaryAdmission(
        id=str(uuid.uuid4()),
        death_record_id=death_id,
        tag_number=body.tag_number,
        compartment=body.compartment,
        received_by_id=current_user.id,
        received_at=datetime.now(timezone.utc),
        status=MortuaryStatus.admitted,
    )
    db.add(intake)
    await db.flush()
    await db.refresh(intake)
    return intake


@router.get("/intakes", response_model=list[MortuaryAdmissionResponse])
async def list_intakes(
    status_filter: MortuaryStatus | None = Query(None, alias="status"),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_CAN_INTAKE)),
):
    stmt = select(MortuaryAdmission)
    if status_filter:
        stmt = stmt.where(MortuaryAdmission.status == status_filter)
    stmt = stmt.order_by(MortuaryAdmission.received_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Family notification ───────────────────────────────────────────────────────

@router.post("/intakes/{intake_id}/notify-family", response_model=MortuaryAdmissionResponse)
async def notify_family(
    intake_id: str,
    body: FamilyNotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_CAN_NOTIFY)),
):
    """Record next-of-kin notification. May be called again to correct details."""
    intake = await _get_intake_or_404(intake_id, db)

    intake.family_notified = True
    intake.notified_person_name = body.notified_person_name
    intake.notified_person_relationship = body.notified_person_relationship
    intake.notified_person_phone = body.notified_person_phone
    intake.notified_at = datetime.now(timezone.utc)
    intake.notified_by_id = current_user.id
    intake.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(intake)
    return intake


# ── Body release ──────────────────────────────────────────────────────────────

@router.post("/intakes/{intake_id}/release", response_model=MortuaryAdmissionResponse)
async def release_body(
    intake_id: str,
    body: BodyReleaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_CAN_RELEASE)),
):
    intake = await _get_intake_or_404(intake_id, db)
    if intake.status == MortuaryStatus.released:
        raise HTTPException(status_code=409, detail="Body already released")
    if not intake.family_notified:
        raise HTTPException(
            status_code=422,
            detail="Family must be notified before the body can be released",
        )

    intake.release_permit_number = _generate_permit_number(await _next_permit_seq(db))
    intake.released_to_name = body.released_to_name
    intake.released_to_relationship = body.released_to_relationship
    intake.released_to_id_number = body.released_to_id_number
    intake.released_at = datetime.now(timezone.utc)
    intake.released_by_id = current_user.id
    intake.status = MortuaryStatus.released
    intake.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(intake)
    return intake
