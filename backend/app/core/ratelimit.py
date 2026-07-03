"""Shared rate limiter (audit H8/N10).

Keying: all browser traffic reaches the backend through the nginx proxy (or
Fly's edge), so request.client.host is the proxy address — every user in the
clinic would share one rate-limit bucket and could lock each other out at
shift change. Prefer the first X-Forwarded-For hop (set by our nginx and by
Fly's edge), falling back to the direct peer address.
"""
from fastapi import Request
from slowapi import Limiter


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Default limit applies to every endpoint via SlowAPIMiddleware; deliberately
# generous so normal clinic traffic is never throttled — it exists to blunt
# scraping/brute-force, not to police staff.
limiter = Limiter(key_func=client_ip, default_limits=["300/minute"])
