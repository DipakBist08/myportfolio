from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MediaUpdate(BaseModel):
    alt_text: Optional[str] = None
    caption: Optional[str] = None


class MediaOut(BaseModel):
    id: int
    filename: str
    original_filename: str
    url: str
    mime_type: str
    file_size: int
    width: Optional[int]
    height: Optional[int]
    alt_text: str
    caption: str
    created_at: datetime
    model_config = {"from_attributes": True}


class PaginatedMedia(BaseModel):
    items: list[MediaOut]
    total: int
    page: int
    page_size: int
    pages: int
