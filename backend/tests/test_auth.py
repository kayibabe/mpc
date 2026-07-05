import pytest
from httpx import AsyncClient
from app.core.security import validate_password_strength


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, auth_token):
    token, user = await auth_token(role="receptionist", employee_id="REC001")
    assert token is not None
    assert len(token) > 50


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, create_test_user):
    await create_test_user(employee_id="REC002", role="receptionist", password="Correct@123!")
    response = await client.post(
        "/api/v1/auth/login",
        json={"employee_id": "REC002", "password": "WrongPass123!"}
    )
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_non_existent_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/login",
        json={"employee_id": "NONEXIST", "password": "Test@Pass123!"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotation(client: AsyncClient, auth_token):
    token, user = await auth_token(role="receptionist", employee_id="REC003")
    # Get refresh token from initial login? But login response has refresh
    # Since fixture returns only access, let's simulate full login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"employee_id": "REC003", "password": "Test@Pass123!"}
    )
    assert login_resp.status_code == 200
    tokens = login_resp.json()
    refresh_token = tokens["refresh_token"]

    # Refresh
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert new_tokens["access_token"] != token
    assert new_tokens["refresh_token"] != refresh_token

    # Old refresh should be revoked (will fail)
    old_refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert old_refresh_resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_endpoint(client: AsyncClient, auth_token):
    token, user = await auth_token(role="receptionist", employee_id="REC004")
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["employee_id"] == "REC004"
    assert data["role"] == "receptionist"


@pytest.mark.asyncio
def test_password_validation_rules():
    # Valid password
    assert validate_password_strength("Valid@Pass123") == "Valid@Pass123"

    # Too short
    with pytest.raises(ValueError, match="at least 8 characters"):
        validate_password_strength("Short1!")

    # No letter
    with pytest.raises(ValueError, match="at least one letter"):
        validate_password_strength("12345678!")

    # No digit
    with pytest.raises(ValueError, match="at least one number"):
        validate_password_strength("Password!")

    # No special char
    with pytest.raises(ValueError, match="at least one special character"):
        validate_password_strength("Password123")

