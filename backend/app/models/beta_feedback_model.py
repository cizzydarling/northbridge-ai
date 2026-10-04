"""Minimal beta diagnostics; no account email or unrestricted context blob."""
from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, func
from app.data.db import Base


class BetaFeedback(Base):
    __tablename__ = "beta_feedback"
    __table_args__ = (
        CheckConstraint("category IN ('bug','ux','ai','content','feature','general')", name="ck_feedback_category"),
        CheckConstraint("length(trim(message)) BETWEEN 10 AND 4000", name="ck_feedback_message"),
        CheckConstraint("rating IS NULL OR rating BETWEEN 1 AND 5", name="ck_feedback_rating"),
        CheckConstraint("language IN ('en','fr')", name="ck_feedback_language"),
        CheckConstraint("status IN ('new','reviewed','planned','resolved','dismissed')", name="ck_feedback_status"),
        CheckConstraint("ai_status IS NULL OR ai_status IN ('available','unavailable','not_requested')", name="ck_feedback_ai_status"),
        Index("ix_feedback_status_created", "status", "created_at", "id"),
        Index("ix_feedback_user_created", "user_id", "created_at"),
    )
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    category = Column(String(16), nullable=False)
    message = Column(Text, nullable=False)
    rating = Column(Integer)
    allow_follow_up = Column(Boolean, nullable=False, server_default="false")
    page_path = Column(String(80), nullable=False)
    language = Column(String(2), nullable=False)
    user_role = Column(String(20), nullable=False)
    user_plan = Column(String(32), nullable=False)
    application_version = Column(String(64))
    backend_version = Column(String(64))
    device_context = Column(String(10))
    ai_status = Column(String(16))
    status = Column(String(16), nullable=False, server_default="new")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
