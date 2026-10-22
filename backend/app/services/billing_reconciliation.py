"""Refund notification handling without inventing a refund/access policy.

Signed events are reconciled with current Stripe charge state. A refund is an
operator review item, not permission to silently change subscription policy.
Existing entitlement and transaction writers remain authoritative and unchanged.
"""
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.models.billing_review_model import BillingReviewEvent
from app.models.billing_transaction_model import BillingTransaction
from app.models.user_models import User
from app.core.access_control import has_active_paid_access


def record_refund_review(db, event, *, retrieve_charge):
    data = event["data"]["object"]
    event_id, kind = event.get("id"), event.get("type")
    charge_id = data.get("charge") if kind == "refund.updated" else data.get("id")
    if not isinstance(event_id, str) or not event_id.startswith("evt_") or len(event_id) > 255 or not isinstance(charge_id, str):
        raise HTTPException(400, "Invalid refund event identity")
    # No trust in an old event snapshot for the current refund amount.
    charge = retrieve_charge(charge_id)
    amount, currency = charge.get("amount_refunded"), charge.get("currency")
    if charge.get("id") != charge_id or type(amount) is not int or amount < 0 or currency != "cad":
        raise HTTPException(400, "Unverified refund state")
    if amount == 0:
        return  # Pending/failed refund grants/revokes nothing.
    existing = db.query(BillingReviewEvent).filter_by(provider_event_id=event_id).first()
    if existing:
        if existing.event_type != kind:
            raise HTTPException(400, "Conflicting provider event identity")
        return
    payment = charge.get("payment_intent")
    rows = db.query(BillingTransaction).filter_by(stripe_payment_intent_id=payment).all() if isinstance(payment, str) else []
    matched = [r for r in rows if r.stripe_customer_id == charge.get("customer") and r.currency == currency]
    transaction = matched[0] if len(matched) == 1 else None
    db.add(BillingReviewEvent(provider_event_id=event_id, event_type=kind,
        transaction_id=transaction.id if transaction else None, refunded_amount=amount,
        currency=currency, status="pending_human_review" if transaction else "unmatched_human_review"))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Concurrent replay must not create a second review item.
        if not db.query(BillingReviewEvent).filter_by(provider_event_id=event_id, event_type=kind).first():
            raise


def reconciliation_summary(db):
    reviews = db.query(BillingReviewEvent).order_by(BillingReviewEvent.id).all()
    users = db.query(User).filter(User.stripe_subscription_id.is_not(None)).all()
    return {"writes": False, "provider_reconciliation_performed": False,
            "refund_policy": "human_review_required_no_automatic_entitlement_change",
            "refund_reviews": [{"id": r.id, "transaction_id": r.transaction_id, "status": r.status,
                                "refunded_amount": r.refunded_amount, "currency": r.currency} for r in reviews],
            "local_subscription_state": [{"user_id": u.id, "status": u.subscription_status,
                "active_access": has_active_paid_access(u), "period_end": u.subscription_current_period_end} for u in users]}
