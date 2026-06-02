from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.data.db import Base


class SavedCareerJob(Base):
    __tablename__ = "saved_career_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(length=255), nullable=False)
    province = Column(String(length=80), nullable=False, index=True)
    noc_code = Column(String(length=20), nullable=True, index=True)
    occupation = Column(String(length=255), nullable=True)
    company = Column(String(length=255), nullable=True)
    job_url = Column(Text, nullable=False)
    source = Column(String(length=120), nullable=False, default="Job Bank")
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
