from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.api.v1.router import router as v1_router
from app.api.public.router import router as public_router

import app.models  # noqa: F401 — register all models with SQLAlchemy

logging.basicConfig(level=logging.INFO if settings.DEBUG else logging.WARNING)


def _purge_expired_tokens() -> None:
    """Delete refresh tokens that are past their expiry — keeps the table lean."""
    from app.models.user import RefreshToken
    db = SessionLocal()
    try:
        deleted = db.query(RefreshToken).filter(
            RefreshToken.expires_at < datetime.now(timezone.utc)
        ).delete(synchronize_session=False)
        db.commit()
        if deleted:
            logging.info(f"Purged {deleted} expired refresh token(s)")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _purge_expired_tokens()
    logging.info(f"🚀  {settings.APP_NAME} started in {settings.APP_ENV} mode")
    yield
    # shutdown — nothing to tear down for SQLite


app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade Blog CMS API for QA Portfolio",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

app.include_router(v1_router)
app.include_router(public_router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}
