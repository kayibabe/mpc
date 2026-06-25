import logging
import redis.asyncio as aioredis
from app.core.config import settings

log = logging.getLogger(__name__)

_pool: aioredis.Redis | None = None
_unavailable: bool = False  # set True after first connection failure


class _NullRedis:
    """No-op Redis stand-in used when the server is unreachable in dev mode.
    Refresh-token revocation is skipped; access tokens still expire normally."""

    async def setex(self, *_a, **_kw): pass
    async def get(self, *_a, **_kw): return None
    async def delete(self, *_a, **_kw): pass
    async def aclose(self): pass


async def get_redis() -> aioredis.Redis:
    global _pool, _unavailable
    if _unavailable:
        return _NullRedis()
    if _pool is None:
        _pool = aioredis.from_url(settings.REDIS_URL, decode_responses=True,
                                  socket_connect_timeout=2)
    try:
        await _pool.ping()
    except Exception as exc:
        if settings.ENVIRONMENT == "production":
            log.error("Redis unavailable in production — refusing to start with NullRedis fallback")
            raise RuntimeError("Redis is required in production but is unavailable") from exc
        log.warning("Redis unavailable — refresh-token revocation disabled (dev mode only): %s", exc)
        _unavailable = True
        return _NullRedis()
    return _pool


async def close_redis() -> None:
    global _pool, _unavailable
    if _pool and not _unavailable:
        await _pool.aclose()
    _pool = None
    _unavailable = False

