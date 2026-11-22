"""Claps for blog posts, and the numbers the blog's recommendation cards show.

GET    /api/public/claps?slug=...          {slug, claps, clappers, my_claps, max_claps}
POST   /api/public/claps  {slug}           clap for the post (signed-in readers; once each)
DELETE /api/public/claps?slug=...          take the reader's clap back
GET    /api/public/engagement?slugs=a,b    {"posts": {slug: {claps, comments, readers}}}

One clap per reader per post (the owner's rule, 22/11/2026): clapping again
changes nothing, and the post's total is the number of readers who clapped.
Rows saved earlier with a count above 1 still count once. Clapping needs a
Google sign-in (app.core.readers).
"""
from __future__ import annotations

import re
import time
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import distinct, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.readers import current_reader, require_reader
from app.database import get_db
from app.models.comment import Comment
from app.models.reader import PostClap, Reader
from app.models.traffic import PageView

router = APIRouter(tags=["Public – Engagement"])

MAX_CLAPS = 1
MAX_SLUGS = 24
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
NO_STORE = {"Cache-Control": "no-store"}

# Clapping and taking it back: 60 requests a minute per reader is far more than a person makes.
_clap_attempts: dict[int, list[float]] = defaultdict(list)
_CLAP_LIMIT = 60
_CLAP_WINDOW = 60.0


def _valid_slug(slug: str) -> str:
    if len(slug) > 200 or not SLUG.match(slug):
        raise HTTPException(status_code=422, detail="invalid slug")
    return slug


class ClapIn(BaseModel):
    slug: str
    count: int = Field(default=1, ge=1, le=MAX_CLAPS)  # kept for older clients; always 1

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        if len(v) > 200 or not SLUG.match(v):
            raise ValueError("invalid slug")
        return v


def clap_summary(db: Session, slug: str, reader: Optional[Reader]) -> dict:
    # One clap per reader: the total is the number of readers who clapped.
    clappers = db.query(func.count(PostClap.id)).filter(PostClap.post_slug == slug).scalar() or 0
    mine = 0
    if reader is not None:
        mine = int(
            db.query(PostClap.id).filter(PostClap.post_slug == slug, PostClap.reader_id == reader.id).first() is not None
        )
    return {"slug": slug, "claps": int(clappers), "clappers": int(clappers), "my_claps": mine, "max_claps": MAX_CLAPS}


@router.get("/claps")
def get_claps(
    response: Response,
    slug: str = Query(..., max_length=200),
    reader: Optional[Reader] = Depends(current_reader),
    db: Session = Depends(get_db),
):
    response.headers.update(NO_STORE)
    return clap_summary(db, _valid_slug(slug), reader)


@router.post("/claps")
def add_claps(body: ClapIn, response: Response, reader: Reader = Depends(require_reader), db: Session = Depends(get_db)):
    now = time.monotonic()
    recent = [t for t in _clap_attempts[reader.id] if t > now - _CLAP_WINDOW]
    if len(recent) >= _CLAP_LIMIT:
        raise HTTPException(status_code=429, detail="Too many claps. Take a breath and try again in a minute.",
                            headers={"Retry-After": "60"})
    _clap_attempts[reader.id] = recent + [now]

    def apply() -> None:
        row = db.query(PostClap).filter(PostClap.post_slug == body.slug, PostClap.reader_id == reader.id).first()
        if row is None:
            db.add(PostClap(post_slug=body.slug, reader_id=reader.id, count=1))
        else:
            row.count = 1  # already clapped: still one clap
        db.commit()

    try:
        apply()
    except IntegrityError:  # two requests from the same reader raced; the row exists now
        db.rollback()
        apply()

    response.headers.update(NO_STORE)
    return clap_summary(db, body.slug, reader)


@router.delete("/claps")
def undo_claps(
    response: Response,
    slug: str = Query(..., max_length=200),
    reader: Reader = Depends(require_reader),
    db: Session = Depends(get_db),
):
    _valid_slug(slug)
    db.query(PostClap).filter(PostClap.post_slug == slug, PostClap.reader_id == reader.id).delete()
    db.commit()
    response.headers.update(NO_STORE)
    return clap_summary(db, slug, reader)


@router.get("/engagement")
def engagement(slugs: str = Query(..., max_length=MAX_SLUGS * 201), db: Session = Depends(get_db)):
    """Claps, approved comments (with replies) and readers for several posts at
    once, for the "Recommended from" cards. Unknown slugs answer zeros."""
    wanted = list(dict.fromkeys(s.strip() for s in slugs.split(",") if s.strip()))
    if not wanted or len(wanted) > MAX_SLUGS:
        raise HTTPException(status_code=422, detail=f"give 1 to {MAX_SLUGS} slugs")
    for slug in wanted:
        _valid_slug(slug)

    claps = dict(  # readers who clapped: one clap each
        db.query(PostClap.post_slug, func.count(PostClap.id))
        .filter(PostClap.post_slug.in_(wanted))
        .group_by(PostClap.post_slug)
        .all()
    )
    comments = dict(
        db.query(Comment.post_slug, func.count(Comment.id))
        .filter(Comment.post_slug.in_(wanted), Comment.is_approved == True)  # noqa: E712
        .group_by(Comment.post_slug)
        .all()
    )
    readers = dict(
        db.query(PageView.post_slug, func.count(distinct(PageView.visitor_hash)))
        .filter(PageView.post_slug.in_(wanted))
        .group_by(PageView.post_slug)
        .all()
    )
    return {
        "posts": {
            slug: {
                "claps": int(claps.get(slug) or 0),
                "comments": int(comments.get(slug) or 0),
                "readers": int(readers.get(slug) or 0),
            }
            for slug in wanted
        }
    }
