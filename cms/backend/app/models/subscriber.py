from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base
import secrets


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(200), default="")

    is_active = Column(Boolean, default=False, nullable=False)   # confirmed
    is_unsubscribed = Column(Boolean, default=False, nullable=False)

    confirmation_token = Column(String(128), unique=True, nullable=True)
    unsubscribe_token = Column(String(128), unique=True, nullable=True, default=lambda: secrets.token_urlsafe(32))

    subscribed_at = Column(DateTime(timezone=True), server_default=func.now())
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    unsubscribed_at = Column(DateTime(timezone=True), nullable=True)
