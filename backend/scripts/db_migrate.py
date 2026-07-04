"""
Fly.io release_command: migrate the database to the latest Alembic revision.

Handles two states:
  1. Fresh database (no tables) — runs create_all for base schema, stamps at
     the initial revision, then upgrades to head.
  2. Existing database (no alembic_version) — the schema was created by an
     earlier create_all deploy; stamps at 001_indexes_relationships (which
     only added indexes that are safe to skip) then upgrades to head.
  3. Already tracked database — upgrades to head normally.

Run: python scripts/db_migrate.py
"""
import subprocess
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

_INITIAL_REVISION = "001_indexes_relationships"


def _table_exists(conn, table_name: str) -> bool:
    return conn.execute(text(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
        f"WHERE table_schema='public' AND table_name='{table_name}')"
    )).scalar()


def _run(*args: str) -> None:
    subprocess.run([sys.executable, "-m", *args], check=True)


def main() -> None:
    engine = create_engine(settings.db_url_sync)

    with engine.connect() as conn:
        if not _table_exists(conn, "patients"):
            print("[migrate] Fresh database — creating base schema")
            from app.core.database import Base
            import app.models  # noqa: F401 — register all models
            Base.metadata.create_all(engine)

        if not _table_exists(conn, "alembic_version"):
            print(f"[migrate] Stamping at {_INITIAL_REVISION}")
            _run("alembic", "stamp", _INITIAL_REVISION)

    print("[migrate] Upgrading to head")
    _run("alembic", "upgrade", "head")
    print("[migrate] Done")


if __name__ == "__main__":
    main()
