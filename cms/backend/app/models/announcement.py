from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Announcement(Base):
    """
    Record of a blog post announced to subscribers.

    Separate from PostNotification because that one is keyed to a CMS `posts` row,
    and the real blog posts are MDX files in the Next.js app — /api/public/posts
    reports zero. This table is keyed by the post's RSS link instead, which is the
    only stable identifier the actual publishing flow produces.

    Its purpose is the same: stop the same post being emailed to the list twice.
    """

    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    # RSS <link> (or <guid>) — the natural key for a published article
    source_key = Column(String(700), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False, default="")

    status = Column(String(20), nullable=False, default="sent")   # sent | partial | failed | skipped
    recipients = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)
    delivered = Column(Integer, nullable=False, default=1)        # 0 when RESEND_API_KEY is unset

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    SUCCESSFUL = ("sent", "partial")
