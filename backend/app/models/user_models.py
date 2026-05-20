from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.data.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="individual")

    plan = Column(String, nullable=False, default="free")
    subscription_status = Column(String, nullable=True)
    subscription_cancel_at_period_end = Column(Boolean, nullable=True)
    subscription_current_period_end = Column(DateTime(timezone=True), nullable=True)
    cancellation_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_email_status = Column(String, nullable=True)
    cancellation_email_error = Column(Text, nullable=True)
    billing_issue_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    billing_issue_email_status = Column(String, nullable=True)
    billing_issue_email_error = Column(Text, nullable=True)
    onboarding_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    onboarding_email_status = Column(String, nullable=True)
    onboarding_email_error = Column(Text, nullable=True)
    email_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    email_confirmation_token_hash = Column(String(128), nullable=True)
    email_confirmation_sent_at = Column(DateTime(timezone=True), nullable=True)
    email_confirmation_status = Column(String, nullable=True)
    email_confirmation_error = Column(Text, nullable=True)
    password_reset_token_hash = Column(String(128), nullable=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_sent_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_status = Column(String, nullable=True)
    password_reset_error = Column(Text, nullable=True)
    stripe_customer_id = Column(String, nullable=True, unique=True)
    stripe_subscription_id = Column(String, nullable=True, unique=True)

    profile = relationship("Profile", back_populates="user", uselist=False)
    billing_transactions = relationship(
        "BillingTransaction",
        back_populates="user",
        cascade="all, delete-orphan",
    )
