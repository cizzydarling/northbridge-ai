"""Minimal refund reconciliation journal; never stores provider payloads/credentials."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func
from app.data.db import Base


class BillingReviewEvent(Base):
    __tablename__ = "billing_review_events"
    id = Column(Integer, primary_key=True)
    provider_event_id = Column(String(255), unique=True, nullable=False)
    event_type = Column(String(80), nullable=False)
    transaction_id = Column(Integer, ForeignKey("billing_transactions.id"), nullable=True)
    refunded_amount = Column(Integer, nullable=False)
    currency = Column(String(12), nullable=False)
    status = Column(String(50), nullable=False, default="pending_human_review")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
