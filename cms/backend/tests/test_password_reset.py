"""Forgot password: the emailed link, what it can and cannot do, and that the
flow never reveals which email addresses have an account."""
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import jwt
import pytest

from app.api.v1 import auth as auth_routes
from app.config import settings
from app.core.security import create_password_reset_token, hash_password, verify_password
from app.database import SessionLocal
from app.models.user import RefreshToken, User

OLD = "Old-password-123"
NEW = "New-password-456"
FORGOT = "/api/v1/auth/forgot-password"
RESET = "/api/v1/auth/reset-password"
LOGIN = "/api/v1/auth/login"
EMAIL = "owner@example.com"


@pytest.fixture
def outbox(monkeypatch):
    """Capture reset emails instead of sending them."""
    sent = []
    monkeypatch.setattr(auth_routes, "send_password_reset_email",
                        lambda email, name, url: sent.append({"to": email, "name": name, "url": url}) or True)
    return sent


def make_user(email=EMAIL, active=True) -> int:
    db = SessionLocal()
    try:
        user = User(email=email, username=email.split("@")[0], full_name="Owner",
                    hashed_password=hash_password(OLD), is_active=active, is_superuser=True)
        db.add(user)
        db.commit()
        return user.id
    finally:
        db.close()


def token_from(mail: dict) -> str:
    url = urlsplit(mail["url"])
    assert f"{url.scheme}://{url.netloc}" == settings.CMS_URL.rstrip("/")
    assert url.path == "/reset-password" and not url.query, "token must not be in the path or query"
    assert url.fragment.startswith("token=")
    return url.fragment.removeprefix("token=")


def request_link(client, outbox, email=EMAIL) -> str:
    res = client.post(FORGOT, json={"email": email})
    assert res.status_code == 200, res.text
    return token_from(outbox[-1])


def can_sign_in(client, password: str) -> bool:
    return client.post(LOGIN, json={"email": EMAIL, "password": password}).status_code == 200


# ── Requesting a link ─────────────────────────────────────────────────────────

def test_known_email_gets_a_link_that_resets_the_password(client, outbox):
    make_user()
    token = request_link(client, outbox)
    assert outbox[0]["to"] == EMAIL and outbox[0]["name"] == "Owner"

    res = client.post(RESET, json={"token": token, "new_password": NEW})
    assert res.status_code == 200, res.text
    assert can_sign_in(client, NEW)
    assert not can_sign_in(client, OLD)


def test_unknown_and_known_emails_get_the_same_answer(client, outbox):
    make_user()
    known = client.post(FORGOT, json={"email": EMAIL})
    unknown = client.post(FORGOT, json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert [m["to"] for m in outbox] == [EMAIL]


def test_disabled_account_gets_no_email(client, outbox):
    make_user(active=False)
    assert client.post(FORGOT, json={"email": EMAIL}).status_code == 200
    assert outbox == []


def test_one_inbox_gets_at_most_three_emails_per_window(client, outbox):
    make_user()
    for i in range(3):
        assert client.post(FORGOT, json={"email": EMAIL},
                           headers={"X-Forwarded-For": f"203.0.113.{i}"}).status_code == 200
    res = client.post(FORGOT, json={"email": EMAIL}, headers={"X-Forwarded-For": "203.0.113.99"})
    assert res.status_code == 429 and "Retry-After" in res.headers
    assert len(outbox) == 3


def test_limit_applies_the_same_to_unknown_emails(client, outbox):
    """A 429 must not tell an attacker the address has no account."""
    for _ in range(3):
        client.post(FORGOT, json={"email": "nobody@example.com"})
    assert client.post(FORGOT, json={"email": "nobody@example.com"}).status_code == 429


def test_one_ip_is_limited_across_many_emails(client, outbox):
    for i in range(10):
        assert client.post(FORGOT, json={"email": f"user{i}@example.com"}).status_code == 200
    assert client.post(FORGOT, json={"email": "user99@example.com"}).status_code == 429


# ── Using the link ────────────────────────────────────────────────────────────

def test_link_works_only_once(client, outbox):
    make_user()
    token = request_link(client, outbox)
    assert client.post(RESET, json={"token": token, "new_password": NEW}).status_code == 200
    again = client.post(RESET, json={"token": token, "new_password": "Third-password-789"})
    assert again.status_code == 400
    assert can_sign_in(client, NEW)


def test_older_links_die_when_the_password_changes(client, outbox):
    make_user()
    first = request_link(client, outbox)
    second = request_link(client, outbox)
    assert client.post(RESET, json={"token": second, "new_password": NEW}).status_code == 200
    assert client.post(RESET, json={"token": first, "new_password": "Third-password-789"}).status_code == 400


def test_expired_link_is_refused(client):
    user_id = make_user()
    db = SessionLocal()
    try:
        hashed = db.get(User, user_id).hashed_password
    finally:
        db.close()
    payload = jwt.decode(create_password_reset_token(user_id, hashed), settings.SECRET_KEY,
                         algorithms=[settings.ALGORITHM])
    payload["exp"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    expired = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert client.post(RESET, json={"token": expired, "new_password": NEW}).status_code == 400
    assert can_sign_in(client, OLD)


def test_other_tokens_cannot_reset_a_password(client):
    """An access token or MFA token is signed with the same key, but is not a reset link."""
    from app.core.security import create_access_token, create_temp_token
    user_id = make_user()
    for token in (create_access_token({"sub": str(user_id)}), create_temp_token(user_id), "not-a-token"):
        assert client.post(RESET, json={"token": token, "new_password": NEW}).status_code == 400
    assert can_sign_in(client, OLD)


def test_weak_password_is_refused_and_link_still_works(client, outbox):
    make_user()
    token = request_link(client, outbox)
    for weak in ("short1A", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere", "Aa1" + "x" * 70):
        assert client.post(RESET, json={"token": token, "new_password": weak}).status_code == 422, weak
    assert client.post(RESET, json={"token": token, "new_password": NEW}).status_code == 200


def test_reset_signs_out_every_session(client, outbox):
    user_id = make_user()
    db = SessionLocal()
    try:
        db.add(RefreshToken(user_id=user_id, token_hash="h" * 64,
                            expires_at=datetime.now(timezone.utc) + timedelta(days=7)))
        db.commit()
    finally:
        db.close()
    token = request_link(client, outbox)
    assert client.post(RESET, json={"token": token, "new_password": NEW}).status_code == 200
    db = SessionLocal()
    try:
        assert all(rt.is_revoked for rt in db.query(RefreshToken).filter_by(user_id=user_id))
    finally:
        db.close()


def test_reset_unlocks_an_account_locked_by_wrong_passwords(client, outbox):
    make_user()
    for i in range(10):
        client.post(LOGIN, json={"email": EMAIL, "password": f"guess-{i}"},
                    headers={"X-Forwarded-For": f"198.51.100.{i}"})
    assert client.post(LOGIN, json={"email": EMAIL, "password": OLD}).status_code == 429
    token = request_link(client, outbox)
    assert client.post(RESET, json={"token": token, "new_password": NEW}).status_code == 200
    assert can_sign_in(client, NEW)


def test_reset_keeps_mfa_on(client, outbox):
    import pyotp
    secret = pyotp.random_base32()
    user_id = make_user()
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        user.mfa_secret, user.mfa_enabled = secret, True
        db.commit()
    finally:
        db.close()
    token = request_link(client, outbox)
    assert client.post(RESET, json={"token": token, "new_password": NEW}).status_code == 200
    res = client.post(LOGIN, json={"email": EMAIL, "password": NEW})
    assert res.status_code == 200 and res.json()["requires_mfa"] is True
    assert res.json()["access_token"] == ""


# ── The email itself ──────────────────────────────────────────────────────────

def test_email_is_sent_through_resend_with_the_link(client, monkeypatch):
    import resend
    sent = []
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(resend.Emails, "send", lambda params: sent.append(params) or {"id": "x"})
    make_user()
    assert client.post(FORGOT, json={"email": EMAIL}).status_code == 200
    assert len(sent) == 1
    msg = sent[0]
    assert msg["to"] == [EMAIL] and msg["subject"] == "Reset your CMS password"
    link = msg["text"].split("\n\n")[2].strip()
    assert link.startswith(f"{settings.CMS_URL.rstrip('/')}/reset-password#token=")
    assert link in msg["html"]


def test_email_off_in_production_fails_quietly(monkeypatch):
    from app.core.email import send_password_reset_email
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")
    monkeypatch.setattr(settings, "DEBUG", False)
    assert send_password_reset_email(EMAIL, "", "https://cms.example/reset-password#token=x") is False
