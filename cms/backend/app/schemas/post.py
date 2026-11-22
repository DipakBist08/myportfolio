import json
import re

from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional, List
from datetime import datetime
from app.models.post import PostStatus

ContentFormat = Literal["html", "mdx"]
# The same values as the blog's ARTICLE_TYPES and Difficulty (blog/lib/blog/types.ts).
ArticleType = Literal["Tutorial", "Opinion", "Experiment", "Project experience"]
Difficulty = Literal["beginner", "intermediate", "advanced"]


class FaqItem(BaseModel):
    q: str = Field(min_length=1, max_length=500)
    a: str = Field(min_length=1, max_length=3000)


class BlogMeta(BaseModel):
    """The blog's article details, stored as JSON in posts.blog_meta. Field
    names match the blog's front matter, so the blog reads them unchanged."""
    primaryQuery: str = Field("", max_length=200)
    secondaryQueries: List[str] = Field(default_factory=list, max_length=20)
    cluster: str = Field("", max_length=100)
    isPillar: bool = False
    testedWith: str = Field("", max_length=500)
    faq: List[FaqItem] = Field(default_factory=list, max_length=20)
    articleType: Optional[ArticleType] = None
    difficulty: Optional[Difficulty] = None
    tools: List[str] = Field(default_factory=list, max_length=30)
    keywords: List[str] = Field(default_factory=list, max_length=30)
    # "Last updated" shown on the post and used as dateModified (YYYY-MM-DD).
    dateModified: Optional[str] = None

    @field_validator("secondaryQueries", "tools", "keywords")
    @classmethod
    def _clean_list(cls, v: List[str]) -> List[str]:
        return [x.strip() for x in v if x and x.strip()]

    @field_validator("dateModified")
    @classmethod
    def _iso_date(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("dateModified must be YYYY-MM-DD")
        return v


def parse_blog_meta(raw) -> dict:
    """posts.blog_meta (a JSON string, possibly empty or invalid) as a dict."""
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


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
    content_format: ContentFormat = "html"
    blog_meta: Optional[BlogMeta] = None
    # Set to keep an article's original publishing date; otherwise "now" on publish.
    published_at: Optional[datetime] = None


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
    content_format: Optional[ContentFormat] = None
    blog_meta: Optional[BlogMeta] = None
    published_at: Optional[datetime] = None


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
    content_format: str = "html"
    model_config = {"from_attributes": True}


class PostDetail(PostListItem):
    content: str
    content_json: str
    seo_title: str
    seo_description: str
    seo_keywords: str
    canonical_url: str
    featured_image_alt: str
    content_format: str = "html"
    blog_meta: dict = Field(default_factory=dict)
    model_config = {"from_attributes": True}

    @field_validator("blog_meta", mode="before")
    @classmethod
    def _meta(cls, v):
        return parse_blog_meta(v)


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


class BlogPostSummary(BaseModel):
    """A published post as the blog lists it (GET /api/public/blog/posts)."""
    slug: str
    title: str
    excerpt: str
    seo_title: str
    seo_description: str
    featured_image: str
    featured_image_alt: str
    is_featured: bool
    reading_time: int
    content_format: str = "html"
    published_at: Optional[datetime]
    updated_at: Optional[datetime]
    category: Optional[CategoryBrief]
    tags: List[TagBrief]
    blog_meta: dict = Field(default_factory=dict)
    model_config = {"from_attributes": True}

    @field_validator("blog_meta", mode="before")
    @classmethod
    def _meta(cls, v):
        return parse_blog_meta(v)


class BlogPostDetail(BlogPostSummary):
    content: str


class PaginatedPosts(BaseModel):
    items: List[PostListItem]
    total: int
    page: int
    page_size: int
    pages: int
