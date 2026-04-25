"""
Auth routes:  login → (MFA verify) → tokens  |  refresh  |  logout  |  profile
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, RefreshToken
from app.schemas.auth import (
    LoginRequest, MFAVerifyRequest, MFASetupResponse,
    MFAConfirmRequest, TokenResponse, RefreshRequest,
    PasswordChangeRequest, UserProfile, UserUpdate,
)
from app.core.security import (
    verify_password, create_access_token, create_temp_token,
    create_refresh_token, hash_token, decode_token_safe,
    generate_mfa_secret, generate_qr_code, verify_totp,
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])


def _make_access(user: User) -> str:
    return create_access_token({"sub": str(user.id)})


def _store_refresh(db: Session, user: User, raw_token: str):
    hashed = hash_token(raw_token)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(user_id=user.id, token_hash=hashed, expires_at=expires))
    db.commit()


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    if user.mfa_enabled:
        temp = create_temp_token(user.id)
        return TokenResponse(access_token="", requires_mfa=True, temp_token=temp)

    # No MFA — issue tokens immediately
    access = _make_access(user)
    raw_rt, _ = create_refresh_token()
    _store_refresh(db, user, raw_rt)
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    return TokenResponse(access_token=access, requires_mfa=False)


# ── MFA verify ────────────────────────────────────────────────────────────────

@router.post("/mfa/verify", response_model=TokenResponse)
def mfa_verify(body: MFAVerifyRequest, db: Session = Depends(get_db)):
    payload = decode_token_safe(body.temp_token)
    if not payload or payload.get("type") != "mfa_pending":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired MFA session")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="MFA not configured")

    if not verify_totp(user.mfa_secret, body.otp_code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP code")

    access = _make_access(user)
    raw_rt, _ = create_refresh_token()
    _store_refresh(db, user, raw_rt)
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    return TokenResponse(access_token=access, refresh_token=raw_rt)


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    hashed = hash_token(body.refresh_token)
    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hashed,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.now(timezone.utc),
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == record.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Rotate
    record.is_revoked = True
    access = _make_access(user)
    raw_rt, _ = create_refresh_token()
    _store_refresh(db, user, raw_rt)
    db.commit()
    return TokenResponse(access_token=access, refresh_token=raw_rt)


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    hashed = hash_token(body.refresh_token)
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == hashed).first()
    if record:
        record.is_revoked = True
        db.commit()
    return {"detail": "Logged out"}


# ── MFA setup ────────────────────────────────────────────────────────────────

@router.post("/mfa/setup", response_model=MFASetupResponse)
def mfa_setup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    secret = generate_mfa_secret()
    current_user.mfa_secret = secret
    db.commit()
    qr_data_uri, otpauth_url = generate_qr_code(current_user.email, secret)
    return MFASetupResponse(secret=secret, qr_code_url=qr_data_uri, otpauth_url=otpauth_url)


@router.post("/mfa/confirm")
def mfa_confirm(
    body: MFAConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Run /mfa/setup first")
    if not verify_totp(current_user.mfa_secret, body.otp_code):
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    current_user.mfa_enabled = True
    db.commit()
    return {"detail": "MFA enabled"}


@router.post("/mfa/disable")
def mfa_disable(
    body: MFAConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.mfa_enabled or not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA not enabled")
    if not verify_totp(current_user.mfa_secret, body.otp_code):
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    db.commit()
    return {"detail": "MFA disabled"}


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserProfile)
def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(current_user, field, val)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.core.security import hash_password
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"detail": "Password updated"}
