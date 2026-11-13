"""Visitor traffic and comment reactions.

Both live in new tables, so `Base.metadata.create_all` adds them to an
existing database at startup without touching the tables already there.
Visitors are identified only by `app.core.visitor.visitor_hash`, a keyed
hash; no IP address or cookie is stored.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.database import Base


def utcnow() -> datetime:
    """Naive UTC, the form SQLite stores and compares as text."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PageView(Base):
    """One counted visit to one page of the portfolio or the blog.

    Repeat loads of the same page by the same visitor within the dedupe
    window (see app.api.public.traffic) are not stored again."""

    __tablename__ = "page_views"

    id = Column(Integer, primary_key=True)
    site = Column(String(20), nullable=False, index=True)        # "portfolio" | "blog"
    path = Column(String(300), nullable=False, index=True)       # e.g. "/" or "/blog/some-post"
    post_slug = Column(String(200), nullable=True, index=True)   # set for blog post pages
    title = Column(String(300), default="")
    referrer_host = Column(String(255), default="")
    visitor_hash = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)


class CommentReaction(Base):
    """A visitor's like (+1) or dislike (-1) on one comment or reply.
    One row per visitor per comment; changing your mind updates the row."""

    __tablename__ = "comment_reactions"
    __table_args__ = (UniqueConstraint("comment_id", "voter_hash", name="uq_comment_reaction_voter"),)

    id = Column(Integer, primary_key=True)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    voter_hash = Column(String(64), nullable=False)
    value = Column(Integer, nullable=False)  # 1 = like, -1 = dislike
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
