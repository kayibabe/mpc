from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone
from app.core.ratelimit import limiter
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.auth import get_current_user
from app.core.audit import log_action
from app.core.redis import get_redis
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, CurrentUserResponse
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.employee_id == body.employee_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        # Record the failed attempt (entity_id = attempted employee_id)
        await log_action(
            db, action="login_failed", entity_type="auth",
            entity_id=body.employee_id, request=request,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    await db.execute(
        update(User).where(User.id == user.id).values(last_login=datetime.now(timezone.utc))
    )

    await log_action(
        db, action="login", entity_type="auth",
        user_id=user.id, entity_id=user.id, request=request,
    )

    access_token = create_access_token(user.id, user.role.value, user.department)
    refresh_token = create_refresh_token(user.id)

    redis = await get_redis()
    await redis.setex(
        f"refresh:{user.id}:{refresh_token[-16:]}",
        86400 * 7,
        refresh_token,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
        user_id = payload["sub"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Verify the token is still in Redis (catches revoked/deactivated users)
    redis = await get_redis()
    redis_key = f"refresh:{user_id}:{body.refresh_token[-16:]}"
    # decode_responses=True → get() returns str (calling .decode() here crashed
    # every refresh against a real Redis; audit M12/N2)
    stored = await redis.get(redis_key)
    if not stored or stored != body.refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Rotate: delete old token, store new one
    await redis.delete(redis_key)
    access_token = create_access_token(user.id, user.role.value, user.department)
    new_refresh_token = create_refresh_token(user.id)
    await redis.setex(
        f"refresh:{user.id}:{new_refresh_token[-16:]}",
        86400 * 7,
        new_refresh_token,
    )
    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.get("/me", response_model=CurrentUserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return CurrentUserResponse(
        id=current_user.id,
        employee_id=current_user.employee_id,
        full_name=current_user.full_name,
        role=current_user.role.value,
        department=current_user.department,
    )
