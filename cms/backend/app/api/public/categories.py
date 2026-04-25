from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.models.category import Category
from app.models.post import Post, PostStatus
from app.schemas.category import CategoryOut

router = APIRouter(prefix="/categories", tags=["Public – Categories"])


@router.get("", response_model=List[CategoryOut])
def list_public_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.name).all()
    result = []
    for c in cats:
        count = db.query(func.count(Post.id)).filter(
            Post.category_id == c.id, Post.status == PostStatus.PUBLISHED
        ).scalar()
        d = {col.key: getattr(c, col.key) for col in c.__table__.columns}
        d["post_count"] = count
        result.append(d)
    return result


@router.get("/tags", tags=["Public – Tags"])
def list_public_tags(db: Session = Depends(get_db)):
    from app.models.tag import Tag, post_tags
    tags = db.query(Tag).order_by(Tag.name).all()
    result = []
    for t in tags:
        count = db.query(func.count()).select_from(post_tags).filter(post_tags.c.tag_id == t.id).scalar()
        result.append({
            "id": t.id, "name": t.name, "slug": t.slug, "color": t.color,
            "post_count": count, "created_at": t.created_at,
        })
    return result
