from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class ReferralUrgency(str, enum.Enum):
    routine = "routine"
    urgent = "urgent"
    emergency = "emergency"


class ReferralStatus(str, enum.Enum):
    pending = "pending"       # letter written, patient not yet gone
    accepted = "accepted"     # receiving facility confirmed
    rejected = "rejected"     # receiving facility cannot take
    completed = "completed"   # patient seen at destination
    cancelled = "cancelled"   # referral withdrawn


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    referred_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    destination_facility: Mapped[str] = mapped_column(String(200), nullable=False)
    destination_department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    urgency: Mapped[ReferralUrgency] = mapped_column(
        SAEnum(ReferralUrgency), default=ReferralUrgency.routine, nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    letter_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[ReferralStatus] = mapped_column(
        SAEnum(ReferralStatus), default=ReferralStatus.pending, nullable=False
    )
    # Filled in when receiving facility responds
    accepting_provider: Mapped[str | None] = mapped_column(String(150), nullable=True)
    feedback_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
    encounter: Mapped["Encounter"] = relationship()
    patient: Mapped["Patient"] = relationship()
    referred_by: Mapped["User"] = relationship(foreign_keys=[referred_by_id])
