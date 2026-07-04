from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.encounter import Encounter, EncounterStatus
from app.models.referral import Referral, ReferralStatus
from app.schemas.referral import ReferralCreate, ReferralFeedbackUpdate, ReferralResponse
import uuid

router = APIRouter(prefix="/referrals", tags=["referrals"])

_CAN_REFER = (UserRole.doctor, UserRole.clinician, UserRole.admin)


@router.post("", response_model=ReferralResponse, status_code=status.HTTP_201_CREATED)
async def create_referral(
    body: ReferralCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_CAN_REFER)),
):
    # Encounter must exist and still be open or already referred
    enc_result = await db.execute(select(Encounter).where(Encounter.id == body.encounter_id))
    encounter = enc_result.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    if encounter.status == EncounterStatus.closed:
        raise HTTPException(status_code=400, detail="Cannot add a referral to a closed encounter")

    referral = Referral(
        id=str(uuid.uuid4()),
        encounter_id=body.encounter_id,
        patient_id=body.patient_id,
        referred_by_id=current_user.id,
        destination_facility=body.destination_facility,
        destination_department=body.destination_department,
        urgency=body.urgency,
        reason=body.reason,
        letter_text=body.letter_text,
    )
    db.add(referral)

    # Mark the encounter as referred
    encounter.status = EncounterStatus.referred
    encounter.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(referral)
    return referral


@router.get("", response_model=list[ReferralResponse])
async def list_referrals(
    patient_id: str | None = Query(None),
    encounter_id: str | None = Query(None),
    status: ReferralStatus | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.clinician, UserRole.nurse, UserRole.admin)),
):
    stmt = select(Referral)
    if patient_id:
        stmt = stmt.where(Referral.patient_id == patient_id)
    if encounter_id:
        stmt = stmt.where(Referral.encounter_id == encounter_id)
    if status:
        stmt = stmt.where(Referral.status == status)
    stmt = stmt.order_by(Referral.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{referral_id}", response_model=ReferralResponse)
async def get_referral(
    referral_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.clinician, UserRole.nurse, UserRole.admin)),
):
    result = await db.execute(select(Referral).where(Referral.id == referral_id))
    referral = result.scalar_one_or_none()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    return referral


@router.patch("/{referral_id}/feedback", response_model=ReferralResponse)
async def update_referral_feedback(
    referral_id: str,
    body: ReferralFeedbackUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_CAN_REFER)),
):
    """Record the receiving facility's response (accepted/rejected/completed)."""
    result = await db.execute(select(Referral).where(Referral.id == referral_id))
    referral = result.scalar_one_or_none()
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    if referral.status == ReferralStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cannot update a cancelled referral")

    referral.status = body.status
    if body.accepting_provider is not None:
        referral.accepting_provider = body.accepting_provider
    if body.feedback_notes is not None:
        referral.feedback_notes = body.feedback_notes
    referral.feedback_date = datetime.now(timezone.utc)
    referral.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(referral)
    return referral
