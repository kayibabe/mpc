"""
Seed random staff users for every role.

1. Adds any missing values to the Postgres `userrole` enum (so the new
   frontend roles can be stored).
2. Inserts one sample user per role with a password read from the
   SEED_USER_PASSWORD environment variable.

Run from backend/ directory:
    SEED_USER_PASSWORD='Str0ng!Pass' python seed_users.py

WARNING: This script is for development/testing only. Do NOT run in production.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine, Base
from app.core.security import hash_password
from app.models.user import User, UserRole


# employee_id, full_name, role, department, email
SEED_USERS = [
    ("USER001",  "Tadala Banda",        UserRole.user,          "General",          "tadala.banda@zcpc.mw"),
    ("DOC001",   "Dr. Chimwemwe Phiri", UserRole.doctor,        "Outpatient",       "c.phiri@zcpc.mw"),
    ("CLN001",   "Dr. Yamikani Gondwe", UserRole.clinician,     "Outpatient",       "y.gondwe@zcpc.mw"),
    ("NUR001",   "Grace Mhango",        UserRole.nurse,         "Inpatient",        "g.mhango@zcpc.mw"),
    ("MID001",   "Esther Nkhoma",       UserRole.midwife,       "Maternity",        "e.nkhoma@zcpc.mw"),
    ("PHA001",   "Limbani Kachale",     UserRole.pharmacist,    "Pharmacy",         "l.kachale@zcpc.mw"),
    ("LAB001",   "Mphatso Chirwa",      UserRole.lab_technician,"Laboratory",       "m.chirwa@zcpc.mw"),
    ("RAD001",   "Thoko Mwale",         UserRole.radiographer,  "Imaging",          "t.mwale@zcpc.mw"),
    ("CSH001",   "Patrick Zulu",        UserRole.cashier,       "Billing",          "p.zulu@zcpc.mw"),
    ("REC001",   "Memory Kumwenda",     UserRole.receptionist,  "Reception",        "m.kumwenda@zcpc.mw"),
    ("SRG001",   "Dr. Blessings Tembo", UserRole.surgical_lead, "Theatre",          "b.tembo@zcpc.mw"),
    ("STO001",   "Daniel Kanyenda",     UserRole.store_manager, "Stores",           "d.kanyenda@zcpc.mw"),
]


async def ensure_enum_values():
    """ALTER TYPE userrole ADD VALUE for each role (must run in autocommit)."""
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        for role in UserRole:
            await conn.execute(
                text(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{role.value}'")
            )
    print("Enum values ensured.")


async def seed():
    password = os.environ.get("SEED_USER_PASSWORD")
    if not password:
        print("ERROR: Set the SEED_USER_PASSWORD environment variable before running this script.")
        print("Example: SEED_USER_PASSWORD='Str0ng!Pass' python seed_users.py")
        sys.exit(1)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await ensure_enum_values()

    created, skipped = 0, 0
    async with AsyncSession(engine) as db:
        for emp_id, name, role, dept, email in SEED_USERS:
            existing = await db.execute(select(User).where(User.employee_id == emp_id))
            if existing.scalar_one_or_none():
                print(f"  skip  {emp_id:8} ({role.value}) — already exists")
                skipped += 1
                continue
            db.add(User(
                employee_id=emp_id,
                full_name=name,
                email=email,
                password_hash=hash_password(password),
                role=role,
                department=dept,
                is_active=True,
            ))
            print(f"  add   {emp_id:8} ({role.value}) — {name}")
            created += 1
        await db.commit()

    print(f"\nDone. Created {created}, skipped {skipped}.")
    print("All users password: (set via SEED_USER_PASSWORD env var)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())

