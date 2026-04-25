from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.category import Category
from app.models.post import Post
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryOut
from app.utils.slug import unique_slug

router = APIRouter(prefix="/categories", tags=["Admin – Categories"])


def _enrich(cat: Category, db: Session) -> dict:
    count = db.query(func.count(Post.id)).filter(Post.category_id == cat.id).scalar()
    d = {c.key: getattr(cat, c.key) for c in cat.__table__.columns}
    d["post_count"] = count
    return d


@router.get("", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cats = db.query(Category).order_by(Category.name).all()
    return [_enrich(c, db) for c in cats]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    slug = unique_slug(body.slug or body.name, Category, db)
    cat = Category(
        name=body.name, slug=slug, description=body.description,
        color=body.color, icon=body.icon, parent_id=body.parent_id,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _enrich(cat, db)


@router.patch("/{cat_id}", response_model=CategoryOut)
def update_category(
    cat_id: int,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    data = body.model_dump(exclude_none=True)
    if "slug" in data:
        data["slug"] = unique_slug(data["slug"], Category, db, exclude_id=cat_id)
    for k, v in data.items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return _enrich(cat, db)


@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(cat_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
