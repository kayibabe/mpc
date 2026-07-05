from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import datetime
from app.models.mortuary import MortuaryStatus


class DeathRecordCreate(BaseModel):
    patient_id: str
    encounter_id: str | None = None
    admission_id: str | None = None
    date_of_death: datetime
    place_of_death: str | None = None
    immediate_cause: str
    underlying_cause: str | None = None
    contributing_conditions: str | None = None
    notes: str | None = None

    @field_validator("immediate_cause")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class MortuaryIntakeCreate(BaseModel):
    tag_number: str
    compartment: str | None = None

    @field_validator("tag_number")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class FamilyNotificationCreate(BaseModel):
    notified_person_name: str
    notified_person_relationship: str
    notified_person_phone: str | None = None

    @field_validator("notified_person_name", "notified_person_relationship")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class BodyReleaseCreate(BaseModel):
    released_to_name: str
    released_to_relationship: str
    released_to_id_number: str

    @field_validator("released_to_name", "released_to_relationship", "released_to_id_number")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class DeathRecordResponse(BaseModel):
    id: str
    patient_id: str
    encounter_id: str | None
    admission_id: str | None
    date_of_death: datetime
    place_of_death: str | None
    immediate_cause: str
    underlying_cause: str | None
    contributing_conditions: str | None
    certificate_number: str
    certified_by_id: str
    certified_at: datetime
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MortuaryAdmissionResponse(BaseModel):
    id: str
    death_record_id: str
    tag_number: str
    compartment: str | None
    received_by_id: str
    received_at: datetime
    status: MortuaryStatus
    family_notified: bool
    notified_person_name: str | None
    notified_person_relationship: str | None
    notified_person_phone: str | None
    notified_at: datetime | None
    notified_by_id: str | None
    release_permit_number: str | None
    released_to_name: str | None
    released_to_relationship: str | None
    released_to_id_number: str | None
    released_at: datetime | None
    released_by_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeathRecordDetailResponse(DeathRecordResponse):
    mortuary_admission: MortuaryAdmissionResponse | None = None
