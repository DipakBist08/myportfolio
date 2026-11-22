"""Create the first admin account at startup when the database has none.

The CMS API on Render's free plan keeps SQLite inside the container
(DATABASE_URL=sqlite:///./cms.db), and that file is wiped on every deploy and
restart. On 22/11/2026 a deploy removed the only admin account, so nobody could
sign in and "Forgot password?" had no account to email. Render's free plan has
no shell, so seed.py could not be run there either.

So, on every start: if no superuser exists and ADMIN_EMAIL and ADMIN_PASSWORD
are set, that account is created (admin only: no sample posts, categories or
settings, unlike seed.py). An existing account is never changed, so a password
changed in the CMS stays changed for as long as the database lasts. A
persistent DATABASE_URL (PostgreSQL) is the real fix; this keeps the owner able
to sign in either way.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.models.user import User

logger = logging.getLogger(__name__)

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_BYTES = 72  # bcrypt's limit


def ensure_admin(db: Session) -> User | None:
    """Create the admin from ADMIN_EMAIL / ADMIN_PASSWORD if no superuser
    exists. Returns the new account, or None when nothing was created."""
    email = (settings.ADMIN_EMAIL or "").strip()
    password = settings.ADMIN_PASSWORD or ""
    if not email or not password:
        return None
    if db.query(User).filter(User.is_superuser == True).first() is not None:  # noqa: E712
        return None
    if len(password) < MIN_PASSWORD_LENGTH or len(password.encode()) > MAX_PASSWORD_BYTES:
        logger.error("ADMIN_PASSWORD must be %d to %d bytes long; no admin account was created.",
                     MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES)
        return None
    if db.query(User).filter(User.email == email).first() is not None:
        logger.error("An account with ADMIN_EMAIL exists but is not an admin; it was left unchanged.")
        return None

    username = settings.ADMIN_USERNAME
    if db.query(User).filter(User.username == username).first() is not None:
        username = f"{username}-{email.split('@')[0]}"[:100]
    admin = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
        full_name=settings.ADMIN_FULL_NAME,
        is_active=True,
        is_superuser=True,
    )
    db.add(admin)
    db.commit()
    logger.warning("No admin account existed, so one was created from ADMIN_EMAIL (%s).", email)
    return admin
