from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.core.ratelimit import limiter
from app.core.redis import close_redis
from app.routers import auth, patients, admin, sync
from app.routers import encounters, billing, lab, pharmacy, admissions, nursing, referrals
import app.models.referral  # ensure Referral table is registered with Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="Zomba City Private Clinic API",
    description="Clinical management system for ZCPC — Zomba, Malawi",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)  # applies the default limit to all endpoints (audit H8)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,  # Using Bearer tokens, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
app.include_router(encounters.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(lab.router, prefix="/api/v1")
app.include_router(pharmacy.router, prefix="/api/v1")
app.include_router(admissions.router, prefix="/api/v1")
app.include_router(nursing.router, prefix="/api/v1")
app.include_router(referrals.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "clinic": settings.CLINIC_NAME}
