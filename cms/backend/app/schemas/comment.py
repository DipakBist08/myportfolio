from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
import bleach


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
        v = bleach.clean(v, tags=[], strip=True)
        if len(v) > 2000:
            raise ValueError("Comment must be under 2000 characters")
        return v


class CommentReply(BaseModel):
    id: int
    author_name: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


class CommentOut(BaseModel):
    id: int
    post_slug: str
    parent_id: Optional[int]
    author_name: str
    content: str
    created_at: datetime
    replies: list[CommentReply] = []
    model_config = {"from_attributes": True}


class CommentAdminOut(CommentOut):
    author_email: str
    is_approved: bool
