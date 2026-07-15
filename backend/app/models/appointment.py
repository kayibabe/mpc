from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Integer, DateTime, Enum as SAEnum, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class AppointmentType(str, enum.Enum):
    opd = "opd"
    follow_up = "follow_up"
    procedure = "procedure"
    antenatal = "antenatal"
    immunization = "immunization"
    other = "other"


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"    # booked, not yet confirmed
    confirmed = "confirmed"    # patient notified/confirmed
    arrived = "arrived"        # patient at reception
    in_progress = "in_progress"  # encounter opened
    completed = "completed"    # encounter closed
    cancelled = "cancelled"    # appointment removed
    no_show = "no_show"        # patient did not arrive


# Valid status transitions
VALID_TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.scheduled:   {AppointmentStatus.confirmed, AppointmentStatus.cancelled, AppointmentStatus.no_show},
    AppointmentStatus.confirmed:   {AppointmentStatus.arrived, AppointmentStatus.cancelled, AppointmentStatus.no_show},
    AppointmentStatus.arrived:     {AppointmentStatus.in_progress, AppointmentStatus.cancelled},
    AppointmentStatus.in_progress: {AppointmentStatus.completed, AppointmentStatus.cancelled},
    AppointmentStatus.completed:   set(),
    AppointmentStatus.cancelled:   set(),
    AppointmentStatus.no_show:     set(),
}

# Terminal states that block all edits
TERMINAL_STATUSES = {AppointmentStatus.completed, AppointmentStatus.cancelled, AppointmentStatus.no_show}


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(
        ForeignKey("patients.id"), nullable=False, index=True
    )
    # provider_id is the assigned clinician/doctor/nurse; nullable so walk-in
    # bookings can be created before a provider is assigned.
    provider_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    scheduled_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=15
    )
    appointment_type: Mapped[AppointmentType] = mapped_column(
        SAEnum(AppointmentType), nullable=False, default=AppointmentType.opd
    )
    visit_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(AppointmentStatus), nullable=False, default=AppointmentStatus.scheduled
    )
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Linked encounter — set when the patient checks in via POST /appointments/{id}/checkin
    encounter_id: Mapped[str | None] = mapped_column(
        ForeignKey("encounters.id"), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    patient: Mapped["Patient"] = relationship(foreign_keys=[patient_id])
    provider: Mapped["User | None"] = relationship(foreign_keys=[provider_id])
    encounter: Mapped["Encounter | None"] = relationship(foreign_keys=[encounter_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
