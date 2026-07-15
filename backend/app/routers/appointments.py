from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta, date
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.appointment import (
    Appointment, AppointmentStatus, AppointmentType,
    VALID_TRANSITIONS, TERMINAL_STATUSES,
)
from app.models.encounter import Encounter, EncounterType
from app.schemas.appointment import (
    AppointmentCreate, AppointmentUpdate, AppointmentCheckin,
    AppointmentListResponse, AppointmentResponse,
)
import uuid

router = APIRouter(prefix="/appointments", tags=["appointments"])

_BOOKING_ROLES = (
    UserRole.receptionist, UserRole.doctor, UserRole.clinician,
    UserRole.nurse, UserRole.midwife, UserRole.admin,
)


async def _check_double_booking(
    db: AsyncSession,
    provider_id: str,
    scheduled_datetime: datetime,
    duration_minutes: int,
    exclude_id: str | None = None,
) -> Appointment | None:
    """Return an existing conflicting appointment or None.

    Fetches all non-terminal provider appointments for the same calendar day
    and checks for time overlap in Python (SQLite-compatible; no interval arithmetic).
    """
    day_start = scheduled_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    stmt = (
        select(Appointment)
        .where(
            Appointment.provider_id == provider_id,
            Appointment.scheduled_datetime >= day_start,
            Appointment.scheduled_datetime < day_end,
            Appointment.status.notin_([
                AppointmentStatus.cancelled,
                AppointmentStatus.no_show,
            ]),
        )
    )
    if exclude_id:
        stmt = stmt.where(Appointment.id != exclude_id)

    result = await db.execute(stmt)
    candidates = result.scalars().all()

    new_start = scheduled_datetime
    new_end = scheduled_datetime + timedelta(minutes=duration_minutes)

    for appt in candidates:
        existing_start = appt.scheduled_datetime
        if existing_start.tzinfo is None:
            existing_start = existing_start.replace(tzinfo=timezone.utc)
        existing_end = existing_start + timedelta(minutes=appt.duration_minutes)
        # Overlap: new starts before existing ends AND new ends after existing starts
        if new_start < existing_end and new_end > existing_start:
            return appt
    return None


@router.post("", response_model=AppointmentResponse, status_code=http_status.HTTP_201_CREATED)
async def create_appointment(
    body: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_BOOKING_ROLES)),
):
    # Double-booking check when a specific provider is assigned
    if body.provider_id:
        conflict = await _check_double_booking(
            db, body.provider_id, body.scheduled_datetime, body.duration_minutes
        )
        if conflict:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail={
                    "message": "Provider already has an appointment that overlaps this time slot.",
                    "conflict_id": conflict.id,
                    "conflict_time": conflict.scheduled_datetime.isoformat(),
                    "conflict_duration_minutes": conflict.duration_minutes,
                },
            )

    appt = Appointment(
        id=str(uuid.uuid4()),
        patient_id=body.patient_id,
        provider_id=body.provider_id,
        scheduled_datetime=body.scheduled_datetime,
        duration_minutes=body.duration_minutes,
        appointment_type=body.appointment_type,
        visit_reason=body.visit_reason,
        notes=body.notes,
        created_by_id=current_user.id,
    )
    db.add(appt)
    await db.flush()
    await db.refresh(appt)
    return appt


@router.get("/today", response_model=list[AppointmentListResponse])
async def list_today_appointments(
    provider_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_BOOKING_ROLES)),
):
    """Today's appointment schedule. Providers default to their own schedule."""
    today = date.today()
    day_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    stmt = select(Appointment).where(
        Appointment.scheduled_datetime >= day_start,
        Appointment.scheduled_datetime < day_end,
    )
    # Providers (not receptionist/admin) default to their own schedule
    effective_provider = provider_id
    if effective_provider is None and current_user.role in (
        UserRole.doctor, UserRole.clinician, UserRole.nurse, UserRole.midwife
    ):
        effective_provider = current_user.id

    if effective_provider:
        stmt = stmt.where(Appointment.provider_id == effective_provider)

    stmt = stmt.order_by(Appointment.scheduled_datetime)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/availability", response_model=list[AppointmentListResponse])
async def provider_availability(
    provider_id: str = Query(...),
    check_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_BOOKING_ROLES)),
):
    """All active appointments for a provider on a given date (for slot display)."""
    day_start = datetime(check_date.year, check_date.month, check_date.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    stmt = (
        select(Appointment)
        .where(
            Appointment.provider_id == provider_id,
            Appointment.scheduled_datetime >= day_start,
            Appointment.scheduled_datetime < day_end,
            Appointment.status.notin_([AppointmentStatus.cancelled, AppointmentStatus.no_show]),
        )
        .order_by(Appointment.scheduled_datetime)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("", response_model=list[AppointmentListResponse])
async def list_appointments(
    patient_id: str | None = Query(None),
    provider_id: str | None = Query(None),
    appt_status: AppointmentStatus | None = Query(None, alias="status"),
    appointment_type: AppointmentType | None = Query(None),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_BOOKING_ROLES)),
):
    stmt = select(Appointment)
    if patient_id:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if provider_id:
        stmt = stmt.where(Appointment.provider_id == provider_id)
    if appt_status:
        stmt = stmt.where(Appointment.status == appt_status)
    if appointment_type:
        stmt = stmt.where(Appointment.appointment_type == appointment_type)
    if from_date:
        stmt = stmt.where(
            Appointment.scheduled_datetime >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        )
    if to_date:
        day_end = datetime(to_date.year, to_date.month, to_date.day, tzinfo=timezone.utc) + timedelta(days=1)
        stmt = stmt.where(Appointment.scheduled_datetime < day_end)
    stmt = stmt.order_by(Appointment.scheduled_datetime.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_BOOKING_ROLES)),
):
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: str,
    body: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_BOOKING_ROLES)),
):
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appt.status in TERMINAL_STATUSES:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"Appointment is {appt.status.value} and cannot be modified",
        )

    # Validate status transition
    if body.status is not None and body.status != appt.status:
        if body.status not in VALID_TRANSITIONS[appt.status]:
            allowed = [s.value for s in VALID_TRANSITIONS[appt.status]]
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot transition from {appt.status.value} to {body.status.value}. "
                       f"Allowed: {allowed}",
            )
        if body.status == AppointmentStatus.cancelled and not body.cancellation_reason:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="cancellation_reason is required when cancelling an appointment",
            )
        appt.status = body.status

    # Rescheduling — re-check double booking if time or provider changes
    new_time = body.scheduled_datetime or appt.scheduled_datetime
    new_duration = body.duration_minutes or appt.duration_minutes
    new_provider = body.provider_id if body.provider_id is not None else appt.provider_id

    time_or_provider_changed = (
        (body.scheduled_datetime is not None and body.scheduled_datetime != appt.scheduled_datetime)
        or (body.provider_id is not None and body.provider_id != appt.provider_id)
        or (body.duration_minutes is not None and body.duration_minutes != appt.duration_minutes)
    )
    if time_or_provider_changed and new_provider:
        # Ensure new_time is timezone-aware
        if new_time.tzinfo is None:
            new_time = new_time.replace(tzinfo=timezone.utc)
        conflict = await _check_double_booking(
            db, new_provider, new_time, new_duration, exclude_id=appointment_id
        )
        if conflict:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail={
                    "message": "Provider already has an appointment that overlaps this time slot.",
                    "conflict_id": conflict.id,
                    "conflict_time": conflict.scheduled_datetime.isoformat(),
                },
            )

    # Apply scalar field updates
    for field in ("provider_id", "scheduled_datetime", "duration_minutes",
                  "appointment_type", "visit_reason", "notes", "cancellation_reason"):
        val = getattr(body, field)
        if val is not None:
            setattr(appt, field, val)

    appt.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(appt)
    return appt


@router.post("/{appointment_id}/checkin", response_model=AppointmentResponse)
async def checkin_appointment(
    appointment_id: str,
    body: AppointmentCheckin = AppointmentCheckin(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_BOOKING_ROLES)),
):
    """Mark the patient as arrived. Creates an encounter if one is not yet linked."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appt.status not in (AppointmentStatus.scheduled, AppointmentStatus.confirmed):
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"Cannot check in an appointment with status={appt.status.value}. "
                   "Only scheduled or confirmed appointments can be checked in.",
        )

    # Create encounter if not already linked
    if appt.encounter_id is None:
        try:
            enc_type = EncounterType(body.encounter_type)
        except ValueError:
            enc_type = EncounterType.opd

        encounter = Encounter(
            id=str(uuid.uuid4()),
            patient_id=appt.patient_id,
            encounter_type=enc_type,
            encounter_date=datetime.now(timezone.utc),
            attending_doctor_id=appt.provider_id,
            chief_complaint=body.chief_complaint or appt.visit_reason,
            created_by=current_user.id,
        )
        db.add(encounter)
        await db.flush()
        appt.encounter_id = encounter.id

    appt.status = AppointmentStatus.arrived
    appt.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(appt)
    return appt


@router.delete("/{appointment_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def cancel_appointment(
    appointment_id: str,
    cancellation_reason: str = Query(..., description="Reason for cancellation"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_BOOKING_ROLES)),
):
    """Convenience DELETE — cancels the appointment with a required reason."""
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.status in TERMINAL_STATUSES:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"Appointment is already {appt.status.value}",
        )
    if AppointmentStatus.cancelled not in VALID_TRANSITIONS[appt.status]:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel an appointment with status={appt.status.value}",
        )
    appt.status = AppointmentStatus.cancelled
    appt.cancellation_reason = cancellation_reason
    appt.updated_at = datetime.now(timezone.utc)
    await db.flush()
