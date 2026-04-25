from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.tag import Tag
from app.models.post import Post
from app.models.tag import post_tags
from app.schemas.tag import TagCreate, TagUpdate, TagOut
from app.utils.slug import unique_slug

router = APIRouter(prefix="/tags", tags=["Admin – Tags"])


def _enrich(tag: Tag, db: Session) -> dict:
    count = db.query(func.count()).select_from(post_tags).filter(post_tags.c.tag_id == tag.id).scalar()
    d = {c.key: getattr(tag, c.key) for c in tag.__table__.columns}
    d["post_count"] = count
    return d


@router.get("", response_model=List[TagOut])
def list_tags(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    tags = db.query(Tag).order_by(Tag.name).all()
    return [_enrich(t, db) for t in tags]


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(body: TagCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    slug = unique_slug(body.slug or body.name, Tag, db)
    tag = Tag(name=body.name, slug=slug, color=body.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return _enrich(tag, db)


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(
    tag_id: int, body: TagUpdate,
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    data = body.model_dump(exclude_none=True)
    if "slug" in data:
        data["slug"] = unique_slug(data["slug"], Tag, db, exclude_id=tag_id)
    for k, v in data.items():
        setattr(tag, k, v)
    db.commit()
    db.refresh(tag)
    return _enrich(tag, db)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
