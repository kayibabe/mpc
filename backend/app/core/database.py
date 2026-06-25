from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
from app.core.config import settings


# When DATABASE_URL points to Fly.io's internal *.flycast network,
# asyncpg SSL isn't supported — disable it only in that case.
# For external/managed Postgres, enforce SSL.
_connect_args = {}
if settings.DATABASE_URL and "flycast" in settings.DATABASE_URL:
    _connect_args = {"ssl": False}  # Fly.io internal network
elif settings.DATABASE_URL:
    _connect_args = {"ssl": "require"}  # External Postgres — enforce SSL

engine = create_async_engine(
    settings.db_url,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

