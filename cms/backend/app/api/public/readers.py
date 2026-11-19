"""Blog reader sign-in with Google.

POST /api/public/auth/google   {credential}  verify Google's ID token, set the session cookie
GET  /api/public/auth/me                     {"reader": {...} | null}
POST /api/public/auth/logout                 clear the session cookie
"""
from __future__ import annotations

import html
import time
from collections import defaultdict
from typing import Optional

import bleach
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.core.readers import (
    GoogleTokenError, GoogleUnavailable, check_origin, clear_session_cookie, current_reader,
    public_reader, set_session_cookie, verify_google_id_token,
)
from app.core.visitor import client_ip
from app.database import get_db
from app.models.reader import Reader
from app.models.traffic import utcnow

router = APIRouter(prefix="/auth", tags=["Public – Readers"])

NO_STORE = {"Cache-Control": "no-store"}

# 10 sign-in attempts per address per minute: plenty for a person, useless for guessing.
_signin_attempts: dict[str, list[float]] = defaultdict(list)
_SIGNIN_LIMIT = 10
_SIGNIN_WINDOW = 60.0


class GoogleCredential(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


def _plain(value: object, limit: int) -> str:
    text = html.unescape(bleach.clean(str(value or ""), tags=[], strip=True)).strip()
    return text[:limit]


def _picture(value: object) -> str:
    url = str(value or "")
    return url[:500] if url.startswith("https://") else ""


@router.post("/google")
def sign_in_with_google(body: GoogleCredential, request: Request, response: Response, db: Session = Depends(get_db)):
    check_origin(request)
    if not settings.reader_sign_in_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Sign-in is not available yet.")

    now = time.monotonic()
    ip = client_ip(request)
    recent = [t for t in _signin_attempts[ip] if t > now - _SIGNIN_WINDOW]
    if len(recent) >= _SIGNIN_LIMIT:
        raise HTTPException(status_code=429, detail="Too many sign-in attempts. Try again in a minute.",
                            headers={"Retry-After": "60"})
    _signin_attempts[ip] = recent + [now]

    try:
        claims = verify_google_id_token(body.credential)
    except GoogleUnavailable:
        raise HTTPException(status_code=503, detail="Could not reach Google. Please try again.")
    except GoogleTokenError:
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")

    email = str(claims["email"])[:255]
    name = _plain(claims.get("name") or claims.get("given_name"), 100) or email.split("@")[0][:100]

    def upsert() -> Reader:
        reader = db.query(Reader).filter(Reader.google_sub == str(claims["sub"])).first()
        if reader is None:
            reader = Reader(google_sub=str(claims["sub"]))
            db.add(reader)
        reader.email = email
        reader.name = name
        reader.picture = _picture(claims.get("picture"))
        reader.last_login_at = utcnow()
        db.commit()
        db.refresh(reader)
        return reader

    try:
        reader = upsert()
    except IntegrityError:  # two sign-ins for a new account raced; the second updates the first
        db.rollback()
        reader = upsert()

    set_session_cookie(response, request, reader.id)
    response.headers.update(NO_STORE)
    return {"reader": public_reader(reader)}


@router.get("/me")
def me(response: Response, reader: Optional[Reader] = Depends(current_reader)):
    response.headers.update(NO_STORE)
    return {"reader": public_reader(reader) if reader else None, "sign_in": settings.reader_sign_in_enabled}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(request: Request, response: Response):
    check_origin(request)
    clear_session_cookie(response, request)
    response.headers.update(NO_STORE)
