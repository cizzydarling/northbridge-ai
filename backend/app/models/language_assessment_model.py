"""Append-only, user-reported test evidence; never backfilled from Profile scalars."""
from sqlalchemy import Column, Date, DateTime, ForeignKey, ForeignKeyConstraint, Integer, JSON, String, UniqueConstraint, CheckConstraint
from sqlalchemy.sql import func
from app.data.db import Base


class LanguageAssessment(Base):
    __tablename__ = "language_assessments"
    __table_args__ = (
        UniqueConstraint("id", "user_id", "language", name="uq_language_assessment_owner"),
        CheckConstraint("language IN ('en','fr')", name="ck_language_assessment_language"),
        CheckConstraint("provenance = 'user_reported'", name="ck_language_assessment_provenance"),
    )
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    language = Column(String(2), nullable=False)
    exam = Column(String(40), nullable=False)
    edition = Column(String(80), nullable=False)
    test_date = Column(Date, nullable=False)
    raw_scores = Column(JSON, nullable=False)
    mapping_version = Column(String(80), nullable=False)
    provenance = Column(String(30), nullable=False, default="user_reported")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LanguageSelection(Base):
    __tablename__ = "language_selections"
    __table_args__ = (ForeignKeyConstraint(
        ["assessment_id", "user_id", "language"],
        ["language_assessments.id", "language_assessments.user_id", "language_assessments.language"],
        name="fk_language_selection_owner"),)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    language = Column(String(2), primary_key=True)
    assessment_id = Column(Integer, nullable=True)
