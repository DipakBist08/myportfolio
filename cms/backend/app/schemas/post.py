from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from app.models.post import PostStatus


class TagBrief(BaseModel):
    id: int
    name: str
    slug: str
    color: str
    model_config = {"from_attributes": True}


class CategoryBrief(BaseModel):
    id: int
    name: str
    slug: str
    color: str
    model_config = {"from_attributes": True}


class AuthorBrief(BaseModel):
    id: int
    username: str
    full_name: str
    avatar_url: str
    model_config = {"from_attributes": True}


# ── Create / Update ──────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    title: str
    slug: Optional[str] = None          # auto-generated if blank
    content: str = ""
    content_json: str = ""
    content_text: str = ""
    excerpt: str = ""
    featured_image: str = ""
    featured_image_alt: str = ""
    status: PostStatus = PostStatus.DRAFT
    is_featured: bool = False
    seo_title: str = ""
    seo_description: str = ""
    seo_keywords: str = ""
    canonical_url: str = ""
    category_id: Optional[int] = None
    tag_ids: List[int] = []
    scheduled_at: Optional[datetime] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    content_json: Optional[str] = None
    content_text: Optional[str] = None
    excerpt: Optional[str] = None
    featured_image: Optional[str] = None
    featured_image_alt: Optional[str] = None
    status: Optional[PostStatus] = None
    is_featured: Optional[bool] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    category_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    scheduled_at: Optional[datetime] = None


# ── Responses ────────────────────────────────────────────────────────────────

class PostListItem(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: str
    featured_image: str
    status: PostStatus
    is_featured: bool
    reading_time: int
    view_count: int
    published_at: Optional[datetime]
    scheduled_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    author: AuthorBrief
    category: Optional[CategoryBrief]
    tags: List[TagBrief]
    model_config = {"from_attributes": True}


class PostDetail(PostListItem):
    content: str
    content_json: str
    seo_title: str
    seo_description: str
    seo_keywords: str
    canonical_url: str
    featured_image_alt: str
    model_config = {"from_attributes": True}


class PostPublic(BaseModel):
    """Minimal public-facing post shape."""
    id: int
    title: str
    slug: str
    excerpt: str
    featured_image: str
    featured_image_alt: str
    content: str
    reading_time: int
    view_count: int
    published_at: Optional[datetime]
    created_at: datetime
    author: AuthorBrief
    category: Optional[CategoryBrief]
    tags: List[TagBrief]
    seo_title: str
    seo_description: str
    seo_keywords: str
    model_config = {"from_attributes": True}


class PaginatedPosts(BaseModel):
    items: List[PostListItem]
    total: int
    page: int
    page_size: int
    pages: int
