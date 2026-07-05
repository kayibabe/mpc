from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import datetime
from app.models.theatre import TheatreCaseStatus


class TheatreCaseCreate(BaseModel):
    patient_id: str
    encounter_id: str
    admission_id: str | None = None  # day cases have no admission
    surgeon_id: str
    anaesthetist_id: str | None = None
    theatre_room: str = "Theatre 1"
    procedure_name: str
    procedure_code: str | None = None
    scheduled_start: datetime
    estimated_duration_minutes: int = 60

    @field_validator("procedure_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()

    @field_validator("estimated_duration_minutes")
    @classmethod
    def sensible_duration(cls, v: int) -> int:
        if not 15 <= v <= 480:
            raise ValueError("estimated_duration_minutes must be between 15 and 480")
        return v


class PreOpChecklistCreate(BaseModel):
    consent_signed: bool
    fasting_confirmed: bool
    site_marked: bool
    anaesthesia_review_done: bool
    bloods_available: bool
    notes: str | None = None


class PostOpCreate(BaseModel):
    operation_notes: str
    findings: str | None = None
    complications: str | None = None

    @field_validator("operation_notes")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class CompleteCase(BaseModel):
    recovery_notes: str | None = None


class CancelCase(BaseModel):
    cancellation_reason: str

    @field_validator("cancellation_reason")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class PreOpChecklistResponse(BaseModel):
    id: str
    case_id: str
    consent_signed: bool
    fasting_confirmed: bool
    site_marked: bool
    anaesthesia_review_done: bool
    bloods_available: bool
    notes: str | None
    completed_by_id: str
    completed_at: datetime

    model_config = {"from_attributes": True}


class TheatreCaseResponse(BaseModel):
    id: str
    patient_id: str
    encounter_id: str
    admission_id: str | None
    surgeon_id: str
    anaesthetist_id: str | None
    theatre_room: str
    procedure_name: str
    procedure_code: str | None
    scheduled_start: datetime
    estimated_duration_minutes: int
    status: TheatreCaseStatus
    cancellation_reason: str | None
    operation_notes: str | None
    findings: str | None
    complications: str | None
    operation_started_at: datetime | None
    operation_ended_at: datetime | None
    recovery_notes: str | None
    recovery_discharged_at: datetime | None
    created_by_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TheatreCaseDetailResponse(TheatreCaseResponse):
    checklist: PreOpChecklistResponse | None = None
