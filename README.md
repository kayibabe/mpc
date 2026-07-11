# Mtowera Private Clinic — HIMS

Full-stack Hospital Information Management System (HIMS) for Mtowera Private Clinic, Malawi.

## Apps in this repo

| Directory | Description |
|-----------|-------------|
| `src/` | Primary React frontend (Vite, JS). Connects to the FastAPI backend. |
| `backend/` | FastAPI + SQLAlchemy async backend — system of record. |
| `frontend/` | Secondary React 19 + TypeScript scaffold (early-stage). |
| `mobile/` | Flutter mobile app (`mpc_mobile`). |
| `deploy/` | Fly.io configs, nginx, and local startup scripts. |

## Local development

**Prerequisites:** Node 20+, Python 3.11+, PostgreSQL 15+

### Frontend

```bash
npm install
cp .env.example .env.local   # set VITE_BACKEND_URL if needed
npm run dev                   # starts at http://localhost:5173
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
cp ../.env.example .env       # fill in DB_*, SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload  # starts at http://localhost:8000
```

### Tests

```bash
# Backend (from backend/):
.venv\Scripts\python -m pytest tests -q

# Frontend (from repo root):
npm test
```

## Deployment

Three Fly.io apps: `mpc` (frontend) → `mpc-api` (backend) → `mpc-db` (Postgres).

Deploy backend before frontend. Migrations run automatically via `release_command`.
