from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.comment import Comment
from app.schemas.comment import CommentAdminOut

router = APIRouter(prefix="/comments", tags=["Admin – Comments"])


@router.get("", response_model=list[CommentAdminOut])
def list_comments(
    slug: Optional[str] = None,
    approved: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Comment).options(joinedload(Comment.replies))
    if slug:
        q = q.filter(Comment.post_slug == slug)
    if approved is not None:
        q = q.filter(Comment.is_approved == approved)
    return q.order_by(Comment.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


@router.patch("/{comment_id}/approve", response_model=CommentAdminOut)
def approve_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.is_approved = not comment.is_approved
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
