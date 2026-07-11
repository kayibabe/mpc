@echo off
echo Starting MPC...

:: Ensure PostgreSQL and Redis are running
net start postgresql-x64-18 2>nul
net start Redis 2>nul

:: Start FastAPI backend
cd /d D:\WebApps\mpc\backend
start "MPC Backend" cmd /k "call .venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Celery worker
start "MPC Celery" cmd /k "call .venv\Scripts\activate && celery -A app.tasks worker --loglevel=info"

echo MPC started. Backend: http://localhost:8000
echo Docs: http://localhost:8000/docs
