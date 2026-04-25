from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TagCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    color: str = "#06b6d4"


class TagUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    color: Optional[str] = None


class TagOut(BaseModel):
    id: int
    name: str
    slug: str
    color: str
    post_count: int = 0
    created_at: datetime
    model_config = {"from_attributes": True}
