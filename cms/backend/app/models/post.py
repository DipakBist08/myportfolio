import enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    SCHEDULED = "scheduled"
    ARCHIVED = "archived"


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    slug = Column(String(500), unique=True, index=True, nullable=False)

    # Content
    content = Column(Text, default="")          # TipTap HTML
    content_json = Column(Text, default="")     # TipTap JSON (for editor restore)
    content_text = Column(Text, default="")     # Stripped plain text (for search / reading time)
    excerpt = Column(Text, default="")

    # Featured image
    featured_image = Column(String(500), default="")
    featured_image_alt = Column(String(300), default="")

    # Status & scheduling
    status = Column(
        SAEnum(PostStatus, name="post_status"),
        default=PostStatus.DRAFT,
        index=True,
        nullable=False,
    )
    is_featured = Column(Boolean, default=False)

    # SEO
    seo_title = Column(String(500), default="")
    seo_description = Column(Text, default="")
    seo_keywords = Column(String(500), default="")
    canonical_url = Column(String(500), default="")

    # Metrics
    reading_time = Column(Integer, default=0)   # minutes
    view_count = Column(Integer, default=0)

    # Timestamps
    published_at = Column(DateTime(timezone=True), nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign keys
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    author = relationship("User", back_populates="posts")
    category = relationship("Category", back_populates="posts")
    tags = relationship("Tag", secondary="post_tags", back_populates="posts", lazy="selectin")
