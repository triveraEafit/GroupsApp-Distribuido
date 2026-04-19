from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    sender_id = Column(Integer, nullable=False)
    sender_username = Column(String, nullable=False)
    group_id = Column(Integer, nullable=True)
    receiver_id = Column(Integer, nullable=True)
    is_direct = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())