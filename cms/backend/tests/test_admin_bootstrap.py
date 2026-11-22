"""The admin account is recreated at startup when the database has none.

On Render's free plan the SQLite file is wiped on every deploy and restart; on
22/11/2026 that removed the only admin, so nobody could sign in. The API now
creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD whenever no superuser
exists, and never touches an existing account.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.core.bootstrap import ensure_admin
from app.core.security import hash_password
from app.database import SessionLocal
from app.main import app
from app.models.user import User

LOGIN = "/api/v1/auth/login"
EMAIL = "owner@example.com"
PASSWORD = "a-long-admin-password"


@pytest.fixture
def admin_env(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", EMAIL)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", PASSWORD)


def users() -> list[tuple[str, bool]]:
    db = SessionLocal()
    try:
        return [(u.email, bool(u.is_superuser)) for u in db.query(User).order_by(User.id)]
    finally:
        db.close()


def test_an_empty_database_gets_the_admin_at_startup_and_it_can_sign_in(client, admin_env):
    assert users() == []
    with TestClient(app):  # a restart runs the startup again
        pass
    assert users() == [(EMAIL, True)]
    res = client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    assert res.status_code == 200 and res.json()["access_token"]


def test_the_admin_is_not_duplicated_or_changed_on_later_starts(client, admin_env, monkeypatch):
    db = SessionLocal()
    ensure_admin(db)
    db.close()
    # The owner changes the password in the CMS; Render still holds the old one.
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "another-long-password")
    with TestClient(app):
        pass
    assert users() == [(EMAIL, True)]
    assert client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).status_code == 200


def test_an_existing_admin_with_another_email_is_left_alone(client, admin_env):
    db = SessionLocal()
    db.add(User(email="someone@example.com", username="someone", hashed_password=hash_password("x" * 12),
                is_superuser=True))
    db.commit()
    assert ensure_admin(db) is None
    db.close()
    assert users() == [("someone@example.com", True)]


@pytest.mark.parametrize("email, password", [
    (None, PASSWORD),            # not configured
    (EMAIL, None),
    (EMAIL, "too-short"),        # under 12 characters
    (EMAIL, "x" * 73),           # over bcrypt's 72 bytes
])
def test_nothing_is_created_without_a_usable_email_and_password(client, monkeypatch, email, password):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", email)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", password)
    db = SessionLocal()
    assert ensure_admin(db) is None
    db.close()
    assert users() == []


def test_a_non_admin_account_with_that_email_is_not_promoted(client, admin_env):
    db = SessionLocal()
    db.add(User(email=EMAIL, username="owner", hashed_password=hash_password("x" * 12), is_superuser=False))
    db.commit()
    assert ensure_admin(db) is None
    db.close()
    assert users() == [(EMAIL, False)]
