"""Audit logging helper.

Writes an AuditLog row within the caller's DB session (no commit here — the
request's get_db dependency commits the transaction). Failures to log are
swallowed so an audit problem never breaks the primary action.
"""
import logging
import uuid
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog

log = logging.getLogger(__name__)


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    # Respect a reverse-proxy header if present, else the direct peer.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


async def log_action(
    db: AsyncSession,
    *,
    action: str,
    entity_type: str,
    user_id: str | None = None,
    entity_id: str | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    request: Request | None = None,
) -> None:
    try:
        db.add(AuditLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            ip_address=_client_ip(request),
        ))
        await db.flush()
    except Exception as e:  # never let auditing break the real operation
        import sys
        log.warning("Audit log failed for %s/%s: %s", action, entity_type, e)
        print(f"⚠️ AUDIT LOG FAILURE: {action}/{entity_type}: {e}", file=sys.stderr)

