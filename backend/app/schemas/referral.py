from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import datetime
from app.models.referral import ReferralUrgency, ReferralStatus


class ReferralCreate(BaseModel):
    encounter_id: str
    patient_id: str
    destination_facility: str
    destination_department: str | None = None
    urgency: ReferralUrgency = ReferralUrgency.routine
    reason: str
    letter_text: str | None = None

    @field_validator("destination_facility", "reason")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class ReferralFeedbackUpdate(BaseModel):
    status: ReferralStatus
    accepting_provider: str | None = None
    feedback_notes: str | None = None


class ReferralResponse(BaseModel):
    id: str
    encounter_id: str
    patient_id: str
    referred_by_id: str
    destination_facility: str
    destination_department: str | None
    urgency: ReferralUrgency
    reason: str
    letter_text: str | None
    status: ReferralStatus
    accepting_provider: str | None
    feedback_notes: str | None
    feedback_date: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
