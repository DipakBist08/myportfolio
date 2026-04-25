from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class SubscribeRequest(BaseModel):
    email: EmailStr
    name: str = ""


class SubscriberOut(BaseModel):
    id: int
    email: str
    name: str
    is_active: bool
    is_unsubscribed: bool
    subscribed_at: datetime
    confirmed_at: Optional[datetime]
    model_config = {"from_attributes": True}


class SubscriberStats(BaseModel):
    total: int
    active: int
    unsubscribed: int
    pending: int
