from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BillingTransactionResponse(BaseModel):
    id: int
    plan: Optional[str] = None
    amount: Optional[int] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    billing_email: Optional[str] = None
    customer_name: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_invoice_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    receipt_url: Optional[str] = None
    invoice_pdf: Optional[str] = None
    paid_at: Optional[datetime] = None
    confirmation_email_sent_at: Optional[datetime] = None
    confirmation_email_status: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
