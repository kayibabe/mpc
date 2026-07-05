from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import datetime, date
from app.models.insurance import PayerType, MemberStatus, PreAuthStatus, ClaimStatus


class InsurerCreate(BaseModel):
    name: str
    payer_type: PayerType
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None

    @field_validator("name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class InsurerResponse(BaseModel):
    id: str
    name: str
    payer_type: PayerType
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberCreate(BaseModel):
    insurer_id: str
    patient_id: str
    member_number: str
    plan_name: str | None = None
    valid_from: date
    valid_to: date | None = None
    status: MemberStatus = MemberStatus.active

    @field_validator("member_number")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()


class MemberResponse(BaseModel):
    id: str
    insurer_id: str
    patient_id: str
    member_number: str
    plan_name: str | None
    valid_from: date
    valid_to: date | None
    status: MemberStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PreAuthCreate(BaseModel):
    insurer_id: str
    patient_id: str
    member_id: str | None = None
    service_description: str
    estimated_amount: float

    @field_validator("service_description")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()

    @field_validator("estimated_amount")
    @classmethod
    def positive_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("estimated_amount must be greater than zero")
        return v


class PreAuthDecision(BaseModel):
    status: PreAuthStatus
    decision_notes: str | None = None


class PreAuthResponse(BaseModel):
    id: str
    auth_number: str | None
    insurer_id: str
    patient_id: str
    member_id: str | None
    service_description: str
    estimated_amount: float
    status: PreAuthStatus
    decision_notes: str | None
    requested_by_id: str
    decided_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClaimCreate(BaseModel):
    invoice_id: str
    insurer_id: str
    member_id: str | None = None
    preauth_id: str | None = None
    copay_amount: float = 0

    @field_validator("copay_amount")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("copay_amount cannot be negative")
        return v


class ClaimDecision(BaseModel):
    status: ClaimStatus
    approved_amount: float | None = None
    rejection_reason: str | None = None


class ClaimResponse(BaseModel):
    id: str
    claim_number: str
    invoice_id: str
    insurer_id: str
    member_id: str | None
    preauth_id: str | None
    claimed_amount: float
    copay_amount: float
    approved_amount: float | None
    status: ClaimStatus
    rejection_reason: str | None
    submitted_at: datetime | None
    decided_at: datetime | None
    settled_at: datetime | None
    created_by_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
