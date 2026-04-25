from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.database import get_db
from app.models.post import Post, PostStatus
from app.models.category import Category
from app.models.tag import Tag
from app.schemas.post import PostPublic

router = APIRouter(prefix="/search", tags=["Public – Search"])


@router.get("", response_model=dict)
def search(
    q: str = Query(..., min_length=2),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    term = f"%{q}%"
    query = (
        db.query(Post)
        .options(joinedload(Post.author), joinedload(Post.category), joinedload(Post.tags))
        .filter(Post.status == PostStatus.PUBLISHED)
        .filter(
            or_(
                Post.title.ilike(term),
                Post.content_text.ilike(term),
                Post.excerpt.ilike(term),
                Post.seo_keywords.ilike(term),
            )
        )
    )
    total = query.count()
    items = query.order_by(Post.published_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "query": q,
        "items": [PostPublic.model_validate(p).model_dump() for p in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": -(-total // page_size),
    }
