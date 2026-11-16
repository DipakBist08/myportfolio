"""Sign-in and MFA hardening: rate limits, one-time MFA tokens and codes,
and re-authentication before the authenticator can be changed."""
import time
from datetime import datetime, timedelta, timezone

import jwt
import pyotp
import pytest

from app.config import settings
from app.core.security import create_access_token, hash_password
from app.database import SessionLocal
from app.models.user import User

PASSWORD = "Correct-Horse-9-battery"
LOGIN = "/api/v1/auth/login"
VERIFY = "/api/v1/auth/mfa/verify"


def make_user(email="owner@example.com", mfa_secret=None) -> tuple[int, dict]:
    db = SessionLocal()
    try:
        user = User(
            email=email, username=email.split("@")[0], hashed_password=hash_password(PASSWORD),
            mfa_secret=mfa_secret, mfa_enabled=bool(mfa_secret), is_superuser=True,
        )
        db.add(user)
        db.commit()
        return user.id, {"Authorization": f"Bearer {create_access_token({'sub': str(user.id)})}"}
    finally:
        db.close()


def stored_mfa(user_id: int) -> tuple[str | None, bool]:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        return user.mfa_secret, user.mfa_enabled
    finally:
        db.close()


def code(secret: str, steps_ahead: int = 0) -> str:
    totp = pyotp.TOTP(secret)
    return totp.generate_otp(int(time.time() // totp.interval) + steps_ahead)


def temp_token(client, email="owner@example.com") -> str:
    res = client.post(LOGIN, json={"email": email, "password": PASSWORD})
    assert res.status_code == 200 and res.json()["requires_mfa"], res.text
    return res.json()["temp_token"]


# ── Sign-in rate limits ──────────────────────────────────────────────────────

def test_account_is_locked_after_ten_wrong_passwords_even_for_the_right_one(client):
    make_user()
    for i in range(10):
        res = client.post(LOGIN, json={"email": "owner@example.com", "password": f"guess-{i}"},
                          headers={"X-Forwarded-For": f"203.0.113.{i}"})
        assert res.status_code == 401
    res = client.post(LOGIN, json={"email": "Owner@Example.com", "password": PASSWORD},
                      headers={"X-Forwarded-For": "198.51.100.7"})
    assert res.status_code == 429
    assert int(res.headers["Retry-After"]) > 0


def test_one_address_is_blocked_after_ten_failures_across_accounts(client):
    make_user()
    ip = {"X-Forwarded-For": "203.0.113.50"}
    for i in range(10):
        assert client.post(LOGIN, json={"email": f"nobody{i}@example.com", "password": "x"},
                           headers=ip).status_code == 401
    assert client.post(LOGIN, json={"email": "owner@example.com", "password": PASSWORD},
                       headers=ip).status_code == 429
    # Another address is unaffected.
    assert client.post(LOGIN, json={"email": "owner@example.com", "password": PASSWORD},
                       headers={"X-Forwarded-For": "198.51.100.8"}).status_code == 200


def test_unknown_and_known_accounts_fail_the_same_way(client):
    make_user()
    unknown = client.post(LOGIN, json={"email": "nobody@example.com", "password": "x"})
    wrong = client.post(LOGIN, json={"email": "owner@example.com", "password": "x"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_a_successful_sign_in_clears_the_account_counter(client):
    make_user()
    for i in range(9):
        client.post(LOGIN, json={"email": "owner@example.com", "password": f"guess-{i}"},
                    headers={"X-Forwarded-For": f"203.0.113.{i}"})
    assert client.post(LOGIN, json={"email": "owner@example.com", "password": PASSWORD}).status_code == 200
    res = client.post(LOGIN, json={"email": "owner@example.com", "password": "guess-again"},
                      headers={"X-Forwarded-For": "203.0.113.99"})
    assert res.status_code == 401


# ── MFA sign-in ──────────────────────────────────────────────────────────────

def test_mfa_token_signs_in_once(client):
    secret = pyotp.random_base32()
    make_user(mfa_secret=secret)
    temp = temp_token(client)
    assert client.post(VERIFY, json={"temp_token": temp, "otp_code": code(secret)}).status_code == 200
    # Same token again, even with a fresh code: refused.
    res = client.post(VERIFY, json={"temp_token": temp, "otp_code": code(secret, 1)})
    assert res.status_code == 401


def test_a_code_cannot_be_used_twice(client):
    secret = pyotp.random_base32()
    make_user(mfa_secret=secret)
    used = code(secret)
    assert client.post(VERIFY, json={"temp_token": temp_token(client), "otp_code": used}).status_code == 200
    res = client.post(VERIFY, json={"temp_token": temp_token(client), "otp_code": used})
    assert res.status_code == 401


def test_five_wrong_codes_block_mfa_even_with_new_tokens(client):
    secret = pyotp.random_base32()
    make_user(mfa_secret=secret)
    right = code(secret)
    wrong = f"{(int(right) + 1) % 1_000_000:06d}"
    for _ in range(5):
        assert client.post(VERIFY, json={"temp_token": temp_token(client), "otp_code": wrong}).status_code == 401
    res = client.post(VERIFY, json={"temp_token": temp_token(client), "otp_code": right})
    assert res.status_code == 429


def test_tokens_signed_another_way_are_refused(client):
    secret = pyotp.random_base32()
    user_id, _ = make_user(mfa_secret=secret)
    exp = datetime.now(timezone.utc) + timedelta(minutes=5)
    forged = [
        jwt.encode({"sub": str(user_id), "type": "mfa_pending", "jti": "a", "exp": exp}, None, algorithm="none"),
        jwt.encode({"sub": str(user_id), "type": "mfa_pending", "jti": "b", "exp": exp}, "x" * 64, algorithm="HS256"),
        jwt.encode({"sub": str(user_id), "type": "mfa_pending", "jti": "c"}, settings.SECRET_KEY, algorithm="HS256"),
    ]
    for token in forged:
        assert client.post(VERIFY, json={"temp_token": token, "otp_code": code(secret)}).status_code == 401
    no_exp_access = jwt.encode({"sub": str(user_id), "type": "access"}, settings.SECRET_KEY, algorithm="HS256")
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {no_exp_access}"}).status_code == 401


# ── Changing the authenticator ───────────────────────────────────────────────

def test_mfa_setup_needs_the_password(client):
    _, auth = make_user()
    assert client.post("/api/v1/auth/mfa/setup", headers=auth).status_code == 422
    res = client.post("/api/v1/auth/mfa/setup", json={"password": "wrong"}, headers=auth)
    assert res.status_code == 400


def test_setup_stores_nothing_until_a_code_confirms_it(client):
    user_id, auth = make_user()
    res = client.post("/api/v1/auth/mfa/setup", json={"password": PASSWORD}, headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert stored_mfa(user_id) == (None, False)

    res = client.post("/api/v1/auth/mfa/confirm", headers=auth,
                      json={"otp_code": code(body["secret"]), "setup_token": body["setup_token"]})
    assert res.status_code == 200
    assert stored_mfa(user_id) == (body["secret"], True)


def test_with_mfa_on_setup_also_needs_the_current_code_and_keeps_the_old_secret(client):
    old = pyotp.random_base32()
    user_id, auth = make_user(mfa_secret=old)
    setup = "/api/v1/auth/mfa/setup"
    assert client.post(setup, json={"password": PASSWORD}, headers=auth).status_code == 400
    assert client.post(setup, json={"password": PASSWORD, "otp_code": "000000" if code(old) != "000000" else "111111"},
                       headers=auth).status_code == 400
    res = client.post(setup, json={"password": PASSWORD, "otp_code": code(old)}, headers=auth)
    assert res.status_code == 200
    # Abandoned setup: the account still uses the old secret.
    assert stored_mfa(user_id) == (old, True)


def test_a_setup_token_works_only_for_its_own_account(client):
    _, auth_a = make_user("a@example.com")
    _, auth_b = make_user("b@example.com")
    body = client.post("/api/v1/auth/mfa/setup", json={"password": PASSWORD}, headers=auth_a).json()
    res = client.post("/api/v1/auth/mfa/confirm", headers=auth_b,
                      json={"otp_code": code(body["secret"]), "setup_token": body["setup_token"]})
    assert res.status_code == 400


def test_wrong_codes_to_disable_mfa_are_limited(client):
    secret = pyotp.random_base32()
    _, auth = make_user(mfa_secret=secret)
    right = code(secret)
    wrong = f"{(int(right) + 1) % 1_000_000:06d}"
    for _ in range(5):
        assert client.post("/api/v1/auth/mfa/disable", json={"otp_code": wrong}, headers=auth).status_code == 400
    assert client.post("/api/v1/auth/mfa/disable", json={"otp_code": right}, headers=auth).status_code == 429


def test_password_guesses_through_change_password_count_towards_the_lock(client):
    _, auth = make_user()
    for i in range(10):
        res = client.post("/api/v1/auth/change-password", headers=auth,
                          json={"current_password": f"guess-{i}", "new_password": "New-Password-1"})
        assert res.status_code == 400
    assert client.post(LOGIN, json={"email": "owner@example.com", "password": PASSWORD}).status_code == 429
