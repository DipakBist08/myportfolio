from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import List


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "QA Portfolio CMS"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str  # required — no default so startup fails loud if missing

    # Database
    DATABASE_URL: str = "sqlite:///./cms.db"

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Admin seed
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "Admin@1234!"
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

    # Master switch for the automatic "new post published" announcement.
    # Set to False to publish without ever emailing the list.
    NOTIFY_SUBSCRIBERS_ON_PUBLISH: bool = True

    @property
    def emails_enabled(self) -> bool:
        return bool(self.RESEND_API_KEY)

    # URLs
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    # Public blog root, used to build post links in announcement emails.
    BLOG_URL: str = "https://blog.dipakbist.com.np"

    # MFA
    MFA_ISSUER: str = "QA Portfolio CMS"

    @model_validator(mode="after")
    def validate_secret_key(self) -> "Settings":
        placeholder = "change-this-to-a-64-char-random-hex-string-in-production"
        if self.SECRET_KEY == placeholder or len(self.SECRET_KEY) < 32:
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
