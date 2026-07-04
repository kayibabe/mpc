from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone, date
from sqlalchemy import (
    String, DateTime, Date, Enum as SAEnum, Text, ForeignKey, Numeric, Boolean,
    Sequence, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


claim_seq = Sequence("claim_seq", metadata=Base.metadata, start=1)
preauth_seq = Sequence("preauth_seq", metadata=Base.metadata, start=1)


class PayerType(str, enum.Enum):
    insurance = "insurance"
    medical_scheme = "medical_scheme"


class MemberStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    expired = "expired"


class PreAuthStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"


class ClaimStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    partially_approved = "partially_approved"
    rejected = "rejected"
    settled = "settled"


class Insurer(Base):
    __tablename__ = "insurers"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    payer_type: Mapped[PayerType] = mapped_column(SAEnum(PayerType), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    members: Mapped[list["SchemeMember"]] = relationship(back_populates="insurer", cascade="all, delete-orphan")
    claims: Mapped[list["InsuranceClaim"]] = relationship(back_populates="insurer")


class SchemeMember(Base):
    __tablename__ = "scheme_members"
    __table_args__ = (UniqueConstraint("insurer_id", "member_number", name="uq_member_per_insurer"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    insurer_id: Mapped[str] = mapped_column(ForeignKey("insurers.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    member_number: Mapped[str] = mapped_column(String(50), nullable=False)
    plan_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[MemberStatus] = mapped_column(SAEnum(MemberStatus), default=MemberStatus.active, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    insurer: Mapped["Insurer"] = relationship(back_populates="members")
    patient: Mapped["Patient"] = relationship()


class PreAuthorization(Base):
    __tablename__ = "pre_authorizations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    auth_number: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    insurer_id: Mapped[str] = mapped_column(ForeignKey("insurers.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("scheme_members.id"), nullable=True, index=True)
    service_description: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[PreAuthStatus] = mapped_column(
        SAEnum(PreAuthStatus), default=PreAuthStatus.requested, nullable=False
    )
    decision_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    insurer: Mapped["Insurer"] = relationship()
    patient: Mapped["Patient"] = relationship()
    requested_by: Mapped["User"] = relationship(foreign_keys=[requested_by_id])


class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("billing_invoices.id"), nullable=False, index=True)
    insurer_id: Mapped[str] = mapped_column(ForeignKey("insurers.id"), nullable=False, index=True)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("scheme_members.id"), nullable=True, index=True)
    preauth_id: Mapped[str | None] = mapped_column(ForeignKey("pre_authorizations.id"), nullable=True, index=True)
    claimed_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    copay_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    approved_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[ClaimStatus] = mapped_column(SAEnum(ClaimStatus), default=ClaimStatus.draft, nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    insurer: Mapped["Insurer"] = relationship(back_populates="claims")
    invoice: Mapped["BillingInvoice"] = relationship()
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
