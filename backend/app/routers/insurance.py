from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from datetime import datetime, timezone, date
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.billing import BillingInvoice, Payment, InvoiceStatus, PaymentMode
from app.models.insurance import (
    Insurer, SchemeMember, PreAuthorization, InsuranceClaim,
    PayerType, MemberStatus, PreAuthStatus, ClaimStatus,
)
from app.schemas.insurance import (
    InsurerCreate, InsurerResponse, MemberCreate, MemberResponse,
    PreAuthCreate, PreAuthDecision, PreAuthResponse,
    ClaimCreate, ClaimDecision, ClaimResponse,
)
from app.routers.billing import _generate_receipt_number, _next_rct_seq
import uuid

router = APIRouter(prefix="/insurance", tags=["insurance"])

_BILLING = (UserRole.billing_clerk, UserRole.cashier, UserRole.admin)
_LOOKUP = (
    UserRole.receptionist, UserRole.billing_clerk, UserRole.cashier,
    UserRole.doctor, UserRole.clinician, UserRole.admin,
)


async def _next_claim_seq(db: AsyncSession) -> int:
    """Postgres sequence; SQLite (dev/tests) falls back to row count + 1."""
    if db.get_bind().dialect.name == "postgresql":
        return (await db.execute(text("SELECT nextval('claim_seq')"))).scalar_one()
    count = (await db.execute(select(func.count()).select_from(InsuranceClaim))).scalar_one()
    return count + 1


async def _next_preauth_seq(db: AsyncSession) -> int:
    """Postgres sequence; SQLite (dev/tests) falls back to approved-count + 1."""
    if db.get_bind().dialect.name == "postgresql":
        return (await db.execute(text("SELECT nextval('preauth_seq')"))).scalar_one()
    count = (
        await db.execute(
            select(func.count()).select_from(PreAuthorization).where(PreAuthorization.auth_number.isnot(None))
        )
    ).scalar_one()
    return count + 1


# ── Insurers / schemes ────────────────────────────────────────────────────────

@router.post("/insurers", response_model=InsurerResponse, status_code=status.HTTP_201_CREATED)
async def create_insurer(
    body: InsurerCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.admin)),
):
    existing = await db.execute(select(Insurer).where(func.lower(Insurer.name) == body.name.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An insurer with this name already exists")
    insurer = Insurer(id=str(uuid.uuid4()), **body.model_dump())
    db.add(insurer)
    await db.flush()
    await db.refresh(insurer)
    return insurer


@router.get("/insurers", response_model=list[InsurerResponse])
async def list_insurers(
    payer_type: PayerType | None = Query(None),
    q: str | None = Query(None, description="Name search"),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_LOOKUP)),
):
    stmt = select(Insurer)
    if payer_type:
        stmt = stmt.where(Insurer.payer_type == payer_type)
    if q:
        stmt = stmt.where(Insurer.name.ilike(f"%{q}%"))
    if active_only:
        stmt = stmt.where(Insurer.is_active == True)  # noqa: E712
    stmt = stmt.order_by(Insurer.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/insurers/{insurer_id}", response_model=InsurerResponse)
async def get_insurer(
    insurer_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_LOOKUP)),
):
    insurer = await _get_insurer_or_404(insurer_id, db)
    return insurer


@router.get("/insurers/{insurer_id}/statement")
async def insurer_statement(
    insurer_id: str,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.admin)),
):
    """Scheme/insurer statement: all claims in the period with totals."""
    from sqlalchemy import cast
    from sqlalchemy.dialects.postgresql import DATE

    insurer = await _get_insurer_or_404(insurer_id, db)

    stmt = select(InsuranceClaim).where(InsuranceClaim.insurer_id == insurer_id)
    if date_from:
        stmt = stmt.where(cast(InsuranceClaim.created_at, DATE) >= date_from)
    if date_to:
        stmt = stmt.where(cast(InsuranceClaim.created_at, DATE) <= date_to)
    stmt = stmt.order_by(InsuranceClaim.created_at)
    claims = (await db.execute(stmt)).scalars().all()

    lines = []
    total_claimed = total_approved = total_settled = 0.0
    counts: dict[str, int] = {}
    for c in claims:
        invoice = (await db.execute(select(BillingInvoice).where(BillingInvoice.id == c.invoice_id))).scalar_one()
        patient = (await db.execute(select(Patient).where(Patient.id == invoice.patient_id))).scalar_one()
        total_claimed += float(c.claimed_amount)
        if c.approved_amount is not None:
            total_approved += float(c.approved_amount)
        if c.status == ClaimStatus.settled and c.approved_amount is not None:
            total_settled += float(c.approved_amount)
        counts[c.status.value] = counts.get(c.status.value, 0) + 1
        lines.append({
            "claim_number": c.claim_number,
            "invoice_number": invoice.invoice_number,
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "patient_mrn": patient.mrn,
            "claimed_amount": float(c.claimed_amount),
            "copay_amount": float(c.copay_amount),
            "approved_amount": float(c.approved_amount) if c.approved_amount is not None else None,
            "status": c.status.value,
            "submitted_at": c.submitted_at,
            "settled_at": c.settled_at,
        })

    return {
        "insurer_id": insurer.id,
        "insurer_name": insurer.name,
        "payer_type": insurer.payer_type.value,
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
        "claim_count": len(claims),
        "counts_by_status": counts,
        "total_claimed": total_claimed,
        "total_approved": total_approved,
        "total_settled": total_settled,
        "total_outstanding": total_approved - total_settled,
        "claims": lines,
    }


# ── Members ───────────────────────────────────────────────────────────────────

@router.post("/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def register_member(
    body: MemberCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.receptionist, UserRole.billing_clerk, UserRole.admin)),
):
    await _get_insurer_or_404(body.insurer_id, db)
    patient = (await db.execute(select(Patient).where(Patient.id == body.patient_id))).scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    existing = await db.execute(
        select(SchemeMember).where(
            SchemeMember.insurer_id == body.insurer_id,
            SchemeMember.member_number == body.member_number,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This member number is already registered with this insurer")
    member = SchemeMember(id=str(uuid.uuid4()), **body.model_dump())
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return member


@router.get("/members/verify")
async def verify_member(
    insurer_id: str = Query(...),
    member_number: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_LOOKUP)),
):
    """Front-desk membership check: is this card valid for cover today?"""
    insurer = await _get_insurer_or_404(insurer_id, db)
    result = await db.execute(
        select(SchemeMember).where(
            SchemeMember.insurer_id == insurer_id,
            SchemeMember.member_number == member_number,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found for this insurer")

    today = datetime.now(timezone.utc).date()
    verified = True
    reason = "Member is active and within the cover period"
    if member.status == MemberStatus.suspended:
        verified, reason = False, "Membership is suspended"
    elif member.status == MemberStatus.expired:
        verified, reason = False, "Membership is marked expired"
    elif member.valid_from > today:
        verified, reason = False, f"Cover starts on {member.valid_from.isoformat()}"
    elif member.valid_to is not None and member.valid_to < today:
        verified, reason = False, f"Cover expired on {member.valid_to.isoformat()}"

    return {
        "verified": verified,
        "reason": reason,
        "insurer_name": insurer.name,
        "payer_type": insurer.payer_type.value,
        "member": MemberResponse.model_validate(member).model_dump(),
    }


@router.get("/members", response_model=list[MemberResponse])
async def list_members(
    insurer_id: str | None = Query(None),
    patient_id: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_LOOKUP)),
):
    stmt = select(SchemeMember)
    if insurer_id:
        stmt = stmt.where(SchemeMember.insurer_id == insurer_id)
    if patient_id:
        stmt = stmt.where(SchemeMember.patient_id == patient_id)
    stmt = stmt.order_by(SchemeMember.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Pre-authorization ─────────────────────────────────────────────────────────

@router.post("/preauth", response_model=PreAuthResponse, status_code=status.HTTP_201_CREATED)
async def request_preauth(
    body: PreAuthCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.doctor, UserRole.clinician, UserRole.billing_clerk, UserRole.admin,
    )),
):
    await _get_insurer_or_404(body.insurer_id, db)
    patient = (await db.execute(select(Patient).where(Patient.id == body.patient_id))).scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    preauth = PreAuthorization(
        id=str(uuid.uuid4()),
        requested_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(preauth)
    await db.flush()
    await db.refresh(preauth)
    return preauth


@router.patch("/preauth/{preauth_id}/decision", response_model=PreAuthResponse)
async def decide_preauth(
    preauth_id: str,
    body: PreAuthDecision,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.billing_clerk, UserRole.admin)),
):
    result = await db.execute(select(PreAuthorization).where(PreAuthorization.id == preauth_id))
    preauth = result.scalar_one_or_none()
    if not preauth:
        raise HTTPException(status_code=404, detail="Pre-authorization not found")
    if preauth.status != PreAuthStatus.requested:
        raise HTTPException(status_code=422, detail="Pre-authorization has already been decided")
    if body.status not in (PreAuthStatus.approved, PreAuthStatus.rejected):
        raise HTTPException(status_code=422, detail="Decision must be approved or rejected")

    preauth.status = body.status
    preauth.decision_notes = body.decision_notes
    preauth.decided_at = datetime.now(timezone.utc)
    if body.status == PreAuthStatus.approved:
        preauth.auth_number = f"PA{str(await _next_preauth_seq(db)).zfill(6)}"
    preauth.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(preauth)
    return preauth


@router.get("/preauth", response_model=list[PreAuthResponse])
async def list_preauths(
    insurer_id: str | None = Query(None),
    patient_id: str | None = Query(None),
    status_filter: PreAuthStatus | None = Query(None, alias="status"),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(
        UserRole.doctor, UserRole.clinician, UserRole.billing_clerk, UserRole.cashier, UserRole.admin,
    )),
):
    stmt = select(PreAuthorization)
    if insurer_id:
        stmt = stmt.where(PreAuthorization.insurer_id == insurer_id)
    if patient_id:
        stmt = stmt.where(PreAuthorization.patient_id == patient_id)
    if status_filter:
        stmt = stmt.where(PreAuthorization.status == status_filter)
    stmt = stmt.order_by(PreAuthorization.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Claims ────────────────────────────────────────────────────────────────────

@router.post("/claims", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
async def create_claim(
    body: ClaimCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_BILLING)),
):
    invoice = (await db.execute(select(BillingInvoice).where(BillingInvoice.id == body.invoice_id))).scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == InvoiceStatus.void:
        raise HTTPException(status_code=400, detail="Cannot claim against a voided invoice")
    await _get_insurer_or_404(body.insurer_id, db)

    if body.member_id:
        member = (await db.execute(select(SchemeMember).where(SchemeMember.id == body.member_id))).scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        if member.insurer_id != body.insurer_id:
            raise HTTPException(status_code=400, detail="Member does not belong to the specified insurer")

    if body.preauth_id:
        preauth = (
            await db.execute(select(PreAuthorization).where(PreAuthorization.id == body.preauth_id))
        ).scalar_one_or_none()
        if not preauth:
            raise HTTPException(status_code=404, detail="Pre-authorization not found")
        if preauth.status != PreAuthStatus.approved:
            raise HTTPException(status_code=422, detail="Pre-authorization is not approved")

    total = float(invoice.total)
    if body.copay_amount > total:
        raise HTTPException(status_code=422, detail="Co-payment cannot exceed the invoice total")

    existing = await db.execute(
        select(InsuranceClaim).where(
            InsuranceClaim.invoice_id == body.invoice_id,
            InsuranceClaim.status != ClaimStatus.rejected,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="An active claim already exists for this invoice")

    claim = InsuranceClaim(
        id=str(uuid.uuid4()),
        claim_number=f"CLM{str(await _next_claim_seq(db)).zfill(6)}",
        invoice_id=body.invoice_id,
        insurer_id=body.insurer_id,
        member_id=body.member_id,
        preauth_id=body.preauth_id,
        claimed_amount=total - body.copay_amount,
        copay_amount=body.copay_amount,
        created_by_id=current_user.id,
    )
    db.add(claim)
    await db.flush()
    await db.refresh(claim)
    return claim


@router.get("/claims", response_model=list[ClaimResponse])
async def list_claims(
    insurer_id: str | None = Query(None),
    invoice_id: str | None = Query(None),
    status_filter: ClaimStatus | None = Query(None, alias="status"),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_BILLING)),
):
    stmt = select(InsuranceClaim)
    if insurer_id:
        stmt = stmt.where(InsuranceClaim.insurer_id == insurer_id)
    if invoice_id:
        stmt = stmt.where(InsuranceClaim.invoice_id == invoice_id)
    if status_filter:
        stmt = stmt.where(InsuranceClaim.status == status_filter)
    stmt = stmt.order_by(InsuranceClaim.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/claims/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_BILLING)),
):
    return await _get_claim_or_404(claim_id, db)


@router.post("/claims/{claim_id}/submit", response_model=ClaimResponse)
async def submit_claim(
    claim_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_BILLING)),
):
    claim = await _get_claim_or_404(claim_id, db)
    if claim.status != ClaimStatus.draft:
        raise HTTPException(status_code=422, detail="Only draft claims can be submitted")
    claim.status = ClaimStatus.submitted
    claim.submitted_at = datetime.now(timezone.utc)
    claim.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(claim)
    return claim


@router.patch("/claims/{claim_id}/decision", response_model=ClaimResponse)
async def decide_claim(
    claim_id: str,
    body: ClaimDecision,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_BILLING)),
):
    """Record the insurer's response: approved, partially_approved, or rejected."""
    claim = await _get_claim_or_404(claim_id, db)
    if claim.status != ClaimStatus.submitted:
        raise HTTPException(status_code=422, detail="Only submitted claims can be decided")

    claimed = float(claim.claimed_amount)
    if body.status == ClaimStatus.approved:
        approved = claimed if body.approved_amount is None else body.approved_amount
        if approved != claimed:
            raise HTTPException(
                status_code=422,
                detail="Full approval must match the claimed amount; use partially_approved otherwise",
            )
        claim.approved_amount = approved
    elif body.status == ClaimStatus.partially_approved:
        if body.approved_amount is None or not (0 < body.approved_amount < claimed):
            raise HTTPException(
                status_code=422,
                detail="partially_approved requires approved_amount between 0 and the claimed amount",
            )
        claim.approved_amount = body.approved_amount
    elif body.status == ClaimStatus.rejected:
        if not body.rejection_reason or not body.rejection_reason.strip():
            raise HTTPException(status_code=422, detail="rejection_reason is required when rejecting a claim")
        claim.rejection_reason = body.rejection_reason.strip()
    else:
        raise HTTPException(
            status_code=422,
            detail="Decision must be approved, partially_approved, or rejected",
        )

    claim.status = body.status
    claim.decided_at = datetime.now(timezone.utc)
    claim.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(claim)
    return claim


@router.post("/claims/{claim_id}/settle", response_model=ClaimResponse)
async def settle_claim(
    claim_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_BILLING)),
):
    """Insurer has paid: record the settlement as an insurance payment on the invoice."""
    claim = await _get_claim_or_404(claim_id, db)
    if claim.status not in (ClaimStatus.approved, ClaimStatus.partially_approved):
        raise HTTPException(status_code=422, detail="Only approved claims can be settled")

    invoice = (await db.execute(select(BillingInvoice).where(BillingInvoice.id == claim.invoice_id))).scalar_one()
    amount = float(claim.approved_amount)
    outstanding = float(invoice.balance)
    if amount > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Settlement {amount} exceeds the invoice outstanding balance {outstanding}",
        )

    payment = Payment(
        id=str(uuid.uuid4()),
        invoice_id=invoice.id,
        receipt_number=_generate_receipt_number(await _next_rct_seq(db)),
        amount=amount,
        payment_mode=PaymentMode.insurance,
        reference=claim.claim_number,
        received_by_id=current_user.id,
        received_at=datetime.now(timezone.utc),
        notes=f"Insurance settlement for claim {claim.claim_number}",
    )
    db.add(payment)

    new_paid = float(invoice.amount_paid) + amount
    invoice.amount_paid = new_paid
    invoice.balance = max(0.0, float(invoice.total) - new_paid)
    if invoice.balance <= 0:
        invoice.status = InvoiceStatus.paid
    elif new_paid > 0:
        invoice.status = InvoiceStatus.partial
    invoice.updated_at = datetime.now(timezone.utc)

    claim.status = ClaimStatus.settled
    claim.settled_at = datetime.now(timezone.utc)
    claim.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(claim)
    return claim


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_insurer_or_404(insurer_id: str, db: AsyncSession) -> Insurer:
    result = await db.execute(select(Insurer).where(Insurer.id == insurer_id))
    insurer = result.scalar_one_or_none()
    if not insurer:
        raise HTTPException(status_code=404, detail="Insurer not found")
    return insurer


async def _get_claim_or_404(claim_id: str, db: AsyncSession) -> InsuranceClaim:
    result = await db.execute(select(InsuranceClaim).where(InsuranceClaim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim
