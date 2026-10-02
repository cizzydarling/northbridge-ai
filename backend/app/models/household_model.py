from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func
from app.data.db import Base

class Household(Base):
    __tablename__ = "households"
    __table_args__ = (UniqueConstraint("id", "owner_user_id", name="uq_household_owner_pair"),)
    id = Column(Integer, primary_key=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    name = Column(String(120), nullable=False, default="My household")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
