from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum, Text, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class WardType(str, enum.Enum):
    general = "general"
    maternity = "maternity"
    private = "private"
    icu = "icu"
    pediatric = "pediatric"


class BedStatus(str, enum.Enum):
    available = "available"
    occupied = "occupied"
    maintenance = "maintenance"


class AdmissionStatus(str, enum.Enum):
    admitted = "admitted"
    discharged = "discharged"
    transferred = "transferred"


class DischargeType(str, enum.Enum):
    normal = "normal"
    ama = "ama"
    death = "death"
    transfer = "transfer"
    absconded = "absconded"


class Ward(Base):
    __tablename__ = "wards"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    ward_type: Mapped[WardType] = mapped_column(SAEnum(WardType), nullable=False)
    total_beds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    floor: Mapped[str | None] = mapped_column(String(20), nullable=True)
    charge_per_day: Mapped[float | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    beds: Mapped[list["Bed"]] = relationship(back_populates="ward", cascade="all, delete-orphan")
    admissions: Mapped[list["Admission"]] = relationship(back_populates="ward", cascade="all, delete-orphan")


class Bed(Base):
    __tablename__ = "beds"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    ward_id: Mapped[str] = mapped_column(ForeignKey("wards.id"), nullable=False, index=True)
    bed_number: Mapped[str] = mapped_column(String(20), nullable=False)
    bed_type: Mapped[str] = mapped_column(String(50), default="general", nullable=False)
    status: Mapped[BedStatus] = mapped_column(SAEnum(BedStatus), default=BedStatus.available, nullable=False)
    current_admission_id: Mapped[str | None] = mapped_column(ForeignKey("admissions.id", use_alter=True), nullable=True, index=True)

    # Relationships
    ward: Mapped["Ward"] = relationship(back_populates="beds")
    current_admission: Mapped["Admission | None"] = relationship(foreign_keys=[current_admission_id])


class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id"), nullable=False, index=True)
    ward_id: Mapped[str] = mapped_column(ForeignKey("wards.id"), nullable=False, index=True)
    bed_id: Mapped[str] = mapped_column(ForeignKey("beds.id"), nullable=False, index=True)
    admitting_doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    admission_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    discharge_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    discharge_type: Mapped[DischargeType | None] = mapped_column(SAEnum(DischargeType), nullable=True)
    discharge_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AdmissionStatus] = mapped_column(SAEnum(AdmissionStatus), default=AdmissionStatus.admitted, nullable=False)
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
    patient: Mapped["Patient"] = relationship(back_populates="admissions")
    encounter: Mapped["Encounter"] = relationship(back_populates="admissions")
    ward: Mapped["Ward"] = relationship(back_populates="admissions")
    # Independent many-to-one via bed_id. NOT a back-reference of
    # Bed.current_admission — that uses a different FK (beds.current_admission_id)
    # and is its own many-to-one, so the two cannot back_populate each other.
    bed: Mapped["Bed"] = relationship(foreign_keys=[bed_id])
    admitting_doctor: Mapped["User"] = relationship(foreign_keys=[admitting_doctor_id])
    vital_signs: Mapped[list["VitalSigns"]] = relationship(back_populates="admission", cascade="all, delete-orphan")
    nursing_notes: Mapped[list["NursingNote"]] = relationship(back_populates="admission", cascade="all, delete-orphan")


