"""Test setup: a throwaway SQLite database and a test secret, set before the
app (and its settings) are imported. Run from cms/backend:

    pip install -r requirements.txt
    pytest
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

_DB = Path(tempfile.mkdtemp(prefix="cms-tests-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB}"
os.environ["SECRET_KEY"] = "test-secret-" + "0123456789abcdef" * 4
os.environ["DEBUG"] = "false"
os.environ["UPLOAD_DIR"] = str(_DB.parent / "uploads")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import create_access_token, hash_password  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402

BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36"


@pytest.fixture
def client():
    """A fresh, empty database and fresh rate limits for every test."""
    from app.api.public import comments

    comments._comment_attempts.clear()
    comments._reaction_attempts.clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_headers(client):
    db = SessionLocal()
    try:
        user = User(email="admin@example.com", username="admin", hashed_password=hash_password("x" * 12))
        db.add(user)
        db.commit()
        token = create_access_token({"sub": str(user.id)})
    finally:
        db.close()
    return {"Authorization": f"Bearer {token}"}


def visitor(ip: str, agent: str = BROWSER) -> dict:
    """Request headers for a distinct visitor (the proxy's X-Forwarded-For)."""
    return {"User-Agent": agent, "X-Forwarded-For": ip}
