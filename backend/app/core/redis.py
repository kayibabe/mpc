import logging
import time
import redis.asyncio as aioredis
from app.core.config import settings

log = logging.getLogger(__name__)

_pool: aioredis.Redis | None = None
_unavailable: bool = False  # set True after first connection failure
_memory_fallback: "_MemoryRedis | None" = None


class _MemoryRedis:
    """In-process Redis stand-in used when the server is unreachable in
    development. Unlike a pure no-op, it actually stores keys so refresh-token
    rotation and revocation behave correctly within a single process.
    NOT for production: state is lost on restart and not shared across machines.
    """

    def __init__(self):
        self._store: dict[str, tuple[str, float]] = {}

    async def setex(self, key, ttl, value):
        self._store[key] = (value, time.monotonic() + ttl)

    async def get(self, key):
        entry = self._store.get(key)
        if not entry:
            return None
        value, expires = entry
        if time.monotonic() > expires:
            del self._store[key]
            return None
        return value

    async def delete(self, *keys):
        for key in keys:
            self._store.pop(key, None)

    async def ping(self):
        return True

    async def aclose(self):
        self._store.clear()


async def get_redis() -> aioredis.Redis:
    global _pool, _unavailable, _memory_fallback
    if _unavailable:
        return _memory_fallback
    if _pool is None:
        _pool = aioredis.from_url(settings.REDIS_URL, decode_responses=True,
                                  socket_connect_timeout=2)
    try:
        await _pool.ping()
    except Exception:
        # Audit H5: never silently degrade token revocation in production.
        if settings.ENVIRONMENT == "production":
            log.critical("Redis unreachable in production — refusing to run without "
                         "token revocation. Attach a Redis instance (see AUDIT_WORKING_DOCUMENT.md, Advisory §2).")
            raise RuntimeError("Redis is required in production (token revocation)")
        log.critical("Redis unavailable — using in-process token store (DEVELOPMENT ONLY: "
                     "revocation state is lost on restart and not shared across machines)")
        _unavailable = True
        _memory_fallback = _MemoryRedis()
        return _memory_fallback
    return _pool


async def close_redis() -> None:
    global _pool, _unavailable, _memory_fallback
    if _pool and not _unavailable:
        await _pool.aclose()
    _pool = None
    _unavailable = False
    _memory_fallback = None
