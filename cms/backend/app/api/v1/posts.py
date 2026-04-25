"""
Admin post management (CRUD + status transitions).
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.post import Post, PostStatus
from app.models.category import Category
from app.models.tag import Tag
from app.schemas.post import (
    PostCreate, PostUpdate, PostDetail, PostListItem, PaginatedPosts
)
from app.utils.slug import unique_slug, estimate_reading_time
import bleach

router = APIRouter(prefix="/posts", tags=["Admin – Posts"])

ALLOWED_TAGS = [
    "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "a", "img", "table", "thead", "tbody", "tr", "th", "td",
    "hr", "mark", "span", "div", "figure", "figcaption",
]
ALLOWED_ATTRS = {
    "*": ["class", "id", "style"],
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "width", "height"],
    "code": ["class"],
    "pre": ["class"],
    "td": ["colspan", "rowspan"],
    "th": ["colspan", "rowspan"],
}


def _sanitize(html: str) -> str:
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)


def _get_or_404(post_id: int, db: Session) -> Post:
    post = db.query(Post).options(
        joinedload(Post.author),
        joinedload(Post.category),
        joinedload(Post.tags),
    ).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedPosts)
def list_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[PostStatus] = None,
    category_id: Optional[int] = None,
    tag_id: Optional[int] = None,
    search: Optional[str] = None,
    is_featured: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Post).options(
        joinedload(Post.author),
        joinedload(Post.category),
        joinedload(Post.tags),
    )
    if status:
        q = q.filter(Post.status == status)
    if category_id:
        q = q.filter(Post.category_id == category_id)
    if tag_id:
        q = q.filter(Post.tags.any(Tag.id == tag_id))
    if is_featured is not None:
        q = q.filter(Post.is_featured == is_featured)
    if search:
        term = f"%{search}%"
        q = q.filter(or_(Post.title.ilike(term), Post.content_text.ilike(term), Post.excerpt.ilike(term)))

    total = q.count()
    items = q.order_by(Post.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedPosts(
        items=items, total=total, page=page, page_size=page_size,
        pages=-(-total // page_size),
    )


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=PostDetail, status_code=status.HTTP_201_CREATED)
def create_post(
    body: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slug = unique_slug(body.slug or body.title, Post, db)
    sanitized_content = _sanitize(body.content) if body.content else ""

    post = Post(
        title=body.title,
        slug=slug,
        content=sanitized_content,
        content_json=body.content_json,
        content_text=body.content_text,
        excerpt=body.excerpt,
        featured_image=body.featured_image,
        featured_image_alt=body.featured_image_alt,
        status=body.status,
        is_featured=body.is_featured,
        seo_title=body.seo_title or body.title,
        seo_description=body.seo_description,
        seo_keywords=body.seo_keywords,
        canonical_url=body.canonical_url,
        category_id=body.category_id,
        scheduled_at=body.scheduled_at,
        author_id=current_user.id,
        reading_time=estimate_reading_time(body.content_text or body.content),
    )
    if body.status == PostStatus.PUBLISHED:
        post.published_at = datetime.now(timezone.utc)

    if body.tag_ids:
        post.tags = db.query(Tag).filter(Tag.id.in_(body.tag_ids)).all()

    db.add(post)
    db.commit()
    db.refresh(post)
    return _get_or_404(post.id, db)


# ── Get one ───────────────────────────────────────────────────────────────────

@router.get("/{post_id}", response_model=PostDetail)
def get_post(post_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _get_or_404(post_id, db)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{post_id}", response_model=PostDetail)
def update_post(
    post_id: int,
    body: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_or_404(post_id, db)

    data = body.model_dump(exclude_none=True)
    tag_ids = data.pop("tag_ids", None)

    if "content" in data:
        data["content"] = _sanitize(data["content"])
    if "content_text" in data:
        data["reading_time"] = estimate_reading_time(data["content_text"])
    if "slug" in data:
        data["slug"] = unique_slug(data["slug"], Post, db, exclude_id=post_id)

    # Handle publish timestamp
    new_status = data.get("status")
    if new_status == PostStatus.PUBLISHED and post.status != PostStatus.PUBLISHED:
        data["published_at"] = datetime.now(timezone.utc)

    for k, v in data.items():
        setattr(post, k, v)

    if tag_ids is not None:
        post.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()

    db.commit()
    return _get_or_404(post_id, db)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()


# ── Bulk status update ────────────────────────────────────────────────────────

@router.post("/bulk/status")
def bulk_status(
    post_ids: list[int],
    new_status: PostStatus,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    posts = db.query(Post).filter(Post.id.in_(post_ids)).all()
    for p in posts:
        p.status = new_status
        if new_status == PostStatus.PUBLISHED and not p.published_at:
            p.published_at = datetime.now(timezone.utc)
    db.commit()
    return {"updated": len(posts)}


# ── Analytics view increment (public-callable) ────────────────────────────────

@router.post("/{post_id}/view", include_in_schema=False)
def increment_view(post_id: int, db: Session = Depends(get_db)):
    db.query(Post).filter(Post.id == post_id).update(
        {Post.view_count: Post.view_count + 1}
    )
    db.commit()
    return {"ok": True}
