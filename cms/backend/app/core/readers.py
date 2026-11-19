"""Blog reader sign-in: Google ID token verification and the reader session.

Flow: the blog shows Google's "Sign in with Google" button (Google Identity
Services). Google hands the browser a signed ID token (a JWT), the blog posts
it to /api/public/auth/google, and this module checks it against Google's
published keys, the expected audience (our OAuth client ID) and issuer. The
API then sets its own session cookie, so Google's token is used exactly once.

The reader session is an HS256 JWT in an httpOnly cookie, signed with a key
derived from SECRET_KEY that is different from the admin token key, and with
its own audience: an admin token is never a reader session and a reader
session is never an admin token.

Cookie-authenticated writes are protected from cross-site requests twice:
the cookie is SameSite=Lax (browsers do not attach it to another site's
POST), and `require_reader` refuses a request whose Origin is not one of
the blog's own origins.
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.reader import Reader

COOKIE = "reader_session"
COOKIE_PATH = "/api/public"
AUDIENCE = "blog-reader"
GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]", "::1"}


class GoogleTokenError(Exception):
    """The credential is not a valid, verified Google ID token for this app."""


class GoogleUnavailable(Exception):
    """Google's signing keys could not be fetched, so nothing can be checked."""


@lru_cache(maxsize=1)
def _google_keys() -> jwt.PyJWKClient:
    # Keys are cached for 5 minutes; a token signed with a newly rotated key
    # triggers one refetch.
    return jwt.PyJWKClient(GOOGLE_CERTS, cache_keys=True, lifespan=300, timeout=10)


def verify_google_id_token(credential: str) -> dict:
    """The verified claims of a Google ID token, or GoogleTokenError.

    Checks the RS256 signature against Google's keys, `aud` (our client ID),
    `iss`, `exp`/`iat`, and that Google has verified the email address."""
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleTokenError("Google sign-in is not configured")
    try:
        key = _google_keys().get_signing_key_from_jwt(credential)
        claims = jwt.decode(
            credential,
            key.key,
            algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_ID,
            issuer=GOOGLE_ISSUERS,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            leeway=30,
        )
    except jwt.exceptions.PyJWKClientConnectionError as err:
        raise GoogleUnavailable(str(err)) from err
    except jwt.PyJWTError as err:
        raise GoogleTokenError(str(err)) from err
    if claims.get("email_verified") is not True or not claims.get("email"):
        raise GoogleTokenError("The Google account's email address is not verified")
    return claims


def _session_key() -> bytes:
    return hmac.new(settings.SECRET_KEY.encode(), b"blog-reader-session", hashlib.sha256).digest()


def create_reader_session(reader_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(reader_id),
        "aud": AUDIENCE,
        "type": "reader",
        "iat": now,
        "exp": now + timedelta(days=settings.READER_SESSION_DAYS),
    }
    return jwt.encode(payload, _session_key(), algorithm="HS256")


def reader_id_from_session(token: str) -> Optional[int]:
    try:
        claims = jwt.decode(
            token, _session_key(), algorithms=["HS256"], audience=AUDIENCE,
            options={"require": ["exp", "sub", "aud"]},
        )
    except jwt.PyJWTError:
        return None
    if claims.get("type") != "reader":
        return None
    try:
        return int(claims["sub"])
    except (TypeError, ValueError):
        return None


def _is_local(request: Request) -> bool:
    return (request.url.hostname or "") in _LOCAL_HOSTS


def set_session_cookie(response: Response, request: Request, reader_id: int) -> None:
    # Secure everywhere except a local http:// API, where browsers would drop it.
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https" or not _is_local(request)
    response.set_cookie(
        COOKIE,
        create_reader_session(reader_id),
        max_age=settings.READER_SESSION_DAYS * 24 * 3600,
        path=COOKIE_PATH,
        httponly=True,
        secure=secure,
        samesite="lax",
    )


def clear_session_cookie(response: Response, request: Request) -> None:
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https" or not _is_local(request)
    response.delete_cookie(COOKIE, path=COOKIE_PATH, httponly=True, secure=secure, samesite="lax")


def current_reader(request: Request, db: Session = Depends(get_db)) -> Optional[Reader]:
    """The signed-in reader, or None. For reads that only personalise."""
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    reader_id = reader_id_from_session(token)
    if reader_id is None:
        return None
    return db.get(Reader, reader_id)


def check_origin(request: Request) -> None:
    """Refuse a browser request sent from a page that is not one of ours.
    Browsers always send Origin on cross-origin and on POST/DELETE requests;
    a request without one did not come from another site's page."""
    origin = request.headers.get("origin")
    if origin and origin not in settings.cors_origins:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Request from an unknown site")


def require_reader(request: Request, reader: Optional[Reader] = Depends(current_reader)) -> Reader:
    """The signed-in reader, for writes (clap, comment). 401 if not signed in."""
    check_origin(request)
    if reader is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in with Google to do that.",
        )
    return reader


def public_reader(reader: Reader) -> dict:
    """What the blog may show about a reader: never the email address."""
    return {"id": reader.id, "name": reader.name, "picture": reader.picture or ""}
