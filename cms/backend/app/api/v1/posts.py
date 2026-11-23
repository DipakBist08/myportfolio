"""
Admin post management (CRUD + status transitions).
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.post import Post, PostStatus
from app.models.category import Category
from app.models.tag import Tag
from app.models.post_notification import PostNotification
from app.schemas.post import (
    PostCreate, PostUpdate, PostDetail, PostListItem, PaginatedPosts
)
from app.core.notifications import announce_post_if_enabled
from app.utils.slug import unique_slug, estimate_reading_time
import bleach
import json

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


def _store_content(content: str, content_format: str) -> str:
    """Rich-text HTML is sanitised. Markdown (MDX) is stored exactly as
    written: bleach would strip its components (<Callout>, <QAChecklist>...).
    The blog compiles it with dangerous JavaScript blocked."""
    if not content:
        return ""
    return content if content_format == "mdx" else _sanitize(content)


def _meta_json(meta) -> str:
    if meta is None:
        return ""
    data = meta if isinstance(meta, dict) else meta.model_dump()
    return json.dumps(data, ensure_ascii=False)


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
    background: BackgroundTasks,
    notify: bool = Query(
        True,
        description="Email confirmed subscribers if this post is created already published. "
                    "Pass notify=false to publish quietly.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slug = unique_slug(body.slug or body.title, Post, db)
    sanitized_content = _store_content(body.content, body.content_format)

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
        content_format=body.content_format,
        blog_meta=_meta_json(body.blog_meta),
    )
    if body.status == PostStatus.PUBLISHED:
        post.published_at = body.published_at or datetime.now(timezone.utc)
    elif body.published_at:
        post.published_at = body.published_at

    if body.tag_ids:
        post.tags = db.query(Tag).filter(Tag.id.in_(body.tag_ids)).all()

    db.add(post)
    db.commit()
    db.refresh(post)

    # Announce only if it went straight out as published. Runs after the
    # response is returned, so a slow mail provider never delays the editor.
    if notify and post.status == PostStatus.PUBLISHED:
        background.add_task(announce_post_if_enabled, post.id)

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
    background: BackgroundTasks,
    notify: bool = Query(
        True,
        description="Email confirmed subscribers when this post transitions to published. "
                    "Pass notify=false to publish quietly.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_or_404(post_id, db)

    data = body.model_dump(exclude_none=True)
    tag_ids = data.pop("tag_ids", None)

    final_format = data.get("content_format", post.content_format or "html")
    if "content" in data:
        data["content"] = _store_content(data["content"], final_format)
    elif "content_format" in data and final_format == "html" and post.content:
        # Switched from Markdown to rich text: what is stored must be safe HTML.
        data["content"] = _sanitize(post.content)
    if "blog_meta" in data:
        data["blog_meta"] = _meta_json(data["blog_meta"])
    if "content_text" in data:
        data["reading_time"] = estimate_reading_time(data["content_text"])
    if "slug" in data:
        data["slug"] = unique_slug(data["slug"], Post, db, exclude_id=post_id)

    # Handle publish timestamp
    new_status = data.get("status")
    just_published = (
        new_status == PostStatus.PUBLISHED and post.status != PostStatus.PUBLISHED
    )
    if just_published and "published_at" not in data:
        data["published_at"] = datetime.now(timezone.utc)

    for k, v in data.items():
        setattr(post, k, v)

    if tag_ids is not None:
        post.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()

    db.commit()

    # Only on the draft -> published transition. Editing an already-published
    # post does not re-announce it, and announce_post_if_enabled double-checks
    # against post_notifications regardless.
    if notify and just_published:
        background.add_task(announce_post_if_enabled, post_id)

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
    background: BackgroundTasks,
    notify: bool = Query(
        True,
        description="Email confirmed subscribers for each post newly moved to published.",
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    posts = db.query(Post).filter(Post.id.in_(post_ids)).all()
    newly_published: list[int] = []
    for p in posts:
        if new_status == PostStatus.PUBLISHED and p.status != PostStatus.PUBLISHED:
            newly_published.append(p.id)
        p.status = new_status
        if new_status == PostStatus.PUBLISHED and not p.published_at:
            p.published_at = datetime.now(timezone.utc)
    db.commit()

    if notify:
        for pid in newly_published:
            background.add_task(announce_post_if_enabled, pid)

    return {"updated": len(posts), "announced": len(newly_published) if notify else 0}


# ── Subscriber announcement status ────────────────────────────────────────────

@router.get("/{post_id}/notifications")
def post_notifications(
    post_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Announcement history for a post, newest first, so the admin UI can show
    whether subscribers were emailed and how it went."""
    _get_or_404(post_id, db)
    rows = (
        db.query(PostNotification)
        .filter(PostNotification.post_id == post_id)
        .order_by(PostNotification.created_at.desc())
        .all()
    )
    return {
        "announced": any(r.status in PostNotification.SUCCESSFUL for r in rows),
        "attempts": [
            {
                "id": r.id,
                "status": r.status,
                "recipients": r.recipients,
                "failed": r.failed,
                "delivered": bool(r.delivered),
                "error": r.error,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    }


# ── Analytics view increment (public-callable) ────────────────────────────────

@router.post("/{post_id}/view", include_in_schema=False)
def increment_view(post_id: int, db: Session = Depends(get_db)):
    db.query(Post).filter(Post.id == post_id).update(
        {Post.view_count: Post.view_count + 1}
    )
    db.commit()
    return {"ok": True}
