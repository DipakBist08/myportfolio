"""Like and dislike counts for comments, attached to ORM objects so the
comment schemas (which read attributes) can return them."""
from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.comment import Comment
from app.models.traffic import CommentReaction


def reaction_counts(db: Session, comment_ids: list[int]) -> dict[int, tuple[int, int]]:
    """{comment_id: (likes, dislikes)} for the given comments."""
    if not comment_ids:
        return {}
    rows = (
        db.query(
            CommentReaction.comment_id,
            func.sum(case((CommentReaction.value > 0, 1), else_=0)),
            func.sum(case((CommentReaction.value < 0, 1), else_=0)),
        )
        .filter(CommentReaction.comment_id.in_(comment_ids))
        .group_by(CommentReaction.comment_id)
        .all()
    )
    return {cid: (int(likes or 0), int(dislikes or 0)) for cid, likes, dislikes in rows}


def attach_reactions(db: Session, comments: Iterable[Comment], voter: Optional[str] = None) -> None:
    """Set .likes, .dislikes and .my_reaction on each comment and its replies."""
    everything: list[Comment] = []
    for comment in comments:
        everything.append(comment)
        everything.extend(getattr(comment, "replies", None) or [])
    ids = [c.id for c in everything]
    counts = reaction_counts(db, ids)
    mine: dict[int, int] = {}
    if voter and ids:
        mine = dict(
            db.query(CommentReaction.comment_id, CommentReaction.value)
            .filter(CommentReaction.comment_id.in_(ids), CommentReaction.voter_hash == voter)
            .all()
        )
    for c in everything:
        c.likes, c.dislikes = counts.get(c.id, (0, 0))
        c.my_reaction = mine.get(c.id, 0)
