from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # "view" | "share" | "subscribe"
    ip_hash = Column(String(64), default="")       
    user_agent = Column(String(500), default="")
    referrer = Column(String(500), default="")
    country = Column(String(100), default="")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
