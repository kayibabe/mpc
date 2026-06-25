from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from datetime import datetime, timezone, date
from decimal import Decimal
from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.billing import BillingInvoice, BillingLineItem, Payment, InvoiceStatus, inv_seq
from app.schemas.billing import (
    InvoiceCreate, InvoiceUpdate, InvoiceListResponse, InvoiceResponse,
    LineItemResponse, PaymentCreate, PaymentResponse,
)
import uuid

router = APIRouter(prefix="/billing", tags=["billing"])


def _generate_invoice_number(seq_val: int) -> str:
    return f"INV{str(seq_val).zfill(6)}"


@router.get("/invoices", response_model=list[InvoiceListResponse])
async def list_invoices(
    patient_id: str | None = Query(None),
    status: InvoiceStatus | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.cashier, UserRole.admin)),
):
    stmt = select(BillingInvoice)
    if patient_id:
        stmt = stmt.where(BillingInvoice.patient_id == patient_id)
    if status:
        stmt = stmt.where(BillingInvoice.status == status)
    if date_from:
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import DATE
        stmt = stmt.where(cast(BillingInvoice.invoice_date, DATE) >= date_from)
    if date_to:
        from sqlalchemy import cast
        from sqlalchemy.dialects.postgresql import DATE
        stmt = stmt.where(cast(BillingInvoice.invoice_date, DATE) <= date_to)
    stmt = stmt.order_by(BillingInvoice.invoice_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.billing_clerk, UserRole.admin)),
):
    seq_result = await db.execute(text("SELECT nextval('inv_seq')"))
    invoice_number = _generate_invoice_number(seq_result.scalar_one())

    subtotal = sum(item.quantity * item.unit_price for item in body.line_items)
    discount = Decimal(str(body.discount))
    total = float(Decimal(str(subtotal)) - discount)

    invoice = BillingInvoice(
        id=str(uuid.uuid4()),
        invoice_number=invoice_number,
        patient_id=body.patient_id,
        encounter_id=body.encounter_id,
        payment_mode=body.payment_mode,
        insurance_claim_number=body.insurance_claim_number,
        subtotal=subtotal,
        discount=body.discount,
        tax=0.0,
        total=total,
        amount_paid=0.0,
        balance=total,
        status=InvoiceStatus.pending,
        notes=body.notes,
        created_by_id=current_user.id,
    )
    db.add(invoice)
    await db.flush()

    for item in body.line_items:
        line = BillingLineItem(
            id=str(uuid.uuid4()),
            invoice_id=invoice.id,
            item_type=item.item_type,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.quantity * item.unit_price,
            reference_id=item.reference_id,
        )
        db.add(line)

    await db.flush()
    await db.refresh(invoice)
    return await _invoice_with_relations(invoice.id, db)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.cashier, UserRole.admin)),
):
    inv = await _get_invoice_or_404(invoice_id, db)
    return await _invoice_with_relations(inv.id, db)


@router.put("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: str,
    body: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.admin)),
):
    invoice = await _get_invoice_or_404(invoice_id, db)
    if invoice.status == InvoiceStatus.void:
        raise HTTPException(status_code=400, detail="Cannot update a voided invoice")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(invoice, field, value)
    invoice.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return await _invoice_with_relations(invoice.id, db)


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    invoice_id: str,
    body: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.billing_clerk, UserRole.admin)),
):
    invoice = await _get_invoice_or_404(invoice_id, db)
    if invoice.status == InvoiceStatus.void:
        raise HTTPException(status_code=400, detail="Cannot accept payment on a voided invoice")

    payment = Payment(
        id=str(uuid.uuid4()),
        invoice_id=invoice_id,
        amount=body.amount,
        payment_mode=body.payment_mode,
        reference=body.reference,
        received_by_id=current_user.id,
        received_at=datetime.now(timezone.utc),
        notes=body.notes,
    )
    db.add(payment)

    new_paid = float(invoice.amount_paid) + body.amount
    new_balance = float(invoice.total) - new_paid
    invoice.amount_paid = new_paid
    invoice.balance = max(0.0, new_balance)
    if invoice.balance <= 0:
        invoice.status = InvoiceStatus.paid
    elif new_paid > 0:
        invoice.status = InvoiceStatus.partial
    invoice.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(payment)
    return payment


@router.get("/summary")
async def billing_summary(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.admin)),
):
    stmt = select(
        func.sum(BillingInvoice.total).label("total_billed"),
        func.sum(BillingInvoice.amount_paid).label("total_collected"),
        func.sum(BillingInvoice.balance).label("total_outstanding"),
        func.count(BillingInvoice.id).label("invoice_count"),
    ).where(BillingInvoice.status != InvoiceStatus.void)
    result = await db.execute(stmt)
    row = result.one()
    return {
        "total_billed": float(row.total_billed or 0),
        "total_collected": float(row.total_collected or 0),
        "total_outstanding": float(row.total_outstanding or 0),
        "invoice_count": row.invoice_count or 0,
    }


async def _get_invoice_or_404(invoice_id: str, db: AsyncSession) -> BillingInvoice:
    result = await db.execute(select(BillingInvoice).where(BillingInvoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


async def _invoice_with_relations(invoice_id: str, db: AsyncSession) -> InvoiceResponse:
    inv_result = await db.execute(select(BillingInvoice).where(BillingInvoice.id == invoice_id))
    invoice = inv_result.scalar_one()

    items_result = await db.execute(
        select(BillingLineItem).where(BillingLineItem.invoice_id == invoice_id)
    )
    items = items_result.scalars().all()

    pays_result = await db.execute(
        select(Payment).where(Payment.invoice_id == invoice_id).order_by(Payment.received_at)
    )
    pays = pays_result.scalars().all()

    return InvoiceResponse(
        **InvoiceListResponse.model_validate(invoice).model_dump(),
        discount=float(invoice.discount),
        tax=float(invoice.tax),
        subtotal=float(invoice.subtotal),
        insurance_claim_number=invoice.insurance_claim_number,
        notes=invoice.notes,
        created_by_id=invoice.created_by_id,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        line_items=[LineItemResponse.model_validate(i) for i in items],
        payments=[PaymentResponse.model_validate(p) for p in pays],
    )


