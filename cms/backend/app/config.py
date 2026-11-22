from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import List, Optional
import re

# Values from example files and docs that must never be a real SECRET_KEY.
_PLACEHOLDER = re.compile(r"change|replace|example|placeholder|your[-_ ]|xxxx", re.IGNORECASE)


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "QA Portfolio CMS"
    APP_ENV: str = "development"
    # Off unless set: DEBUG publishes /docs and the OpenAPI schema and logs SQL.
    # Set DEBUG=true in a local .env for development.
    DEBUG: bool = False
    SECRET_KEY: str  # required — no default so startup fails loud if missing

    # Database
    DATABASE_URL: str = "sqlite:///./cms.db"
    # Neon: DATABASE_URL is the pooled connection (app traffic) and
    # DATABASE_URL_UNPOOLED the direct one, used to create the tables at
    # startup (schema changes should not go through the pooler). Both come
    # from `neon env pull`; empty means DATABASE_URL is used for both.
    DATABASE_URL_UNPOOLED: str = ""

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Admin seed (seed.py). No defaults: a missing value must never fall back
    # to a published password.
    ADMIN_EMAIL: Optional[str] = None
    ADMIN_PASSWORD: Optional[str] = None
    ADMIN_USERNAME: str = "admin"
    ADMIN_FULL_NAME: str = "CMS Admin"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,https://blog.dipakbist.com.np,https://dipak-blog.vercel.app"

    # File storage
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10 MB

    # Email — Resend
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "newsletter@dipakbist.com.np"
    RESEND_FROM_NAME: str = "Dipak Bist | QA Blog"

    # Seconds to wait between individual sends. Resend's free tier allows
    # ~2 requests/second; 0.6 keeps a margin. Sends run in a background task,
    # so this delay never blocks an API response.
    RESEND_SEND_DELAY: float = 0.6

    # Blog readers sign in with Google to clap and comment. The OAuth client ID
    # from Google Cloud Console (APIs & Services > Credentials > OAuth client ID,
    # type "Web application"); the blog uses the same value as
    # NEXT_PUBLIC_GOOGLE_CLIENT_ID. Empty = reader sign-in is off.
    GOOGLE_CLIENT_ID: str = ""
    READER_SESSION_DAYS: int = 30

    @property
    def reader_sign_in_enabled(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID)

    # Master switch for the automatic "new post published" announcement.
    # Set to False to publish without ever emailing the list.
    NOTIFY_SUBSCRIBERS_ON_PUBLISH: bool = True

    @property
    def emails_enabled(self) -> bool:
        return bool(self.RESEND_API_KEY)

    # URLs
    FRONTEND_URL: str = "http://localhost:5173"
    # The CMS admin site. Password-reset emails link here, so it must be the
    # real address (set CMS_URL=http://localhost:5173 in a local .env).
    CMS_URL: str = "https://cms.dipakbist.com.np"
    BACKEND_URL: str = "http://localhost:8000"
    # Public blog root, used to build post links in announcement emails.
    BLOG_URL: str = "https://blog.dipakbist.com.np"

    # MFA
    MFA_ISSUER: str = "QA Portfolio CMS"

    # How long a "Forgot password?" email link works.
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    @model_validator(mode="after")
    def validate_secret_key(self) -> "Settings":
        if len(self.SECRET_KEY) < 32 or _PLACEHOLDER.search(self.SECRET_KEY):
            raise ValueError(
                "SECRET_KEY must be a random hex string of at least 32 bytes. "
                "Generate one with: python3 -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return self

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "case_sensitive": True, "extra": "ignore"}


settings = Settings()
