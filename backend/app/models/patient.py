from __future__ import annotations

import uuid
import enum
from datetime import datetime, date, timezone
from sqlalchemy import String, Boolean, DateTime, Date, Enum as SAEnum, Text, Sequence
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

# PostgreSQL sequence for atomic, gap-free MRN generation
mrn_seq = Sequence("mrn_seq", metadata=Base.metadata, start=1)


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class BloodGroup(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    UNKNOWN = "unknown"


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    mrn: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    other_names: Mapped[str | None] = mapped_column(String(100), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[Gender] = mapped_column(SAEnum(Gender), nullable=False)
    blood_group: Mapped[BloodGroup] = mapped_column(SAEnum(BloodGroup), default=BloodGroup.UNKNOWN, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone_alt: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    village: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    emergency_contact_relation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    insurance_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    insurance_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    known_allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # MDA 2024: data-processing consent captured at registration
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    encounters: Mapped[list["Encounter"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    admissions: Mapped[list["Admission"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    lab_orders: Mapped[list["LabOrder"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    prescriptions: Mapped[list["Prescription"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    vital_signs: Mapped[list["VitalSigns"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    nursing_notes: Mapped[list["NursingNote"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    billing_invoices: Mapped[list["BillingInvoice"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    medication_administrations: Mapped[list["MedicationAdministration"]] = relationship(back_populates="patient", cascade="all, delete-orphan")


