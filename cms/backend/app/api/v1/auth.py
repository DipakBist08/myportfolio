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
    LoginRequest, MFAVerifyRequest, MFASetupRequest, MFASetupResponse,
    MFAEnableRequest, MFAConfirmRequest, TokenResponse, RefreshRequest,
    PasswordChangeRequest, UserProfile, UserUpdate,
)
from app.core.security import (
    verify_password, verify_password_or_dummy, create_access_token,
    create_temp_token, create_mfa_setup_token, create_refresh_token,
    hash_token, decode_token_safe, generate_mfa_secret, generate_qr_code,
    verify_totp, verify_totp_once,
)
from app.core.throttle import (
    PASSWORD_FAILURES, MFA_FAILURES, USED_MFA_TOKENS,
    account_key, ip_key, user_key,
)
from app.core.visitor import client_ip
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])


def _make_access(user: User) -> str:
    return create_access_token({"sub": str(user.id)})


def _store_refresh(db: Session, user: User, raw_token: str):
    hashed = hash_token(raw_token)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(user_id=user.id, token_hash=hashed, expires_at=expires))
    db.commit()


def _check_password(user: User, password: str, request: Request) -> None:
    """Re-check a signed-in user's password before a sensitive change.
    Wrong guesses count against the same limits as sign-in, so a stolen
    access token cannot be used to guess the password here instead."""
    keys = (account_key(user.email), ip_key(client_ip(request)))
    PASSWORD_FAILURES.check(*keys)
    if not verify_password(password, user.hashed_password):
        PASSWORD_FAILURES.fail(*keys)
        raise HTTPException(status_code=400, detail="Current password is incorrect")


def _check_code(user: User, secret: str, code: str, *, one_time: bool, error_status: int) -> None:
    """Check an authenticator code, limited to MFA_FAILURES wrong codes per user."""
    key = user_key(user.id)
    MFA_FAILURES.check(key)
    ok = verify_totp_once(user.id, secret, code) if one_time else verify_totp(secret, code)
    if not ok:
        MFA_FAILURES.fail(key)
        raise HTTPException(status_code=error_status, detail="Invalid OTP code")
    MFA_FAILURES.reset(key)


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    keys = (account_key(body.email), ip_key(client_ip(request)))
    PASSWORD_FAILURES.check(*keys)
    user = db.query(User).filter(User.email == body.email).first()
    if not verify_password_or_dummy(body.password, user.hashed_password if user else None):
        PASSWORD_FAILURES.fail(*keys)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    PASSWORD_FAILURES.reset(keys[0])
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
    if not payload or payload.get("type") != "mfa_pending" or not payload.get("jti"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired MFA session")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="MFA not configured")

    _check_code(user, user.mfa_secret, body.otp_code, one_time=True,
                error_status=status.HTTP_401_UNAUTHORIZED)
    # One successful sign-in per MFA token.
    if not USED_MFA_TOKENS.claim(payload["jti"], float(payload["exp"])):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired MFA session")

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
def mfa_setup(
    body: MFASetupRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Start MFA setup. Needs the password, plus the current code when MFA is
    already on, so an access token alone cannot replace the authenticator.
    Nothing is stored until /mfa/confirm proves the new secret."""
    _check_password(current_user, body.password, request)
    if current_user.mfa_enabled:
        if not body.otp_code:
            raise HTTPException(status_code=400, detail="Enter the code from your current authenticator app")
        _check_code(current_user, current_user.mfa_secret, body.otp_code, one_time=True, error_status=400)
    secret = generate_mfa_secret()
    qr_data_uri, otpauth_url = generate_qr_code(current_user.email, secret)
    return MFASetupResponse(
        secret=secret, qr_code_url=qr_data_uri, otpauth_url=otpauth_url,
        setup_token=create_mfa_setup_token(current_user.id, secret),
    )


@router.post("/mfa/confirm")
def mfa_confirm(
    body: MFAEnableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload = decode_token_safe(body.setup_token)
    if (not payload or payload.get("type") != "mfa_setup"
            or payload.get("sub") != str(current_user.id) or not payload.get("secret")):
        raise HTTPException(status_code=400, detail="MFA setup has expired. Start again.")
    _check_code(current_user, payload["secret"], body.otp_code, one_time=False, error_status=400)
    current_user.mfa_secret = payload["secret"]
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
    _check_code(current_user, current_user.mfa_secret, body.otp_code, one_time=True, error_status=400)
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
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.core.security import hash_password
    _check_password(current_user, body.current_password, request)
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"detail": "Password updated"}
