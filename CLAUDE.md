# ZCPC — Zomba City Private Clinic

Full-stack clinic management system for a Malawi client. This repo holds **four apps plus the Base44 platform source**:

| Path | What it is |
|------|------------|
| `src/` (repo root app) | **Primary React frontend** (Vite, JS, 48 pages). Built as a Base44 app; runs dual-mode — against the Base44 platform when `?app_id=`/`VITE_BASE44_APP_ID` is present, otherwise against the FastAPI backend through the adapter `src/api/customClient.js`. |
| `backend/` | **FastAPI + SQLAlchemy (async) backend — the system of record.** Routers in `backend/app/routers/`, models in `backend/app/models/`, Alembic chain `001` → `008` in `backend/migrations/versions/`. |
| `frontend/` | Secondary React 19 + TypeScript Vite app (TanStack Query, axios, Dexie offline store). Early scaffold — stock Vite README, not the deployed frontend. |
| `mobile/` | Flutter mobile app. |
| `base44/` | Base44 platform source: 66 entity schemas + 102 cloud functions. **Read `base44/CLAUDE.md` before touching anything here — the flat layout is platform-managed.** |
| `deploy/`, `.github/workflows/` | Fly.io deploy assets and CI (backend Docker + frontend build). |
| `docs/` + root `.docx`/`.pdf` | Client-facing system documentation and audit reports. |

## Commands

```powershell
# Backend tests (from backend/):
.\.venv\Scripts\python.exe -m pytest tests -q
# Backend migrations (offline SQL check):
.\.venv\Scripts\python.exe -m alembic upgrade head --sql
# Root frontend (from repo root):
npm test          # vitest (includes src/api/customClient.test.js adapter regressions)
npm run build     # vite build
```

Tests use in-memory SQLite via `backend/tests/conftest.py` (httpx ASGITransport, no server needed). Sequences (MRN/INV/RCT/CLM/…) are Postgres sequences with a COUNT+1 SQLite fallback.

## Deployment

Three Fly.io apps: `zcpc` (frontend) → `zcpc-api` (backend) → `zcpc-db` (Postgres). **Deploy backend before frontend.** Migrations run via `release_command` (`db_migrate.py`). Do not deploy or push without explicit instruction from the operator.

## Sources of truth (do not re-derive)

- `AUDIT_WORKING_DOCUMENT.md` — all 66 security/audit findings with status and evidence.
- `PATIENT_FLOW_AUDIT.md` — patient-flow coverage: pass 1 (19 scenarios) + handover pass 2 (10 end-to-end scenarios, one test each in `backend/tests/test_patient_flows.py`).
- `base44/CLAUDE.md` — Base44 entity/function index and which entities are live vs stubbed in self-hosted mode.
