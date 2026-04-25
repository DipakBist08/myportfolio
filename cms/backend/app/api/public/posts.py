"""
Public-facing read-only post API consumed by the static portfolio / blog.
"""
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.database import get_db
from app.models.post import Post, PostStatus
from app.models.category import Category
from app.models.tag import Tag
from app.schemas.post import PostPublic

router = APIRouter(prefix="/posts", tags=["Public – Posts"])


def _published_query(db: Session):
    return db.query(Post).options(
        joinedload(Post.author),
        joinedload(Post.category),
        joinedload(Post.tags),
    ).filter(Post.status == PostStatus.PUBLISHED)


@router.get("", response_model=dict)
def public_list_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    category: Optional[str] = None,
    tag: Optional[str] = None,
    featured: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    q = _published_query(db)
    if category:
        q = q.join(Category).filter(Category.slug == category)
    if tag:
        q = q.filter(Post.tags.any(Tag.slug == tag))
    if featured is not None:
        q = q.filter(Post.is_featured == featured)
    total = q.count()
    items = q.order_by(Post.published_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [PostPublic.model_validate(p).model_dump() for p in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": -(-total // page_size),
    }


@router.get("/recent", response_model=List[PostPublic])
def recent_posts(limit: int = Query(5, ge=1, le=20), db: Session = Depends(get_db)):
    posts = _published_query(db).order_by(Post.published_at.desc()).limit(limit).all()
    return posts


@router.get("/featured", response_model=List[PostPublic])
def featured_posts(limit: int = Query(3, ge=1, le=10), db: Session = Depends(get_db)):
    posts = _published_query(db).filter(Post.is_featured == True).order_by(
        Post.published_at.desc()
    ).limit(limit).all()
    return posts


@router.get("/{slug}", response_model=PostPublic)
def get_post_by_slug(slug: str, db: Session = Depends(get_db)):
    post = _published_query(db).filter(Post.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.get("/{slug}/related", response_model=List[PostPublic])
def related_posts(slug: str, limit: int = Query(3, ge=1, le=10), db: Session = Depends(get_db)):
    post = _published_query(db).filter(Post.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    q = _published_query(db).filter(Post.id != post.id)
    if post.category_id:
        q = q.filter(Post.category_id == post.category_id)
    related = q.order_by(Post.published_at.desc()).limit(limit).all()
    if len(related) < limit:
        ids = [r.id for r in related] + [post.id]
        extra = _published_query(db).filter(~Post.id.in_(ids)).order_by(
            Post.published_at.desc()
        ).limit(limit - len(related)).all()
        related += extra
    return related
