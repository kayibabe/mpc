from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.lab import LabTest, LabOrder, LabOrderItem, LabOrderStatus, ResultFlag
from app.schemas.lab import (
    LabTestCreate, LabOrderCreate, LabResultCreate, LabStatusUpdate,
    LabTestResponse, LabOrderListResponse, LabOrderResponse, LabOrderItemResponse,
)
import uuid

router = APIRouter(prefix="/lab", tags=["lab"])


@router.get("/tests", response_model=list[LabTestResponse])
async def list_tests(
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.lab_tech, UserRole.lab_technician, UserRole.admin)),
):
    stmt = select(LabTest).where(LabTest.is_active == True)
    if category:
        stmt = stmt.where(LabTest.category == category)
    stmt = stmt.order_by(LabTest.category, LabTest.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/tests", response_model=LabTestResponse, status_code=status.HTTP_201_CREATED)
async def create_test(
    body: LabTestCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.lab_tech, UserRole.admin)),
):
    existing = await db.execute(select(LabTest).where(LabTest.code == body.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Test code already exists")
    test = LabTest(id=str(uuid.uuid4()), **body.model_dump())
    db.add(test)
    await db.flush()
    await db.refresh(test)
    return test


@router.get("/results")
async def list_results(
    patient_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.lab_tech, UserRole.lab_technician, UserRole.admin)),
):
    """Flattened view of resulted lab order items (one row per result).
    Joins the test catalogue so each row carries a human-readable test name."""
    stmt = (
        select(LabOrderItem, LabOrder, LabTest)
        .join(LabOrder, LabOrderItem.lab_order_id == LabOrder.id)
        .join(LabTest, LabOrderItem.test_id == LabTest.id)
        .where(LabOrderItem.result_value.is_not(None))
    )
    if patient_id:
        stmt = stmt.where(LabOrder.patient_id == patient_id)
    stmt = stmt.order_by(LabOrderItem.resulted_at.desc()).limit(min(limit, 500))
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": item.id,
            "lab_order_id": item.lab_order_id,
            "patient_id": order.patient_id,
            "test_name": test.name,
            "result_value": item.result_value,
            "result_unit": item.result_unit or test.unit,
            "reference_range": item.reference_range or test.normal_range_text,
            "result_flag": item.result_flag.value if item.result_flag else None,
            "is_critical": item.result_flag in (ResultFlag.critical_low, ResultFlag.critical_high),
            "status": "critical" if item.result_flag in (ResultFlag.critical_low, ResultFlag.critical_high) else "final",
            "notes": item.notes,
            "resulted_at": item.resulted_at,
            "created_date": item.resulted_at,
        }
        for item, order, test in rows
    ]


@router.get("/orders", response_model=list[LabOrderListResponse])
async def list_orders(
    patient_id: str | None = Query(None),
    encounter_id: str | None = Query(None),
    status: LabOrderStatus | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.lab_tech, UserRole.lab_technician, UserRole.admin)),
):
    stmt = select(LabOrder)
    if patient_id:
        stmt = stmt.where(LabOrder.patient_id == patient_id)
    if encounter_id:
        stmt = stmt.where(LabOrder.encounter_id == encounter_id)
    if status:
        stmt = stmt.where(LabOrder.status == status)
    stmt = stmt.order_by(LabOrder.order_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/orders", response_model=LabOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: LabOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.doctor, UserRole.admin)),
):
    order = LabOrder(
        id=str(uuid.uuid4()),
        encounter_id=body.encounter_id,
        patient_id=body.patient_id,
        ordered_by_id=current_user.id,
        order_date=datetime.now(timezone.utc),
        priority=body.priority,
        notes=body.notes,
    )
    db.add(order)
    await db.flush()

    for item in body.items:
        order_item = LabOrderItem(
            id=str(uuid.uuid4()),
            lab_order_id=order.id,
            test_id=item.test_id,
            notes=item.notes,
        )
        db.add(order_item)

    await db.flush()
    await db.refresh(order)
    return await _order_with_items(order.id, db)


@router.get("/orders/{order_id}", response_model=LabOrderResponse)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.doctor, UserRole.nurse, UserRole.lab_tech, UserRole.lab_technician, UserRole.admin)),
):
    result = await db.execute(select(LabOrder).where(LabOrder.id == order_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lab order not found")
    return await _order_with_items(order_id, db)


@router.put("/orders/{order_id}/status", response_model=LabOrderResponse)
async def update_order_status(
    order_id: str,
    body: LabStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.lab_tech, UserRole.admin)),
):
    result = await db.execute(select(LabOrder).where(LabOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")
    order.status = body.status
    order.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return await _order_with_items(order_id, db)


@router.post("/orders/{order_id}/results/{item_id}", response_model=LabOrderItemResponse)
async def record_result(
    order_id: str,
    item_id: str,
    body: LabResultCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.lab_tech, UserRole.admin)),
):
    result = await db.execute(
        select(LabOrderItem).where(
            LabOrderItem.id == item_id,
            LabOrderItem.lab_order_id == order_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    item.resulted_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(item)
    return item


async def _order_with_items(order_id: str, db: AsyncSession) -> LabOrderResponse:
    order_result = await db.execute(select(LabOrder).where(LabOrder.id == order_id))
    order = order_result.scalar_one()
    items_result = await db.execute(
        select(LabOrderItem).where(LabOrderItem.lab_order_id == order_id)
    )
    items = items_result.scalars().all()
    return LabOrderResponse(
        **LabOrderListResponse.model_validate(order).model_dump(),
        notes=order.notes,
        updated_at=order.updated_at,
        items=[LabOrderItemResponse.model_validate(i) for i in items],
    )




