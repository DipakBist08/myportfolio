from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_slug = Column(String(255), nullable=False, index=True)

    # Threading — None = top-level, int = reply to that comment
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)

    author_name = Column(String(100), nullable=False)
    author_email = Column(String(255), nullable=False)  # stored, never exposed publicly
    content = Column(Text, nullable=False)

    is_approved = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Self-referential: remote_side marks "id" as the one-side (parent)
    parent = relationship(
        "Comment",
        remote_side="Comment.id",
        back_populates="replies",
        foreign_keys=[parent_id],
    )
    replies = relationship(
        "Comment",
        back_populates="parent",
        foreign_keys=[parent_id],
        cascade="all, delete-orphan",
        lazy="select",
    )
