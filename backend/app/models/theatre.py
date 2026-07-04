from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum, Text, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class TheatreCaseStatus(str, enum.Enum):
    booked = "booked"           # slot reserved, checklist not yet done
    pre_op = "pre_op"           # pre-op checklist completed
    in_theatre = "in_theatre"   # operation in progress
    recovery = "recovery"       # operation ended, patient in recovery
    completed = "completed"     # discharged from recovery
    cancelled = "cancelled"     # case withdrawn


class TheatreCase(Base):
    __tablename__ = "theatre_cases"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id"), nullable=False, index=True)
    # Day cases have no admission
    admission_id: Mapped[str | None] = mapped_column(ForeignKey("admissions.id"), nullable=True, index=True)
    surgeon_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    anaesthetist_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    theatre_room: Mapped[str] = mapped_column(String(50), default="Theatre 1", nullable=False)
    procedure_name: Mapped[str] = mapped_column(String(200), nullable=False)
    procedure_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    status: Mapped[TheatreCaseStatus] = mapped_column(
        SAEnum(TheatreCaseStatus), default=TheatreCaseStatus.booked, nullable=False
    )
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Operation record
    operation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    complications: Mapped[str | None] = mapped_column(Text, nullable=True)
    operation_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    operation_ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Recovery record
    recovery_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recovery_discharged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
    patient: Mapped["Patient"] = relationship()
    encounter: Mapped["Encounter"] = relationship()
    surgeon: Mapped["User"] = relationship(foreign_keys=[surgeon_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    checklist: Mapped["PreOpChecklist | None"] = relationship(
        back_populates="case", cascade="all, delete-orphan", uselist=False
    )


class PreOpChecklist(Base):
    __tablename__ = "preop_checklists"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(ForeignKey("theatre_cases.id"), nullable=False, unique=True)

    consent_signed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    fasting_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    site_marked: Mapped[bool] = mapped_column(Boolean, nullable=False)
    anaesthesia_review_done: Mapped[bool] = mapped_column(Boolean, nullable=False)
    bloods_available: Mapped[bool] = mapped_column(Boolean, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    completed_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    case: Mapped["TheatreCase"] = relationship(back_populates="checklist")
