from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, field_validator
from app.core.database import get_db
from app.core.auth import require_role
from app.core.audit import log_action
from app.core.security import hash_password, validate_password_strength
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.audit import AuditLog
import uuid
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["admin"])


class UserCreate(BaseModel):
    employee_id: str
    full_name: str
    role: UserRole
    department: str | None = None
    phone: str | None = None
    email: str | None = None
    password: str

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        return validate_password_strength(v)


class UserResponse(BaseModel):
    id: str
    employee_id: str
    full_name: str
    role: UserRole
    department: str | None
    phone: str | None
    email: str | None
    is_active: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(User).order_by(User.full_name))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    existing = await db.execute(select(User).where(User.employee_id == body.employee_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Employee ID already exists")

    user = User(
        id=str(uuid.uuid4()),
        employee_id=body.employee_id,
        full_name=body.full_name,
        role=body.role,
        department=body.department,
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await log_action(
        db, action="create", entity_type="user",
        user_id=current_user.id, entity_id=user.id,
        new_value={"employee_id": user.employee_id, "role": user.role.value},
        request=request,
    )
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    if user_id == current_user.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old = {"is_active": user.is_active, "role": user.role.value}
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        user.role = body.role
    await db.flush()
    await db.refresh(user)

    await log_action(
        db, action="update", entity_type="user",
        user_id=current_user.id, entity_id=user.id,
        old_value=old, new_value={"is_active": user.is_active, "role": user.role.value},
        request=request,
    )
    return user


@router.get("/audit-logs")
async def list_audit_logs(
    action: str | None = None,
    entity_type: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    stmt = stmt.order_by(AuditLog.timestamp.desc()).limit(min(limit, 500))
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "ip_address": r.ip_address,
            "timestamp": r.timestamp,
            "created_date": r.timestamp,
        }
        for r in rows
    ]


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    total_patients = (await db.execute(select(func.count()).select_from(Patient))).scalar_one()
    return {
        "total_patients": total_patients,
    }
