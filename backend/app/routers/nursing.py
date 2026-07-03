from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.nursing import VitalSigns, MedicationAdministration, NursingNote
from app.schemas.nursing import (
    VitalSignsCreate, NursingNoteCreate, MARCreate,
    VitalSignsResponse, NursingNoteResponse, MARResponse,
)
import uuid

router = APIRouter(prefix="/nursing", tags=["nursing"])


@router.post("/vitals", response_model=VitalSignsResponse, status_code=status.HTTP_201_CREATED)
async def record_vitals(
    body: VitalSignsCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.nurse, UserRole.doctor, UserRole.admin)),
):
    vitals = VitalSigns(
        id=str(uuid.uuid4()),
        nurse_id=current_user.id,
        charted_at=datetime.now(timezone.utc),
        **body.model_dump(),
    )
    db.add(vitals)
    await db.flush()
    await db.refresh(vitals)
    return vitals


@router.get("/vitals", response_model=list[VitalSignsResponse])
async def list_vitals(
    patient_id: str | None = Query(None),
    admission_id: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.nurse, UserRole.doctor, UserRole.admin)),
):
    stmt = select(VitalSigns)
    if patient_id:
        stmt = stmt.where(VitalSigns.patient_id == patient_id)
    if admission_id:
        stmt = stmt.where(VitalSigns.admission_id == admission_id)
    stmt = stmt.order_by(VitalSigns.charted_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/notes", response_model=NursingNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_note(
    body: NursingNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.nurse, UserRole.admin)),
):
    note = NursingNote(
        id=str(uuid.uuid4()),
        nurse_id=current_user.id,
        **body.model_dump(),
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


@router.get("/notes", response_model=list[NursingNoteResponse])
async def list_notes(
    patient_id: str | None = Query(None),
    admission_id: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.nurse, UserRole.doctor, UserRole.admin)),
):
    stmt = select(NursingNote)
    if patient_id:
        stmt = stmt.where(NursingNote.patient_id == patient_id)
    if admission_id:
        stmt = stmt.where(NursingNote.admission_id == admission_id)
    stmt = stmt.order_by(NursingNote.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/mar", response_model=MARResponse, status_code=status.HTTP_201_CREATED)
async def record_mar(
    body: MARCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.nurse, UserRole.admin)),
):
    mar = MedicationAdministration(
        id=str(uuid.uuid4()),
        administered_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(mar)
    await db.flush()
    await db.refresh(mar)
    return mar


@router.get("/mar", response_model=list[MARResponse])
async def list_mar(
    patient_id: str | None = Query(None),
    prescription_item_id: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.nurse, UserRole.doctor, UserRole.pharmacist, UserRole.admin)),
):
    stmt = select(MedicationAdministration)
    if patient_id:
        stmt = stmt.where(MedicationAdministration.patient_id == patient_id)
    if prescription_item_id:
        stmt = stmt.where(MedicationAdministration.prescription_item_id == prescription_item_id)
    stmt = stmt.order_by(MedicationAdministration.scheduled_time.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()
