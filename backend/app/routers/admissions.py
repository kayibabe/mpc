from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.admission import Ward, Bed, Admission, BedStatus, AdmissionStatus
from app.schemas.admission import (
    WardCreate, BedCreate, AdmissionCreate, DischargeCreate,
    WardResponse, BedResponse, AdmissionListResponse, AdmissionResponse,
)
import uuid

router = APIRouter(prefix="/admissions", tags=["admissions"])


@router.get("/wards", response_model=list[WardResponse])
async def list_wards(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.midwife, UserRole.admin)),
):
    result = await db.execute(select(Ward).where(Ward.is_active == True).order_by(Ward.name))
    wards = result.scalars().all()
    out = []
    for ward in wards:
        beds_result = await db.execute(select(Bed).where(Bed.ward_id == ward.id).order_by(Bed.bed_number))
        beds = beds_result.scalars().all()
        out.append(WardResponse(
            **{c.name: getattr(ward, c.name) for c in Ward.__table__.columns},
            beds=[BedResponse.model_validate(b) for b in beds],
        ))
    return out


@router.post("/wards", response_model=WardResponse, status_code=status.HTTP_201_CREATED)
async def create_ward(
    body: WardCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    ward = Ward(id=str(uuid.uuid4()), **body.model_dump())
    db.add(ward)
    await db.flush()
    await db.refresh(ward)
    return WardResponse(**{c.name: getattr(ward, c.name) for c in Ward.__table__.columns}, beds=[])


@router.post("/wards/{ward_id}/beds", response_model=BedResponse, status_code=status.HTTP_201_CREATED)
async def add_bed(
    ward_id: str,
    body: BedCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    ward_result = await db.execute(select(Ward).where(Ward.id == ward_id))
    if not ward_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Ward not found")
    bed = Bed(id=str(uuid.uuid4()), ward_id=ward_id, **body.model_dump())
    db.add(bed)
    await db.flush()
    await db.refresh(bed)
    return bed


@router.get("", response_model=list[AdmissionListResponse])
async def list_admissions(
    patient_id: str | None = Query(None),
    ward_id: str | None = Query(None),
    status: AdmissionStatus | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.midwife, UserRole.admin)),
):
    stmt = select(Admission)
    if patient_id:
        stmt = stmt.where(Admission.patient_id == patient_id)
    if ward_id:
        stmt = stmt.where(Admission.ward_id == ward_id)
    if status:
        stmt = stmt.where(Admission.status == status)
    else:
        stmt = stmt.where(Admission.status == AdmissionStatus.admitted)
    stmt = stmt.order_by(Admission.admission_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=AdmissionResponse, status_code=status.HTTP_201_CREATED)
async def admit_patient(
    body: AdmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.admin)),
):
    bed_result = await db.execute(select(Bed).where(Bed.id == body.bed_id))
    bed = bed_result.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    if bed.status != BedStatus.available:
        raise HTTPException(status_code=409, detail="Bed is not available")

    admission = Admission(
        id=str(uuid.uuid4()),
        patient_id=body.patient_id,
        encounter_id=body.encounter_id,
        ward_id=body.ward_id,
        bed_id=body.bed_id,
        admitting_doctor_id=current_user.id,
        admission_date=datetime.now(timezone.utc),
    )
    db.add(admission)
    await db.flush()

    bed.status = BedStatus.occupied
    bed.current_admission_id = admission.id

    await db.flush()
    await db.refresh(admission)
    return admission


@router.get("/{admission_id}", response_model=AdmissionResponse)
async def get_admission(
    admission_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.admin)),
):
    result = await db.execute(select(Admission).where(Admission.id == admission_id))
    admission = result.scalar_one_or_none()
    if not admission:
        raise HTTPException(status_code=404, detail="Admission not found")
    return admission


@router.post("/{admission_id}/discharge", response_model=AdmissionResponse)
async def discharge_patient(
    admission_id: str,
    body: DischargeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.admin)),
):
    result = await db.execute(select(Admission).where(Admission.id == admission_id))
    admission = result.scalar_one_or_none()
    if not admission:
        raise HTTPException(status_code=404, detail="Admission not found")
    if admission.status != AdmissionStatus.admitted:
        raise HTTPException(status_code=400, detail="Patient is not currently admitted")

    admission.status = AdmissionStatus.discharged
    admission.discharge_date = datetime.now(timezone.utc)
    admission.discharge_type = body.discharge_type
    admission.discharge_summary = body.discharge_summary
    admission.updated_at = datetime.now(timezone.utc)

    bed_result = await db.execute(select(Bed).where(Bed.id == admission.bed_id))
    bed = bed_result.scalar_one_or_none()
    if bed:
        bed.status = BedStatus.available
        bed.current_admission_id = None

    await db.flush()
    await db.refresh(admission)
    return admission



