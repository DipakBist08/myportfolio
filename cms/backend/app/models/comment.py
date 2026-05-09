from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_slug = Column(String(255), nullable=False, index=True)

    # Threading — None means top-level, int means reply to that comment id
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)

    author_name = Column(String(100), nullable=False)
    author_email = Column(String(255), nullable=False)  # stored, never exposed publicly
    content = Column(Text, nullable=False)

    is_approved = Column(Boolean, default=True, nullable=False)  # auto-approve; admin can delete spam

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    replies = relationship(
        "Comment",
        backref="parent",
        foreign_keys=[parent_id],
        cascade="all, delete-orphan",
        lazy="select",
    )
