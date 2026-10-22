"""Real signed webhook/parser and isolated DB; Stripe API boundary is synthetic."""
import copy
import pytest
from sqlalchemy import select
from app.models.billing_review_model import BillingReviewEvent
from app.models.billing_transaction_model import BillingTransaction
from app.models.user_models import User
from backend.tests.test_billing_entitlements import env, headers, webhook  # noqa: F401


@pytest.fixture
def refunds(env, monkeypatch):
    with env.db() as db:
        BillingReviewEvent.__table__.create(db.get_bind())
        db.add(BillingTransaction(id=1, user_id=1, amount=3900, currency="cad", status="paid",
            stripe_customer_id="cus_1", stripe_payment_intent_id="pi_synthetic", plan="individual_pro"))
        db.commit()
    env.charge = {"id": "ch_synthetic", "customer": "cus_1", "payment_intent": "pi_synthetic", "amount_refunded": 3900, "currency": "cad"}
    monkeypatch.setattr("app.routes.billing_routes.stripe.Charge.retrieve", lambda _id: copy.deepcopy(env.charge))
    return env


def snapshot(env):
    with env.db() as db:
        user = db.get(User, 1)
        transaction = db.get(BillingTransaction, 1)
        return (user.plan, user.subscription_status, user.subscription_current_period_end, transaction.status, transaction.amount)


def test_refund_signed_replay_is_audit_only_without_policy_change(refunds):
    before = snapshot(refunds)
    for _ in range(2):
        assert webhook(refunds, "charge.refunded", {"id": "ch_synthetic", "amount_refunded": 0}).status_code == 200
    assert snapshot(refunds) == before
    with refunds.db() as db:
        rows = db.scalars(select(BillingReviewEvent)).all()
        assert len(rows) == 1
        assert rows[0].transaction_id == 1 and rows[0].refunded_amount == 3900
        assert rows[0].status == "pending_human_review"
    assert refunds.client.get("/billing/admin/reconciliation").status_code == 401
    assert refunds.client.get("/billing/admin/reconciliation", headers=headers()).status_code == 403
    with refunds.db() as db:
        db.get(User, 2).role = "admin"
        db.commit()
    response = refunds.client.get("/billing/admin/reconciliation", headers=headers(2))
    assert response.status_code == 200
    body = response.json()
    assert body["writes"] is False and body["provider_reconciliation_performed"] is False
    assert body["refund_reviews"][0]["refunded_amount"] == 3900
    assert "@" not in response.text and "pi_synthetic" not in response.text


def test_refund_unmatched_customer_never_attaches_another_users_payment(refunds):
    refunds.charge["customer"] = "cus_2"
    assert webhook(refunds, "charge.refunded", {"id": "ch_synthetic"}).status_code == 200
    with refunds.db() as db:
        row = db.scalars(select(BillingReviewEvent)).one()
        assert row.transaction_id is None and row.status == "unmatched_human_review"


@pytest.mark.parametrize("amount", [0, -1, True])
def test_pending_or_invalid_refund_never_changes_access(refunds, amount):
    before = snapshot(refunds)
    refunds.charge["amount_refunded"] = amount
    response = webhook(refunds, "refund.updated", {"id": "re_synthetic", "charge": "ch_synthetic"})
    assert response.status_code == (200 if amount == 0 else 400)
    with refunds.db() as db:
        assert db.scalars(select(BillingReviewEvent)).all() == []
    assert snapshot(refunds) == before


def test_provider_failure_is_retryable_without_false_audit(refunds, monkeypatch):
    def failed(_id):
        raise ConnectionError("synthetic provider failure")
    monkeypatch.setattr("app.routes.billing_routes.stripe.Charge.retrieve", failed)
    with pytest.raises(ConnectionError):
        webhook(refunds, "charge.refunded", {"id": "ch_synthetic"})
    with refunds.db() as db:
        assert db.scalars(select(BillingReviewEvent)).all() == []
