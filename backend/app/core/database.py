from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
from app.core.config import settings


# Pool sizing args are only valid for real (QueuePool) databases; SQLite's
# StaticPool (CI/tests) rejects them with a TypeError at import.
_pool_kwargs = {}
if settings.db_url.startswith("postgresql"):
    _pool_kwargs = {"pool_size": 10, "max_overflow": 20, "pool_recycle": 300}

engine = create_async_engine(
    settings.db_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    **_pool_kwargs,
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
            # Only commit if the session has pending changes (writes)
            if session.in_transaction() and session.is_active:
                await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

