from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)          
    original_filename = Column(String(500), nullable=False)  
    file_path = Column(String(1000), nullable=False)         
    url = Column(String(1000), nullable=False)             
    mime_type = Column(String(100), nullable=False)
    file_size = Column(BigInteger, default=0)                
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    alt_text = Column(String(500), default="")
    caption = Column(Text, default="")

    uploaded_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    uploader = relationship("User", back_populates="media")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
