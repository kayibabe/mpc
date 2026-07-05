from __future__ import annotations

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum, Text, ForeignKey, Numeric, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class LabOrderStatus(str, enum.Enum):
    ordered = "ordered"
    sample_collected = "sample_collected"
    processing = "processing"
    resulted = "resulted"
    verified = "verified"
    cancelled = "cancelled"


class LabPriority(str, enum.Enum):
    routine = "routine"
    urgent = "urgent"
    stat = "stat"


class ResultFlag(str, enum.Enum):
    normal = "normal"
    low = "low"
    high = "high"
    critical_low = "critical_low"
    critical_high = "critical_high"


class LabTest(Base):
    __tablename__ = "lab_tests"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    normal_range_text: Mapped[str | None] = mapped_column(String(200), nullable=True)
    normal_range_male_min: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    normal_range_male_max: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    normal_range_female_min: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    normal_range_female_max: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sample_type: Mapped[str] = mapped_column(String(100), nullable=False)
    turnaround_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    order_items: Mapped[list["LabOrderItem"]] = relationship(back_populates="test", cascade="all, delete-orphan")


class LabOrder(Base):
    __tablename__ = "lab_orders"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    ordered_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[LabOrderStatus] = mapped_column(SAEnum(LabOrderStatus), default=LabOrderStatus.ordered, nullable=False)
    priority: Mapped[LabPriority] = mapped_column(SAEnum(LabPriority), default=LabPriority.routine, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    encounter: Mapped["Encounter"] = relationship(back_populates="lab_orders")
    patient: Mapped["Patient"] = relationship(back_populates="lab_orders")
    ordered_by: Mapped["User"] = relationship(foreign_keys=[ordered_by_id])
    order_items: Mapped[list["LabOrderItem"]] = relationship(back_populates="lab_order", cascade="all, delete-orphan")


class LabOrderItem(Base):
    __tablename__ = "lab_order_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    lab_order_id: Mapped[str] = mapped_column(ForeignKey("lab_orders.id"), nullable=False, index=True)
    test_id: Mapped[str] = mapped_column(ForeignKey("lab_tests.id"), nullable=False, index=True)
    sample_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sample_collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    result_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_range: Mapped[str | None] = mapped_column(String(200), nullable=True)
    result_flag: Mapped[ResultFlag | None] = mapped_column(SAEnum(ResultFlag), nullable=True)
    resulted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    lab_order: Mapped["LabOrder"] = relationship(back_populates="order_items")
    test: Mapped["LabTest"] = relationship(back_populates="order_items")
    verified_by: Mapped["User | None"] = relationship(foreign_keys=[verified_by_id])

