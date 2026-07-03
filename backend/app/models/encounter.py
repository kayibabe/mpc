from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum as SAEnum, Text, ForeignKey, Numeric, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class EncounterType(str, enum.Enum):
    opd = "opd"
    ipd = "ipd"
    emergency = "emergency"


class EncounterStatus(str, enum.Enum):
    open = "open"
    closed = "closed"
    referred = "referred"


class TriageCategory(str, enum.Enum):
    immediate = "immediate"
    urgent = "urgent"
    non_urgent = "non_urgent"


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    encounter_type: Mapped[EncounterType] = mapped_column(SAEnum(EncounterType), nullable=False)
    encounter_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attending_doctor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[EncounterStatus] = mapped_column(SAEnum(EncounterStatus), default=EncounterStatus.open, nullable=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
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
    patient: Mapped["Patient"] = relationship(back_populates="encounters")
    attending_doctor: Mapped["User | None"] = relationship(foreign_keys=[attending_doctor_id])
    created_by_user: Mapped["User"] = relationship(foreign_keys=[created_by])
    triage_assessment: Mapped["TriageAssessment | None"] = relationship(back_populates="encounter", uselist=False)
    clinical_notes: Mapped[list["ClinicalNote"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    lab_orders: Mapped[list["LabOrder"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    prescriptions: Mapped[list["Prescription"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    billing_invoices: Mapped[list["BillingInvoice"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    admissions: Mapped[list["Admission"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")


class TriageAssessment(Base):
    __tablename__ = "triage_assessments"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id"), nullable=False, unique=True)
    nurse_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    bp_systolic: Mapped[int | None] = mapped_column(nullable=True)
    bp_diastolic: Mapped[int | None] = mapped_column(nullable=True)
    pulse: Mapped[int | None] = mapped_column(nullable=True)
    temperature: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    spo2: Mapped[int | None] = mapped_column(nullable=True)
    weight: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    height: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    respiratory_rate: Mapped[int | None] = mapped_column(nullable=True)
    pain_score: Mapped[int | None] = mapped_column(nullable=True)
    triage_category: Mapped[TriageCategory] = mapped_column(SAEnum(TriageCategory), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    encounter: Mapped["Encounter"] = relationship(back_populates="triage_assessment")
    nurse: Mapped["User"] = relationship(foreign_keys=[nurse_id])


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id"), nullable=False, index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    subjective: Mapped[str | None] = mapped_column(Text, nullable=True)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnoses: Mapped[list | None] = mapped_column(JSON, nullable=True)
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
    encounter: Mapped["Encounter"] = relationship(back_populates="clinical_notes")
    author: Mapped["User"] = relationship(foreign_keys=[author_id])

