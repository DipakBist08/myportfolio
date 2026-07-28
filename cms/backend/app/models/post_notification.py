from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class PostNotification(Base):
    """
    One row per attempt to announce a post to subscribers.

    This exists as its own table rather than a column on `posts` because the
    schema is created with Base.metadata.create_all() and there are no Alembic
    revisions in this project — create_all adds missing *tables* but never
    missing *columns*, so a new column would silently fail to appear on the
    deployed Postgres database.

    It doubles as an audit trail: the automatic publish hook checks for an
    existing successful row before sending, which is what stops a re-publish
    (or a bulk status change) from emailing the whole list twice.
    """

    __tablename__ = "post_notifications"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(
        Integer,
        ForeignKey("posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # sent | partial | failed | skipped
    status = Column(String(20), nullable=False, default="sent")
    recipients = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)

    # False when RESEND_API_KEY is unset — the send was simulated, not delivered
    delivered = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    post = relationship("Post", backref="notifications")

    # Statuses that mean "subscribers have already heard about this post"
    SUCCESSFUL = ("sent", "partial")
