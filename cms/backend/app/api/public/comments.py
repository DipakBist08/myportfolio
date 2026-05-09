import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentOut

router = APIRouter(prefix="/comments", tags=["Comments"])

# Rate limit: 5 comments per IP per 5 minutes
_comment_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 5
_RATE_WINDOW = 300.0


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    window = now - _RATE_WINDOW
    attempts = [t for t in _comment_attempts[ip] if t > window]
    if len(attempts) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many comments. Please wait a few minutes.",
            headers={"Retry-After": "300"},
        )
    attempts.append(now)
    _comment_attempts[ip] = attempts


@router.get("", response_model=list[CommentOut])
def get_comments(slug: str = Query(...), db: Session = Depends(get_db)):
    """Return all approved top-level comments with their replies for a post slug."""
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.replies))
        .filter(
            Comment.post_slug == slug,
            Comment.parent_id == None,
            Comment.is_approved == True,
        )
        .order_by(Comment.created_at.asc())
        .all()
    )
    # Filter replies to approved only
    for c in comments:
        c.replies = [r for r in c.replies if r.is_approved]
    return comments


@router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def post_comment(body: CommentCreate, request: Request, db: Session = Depends(get_db)):
    """Submit a new comment or reply."""
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # Validate parent exists and belongs to same post
    if body.parent_id is not None:
        parent = db.query(Comment).filter(
            Comment.id == body.parent_id,
            Comment.post_slug == body.post_slug,
            Comment.parent_id == None,   # Only one level of nesting
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = Comment(
        post_slug=body.post_slug,
        parent_id=body.parent_id,
        author_name=body.author_name,
        author_email=body.author_email,
        content=body.content,
        is_approved=True,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    comment.replies = []
    return comment
