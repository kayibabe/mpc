from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum, Text, ForeignKey, Boolean, Sequence
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class MortuaryStatus(str, enum.Enum):
    admitted = "admitted"
    released = "released"


death_cert_seq = Sequence("death_cert_seq", metadata=Base.metadata, start=1)
burial_permit_seq = Sequence("burial_permit_seq", metadata=Base.metadata, start=1)


class DeathRecord(Base):
    __tablename__ = "death_records"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id: Mapped[str | None] = mapped_column(ForeignKey("encounters.id"), nullable=True, index=True)
    admission_id: Mapped[str | None] = mapped_column(ForeignKey("admissions.id"), nullable=True, index=True)

    date_of_death: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    place_of_death: Mapped[str | None] = mapped_column(String(150), nullable=True)
    immediate_cause: Mapped[str] = mapped_column(String(300), nullable=False)
    underlying_cause: Mapped[str | None] = mapped_column(String(300), nullable=True)
    contributing_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Official certificate number, format DC000001
    certificate_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    certified_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    certified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    patient: Mapped["Patient"] = relationship()
    certified_by: Mapped["User"] = relationship(foreign_keys=[certified_by_id])
    mortuary_admission: Mapped["MortuaryAdmission | None"] = relationship(
        back_populates="death_record", uselist=False, cascade="all, delete-orphan"
    )


class MortuaryAdmission(Base):
    __tablename__ = "mortuary_admissions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    death_record_id: Mapped[str] = mapped_column(
        ForeignKey("death_records.id"), nullable=False, unique=True
    )

    tag_number: Mapped[str] = mapped_column(String(30), nullable=False)
    compartment: Mapped[str | None] = mapped_column(String(30), nullable=True)
    received_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    status: Mapped[MortuaryStatus] = mapped_column(
        SAEnum(MortuaryStatus), default=MortuaryStatus.admitted, nullable=False
    )

    # Next-of-kin notification
    family_notified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notified_person_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    notified_person_relationship: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notified_person_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notified_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Body release / burial permit, format BRP000001
    release_permit_number: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    released_to_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    released_to_relationship: Mapped[str | None] = mapped_column(String(50), nullable=True)
    released_to_id_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)

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
    death_record: Mapped["DeathRecord"] = relationship(back_populates="mortuary_admission")
