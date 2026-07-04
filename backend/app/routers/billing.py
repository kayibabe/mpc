from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.billing import BillingInvoice, BillingLineItem, Payment, InvoiceStatus
from app.schemas.billing import (
    InvoiceCreate, InvoiceUpdate, InvoiceListResponse, InvoiceResponse,
    LineItemResponse, PaymentCreate, PaymentResponse,
)
import uuid

router = APIRouter(prefix="/billing", tags=["billing"])


def _generate_invoice_number(seq_val: int) -> str:
    return f"INV{str(seq_val).zfill(6)}"


def _generate_receipt_number(seq_val: int) -> str:
    return f"RCT{str(seq_val).zfill(6)}"


async def _next_inv_seq(db: AsyncSession) -> int:
    """Postgres sequence; SQLite (dev/tests) falls back to row count + 1."""
    if db.get_bind().dialect.name == "postgresql":
        return (await db.execute(text("SELECT nextval('inv_seq')"))).scalar_one()
    count = (await db.execute(select(func.count()).select_from(BillingInvoice))).scalar_one()
    return count + 1


async def _next_rct_seq(db: AsyncSession) -> int:
    """Postgres sequence; SQLite (dev/tests) falls back to row count + 1."""
    if db.get_bind().dialect.name == "postgresql":
        return (await db.execute(text("SELECT nextval('rct_seq')"))).scalar_one()
    count = (await db.execute(select(func.count()).select_from(Payment))).scalar_one()
    return count + 1


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
    current_user: User = Depends(require_role(UserRole.billing_clerk, UserRole.cashier, UserRole.admin)),
):
    invoice_number = _generate_invoice_number(await _next_inv_seq(db))

    subtotal = sum(item.quantity * item.unit_price for item in body.line_items)
    discount = Decimal(str(body.discount))
    if discount > Decimal(str(subtotal)):
        raise HTTPException(status_code=400, detail="Discount cannot exceed the invoice subtotal")
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
    current_user: User = Depends(require_role(UserRole.billing_clerk, UserRole.cashier, UserRole.admin)),
):
    invoice = await _get_invoice_or_404(invoice_id, db)
    if invoice.status == InvoiceStatus.void:
        raise HTTPException(status_code=400, detail="Cannot accept payment on a voided invoice")
    outstanding = float(invoice.balance)
    if body.amount > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Payment {body.amount} exceeds outstanding balance {outstanding}",
        )

    payment = Payment(
        id=str(uuid.uuid4()),
        invoice_id=invoice_id,
        receipt_number=_generate_receipt_number(await _next_rct_seq(db)),
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


@router.get("/payments/{payment_id}/receipt")
async def get_receipt(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.cashier, UserRole.admin)),
):
    """Printable receipt payload for a recorded payment."""
    from app.core.config import settings
    from app.models.patient import Patient

    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    invoice = await _get_invoice_or_404(payment.invoice_id, db)
    patient = (await db.execute(select(Patient).where(Patient.id == invoice.patient_id))).scalar_one()
    received_by = (await db.execute(select(User).where(User.id == payment.received_by_id))).scalar_one()

    return {
        "receipt_number": payment.receipt_number,
        "clinic_name": settings.CLINIC_NAME,
        "invoice_number": invoice.invoice_number,
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "patient_mrn": patient.mrn,
        "amount": float(payment.amount),
        "payment_mode": payment.payment_mode.value,
        "reference": payment.reference,
        "received_by": received_by.full_name,
        "received_at": payment.received_at,
        "invoice_total": float(invoice.total),
        "invoice_amount_paid": float(invoice.amount_paid),
        "invoice_balance": float(invoice.balance),
    }


@router.get("/reconciliation")
async def daily_reconciliation(
    recon_date: date | None = Query(None, description="Defaults to today (UTC)"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.cashier, UserRole.admin)),
):
    """End-of-day cash-up: all payments received on a date, totalled by mode and by receiver."""
    if recon_date is None:
        recon_date = datetime.now(timezone.utc).date()

    # Datetime-range filter (not CAST-to-DATE): portable across Postgres and
    # the SQLite test/dev database, and able to use the received_at index.
    day_start = datetime(recon_date.year, recon_date.month, recon_date.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    result = await db.execute(
        select(Payment)
        .where(Payment.received_at >= day_start, Payment.received_at < day_end)
        .order_by(Payment.received_at)
    )
    payments = result.scalars().all()

    by_mode: dict[str, dict] = {}
    by_receiver: dict[str, dict] = {}
    total = 0.0
    for p in payments:
        total += float(p.amount)
        mode = p.payment_mode.value
        by_mode.setdefault(mode, {"count": 0, "total": 0.0})
        by_mode[mode]["count"] += 1
        by_mode[mode]["total"] += float(p.amount)
        by_receiver.setdefault(p.received_by_id, {"count": 0, "total": 0.0})
        by_receiver[p.received_by_id]["count"] += 1
        by_receiver[p.received_by_id]["total"] += float(p.amount)

    # Resolve receiver names for the cash-up sheet
    receivers = []
    for user_id, agg in by_receiver.items():
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        receivers.append({
            "user_id": user_id,
            "name": user.full_name if user else "(unknown)",
            "count": agg["count"],
            "total": agg["total"],
        })

    return {
        "date": recon_date.isoformat(),
        "payment_count": len(payments),
        "total_collected": total,
        "by_mode": by_mode,
        "by_receiver": receivers,
        "payments": [
            {
                "receipt_number": p.receipt_number,
                "invoice_id": p.invoice_id,
                "amount": float(p.amount),
                "payment_mode": p.payment_mode.value,
                "reference": p.reference,
                "received_by_id": p.received_by_id,
                "received_at": p.received_at,
            }
            for p in payments
        ],
    }


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
