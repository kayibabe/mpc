from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, text
from datetime import datetime, timezone, date
from app.core.database import get_db
from app.core.auth import require_role
from app.core.audit import log_action
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientListResponse
import uuid

router = APIRouter(prefix="/patients", tags=["patients"])


def _generate_mrn(seq_val: int) -> str:
    return f"ZCPC{str(seq_val).zfill(6)}"


async def _next_mrn_seq(db: AsyncSession) -> int:
    """Postgres uses the mrn_seq sequence (atomic, gap-free). SQLite (dev/tests)
    has no sequences — fall back to row count + 1 (patients are append-only)."""
    if db.get_bind().dialect.name == "postgresql":
        return (await db.execute(text("SELECT nextval('mrn_seq')"))).scalar_one()
    from sqlalchemy import func
    count = (await db.execute(select(func.count()).select_from(Patient))).scalar_one()
    return count + 1


@router.get("", response_model=list[PatientListResponse])
async def list_patients(
    q: str | None = Query(None, max_length=100, description="Search by name, MRN, or phone"),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse, UserRole.clinician)),
):
    stmt = select(Patient).where(Patient.is_deleted == False)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Patient.first_name.ilike(pattern),
                Patient.last_name.ilike(pattern),
                Patient.mrn.ilike(pattern),
                Patient.phone.ilike(pattern),
            )
        )
    stmt = stmt.order_by(Patient.last_name, Patient.first_name).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    body: PatientCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.receptionist)),
):
    # S12 — Under-18 consent gate: if patient is a minor, consent and a guardian
    # contact are mandatory. Enforced here rather than in the schema so the check
    # has access to today's date and remains consistent across all call sites.
    if body.date_of_birth is not None:
        today = date.today()
        age_years = (today - body.date_of_birth).days // 365
        if age_years < 18:
            if not body.consent_given:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Patients under 18 require consent_given=true (MDA 2024 §4.2). "
                           "A parent or guardian must give consent before registration proceeds.",
                )
            if not (body.emergency_contact_name or body.emergency_contact_phone):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Patients under 18 require a guardian contact "
                           "(emergency_contact_name or emergency_contact_phone).",
                )

    # S16 — Duplicate detection: block if an active patient with the same
    # phone AND last name already exists (case-insensitive). Returns the
    # existing MRN so the receptionist can look them up instead of re-registering.
    if body.phone:
        normalised_phone = "".join(c for c in body.phone if c.isdigit())
        dup_stmt = (
            select(Patient)
            .where(
                Patient.is_deleted == False,
                Patient.last_name.ilike(body.last_name),
            )
        )
        dup_result = await db.execute(dup_stmt)
        candidates = dup_result.scalars().all()
        for candidate in candidates:
            if candidate.phone:
                candidate_phone = "".join(c for c in candidate.phone if c.isdigit())
                if candidate_phone == normalised_phone:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "message": "A patient with this name and phone number already exists.",
                            "existing_mrn": candidate.mrn,
                            "existing_id": candidate.id,
                            "hint": "Look up the existing patient by MRN before registering a new record.",
                        },
                    )

    mrn = _generate_mrn(await _next_mrn_seq(db))

    patient = Patient(
        id=str(uuid.uuid4()),
        mrn=mrn,
        **body.model_dump(),
    )
    db.add(patient)
    await db.flush()
    await db.refresh(patient)

    await log_action(
        db, action="create", entity_type="patient",
        user_id=current_user.id, entity_id=patient.id,
        new_value={"mrn": mrn, "name": f"{patient.first_name} {patient.last_name}"},
        request=request,
    )
    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse, UserRole.clinician, UserRole.pharmacist, UserRole.lab_technician)),
):
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    body: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.receptionist)),
):
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    await log_action(db, action="update", entity_type="patient", user_id=current_user.id, entity_id=patient_id, request=None)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(patient, field, value)
    patient.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(patient)
    return patient
