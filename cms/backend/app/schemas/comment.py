from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from datetime import datetime
import bleach
import html
import re


SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class CommentCreate(BaseModel):
    """A new comment or reply from a signed-in reader. The name and email come
    from their Google account (app.core.readers), never from the request."""

    post_slug: str
    parent_id: Optional[int] = None
    content: str

    @field_validator("post_slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        if len(v) > 200 or not SLUG.match(v):
            raise ValueError("invalid slug")
        return v

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
    # The Google profile picture of a signed-in author ("" for older comments).
    author_picture: str = ""
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
    author_picture: str = ""
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
