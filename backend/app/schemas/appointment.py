from __future__ import annotations
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from app.models.appointment import AppointmentType, AppointmentStatus


class AppointmentCreate(BaseModel):
    patient_id: str
    provider_id: str | None = None
    scheduled_datetime: datetime
    duration_minutes: int = Field(15, ge=5, le=480)
    appointment_type: AppointmentType = AppointmentType.opd
    visit_reason: str | None = None
    notes: str | None = None

    @field_validator("scheduled_datetime")
    @classmethod
    def must_be_future(cls, v: datetime) -> datetime:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        # Ensure timezone-aware; accept naive as UTC
        if v.tzinfo is None:
            from datetime import timezone
            v = v.replace(tzinfo=timezone.utc)
        if v <= now:
            raise ValueError("scheduled_datetime must be in the future")
        return v


class AppointmentUpdate(BaseModel):
    provider_id: str | None = None
    scheduled_datetime: datetime | None = None
    duration_minutes: int | None = Field(None, ge=5, le=480)
    appointment_type: AppointmentType | None = None
    visit_reason: str | None = None
    notes: str | None = None
    status: AppointmentStatus | None = None
    cancellation_reason: str | None = None

    @model_validator(mode="after")
    def cancellation_reason_requires_cancel(self) -> "AppointmentUpdate":
        if (
            self.cancellation_reason
            and self.status != AppointmentStatus.cancelled
        ):
            raise ValueError("cancellation_reason may only be set when status=cancelled")
        return self


class AppointmentCheckin(BaseModel):
    """Optional body for checkin — all fields optional."""
    encounter_type: str = "opd"
    chief_complaint: str | None = None


class AppointmentListResponse(BaseModel):
    id: str
    patient_id: str
    provider_id: str | None
    scheduled_datetime: datetime
    duration_minutes: int
    appointment_type: AppointmentType
    visit_reason: str | None
    status: AppointmentStatus
    encounter_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AppointmentResponse(BaseModel):
    id: str
    patient_id: str
    provider_id: str | None
    scheduled_datetime: datetime
    duration_minutes: int
    appointment_type: AppointmentType
    visit_reason: str | None
    status: AppointmentStatus
    cancellation_reason: str | None
    encounter_id: str | None
    notes: str | None
    created_by_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
