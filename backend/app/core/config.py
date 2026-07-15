from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database — fly.dev sets DATABASE_URL when postgres is attached;
    # individual DB_* vars are used for local development.
    DATABASE_URL: Optional[str] = None
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "mpc"
    DB_USER: str = "postgres"
    DB_PASS: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT — no default; startup fails if SECRET_KEY is not set
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — comma-separated list of allowed origins for production
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Clinic
    CLINIC_NAME: str = "Mtowera Private Clinic"
    CLINIC_PHONE: str = ""
    CLINIC_ADDRESS: str = "Mtowera, Malawi"

    # Africa's Talking
    AT_API_KEY: str = ""
    AT_USERNAME: str = "sandbox"
    AT_SENDER_ID: str = "MPC"

    # Seed scripts — required when running seed_admin.py / seed_users.py
    ADMIN_PASSWORD: str = ""
    SEED_USER_PASSWORD: str = ""

    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @staticmethod
    def _psycopg_url(raw: str) -> str:
        url = (raw
               .replace("postgres://", "postgresql+psycopg://")
               .replace("postgresql://", "postgresql+psycopg://"))
        # Fly Postgres internal/flycast connections reject SSL; psycopg3 defaults
        # to sslmode=prefer which causes "server closed the connection unexpectedly".
        if "sslmode=" not in url:
            sep = "&" if "?" in url else "?"
            url += f"{sep}sslmode=disable"
        return url

    @property
    def db_url(self) -> str:
        if self.DATABASE_URL:
            return self._psycopg_url(self.DATABASE_URL)
        return f"postgresql+psycopg://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def db_url_sync(self) -> str:
        if self.DATABASE_URL:
            return self._psycopg_url(self.DATABASE_URL)
        return f"postgresql+psycopg://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
