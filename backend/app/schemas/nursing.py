from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import datetime
from app.models.nursing import MARStatus


class VitalSignsCreate(BaseModel):
    admission_id: str
    patient_id: str
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    pulse: int | None = None
    temperature: float | None = None
    spo2: int | None = None
    respiratory_rate: int | None = None
    urine_output_ml: int | None = None
    fluid_intake_ml: int | None = None
    gcs: int | None = None
    notes: str | None = None

    @field_validator("bp_systolic")
    @classmethod
    def validate_bp_systolic(cls, v: int | None) -> int | None:
        if v is not None and not (40 <= v <= 300):
            raise ValueError("bp_systolic must be between 40 and 300 mmHg")
        return v

    @field_validator("bp_diastolic")
    @classmethod
    def validate_bp_diastolic(cls, v: int | None) -> int | None:
        if v is not None and not (20 <= v <= 200):
            raise ValueError("bp_diastolic must be between 20 and 200 mmHg")
        return v

    @field_validator("pulse")
    @classmethod
    def validate_pulse(cls, v: int | None) -> int | None:
        if v is not None and not (20 <= v <= 250):
            raise ValueError("pulse must be between 20 and 250 bpm")
        return v

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, v: float | None) -> float | None:
        if v is not None and not (30.0 <= v <= 45.0):
            raise ValueError("temperature must be between 30.0 and 45.0 °C")
        return v

    @field_validator("spo2")
    @classmethod
    def validate_spo2(cls, v: int | None) -> int | None:
        if v is not None and not (0 <= v <= 100):
            raise ValueError("spo2 must be between 0 and 100 %")
        return v

    @field_validator("respiratory_rate")
    @classmethod
    def validate_rr(cls, v: int | None) -> int | None:
        if v is not None and not (5 <= v <= 60):
            raise ValueError("respiratory_rate must be between 5 and 60 breaths/min")
        return v

    @field_validator("gcs")
    @classmethod
    def validate_gcs(cls, v: int | None) -> int | None:
        if v is not None and not (3 <= v <= 15):
            raise ValueError("GCS must be between 3 and 15")
        return v


class NursingNoteCreate(BaseModel):
    admission_id: str
    patient_id: str
    shift: str
    note_type: str = "routine"
    note_text: str

    @field_validator("shift")
    @classmethod
    def validate_shift(cls, v: str) -> str:
        valid = {"day", "night", "evening", "morning", "afternoon"}
        if v.lower() not in valid:
            raise ValueError(f"shift must be one of: {', '.join(sorted(valid))}")
        return v.lower()

    @field_validator("note_type")
    @classmethod
    def validate_note_type(cls, v: str) -> str:
        valid = {"routine", "handover"}
        if v.lower() not in valid:
            raise ValueError(f"note_type must be one of: {', '.join(sorted(valid))}")
        return v.lower()


class MARCreate(BaseModel):
    prescription_item_id: str
    patient_id: str
    scheduled_time: datetime
    administered_at: datetime | None = None
    dose_given: str | None = None
    route: str | None = None
    status: MARStatus
    notes: str | None = None


class VitalSignsResponse(BaseModel):
    id: str
    admission_id: str
    patient_id: str
    nurse_id: str
    bp_systolic: int | None
    bp_diastolic: int | None
    pulse: int | None
    temperature: float | None
    spo2: int | None
    respiratory_rate: int | None
    urine_output_ml: int | None
    fluid_intake_ml: int | None
    gcs: int | None
    charted_at: datetime
    notes: str | None

    model_config = {"from_attributes": True}


class NursingNoteResponse(BaseModel):
    id: str
    admission_id: str
    patient_id: str
    nurse_id: str
    shift: str
    note_type: str
    note_text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MARResponse(BaseModel):
    id: str
    prescription_item_id: str
    patient_id: str
    administered_by_id: str
    scheduled_time: datetime
    administered_at: datetime | None
    dose_given: str | None
    route: str | None
    status: MARStatus
    notes: str | None

    model_config = {"from_attributes": True}

