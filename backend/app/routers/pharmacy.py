from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, date
from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.pharmacy import Drug, DrugStock, Prescription, PrescriptionItem, PrescriptionStatus
from app.models.patient import Patient
from app.schemas.pharmacy import (
    DrugCreate, DrugStockCreate, PrescriptionCreate, DispenseCreate,
    DrugResponse, DrugStockResponse, PrescriptionListResponse, PrescriptionResponse,
    PrescriptionItemResponse,
)
import uuid

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])


@router.get("/drugs", response_model=list[DrugResponse])
async def list_drugs(
    q: str | None = Query(None, max_length=100),
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.pharmacist, UserRole.admin)),
):
    stmt = select(Drug).where(Drug.is_active == True)
    if q:
        from sqlalchemy import or_
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(Drug.name.ilike(pattern), Drug.generic_name.ilike(pattern))
        )
    if category:
        stmt = stmt.where(Drug.category == category)
    stmt = stmt.order_by(Drug.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/drugs", response_model=DrugResponse, status_code=status.HTTP_201_CREATED)
async def create_drug(
    body: DrugCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.pharmacist, UserRole.admin)),
):
    drug = Drug(id=str(uuid.uuid4()), **body.model_dump())
    db.add(drug)
    await db.flush()
    await db.refresh(drug)
    return drug


@router.get("/drugs/{drug_id}/stock", response_model=list[DrugStockResponse])
async def get_drug_stock(
    drug_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.pharmacist, UserRole.doctor, UserRole.admin)),
):
    result = await db.execute(
        select(Drug).where(Drug.id == drug_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Drug not found")
    stock_result = await db.execute(
        select(DrugStock)
        .where(DrugStock.drug_id == drug_id, DrugStock.quantity_current > 0)
        .order_by(DrugStock.expiry_date)
    )
    return stock_result.scalars().all()


@router.post("/drugs/{drug_id}/stock", response_model=DrugStockResponse, status_code=status.HTTP_201_CREATED)
async def add_stock(
    drug_id: str,
    body: DrugStockCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.pharmacist, UserRole.admin)),
):
    drug_result = await db.execute(select(Drug).where(Drug.id == drug_id))
    if not drug_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Drug not found")
    stock = DrugStock(
        id=str(uuid.uuid4()),
        drug_id=drug_id,
        quantity_current=body.quantity_received,
        **body.model_dump(),
    )
    db.add(stock)
    await db.flush()
    await db.refresh(stock)
    return stock


@router.get("/prescriptions", response_model=list[PrescriptionListResponse])
async def list_prescriptions(
    patient_id: str | None = Query(None),
    encounter_id: str | None = Query(None),
    status: PrescriptionStatus | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.pharmacist, UserRole.nurse, UserRole.admin)),
):
    stmt = select(Prescription)
    if patient_id:
        stmt = stmt.where(Prescription.patient_id == patient_id)
    if encounter_id:
        stmt = stmt.where(Prescription.encounter_id == encounter_id)
    if status:
        stmt = stmt.where(Prescription.status == status)
    stmt = stmt.order_by(Prescription.prescribed_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/prescriptions", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    body: PrescriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.doctor, UserRole.admin)),
):
    prescription = Prescription(
        id=str(uuid.uuid4()),
        encounter_id=body.encounter_id,
        patient_id=body.patient_id,
        prescribed_by_id=current_user.id,
        notes=body.notes,
    )
    db.add(prescription)
    await db.flush()

    for item in body.items:
        pi = PrescriptionItem(
            id=str(uuid.uuid4()),
            prescription_id=prescription.id,
            drug_id=item.drug_id,
            dose=item.dose,
            frequency=item.frequency,
            route=item.route,
            duration_days=item.duration_days,
            quantity=item.quantity,
            instructions=item.instructions,
            start_date=item.start_date,
        )
        db.add(pi)

    await db.flush()
    await db.refresh(prescription)
    return await _prescription_with_items(prescription.id, db)


@router.get("/prescriptions/{prescription_id}", response_model=PrescriptionResponse)
async def get_prescription(
    prescription_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.pharmacist, UserRole.nurse, UserRole.admin)),
):
    result = await db.execute(select(Prescription).where(Prescription.id == prescription_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Prescription not found")
    return await _prescription_with_items(prescription_id, db)


@router.post("/prescriptions/{prescription_id}/dispense", response_model=PrescriptionResponse)
async def dispense(
    prescription_id: str,
    body: DispenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.pharmacist, UserRole.admin)),
):
    rx_result = await db.execute(select(Prescription).where(Prescription.id == prescription_id))
    prescription = rx_result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if prescription.status == PrescriptionStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cannot dispense a cancelled prescription")

    # ── C5: Validate stock availability before dispensing ──
    for dispense_item in body.items:
        item_result = await db.execute(
            select(PrescriptionItem).where(
                PrescriptionItem.id == dispense_item.prescription_item_id,
                PrescriptionItem.prescription_id == prescription_id,
            )
        )
        item = item_result.scalar_one_or_none()
        if not item:
            continue

        # Check total available stock
        stock_result = await db.execute(
            select(DrugStock)
            .where(DrugStock.drug_id == item.drug_id, DrugStock.quantity_current > 0)
            .order_by(DrugStock.expiry_date)
        )
        available_stock = sum(s.quantity_current for s in stock_result.scalars().all())
        if available_stock < dispense_item.quantity_dispensed:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for drug {item.drug_id}: requested {dispense_item.quantity_dispensed}, available {available_stock}"
            )

        # Deduct from stock (FEFO — first to expire first)
        remaining = dispense_item.quantity_dispensed
        stocks = await db.execute(
            select(DrugStock)
            .where(DrugStock.drug_id == item.drug_id, DrugStock.quantity_current > 0)
            .order_by(DrugStock.expiry_date)
        )
        for batch in stocks.scalars().all():
            if remaining <= 0:
                break
            deduct = min(remaining, batch.quantity_current)
            batch.quantity_current -= deduct
            remaining -= deduct

        item.dispensed_quantity = item.dispensed_quantity + dispense_item.quantity_dispensed
        item.is_dispensed = item.dispensed_quantity >= item.quantity
        item.dispensed_at = datetime.now(timezone.utc)
        item.dispensed_by_id = current_user.id

    # Recompute prescription status
    all_items_result = await db.execute(
        select(PrescriptionItem).where(PrescriptionItem.prescription_id == prescription_id)
    )
    all_items = all_items_result.scalars().all()
    if all(i.is_dispensed for i in all_items):
        prescription.status = PrescriptionStatus.dispensed
    else:
        prescription.status = PrescriptionStatus.partially_dispensed

    await db.flush()
    return await _prescription_with_items(prescription_id, db)


async def _prescription_with_items(prescription_id: str, db: AsyncSession) -> PrescriptionResponse:
    rx_result = await db.execute(select(Prescription).where(Prescription.id == prescription_id))
    rx = rx_result.scalar_one()
    items_result = await db.execute(
        select(PrescriptionItem).where(PrescriptionItem.prescription_id == prescription_id)
    )
    items = items_result.scalars().all()
    return PrescriptionResponse(
        **PrescriptionListResponse.model_validate(rx).model_dump(),
        items=[PrescriptionItemResponse.model_validate(i) for i in items],
    )






