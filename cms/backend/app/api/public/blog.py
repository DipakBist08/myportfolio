"""
What the blog (blog.dipakbist.com.np) reads to show posts written in the CMS.

GET /api/public/blog/posts          every published post, newest first, without its body
GET /api/public/blog/posts/{slug}   one published post with its body

Only published posts are returned. The body is sanitised HTML (rich-text posts)
or MDX source (Markdown posts); `content_format` says which. The blog compiles
MDX with dangerous JavaScript blocked.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.post import Post, PostStatus
from app.schemas.post import BlogPostDetail, BlogPostSummary

router = APIRouter(prefix="/blog", tags=["Public – Blog"])


def _published(db: Session):
    return (db.query(Post)
            .options(joinedload(Post.category), joinedload(Post.tags))
            .filter(Post.status == PostStatus.PUBLISHED, Post.published_at.isnot(None)))


@router.get("/posts", response_model=List[BlogPostSummary])
def blog_posts(db: Session = Depends(get_db)):
    return _published(db).order_by(Post.published_at.desc()).all()


@router.get("/posts/{slug}", response_model=BlogPostDetail)
def blog_post(slug: str, db: Session = Depends(get_db)):
    post = _published(db).filter(Post.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post
