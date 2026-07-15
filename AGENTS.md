# MPC — Mtowera Private Clinic

Full-stack clinic management system for a Malawi client. This repo holds **four apps**:

| Path | What it is |
|------|------------|
| `src/` (repo root app) | **Primary React frontend** (Vite, JS, 48 pages). Connects to the FastAPI backend via `src/api/customClient.js`. Entry point: `src/api/base44Client.js` (legacy name kept to avoid updating 100+ imports). |
| `backend/` | **FastAPI + SQLAlchemy (async) backend — the system of record.** Routers in `backend/app/routers/`, models in `backend/app/models/`, Alembic chain `001` → `008` in `backend/migrations/versions/`. |
| `frontend/` | Secondary React 19 + TypeScript Vite app (TanStack Query, axios, Dexie offline store). Early scaffold — not the deployed frontend. |
| `mobile/` | Flutter mobile app (`mpc_mobile`). |
| *(deleted)* `base44/` | Removed — original platform-sourced entity schemas. Gaps documented in `PATIENT_FLOW_AUDIT.md` (second pass) and `AUDIT_WORKING_DOCUMENT.md`. |
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

Three Fly.io apps: `mpc` (frontend) → `mpc-api` (backend) → `mpc-db` (Postgres). **Deploy backend before frontend.** Migrations run via `release_command` (`db_migrate.py`). Do not deploy or push without explicit instruction from the operator.

## Sources of truth (do not re-derive)

- `AUDIT_WORKING_DOCUMENT.md` — all 66 security/audit findings with status and evidence.
- `PATIENT_FLOW_AUDIT.md` — patient-flow coverage: pass 1 (19 scenarios) + handover pass 2 (10 end-to-end scenarios, one test each in `backend/tests/test_patient_flows.py`).
- `PATIENT_FLOW_AUDIT.md` and `AUDIT_WORKING_DOCUMENT.md` — the `base44/` directory has been deleted; these two documents are the remaining implementation backlog.
