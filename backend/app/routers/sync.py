from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.encounter import Encounter

router = APIRouter(prefix="/sync", tags=["sync"])


class SyncPullResponse(BaseModel):
    server_time: str
    patients: list[dict] = []
    encounters: list[dict] = []


@router.get("/pull", response_model=SyncPullResponse)
async def pull_changes(
    since: str | None = Query(None, description="ISO timestamp of last sync"),
    modules: str = Query("patients,encounters", description="Comma-separated list of modules"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    server_time = datetime.now(timezone.utc).isoformat()
    since_dt = datetime.fromisoformat(since) if since else None
    requested = set(modules.split(","))

    patients = []
    if "patients" in requested:
        stmt = select(Patient).where(Patient.is_deleted == False)
        if since_dt:
            stmt = stmt.where(Patient.updated_at > since_dt)
        result = await db.execute(stmt.limit(500))
        for p in result.scalars():
            patients.append({
                "id": p.id, "mrn": p.mrn,
                "first_name": p.first_name, "last_name": p.last_name,
                "gender": p.gender.value, "phone": p.phone,
                "updated_at": p.updated_at.isoformat(),
            })

    encounters = []
    if "encounters" in requested:
        stmt = select(Encounter)
        if since_dt:
            stmt = stmt.where(Encounter.updated_at > since_dt)
        result = await db.execute(stmt.limit(500))
        for e in result.scalars():
            encounters.append({
                "id": e.id, "patient_id": e.patient_id,
                "encounter_type": e.encounter_type.value,
                "encounter_date": e.encounter_date.isoformat(),
                "status": e.status.value,
                "updated_at": e.updated_at.isoformat(),
            })

    return SyncPullResponse(server_time=server_time, patients=patients, encounters=encounters)



