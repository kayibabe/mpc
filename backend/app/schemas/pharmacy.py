from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import datetime, date
from app.models.pharmacy import DrugForm, PrescriptionStatus


class DrugCreate(BaseModel):
    name: str
    generic_name: str | None = None
    category: str | None = None
    form: DrugForm
    strength: str | None = None
    unit_of_measure: str = "units"
    unit_price: float = 0.0
    reorder_level: int = 10
    is_controlled: bool = False
    contraindications: str | None = None

    @field_validator("unit_price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError("unit_price cannot be negative")
        return v

    @field_validator("reorder_level")
    @classmethod
    def validate_reorder(cls, v: int) -> int:
        if v < 0:
            raise ValueError("reorder_level cannot be negative")
        return v


class DrugStockCreate(BaseModel):
    batch_number: str
    expiry_date: date
    quantity_received: int
    purchase_price: float | None = None
    supplier: str | None = None
    received_date: date

    @field_validator("quantity_received")
    @classmethod
    def validate_qty(cls, v: int) -> int:
        if v < 1:
            raise ValueError("quantity_received must be at least 1")
        return v

    @field_validator("expiry_date")
    @classmethod
    def validate_expiry(cls, v: date) -> date:
        if v <= date.today():
            raise ValueError("expiry_date must be in the future")
        return v

    @field_validator("purchase_price")
    @classmethod
    def validate_price(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("purchase_price cannot be negative")
        return v


class PrescriptionItemCreate(BaseModel):
    drug_id: str
    dose: str
    frequency: str
    route: str = "oral"
    duration_days: int | None = None
    quantity: int
    instructions: str | None = None
    start_date: date | None = None

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v < 1:
            raise ValueError("quantity must be at least 1")
        return v

    @field_validator("duration_days")
    @classmethod
    def validate_duration(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("duration_days must be at least 1 if specified")
        return v

    @field_validator("route")
    @classmethod
    def validate_route(cls, v: str) -> str:
        valid_routes = {"oral", "iv", "im", "sc", "topical", "sublingual",
                        "rectal", "vaginal", "inhaled", "intranasal", "ophthalmic", "otic"}
        if v.lower() not in valid_routes:
            raise ValueError(f"route must be one of: {', '.join(sorted(valid_routes))}")
        return v.lower()


class PrescriptionCreate(BaseModel):
    encounter_id: str
    patient_id: str
    notes: str | None = None
    items: list[PrescriptionItemCreate]
    # Explicit clinician override of the allergy/contraindication block.
    # Overrides are audit-logged with the acting user.
    override_allergy_block: bool = False

    @field_validator("items")
    @classmethod
    def validate_items_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one prescription item is required")
        return v


class DispenseItemCreate(BaseModel):
    prescription_item_id: str
    quantity_dispensed: int

    @field_validator("quantity_dispensed")
    @classmethod
    def validate_qty(cls, v: int) -> int:
        if v < 1:
            raise ValueError("quantity_dispensed must be at least 1")
        return v


class DispenseCreate(BaseModel):
    items: list[DispenseItemCreate]
    override_allergy_block: bool = False

    @field_validator("items")
    @classmethod
    def validate_items_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one dispense item is required")
        return v


class DrugResponse(BaseModel):
    id: str
    name: str
    generic_name: str | None
    category: str | None
    form: DrugForm
    strength: str | None
    unit_of_measure: str
    unit_price: float
    reorder_level: int
    is_controlled: bool
    is_active: bool

    model_config = {"from_attributes": True}


class DrugStockResponse(BaseModel):
    id: str
    drug_id: str
    batch_number: str
    expiry_date: date
    quantity_received: int
    quantity_current: int
    purchase_price: float | None
    supplier: str | None
    received_date: date

    model_config = {"from_attributes": True}


class PrescriptionItemResponse(BaseModel):
    id: str
    prescription_id: str
    drug_id: str
    dose: str
    frequency: str
    route: str
    duration_days: int | None
    quantity: int
    dispensed_quantity: int
    instructions: str | None
    start_date: date | None
    end_date: date | None
    is_dispensed: bool
    dispensed_at: datetime | None

    model_config = {"from_attributes": True}


class PrescriptionListResponse(BaseModel):
    id: str
    encounter_id: str
    patient_id: str
    prescribed_by_id: str
    prescribed_at: datetime
    status: PrescriptionStatus
    notes: str | None

    model_config = {"from_attributes": True}


class PrescriptionResponse(PrescriptionListResponse):
    items: list[PrescriptionItemResponse] = []

