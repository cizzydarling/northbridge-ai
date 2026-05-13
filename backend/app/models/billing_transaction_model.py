from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.data.db import Base


class BillingTransaction(Base):
    __tablename__ = "billing_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    plan = Column(String(80), nullable=True)
    amount = Column(Integer, nullable=True)
    currency = Column(String(12), nullable=True)
    status = Column(String(80), nullable=True)

    billing_email = Column(String(255), nullable=True)
    customer_name = Column(String(255), nullable=True)

    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True, index=True)
    stripe_session_id = Column(String(255), nullable=True, unique=True, index=True)
    stripe_invoice_id = Column(String(255), nullable=True, unique=True, index=True)
    stripe_payment_intent_id = Column(String(255), nullable=True, index=True)

    receipt_url = Column(Text, nullable=True)
    invoice_pdf = Column(Text, nullable=True)

    paid_at = Column(DateTime(timezone=True), nullable=True)
    confirmation_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    confirmation_email_status = Column(String(80), nullable=True)
    confirmation_email_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="billing_transactions")
