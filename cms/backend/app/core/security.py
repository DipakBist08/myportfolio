"""
JWT access/refresh token management + TOTP-based MFA.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib, secrets, base64, io

from jose import JWTError, jwt
import bcrypt
import pyotp
import qrcode

from app.config import settings


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT ───────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = _now() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_temp_token(user_id: int) -> str:
    """Short-lived token issued when MFA is required (before TOTP verified)."""
    payload = {
        "sub": str(user_id),
        "type": "mfa_pending",
        "exp": _now() + timedelta(minutes=5),
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
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def decode_token_safe(token: str) -> Optional[dict]:
    try:
        return decode_token(token)
    except JWTError:
        return None


# ── MFA (TOTP) ────────────────────────────────────────────────────────────────

def generate_mfa_secret() -> str:
    return pyotp.random_base32()


def get_totp(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret, issuer=settings.MFA_ISSUER)


def verify_totp(secret: str, code: str) -> bool:
    totp = get_totp(secret)
    return totp.verify(code, valid_window=1)


def generate_qr_code(email: str, secret: str) -> str:
    """Returns a base64-encoded PNG data-URI."""
    totp = get_totp(secret)
    otpauth_url = totp.provisioning_uri(name=email, issuer_name=settings.MFA_ISSUER)

    img = qrcode.make(otpauth_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}", otpauth_url
