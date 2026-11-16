"""
JWT access/refresh token management + TOTP-based MFA.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib, secrets, base64, io, threading, time

import jwt
import bcrypt
import pyotp
from pyotp.utils import strings_equal
import qrcode

from app.config import settings


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


_UNKNOWN_ACCOUNT_HASH: Optional[str] = None


def verify_password_or_dummy(plain: str, hashed: Optional[str]) -> bool:
    """verify_password, but also spends the bcrypt time when there is no
    account, so response time does not reveal which emails exist."""
    global _UNKNOWN_ACCOUNT_HASH
    if hashed:
        return verify_password(plain, hashed)
    if _UNKNOWN_ACCOUNT_HASH is None:
        _UNKNOWN_ACCOUNT_HASH = hash_password(secrets.token_urlsafe(16))
    verify_password(plain, _UNKNOWN_ACCOUNT_HASH)
    return False


# ── JWT ───────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = _now() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_temp_token(user_id: int) -> str:
    """Short-lived token issued when MFA is required (before TOTP verified).
    Its `jti` lets the server accept it for one successful sign-in only."""
    payload = {
        "sub": str(user_id),
        "type": "mfa_pending",
        "jti": secrets.token_urlsafe(16),
        "exp": _now() + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_mfa_setup_token(user_id: int, secret: str) -> str:
    """Carries a new, not yet confirmed MFA secret from /mfa/setup to
    /mfa/confirm. The account keeps its current secret until the new one is
    proven with a code, so an abandoned setup never locks anyone out."""
    payload = {
        "sub": str(user_id),
        "type": "mfa_setup",
        "secret": secret,
        "exp": _now() + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, hashed_token). Store the hash; send the raw."""
    raw = secrets.token_urlsafe(48)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def decode_token(token: str) -> dict:
    return jwt.decode(
        token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM],
        options={"require": ["exp", "sub", "type"]},
    )


def decode_token_safe(token: str) -> Optional[dict]:
    try:
        return decode_token(token)
    except jwt.PyJWTError:
        return None


# ── MFA (TOTP) ────────────────────────────────────────────────────────────────

def generate_mfa_secret() -> str:
    return pyotp.random_base32()


def get_totp(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret, issuer=settings.MFA_ISSUER)


def verify_totp(secret: str, code: str) -> bool:
    totp = get_totp(secret)
    return totp.verify(code, valid_window=1)


# Last accepted time step per user. A code is only good once: RFC 6238 §5.2
# says to reject a code whose time step is not after the last one accepted.
_last_accepted_step: dict[int, int] = {}
_step_lock = threading.Lock()


def verify_totp_once(user_id: int, secret: str, code: str) -> bool:
    """verify_totp, but a code (or an older one) cannot be used twice."""
    totp = get_totp(secret)
    code = (code or "").strip()
    if len(code) != totp.digits or not code.isdigit():
        return False
    now = int(time.time() // totp.interval)
    for step in (now, now - 1, now + 1):
        if strings_equal(totp.generate_otp(step), code):
            with _step_lock:
                if step <= _last_accepted_step.get(user_id, -1):
                    return False
                _last_accepted_step[user_id] = step
            return True
    return False


def forget_accepted_codes() -> None:
    """For tests."""
    with _step_lock:
        _last_accepted_step.clear()


def generate_qr_code(email: str, secret: str) -> str:
    """Returns a base64-encoded PNG data-URI."""
    totp = get_totp(secret)
    otpauth_url = totp.provisioning_uri(name=email, issuer_name=settings.MFA_ISSUER)

    img = qrcode.make(otpauth_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}", otpauth_url
