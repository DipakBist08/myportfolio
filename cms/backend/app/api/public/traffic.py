"""Visit counting for the portfolio and the blog.

POST /api/public/track   records a page view and, for a blog post, returns
                         its views and readers (unique visitors).
GET  /api/public/stats/post?slug=...   the same numbers, read-only.

/track accepts its JSON body under any content type, so the portfolio can
send it with navigator.sendBeacon (text/plain, no CORS preflight, nothing to
read back). Repeat loads of one page by one visitor within DEDUPE count once;
crawlers and scripted clients are not counted.
"""
from __future__ import annotations

import html
import re
from datetime import timedelta
from typing import Optional
from urllib.parse import urlparse

import bleach
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ValidationError, field_validator
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.core.visitor import is_bot, visitor_hash
from app.database import get_db
from app.models.traffic import PageView, utcnow

router = APIRouter(tags=["Public – Traffic"])

SITES = {"portfolio", "blog"}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DEDUPE = timedelta(minutes=30)
MAX_BODY = 4096


class TrackIn(BaseModel):
    site: str
    path: str = "/"
    slug: Optional[str] = None
    title: str = ""
    referrer: str = ""

    @field_validator("site")
    @classmethod
    def known_site(cls, v: str) -> str:
        if v not in SITES:
            raise ValueError("unknown site")
        return v

    @field_validator("path")
    @classmethod
    def clean_path(cls, v: str) -> str:
        v = (v or "/").split("?")[0].split("#")[0][:300]
        if not v.startswith("/"):
            raise ValueError("path must start with /")
        return v

    @field_validator("slug")
    @classmethod
    def clean_slug(cls, v: Optional[str]) -> Optional[str]:
        if v in (None, ""):
            return None
        if len(v) > 200 or not SLUG.match(v):
            raise ValueError("invalid slug")
        return v

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        # Tags removed, then entities decoded: the admin shows it as text, so "&" must stay "&".
        return html.unescape(bleach.clean(v or "", tags=[], strip=True)).strip()[:300]

    @field_validator("referrer")
    @classmethod
    def referrer_host(cls, v: str) -> str:
        # Only the host is kept ("www.linkedin.com"), never the full address.
        try:
            return (urlparse(v).hostname or "")[:255] if v else ""
        except ValueError:
            return ""


def post_stats(db: Session, slug: str) -> dict:
    views, readers = (
        db.query(func.count(PageView.id), func.count(distinct(PageView.visitor_hash)))
        .filter(PageView.post_slug == slug)
        .one()
    )
    return {"slug": slug, "views": int(views), "readers": int(readers)}


@router.post("/track")
async def track(request: Request, db: Session = Depends(get_db)) -> dict:
    raw = await request.body()
    if len(raw) > MAX_BODY:
        raise HTTPException(status_code=413, detail="Too large")
    try:
        data = TrackIn.model_validate_json(raw or b"{}")
    except ValidationError as err:
        raise HTTPException(status_code=422, detail=err.errors(include_url=False, include_context=False))

    counted = False
    if not is_bot(request):
        who = visitor_hash(request)
        seen_recently = (
            db.query(PageView.id)
            .filter(
                PageView.visitor_hash == who,
                PageView.path == data.path,
                PageView.created_at >= utcnow() - DEDUPE,
            )
            .first()
        )
        if not seen_recently:
            db.add(PageView(
                site=data.site, path=data.path, post_slug=data.slug, title=data.title,
                referrer_host=data.referrer, visitor_hash=who,
            ))
            db.commit()
            counted = True

    result: dict = {"counted": counted}
    if data.slug:
        result.update(post_stats(db, data.slug))
    return result


@router.get("/stats/post")
def stats_for_post(slug: str = Query(..., max_length=200), db: Session = Depends(get_db)) -> dict:
    if not SLUG.match(slug):
        raise HTTPException(status_code=422, detail="invalid slug")
    return post_stats(db, slug)
