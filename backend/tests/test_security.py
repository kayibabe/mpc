import pytest
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta
from jose import jwt
from app.core.config import settings
from app.core.security import validate_password_strength
from app.models.user import UserRole


@pytest.mark.asyncio
async def test_access_protected_route_without_token(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_access_admin_route_as_non_admin(client: AsyncClient, auth_token):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="REC008")
    response = await client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_token_expiry(client: AsyncClient, create_test_user):
    # Create expired token manually
    user = await create_test_user(employee_id="EXP001", role=UserRole.receptionist)
    expire = datetime.now(timezone.utc) - timedelta(minutes=1)
    payload = {
        "sub": user.id,
        "role": user.role.value,
        "exp": expire,
        "type": "access",
    }
    expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401
    assert "Invalid or expired token" in response.json()["detail"]


def test_password_strength_validation():
    # Reuse from auth but ensure coverage
    with pytest.raises(ValueError):
        validate_password_strength("weak")

    valid = "Strong@Pass1"
    assert validate_password_strength(valid) == valid

