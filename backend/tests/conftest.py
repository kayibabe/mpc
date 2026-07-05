import asyncio
import pytest
from typing import AsyncGenerator

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db, Base
from app.routers.auth import limiter as auth_limiter
from app.core.security import hash_password
from app.models.user import User, UserRole

# Use in-memory SQLite for tests (async)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# StaticPool: a single shared connection so every session sees the same
# in-memory database (otherwise each pooled connection gets its own empty DB).
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Rate limits are per-IP; under ASGITransport every test shares one client IP,
# so the 10/min login limit trips across tests. Disable for the suite.
auth_limiter.enabled = False

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        try:
            yield session
            if session.in_transaction() and session.is_active:
                await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_database():
    """Create all tables in the test database."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a clean database session for each test."""
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client using ASGITransport."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture
async def create_test_user(db: AsyncSession):
    """Factory fixture to create test users with different roles."""
    async def _create_user(
        employee_id: str = "TEST001",
        full_name: str = "Test User",
        role: UserRole = UserRole.receptionist,
        department: str = "Test",
        password: str = "Test@Pass123!",
        is_active: bool = True,
    ) -> User:
        # Idempotent: tests share one database, so reuse an existing user
        # instead of violating the unique employee_id/email constraints.
        existing = await db.execute(select(User).where(User.employee_id == employee_id))
        found = existing.scalar_one_or_none()
        if found:
            return found
        user = User(
            id=str(__import__("uuid").uuid4()),
            employee_id=employee_id,
            full_name=full_name,
            role=role,
            department=department,
            password_hash=hash_password(password),
            is_active=is_active,
            email=f"{employee_id.lower()}@test.zcpc.mw",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
    return _create_user


@pytest.fixture
async def auth_token(client: AsyncClient, create_test_user):
    """Helper to get a valid auth token for a user."""
    async def _get_token(role: UserRole = UserRole.receptionist, employee_id: str = None):
        if employee_id is None:
            employee_id = f"TEST{role.value.upper()[:3]}"
        user = await create_test_user(
            employee_id=employee_id,
            role=role,
            password="Test@Pass123!"
        )
        response = await client.post(
            "/api/v1/auth/login",
            json={"employee_id": employee_id, "password": "Test@Pass123!"}
        )
        assert response.status_code == 200
        return response.json()["access_token"], user
    return _get_token


@pytest.fixture
async def receptionist_user(create_test_user):
    return await create_test_user(
        employee_id="REC001",
        full_name="Receptionist Test",
        role=UserRole.receptionist,
        password="Test@Pass123!"
    )


@pytest.fixture
async def doctor_user(create_test_user):
    return await create_test_user(
        employee_id="DOC001",
        full_name="Doctor Test",
        role=UserRole.doctor,
        password="Test@Pass123!"
    )


@pytest.fixture
async def pharmacist_user(create_test_user):
    return await create_test_user(
        employee_id="PHA001",
        full_name="Pharmacist Test",
        role=UserRole.pharmacist,
        password="Test@Pass123!"
    )


@pytest.fixture
async def admin_user(create_test_user):
    return await create_test_user(
        employee_id="ADM001",
        full_name="Admin Test",
        role=UserRole.admin,
        password="Test@Pass123!"
    )


@pytest.fixture
async def nurse_user(create_test_user):
    return await create_test_user(
        employee_id="NUR001",
        full_name="Nurse Test",
        role=UserRole.nurse,
        password="Test@Pass123!"
    )

