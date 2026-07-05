from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum, Text, ForeignKey, Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class MARStatus(str, enum.Enum):
    given = "given"
    held = "held"
    refused = "refused"
    missed = "missed"


class VitalSigns(Base):
    __tablename__ = "vital_signs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    admission_id: Mapped[str] = mapped_column(ForeignKey("admissions.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    nurse_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    bp_systolic: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bp_diastolic: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pulse: Mapped[int | None] = mapped_column(Integer, nullable=True)
    temperature: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    spo2: Mapped[int | None] = mapped_column(Integer, nullable=True)
    respiratory_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    urine_output_ml: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fluid_intake_ml: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gcs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    charted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    admission: Mapped["Admission"] = relationship(back_populates="vital_signs")
    patient: Mapped["Patient"] = relationship(back_populates="vital_signs")
    nurse: Mapped["User"] = relationship(foreign_keys=[nurse_id])


class MedicationAdministration(Base):
    __tablename__ = "medication_administrations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_item_id: Mapped[str] = mapped_column(ForeignKey("prescription_items.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    administered_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    scheduled_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    administered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dose_given: Mapped[str | None] = mapped_column(String(100), nullable=True)
    route: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[MARStatus] = mapped_column(SAEnum(MARStatus), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    prescription_item: Mapped["PrescriptionItem"] = relationship(back_populates="administrations")
    patient: Mapped["Patient"] = relationship(back_populates="medication_administrations")
    administered_by: Mapped["User"] = relationship(foreign_keys=[administered_by_id])


class NursingNote(Base):
    __tablename__ = "nursing_notes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    admission_id: Mapped[str] = mapped_column(ForeignKey("admissions.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    nurse_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    shift: Mapped[str] = mapped_column(String(20), nullable=False)
    # "routine" progress note or end-of-shift "handover" note
    note_type: Mapped[str] = mapped_column(String(20), default="routine", nullable=False)
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    admission: Mapped["Admission"] = relationship(back_populates="nursing_notes")
    patient: Mapped["Patient"] = relationship(back_populates="nursing_notes")
    nurse: Mapped["User"] = relationship(foreign_keys=[nurse_id])

