import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session, joinedload

from sqlalchemy.exc import IntegrityError

from app.core.reactions import attach_reactions, reaction_counts
from app.core.readers import require_reader
from app.core.visitor import client_ip, visitor_hash
from app.database import get_db
from app.models.comment import Comment
from app.models.reader import CommentAuthor, Reader
from app.models.traffic import CommentReaction
from app.schemas.comment import CommentCreate, CommentOut, ReactionIn, ReactionOut

router = APIRouter(prefix="/comments", tags=["Comments"])

# Reactions: 30 per IP per minute is plenty for a reader and stops scripted flooding.
_reaction_attempts: dict[str, list[float]] = defaultdict(list)
_REACTION_LIMIT = 30
_REACTION_WINDOW = 60.0

# Rate limit: 5 comments per reader (and per address) per 5 minutes
_comment_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 5
_RATE_WINDOW = 300.0


def _check_rate_limit(*keys: str) -> None:
    now = time.monotonic()
    window = now - _RATE_WINDOW
    recent = {key: [t for t in _comment_attempts[key] if t > window] for key in keys}
    if any(len(attempts) >= _RATE_LIMIT for attempts in recent.values()):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many comments. Please wait a few minutes.",
            headers={"Retry-After": "300"},
        )
    for key, attempts in recent.items():
        _comment_attempts[key] = attempts + [now]


def attach_authors(db: Session, comments: list[Comment]) -> None:
    """Set .author_picture on each comment and reply written by a signed-in
    reader (from their Google account), "" on older comments."""
    everything = [c for comment in comments for c in [comment, *(getattr(comment, "replies", None) or [])]]
    ids = [c.id for c in everything]
    pictures: dict[int, str] = {}
    if ids:
        pictures = dict(
            db.query(CommentAuthor.comment_id, Reader.picture)
            .join(Reader, Reader.id == CommentAuthor.reader_id)
            .filter(CommentAuthor.comment_id.in_(ids))
            .all()
        )
    for c in everything:
        c.author_picture = pictures.get(c.id) or ""


@router.get("", response_model=list[CommentOut])
def get_comments(request: Request, slug: str = Query(...), db: Session = Depends(get_db)):
    """Return all approved top-level comments with their replies for a post
    slug, each with its like and dislike counts and the reader's own reaction."""
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
    attach_reactions(db, comments, voter=visitor_hash(request))
    attach_authors(db, comments)
    return comments


@router.post("/{comment_id}/reaction", response_model=ReactionOut)
def react(comment_id: int, body: ReactionIn, request: Request, db: Session = Depends(get_db)):
    """Like (1), dislike (-1) or clear (0) the reader's reaction to a comment
    or reply. One reaction per reader per comment; a new one replaces the old."""
    now = time.monotonic()
    ip = client_ip(request)
    recent = [t for t in _reaction_attempts[ip] if t > now - _REACTION_WINDOW]
    if len(recent) >= _REACTION_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many reactions. Please wait a minute.",
            headers={"Retry-After": "60"},
        )
    _reaction_attempts[ip] = recent + [now]

    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.is_approved == True).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    voter = visitor_hash(request)

    def apply() -> None:
        existing = db.query(CommentReaction).filter(
            CommentReaction.comment_id == comment_id, CommentReaction.voter_hash == voter
        ).first()
        if body.value == 0:
            if existing:
                db.delete(existing)
        elif existing:
            existing.value = body.value
        else:
            db.add(CommentReaction(comment_id=comment_id, voter_hash=voter, value=body.value))
        db.commit()

    try:
        apply()
    except IntegrityError:  # the same reader's two clicks raced; the second updates the first
        db.rollback()
        apply()

    likes, dislikes = reaction_counts(db, [comment_id]).get(comment_id, (0, 0))
    return ReactionOut(comment_id=comment_id, likes=likes, dislikes=dislikes, my_reaction=body.value)


@router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def post_comment(
    body: CommentCreate,
    request: Request,
    reader: Reader = Depends(require_reader),
    db: Session = Depends(get_db),
):
    """Submit a new comment or reply as the signed-in reader. The name shown is
    the one on their Google account; the email is kept private."""
    # Per reader, and per real visitor address (behind the hosting proxy the
    # socket peer is the proxy, so a per-peer limit would throttle everyone).
    _check_rate_limit(f"reader:{reader.id}", f"ip:{client_ip(request)}")

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
        author_name=reader.name,
        author_email=reader.email,
        content=body.content,
        is_approved=True,
    )
    db.add(comment)
    db.flush()
    db.add(CommentAuthor(comment_id=comment.id, reader_id=reader.id))
    db.commit()
    db.refresh(comment)
    comment.replies = []
    comment.author_picture = reader.picture or ""
    return comment
