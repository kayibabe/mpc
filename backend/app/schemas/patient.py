from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import date, datetime
from app.models.patient import Gender, BloodGroup


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    other_names: str | None = None
    date_of_birth: date | None = None
    gender: Gender
    blood_group: BloodGroup = BloodGroup.UNKNOWN
    phone: str | None = None
    phone_alt: str | None = None
    email: str | None = None
    address: str | None = None
    village: str | None = None
    district: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    insurance_provider: str | None = None
    insurance_number: str | None = None
    known_allergies: str | None = None
    chronic_conditions: str | None = None
    consent_given: bool = False
    consent_date: datetime | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_names(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name fields cannot be empty")
        if len(v) > 100:
            raise ValueError("Name fields must be 100 characters or less")
        return v.strip()

    @field_validator("phone", "emergency_contact_phone", "phone_alt")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is not None:
            digits = ''.join(c for c in v if c.isdigit())
            if len(digits) < 7 or len(digits) > 15:
                raise ValueError("Phone number must have 7-15 digits")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is not None:
            if "@" not in v or "." not in v.split("@")[-1]:
                raise ValueError("Invalid email format")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, v: date | None) -> date | None:
        if v is not None and v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v


class PatientUpdate(PatientCreate):
    first_name: str | None = None
    last_name: str | None = None
    gender: Gender | None = None


class PatientResponse(BaseModel):
    id: str
    mrn: str
    first_name: str
    last_name: str
    other_names: str | None
    date_of_birth: date | None
    gender: Gender
    blood_group: BloodGroup
    phone: str | None
    phone_alt: str | None
    email: str | None
    address: str | None
    village: str | None
    district: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    emergency_contact_relation: str | None
    insurance_provider: str | None
    insurance_number: str | None
    known_allergies: str | None
    chronic_conditions: str | None
    consent_given: bool
    consent_date: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PatientListResponse(BaseModel):
    id: str
    mrn: str
    first_name: str
    last_name: str
    gender: Gender
    date_of_birth: date | None
    phone: str | None
    insurance_provider: str | None

    model_config = {"from_attributes": True}

