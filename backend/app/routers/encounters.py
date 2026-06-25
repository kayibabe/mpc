from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, date
from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.encounter import Encounter, EncounterStatus, EncounterType, TriageAssessment, ClinicalNote
from app.schemas.encounter import (
    EncounterCreate, EncounterUpdate, EncounterListResponse, EncounterResponse,
    EncounterDetailResponse, TriageCreate, TriageResponse, ClinicalNoteCreate, ClinicalNoteResponse,
)
import uuid

router = APIRouter(prefix="/encounters", tags=["encounters"])

_CLINICAL = (
    UserRole.doctor, UserRole.nurse, UserRole.receptionist,
    UserRole.lab_tech, UserRole.pharmacist, UserRole.admin,
)


@router.get("", response_model=list[EncounterListResponse])
async def list_encounters(
    patient_id: str | None = Query(None),
    status: EncounterStatus | None = Query(None),
    encounter_date: date | None = Query(None),
    doctor_id: str | None = Query(None),
    encounter_type: EncounterType | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.receptionist, UserRole.admin)),
):
    stmt = select(Encounter)
    if patient_id:
        stmt = stmt.where(Encounter.patient_id == patient_id)
    if status:
        stmt = stmt.where(Encounter.status == status)
    if doctor_id:
        stmt = stmt.where(Encounter.attending_doctor_id == doctor_id)
    if encounter_type:
        stmt = stmt.where(Encounter.encounter_type == encounter_type)
    if encounter_date:
        from sqlalchemy import func, cast
        from sqlalchemy.dialects.postgresql import DATE
        stmt = stmt.where(cast(Encounter.encounter_date, DATE) == encounter_date)
    stmt = stmt.order_by(Encounter.encounter_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=EncounterResponse, status_code=status.HTTP_201_CREATED)
async def create_encounter(
    body: EncounterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.receptionist, UserRole.doctor, UserRole.nurse, UserRole.admin,
    )),
):
    encounter = Encounter(
        id=str(uuid.uuid4()),
        encounter_date=datetime.now(timezone.utc),
        created_by=current_user.id,
        **body.model_dump(),
    )
    db.add(encounter)
    await db.flush()
    await db.refresh(encounter)
    return encounter


@router.get("/{encounter_id}", response_model=EncounterDetailResponse)
async def get_encounter(
    encounter_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.admin)),
):
    result = await db.execute(select(Encounter).where(Encounter.id == encounter_id))
    encounter = result.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")

    triage_result = await db.execute(
        select(TriageAssessment).where(TriageAssessment.encounter_id == encounter_id)
    )
    triage = triage_result.scalar_one_or_none()

    notes_result = await db.execute(
        select(ClinicalNote).where(ClinicalNote.encounter_id == encounter_id)
        .order_by(ClinicalNote.created_at)
    )
    notes = notes_result.scalars().all()

    return EncounterDetailResponse(
        **EncounterResponse.model_validate(encounter).model_dump(),
        triage=TriageResponse.model_validate(triage) if triage else None,
        notes=[ClinicalNoteResponse.model_validate(n) for n in notes],
    )


@router.put("/{encounter_id}", response_model=EncounterResponse)
async def update_encounter(
    encounter_id: str,
    body: EncounterUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.admin)),
):
    result = await db.execute(select(Encounter).where(Encounter.id == encounter_id))
    encounter = result.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(encounter, field, value)
    encounter.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(encounter)
    return encounter


@router.post("/{encounter_id}/triage", response_model=TriageResponse, status_code=status.HTTP_201_CREATED)
async def upsert_triage(
    encounter_id: str,
    body: TriageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.nurse, UserRole.doctor, UserRole.admin)),
):
    enc_result = await db.execute(select(Encounter).where(Encounter.id == encounter_id))
    if not enc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Encounter not found")

    existing = await db.execute(
        select(TriageAssessment).where(TriageAssessment.encounter_id == encounter_id)
    )
    triage = existing.scalar_one_or_none()

    if triage:
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(triage, field, value)
        triage.assessed_at = datetime.now(timezone.utc)
    else:
        triage = TriageAssessment(
            id=str(uuid.uuid4()),
            encounter_id=encounter_id,
            nurse_id=current_user.id,
            assessed_at=datetime.now(timezone.utc),
            **body.model_dump(),
        )
        db.add(triage)

    await db.flush()
    await db.refresh(triage)
    return triage


@router.get("/{encounter_id}/notes", response_model=list[ClinicalNoteResponse])
async def list_notes(
    encounter_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.admin)),
):
    result = await db.execute(
        select(ClinicalNote).where(ClinicalNote.encounter_id == encounter_id)
        .order_by(ClinicalNote.created_at)
    )
    return result.scalars().all()


@router.post("/{encounter_id}/notes", response_model=ClinicalNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_note(
    encounter_id: str,
    body: ClinicalNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.doctor, UserRole.admin)),
):
    enc_result = await db.execute(select(Encounter).where(Encounter.id == encounter_id))
    if not enc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Encounter not found")

    note = ClinicalNote(
        id=str(uuid.uuid4()),
        encounter_id=encounter_id,
        author_id=current_user.id,
        **body.model_dump(),
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note



