from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MFAVerifyRequest(BaseModel):
    temp_token: str
    otp_code: str


class MFASetupResponse(BaseModel):
    secret: str
    qr_code_url: str          # data:image/png;base64,...
    otpauth_url: str


class MFAConfirmRequest(BaseModel):
    otp_code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    requires_mfa: bool = False
    temp_token: Optional[str] = None  # present when MFA needed


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v


class UserProfile(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    bio: str
    avatar_url: str
    is_superuser: bool
    mfa_enabled: bool

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
