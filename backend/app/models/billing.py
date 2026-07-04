from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum, Text, ForeignKey, Numeric, Boolean, Sequence
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    paid = "paid"
    partial = "partial"
    void = "void"


class PaymentMode(str, enum.Enum):
    cash = "cash"
    insurance = "insurance"
    mpesa = "mpesa"
    bank = "bank"
    credit = "credit"


class LineItemType(str, enum.Enum):
    consultation = "consultation"
    lab_test = "lab_test"
    drug = "drug"
    bed_day = "bed_day"
    procedure = "procedure"
    other = "other"


inv_seq = Sequence("inv_seq", metadata=Base.metadata, start=1)
rct_seq = Sequence("rct_seq", metadata=Base.metadata, start=1)


class BillingInvoice(Base):
    __tablename__ = "billing_invoices"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id"), nullable=False, index=True)
    invoice_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    payment_mode: Mapped[PaymentMode] = mapped_column(SAEnum(PaymentMode), default=PaymentMode.cash, nullable=False)
    insurance_claim_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    status: Mapped[InvoiceStatus] = mapped_column(SAEnum(InvoiceStatus), default=InvoiceStatus.draft, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    patient: Mapped["Patient"] = relationship(back_populates="billing_invoices")
    encounter: Mapped["Encounter"] = relationship(back_populates="billing_invoices")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    line_items: Mapped[list["BillingLineItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class BillingLineItem(Base):
    __tablename__ = "billing_line_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id: Mapped[str] = mapped_column(ForeignKey("billing_invoices.id"), nullable=False, index=True)
    item_type: Mapped[LineItemType] = mapped_column(SAEnum(LineItemType), nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    charge_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    invoice: Mapped["BillingInvoice"] = relationship(back_populates="line_items")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id: Mapped[str] = mapped_column(ForeignKey("billing_invoices.id"), nullable=False, index=True)
    # Nullable for payments recorded before receipts existed; always set on new payments.
    receipt_number: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[PaymentMode] = mapped_column(SAEnum(PaymentMode), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    received_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    invoice: Mapped["BillingInvoice"] = relationship(back_populates="payments")
    received_by: Mapped["User"] = relationship(foreign_keys=[received_by_id])

