"""Claps for blog posts, and the numbers the blog's recommendation cards show.

GET    /api/public/claps?slug=...          {slug, claps, clappers, my_claps}
POST   /api/public/claps  {slug, count}    add `count` claps (signed-in readers; at most MAX_CLAPS each)
DELETE /api/public/claps?slug=...          take back all of the reader's claps
GET    /api/public/engagement?slugs=a,b    {"posts": {slug: {claps, comments, readers}}}

Like Medium, one reader can clap up to MAX_CLAPS times for a post, and the
post shows the total. Clapping needs a Google sign-in (app.core.readers).
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

MAX_CLAPS = 50
MAX_SLUGS = 24
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
NO_STORE = {"Cache-Control": "no-store"}

# A clap burst is sent as one request; 60 requests a minute per reader is far more than a person makes.
_clap_attempts: dict[int, list[float]] = defaultdict(list)
_CLAP_LIMIT = 60
_CLAP_WINDOW = 60.0


def _valid_slug(slug: str) -> str:
    if len(slug) > 200 or not SLUG.match(slug):
        raise HTTPException(status_code=422, detail="invalid slug")
    return slug


class ClapIn(BaseModel):
    slug: str
    count: int = Field(ge=1, le=MAX_CLAPS)

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        if len(v) > 200 or not SLUG.match(v):
            raise ValueError("invalid slug")
        return v


def clap_summary(db: Session, slug: str, reader: Optional[Reader]) -> dict:
    total, clappers = (
        db.query(func.coalesce(func.sum(PostClap.count), 0), func.count(PostClap.id))
        .filter(PostClap.post_slug == slug)
        .one()
    )
    mine = 0
    if reader is not None:
        mine = (
            db.query(PostClap.count)
            .filter(PostClap.post_slug == slug, PostClap.reader_id == reader.id)
            .scalar()
        ) or 0
    return {"slug": slug, "claps": int(total), "clappers": int(clappers), "my_claps": int(mine), "max_claps": MAX_CLAPS}


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
            db.add(PostClap(post_slug=body.slug, reader_id=reader.id, count=min(body.count, MAX_CLAPS)))
        else:
            row.count = min(row.count + body.count, MAX_CLAPS)
        db.commit()

    try:
        apply()
    except IntegrityError:  # two bursts from the same reader raced; the second adds to the first
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

    claps = dict(
        db.query(PostClap.post_slug, func.sum(PostClap.count))
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
