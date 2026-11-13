from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal, Optional
from datetime import datetime
import bleach
import html


class CommentCreate(BaseModel):
    post_slug: str
    parent_id: Optional[int] = None
    author_name: str
    author_email: EmailStr
    content: str

    @field_validator("author_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v[:100]

    @field_validator("content")
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        # Strip all HTML tags — plain text only
        # The blog renders comments as text (React escapes them), so decode the
        # entities bleach adds: "Q&A" must not show as "Q&amp;A".
        v = html.unescape(bleach.clean(v, tags=[], strip=True))
        if len(v) > 2000:
            raise ValueError("Comment must be under 2000 characters")
        return v


class CommentReply(BaseModel):
    id: int
    author_name: str
    content: str
    created_at: datetime
    # Reactions (app.core.reactions.attach_reactions). my_reaction is the
    # requesting visitor's own: 1 like, -1 dislike, 0 none.
    likes: int = 0
    dislikes: int = 0
    my_reaction: int = 0
    model_config = {"from_attributes": True}


class CommentOut(BaseModel):
    id: int
    post_slug: str
    parent_id: Optional[int]
    author_name: str
    content: str
    created_at: datetime
    replies: list[CommentReply] = []
    likes: int = 0
    dislikes: int = 0
    my_reaction: int = 0
    model_config = {"from_attributes": True}


class ReactionIn(BaseModel):
    value: Literal[-1, 0, 1]  # 1 like, -1 dislike, 0 take my reaction back


class ReactionOut(BaseModel):
    comment_id: int
    likes: int
    dislikes: int
    my_reaction: int


class CommentAdminOut(CommentOut):
    author_email: str
    is_approved: bool
