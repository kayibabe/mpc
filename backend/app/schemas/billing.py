from pydantic import BaseModel, Field
from datetime import datetime
from app.models.billing import InvoiceStatus, PaymentMode, LineItemType


class LineItemCreate(BaseModel):
    item_type: LineItemType = LineItemType.other
    description: str
    quantity: float = Field(1.0, gt=0)
    unit_price: float = Field(..., ge=0)
    reference_id: str | None = None


class InvoiceCreate(BaseModel):
    patient_id: str
    encounter_id: str
    payment_mode: PaymentMode = PaymentMode.cash
    insurance_claim_number: str | None = None
    discount: float = Field(0.0, ge=0)
    notes: str | None = None
    line_items: list[LineItemCreate]


class InvoiceUpdate(BaseModel):
    status: InvoiceStatus | None = None
    discount: float | None = Field(None, ge=0)
    notes: str | None = None
    payment_mode: PaymentMode | None = None


class PaymentCreate(BaseModel):
    # gt=0: a zero or negative "payment" would silently reduce amount_paid /
    # manipulate balances (audit N3)
    amount: float = Field(..., gt=0)
    payment_mode: PaymentMode
    reference: str | None = None
    notes: str | None = None


class LineItemResponse(BaseModel):
    id: str
    item_type: LineItemType
    description: str
    quantity: float
    unit_price: float
    total_price: float
    reference_id: str | None
    is_billable: bool

    model_config = {"from_attributes": True}


class PaymentResponse(BaseModel):
    id: str
    invoice_id: str
    receipt_number: str | None = None
    amount: float
    payment_mode: PaymentMode
    reference: str | None
    received_by_id: str
    received_at: datetime
    notes: str | None

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    id: str
    invoice_number: str
    patient_id: str
    encounter_id: str
    invoice_date: datetime
    status: InvoiceStatus
    total: float
    amount_paid: float
    balance: float
    payment_mode: PaymentMode

    model_config = {"from_attributes": True}


class InvoiceResponse(InvoiceListResponse):
    discount: float
    tax: float
    subtotal: float
    insurance_claim_number: str | None
    notes: str | None
    created_by_id: str
    created_at: datetime
    updated_at: datetime
    line_items: list[LineItemResponse] = []
    payments: list[PaymentResponse] = []
