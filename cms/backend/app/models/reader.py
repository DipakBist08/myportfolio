"""Blog readers who signed in with Google, their claps, and which comments
they wrote.

All three are new tables, so `Base.metadata.create_all` adds them to an
existing database at startup without altering any table already there (the
`comments` table is linked through `comment_authors` rather than a new column).
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.database import Base
from app.models.traffic import utcnow


class Reader(Base):
    """A person who signed in on the blog with their Google account.

    Only what the blog shows or needs is kept: Google's stable account ID
    (`sub`), the verified email (never shown publicly), the display name and
    the profile picture URL."""

    __tablename__ = "readers"

    id = Column(Integer, primary_key=True)
    google_sub = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    picture = Column(String(500), default="", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_login_at = Column(DateTime, default=utcnow, nullable=False)


class PostClap(Base):
    """One reader's claps for one post: 1 to MAX_CLAPS, like Medium.
    Clapping again adds to the row; undoing deletes it."""

    __tablename__ = "post_claps"
    __table_args__ = (UniqueConstraint("post_slug", "reader_id", name="uq_post_clap_reader"),)

    id = Column(Integer, primary_key=True)
    post_slug = Column(String(200), nullable=False, index=True)
    reader_id = Column(Integer, ForeignKey("readers.id", ondelete="CASCADE"), nullable=False, index=True)
    count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class CommentAuthor(Base):
    """The signed-in reader who wrote a comment. Comments from before sign-in
    was required have no row here and keep the name they were posted with."""

    __tablename__ = "comment_authors"

    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), primary_key=True)
    reader_id = Column(Integer, ForeignKey("readers.id", ondelete="CASCADE"), nullable=False, index=True)
