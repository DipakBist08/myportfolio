"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging

from app.config import settings
from app.database import engine, Base
from app.api.v1.router import router as v1_router
from app.api.public.router import router as public_router

# Eagerly import all models so Alembic/create_all picks them up
import app.models  # noqa: F401

logging.basicConfig(level=logging.INFO if settings.DEBUG else logging.WARNING)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade Blog CMS API for QA Portfolio",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving (uploaded media) ─────────────────────────────────────

upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(v1_router)
app.include_router(public_router)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    # Create all tables (idempotent — Alembic handles migrations in prod)
    Base.metadata.create_all(bind=engine)
    logging.info(f"🚀  {settings.APP_NAME} started in {settings.APP_ENV} mode")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}
