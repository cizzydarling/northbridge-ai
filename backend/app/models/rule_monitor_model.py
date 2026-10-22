"""Public-source evidence only. Snapshots/reviews are append-only in application APIs."""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.sql import func
from app.data.db import Base


class RuleSourceCheck(Base):
    __tablename__ = "rule_source_checks"
    id = Column(Integer, primary_key=True)
    source_id = Column(String(80), nullable=False, index=True)
    checked_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(40), nullable=False)
    fingerprint = Column(String(64), nullable=True)
    __table_args__ = (UniqueConstraint("source_id", "checked_at", name="uq_rule_source_check"),)


class RuleSourceSnapshot(Base):
    __tablename__ = "rule_source_snapshots"
    id = Column(Integer, primary_key=True)
    source_id = Column(String(80), nullable=False)
    fingerprint = Column(String(64), nullable=False)
    normalized_text = Column(Text, nullable=False)
    captured_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("source_id", "fingerprint", name="uq_rule_snapshot"),)


class RuleSourceChange(Base):
    __tablename__ = "rule_source_changes"
    id = Column(Integer, primary_key=True)
    source_id = Column(String(80), nullable=False)
    previous_fingerprint = Column(String(64), nullable=True)
    new_fingerprint = Column(String(64), nullable=False)
    detected_at = Column(DateTime(timezone=True), nullable=False)
    effective_date = Column(Date, nullable=True)
    classification = Column(String(80), nullable=False)
    before_excerpt = Column(String(400), nullable=False)
    after_excerpt = Column(String(400), nullable=False)
    extraction_status = Column(String(40), nullable=False)
    modules = Column(JSON, nullable=False)
    __table_args__ = (UniqueConstraint("source_id", "detected_at", name="uq_rule_change"),)


class RuleReviewDecision(Base):
    __tablename__ = "rule_review_decisions"
    id = Column(Integer, primary_key=True)
    change_id = Column(Integer, ForeignKey("rule_source_changes.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decision = Column(String(40), nullable=False)
    note = Column(String(1000), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
