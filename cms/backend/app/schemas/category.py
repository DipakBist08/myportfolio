from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: str = ""
    color: str = "#6366f1"
    icon: str = ""
    parent_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[int] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    color: str
    icon: str
    parent_id: Optional[int]
    post_count: int = 0
    created_at: datetime
    model_config = {"from_attributes": True}
