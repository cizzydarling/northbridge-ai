"""Billing security contract: real JWT/DB/guards, mocked Stripe boundary only."""
import copy
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
import backend.launch_smoke_test  # noqa: F401 -- model registry and SQLite JSONB support
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import access_control as access
from app.data.db import Base, get_db
from app.models.billing_transaction_model import BillingTransaction
from app.models.promo_code_model import PromoCode, PromoCodeRedemption
from app.models.user_models import User
from app.routes import billing_routes as billing
from app.routes.auth_routes import create_access_token
from app.routes.forms_routes import _can_download_forms, _can_export_forms_pdf
from app.services.ai_orchestrator import _resolve_ai_plan
from app.services.promo_code_service import redeem_promo_code


@pytest.fixture
def env(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    sessions = sessionmaker(bind=engine)
    Base.metadata.create_all(engine, tables=[User.__table__, BillingTransaction.__table__,
                                            PromoCode.__table__, PromoCodeRedemption.__table__])
    with sessions() as db:
        db.add_all([User(id=i, email=f"billing{i}@example.com", password="unused", role="individual",
                         plan="free", stripe_customer_id=f"cus_{i}",
                         email_confirmed_at=datetime.now(timezone.utc)) for i in (1, 2)])
        db.commit()

    state = SimpleNamespace(
        session={"id": "cs_1", "customer": "cus_1", "subscription": "sub_1", "invoice": "in_1",
                 "mode": "subscription", "status": "complete", "payment_status": "paid",
                 "client_reference_id": "1", "metadata": {"user_id": "1", "plan": "individual_pro"},
                 "amount_total": 3900, "currency": "cad"},
        subscription={"id": "sub_1", "customer": "cus_1", "status": "active",
                      "metadata": {"user_id": "1", "plan": "individual_pro"},
                      "cancel_at_period_end": False,
                      "items": {"data": [{"quantity": 1, "price": {"id": "price_pro"},
                                           "current_period_end": int(time.time()) + 86400}]},
                      "latest_invoice": {"id": "in_1", "customer": "cus_1", "subscription": "sub_1",
                                         "status": "paid"}},
        db=sessions,
    )
    configs = copy.deepcopy(billing.STRIPE_PLAN_CONFIG)
    for plan, price_id in (("individual_pro", "price_pro"), ("individual_premium", "price_premium"),
                           ("agent_pro", "price_agent")):
        configs[plan]["price_id"] = price_id
    monkeypatch.setattr(billing, "STRIPE_PLAN_CONFIG", configs)
    monkeypatch.setattr(billing.stripe, "api_key", "sk_test_local_only")
    monkeypatch.setattr(billing, "STRIPE_WEBHOOK_SECRET", "whsec_test_local_only")
    state.retrieve_session = Mock(side_effect=lambda *a, **kw: copy.deepcopy(state.session))
    state.retrieve_subscription = Mock(side_effect=lambda *a, **kw: copy.deepcopy(state.subscription))
    monkeypatch.setattr(billing.stripe.checkout.Session, "retrieve", state.retrieve_session)
    monkeypatch.setattr(billing.stripe.Subscription, "retrieve", state.retrieve_subscription)
    monkeypatch.setattr(billing.stripe.Invoice, "retrieve", lambda *a, **kw: {
        "id": "in_1", "customer": "cus_1", "subscription": "sub_1", "status": "paid"})
    monkeypatch.setattr(billing, "_safe_send_payment_confirmation_email", Mock())
    monkeypatch.setattr(billing, "_safe_send_cancellation_confirmation_email", Mock())
    monkeypatch.setattr(billing, "_safe_send_billing_issue_email", Mock())

    def override_db():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(billing.router)
    app.dependency_overrides[get_db] = override_db

    @app.get("/test/pro", dependencies=[Depends(access.require_individual_pro)])
    def pro_feature():
        return {"allowed": True}

    @app.get("/test/agent", dependencies=[Depends(access.require_agent_plan)])
    def agent_feature():
        return {"allowed": True}

    with TestClient(app) as client:
        state.client = client
        yield state
    engine.dispose()


def headers(user_id=1):
    return {"Authorization": "Bearer " + create_access_token({
        "sub": f"billing{user_id}@example.com", "token_version": 0})}


def sync(env, user_id=1):
    return env.client.post("/billing/sync-checkout-session", headers=headers(user_id),
                           json={"session_id": "cs_1"})


def webhook(env, kind, data):
    body = json.dumps({"id": "evt_replay", "type": kind, "data": {"object": data}})
    timestamp = int(time.time())
    signature = hmac.new(b"whsec_test_local_only", f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()
    return env.client.post("/billing/webhook", content=body,
                           headers={"stripe-signature": f"t={timestamp},v1={signature}"})


def assert_no_access(env, user_id=1):
    with env.db() as db:
        user = db.get(User, user_id)
        assert not access.has_active_paid_access(user)
        assert not access.has_individual_pro(user)
        assert not access.has_agent_plan(user)
        assert not _can_download_forms(user)
        assert not _can_export_forms_pdf(user)
        assert _resolve_ai_plan(user) == "free"
    for feature in ("pro", "agent"):
        assert env.client.get(f"/test/{feature}", headers=headers(user_id)).status_code == 403


@pytest.mark.parametrize("status,payment", [("open", "unpaid"), ("open", "paid"),
    ("complete", "unpaid"), ("expired", "unpaid"), (None, "paid"), ("complete", None),
    ("complete", "failed"), ("complete", "processing")])
def test_unpaid_or_incomplete_checkout_cannot_grant(env, status, payment):
    env.session.update(status=status, payment_status=payment)
    assert sync(env).status_code == 409
    env.retrieve_subscription.assert_not_called()
    assert_no_access(env)


@pytest.mark.parametrize("status", [None, "", "incomplete", "incomplete_expired", "past_due",
                                    "unpaid", "canceled", "paused", "trialing", "unknown"])
def test_bad_subscription_state_denies_even_with_paid_checkout(env, status):
    env.subscription["status"] = status
    assert sync(env).status_code == 409
    assert_no_access(env)


@pytest.mark.parametrize("field,value", [("subscription", None), ("mode", "payment"),
    ("metadata", {}), ("metadata", {"user_id": "1", "plan": "unknown"}),
    ("customer", None), ("client_reference_id", None)])
def test_missing_checkout_state_denies(env, field, value):
    env.session[field] = value
    assert sync(env).status_code in {403, 409}
    assert_no_access(env)


def test_anonymous_sync_denied(env):
    assert env.client.post("/billing/sync-checkout-session", json={"session_id": "cs_1"}).status_code == 401


def test_other_users_checkout_rejected_before_mutation(env):
    assert sync(env, user_id=2).status_code == 403
    assert_no_access(env, 1)
    assert_no_access(env, 2)


@pytest.mark.parametrize("target,field,value", [
    ("session", "customer", "cus_2"), ("session", "client_reference_id", "2"),
    ("session", "metadata", {"user_id": "2", "plan": "individual_pro"}),
    ("subscription", "customer", "cus_2"), ("subscription", "id", "sub_other"),
    ("subscription", "metadata", {"user_id": "2", "plan": "individual_pro"}),
])
def test_identity_mismatches_rejected(env, target, field, value):
    getattr(env, target)[field] = value
    assert sync(env).status_code == 403
    assert_no_access(env)


@pytest.mark.parametrize("field,value", [("latest_invoice", None), ("items", {}),
    ("items", {"data": "malformed"}), ("metadata", {}), ("cancel_at_period_end", None),
    ("pause_collection", {"behavior": "void"})])
def test_malformed_subscription_denied(env, field, value):
    env.subscription[field] = value
    assert sync(env).status_code in {403, 409}
    assert_no_access(env)


@pytest.mark.parametrize("field,value", [("status", "open"), ("status", "void"),
    ("status", "uncollectible"), ("status", None), ("customer", "cus_2"),
    ("subscription", "sub_other"), ("subscription", None), ("id", None)])
def test_unpaid_or_unbound_invoice_denied(env, field, value):
    env.subscription["latest_invoice"][field] = value
    assert sync(env).status_code == 409
    assert_no_access(env)


@pytest.mark.parametrize("period", [None, "invalid", 0, 1, 10**100])
def test_missing_malformed_or_expired_period_denied(env, period):
    env.subscription["items"]["data"][0]["current_period_end"] = period
    assert sync(env).status_code == 409
    assert_no_access(env)


@pytest.mark.parametrize("plan,price,role,pro,agent", [
    ("individual_pro", "price_pro", "individual", True, False),
    ("individual_premium", "price_premium", "individual", True, False),
    ("agent_pro", "price_agent", "agent", False, True),
])
def test_verified_checkout_and_replay_grant_correct_access(env, plan, price, role, pro, agent):
    with env.db() as db:
        db.get(User, 1).role = role
        db.commit()
    env.session["metadata"]["plan"] = plan
    env.subscription["metadata"]["plan"] = plan
    env.subscription["items"]["data"][0]["price"]["id"] = price
    first = sync(env)
    assert first.status_code == 200, first.text
    second = sync(env)
    assert second.status_code == 200
    assert first.json() == second.json()
    assert second.json()["access"]["is_pro"] is pro
    assert second.json()["access"]["is_agent"] is agent
    assert env.client.get("/test/pro", headers=headers()).status_code == (200 if pro else 403)
    assert env.client.get("/test/agent", headers=headers()).status_code == (200 if agent else 403)
    with env.db() as db:
        assert db.query(BillingTransaction).count() == 1


def test_replay_after_cancellation_cannot_restore_access(env):
    assert sync(env).status_code == 200
    env.subscription["status"] = "canceled"
    assert sync(env).status_code == 409
    assert_no_access(env)


def test_stripe_failure_does_not_fall_back_to_metadata(env):
    env.retrieve_subscription.side_effect = RuntimeError("Stripe unavailable")
    assert sync(env).status_code == 503
    assert_no_access(env)


def test_stripe_failure_revokes_unverifiable_bound_state(env):
    assert sync(env).status_code == 200
    env.retrieve_subscription.side_effect = RuntimeError("Stripe unavailable")
    assert sync(env).status_code == 503
    assert_no_access(env)


@pytest.mark.parametrize("kind", ["checkout.session.completed", "checkout.session.async_payment_succeeded",
    "customer.subscription.created", "customer.subscription.updated", "customer.subscription.resumed",
    "invoice.payment_succeeded", "invoice.paid"])
def test_webhooks_use_current_state_not_paid_event_snapshot(env, kind):
    stale = copy.deepcopy(env.session if kind.startswith("checkout") else
                          env.subscription if kind.startswith("customer") else env.subscription["latest_invoice"])
    env.subscription["status"] = "incomplete"
    assert webhook(env, kind, stale).status_code == 200
    assert_no_access(env)


@pytest.mark.parametrize("kind", ["checkout.session.completed", "customer.subscription.created", "invoice.paid"])
def test_legitimate_webhook_and_replay(env, kind):
    data = env.session if kind.startswith("checkout") else env.subscription if kind.startswith("customer") else env.subscription["latest_invoice"]
    for _ in range(2):
        result = webhook(env, kind, data)
        assert result.status_code == 200, result.text
    with env.db() as db:
        assert access.has_individual_pro(db.get(User, 1))


def test_failed_invoice_revokes_and_old_success_event_cannot_restore(env):
    assert sync(env).status_code == 200
    invoice = copy.deepcopy(env.subscription["latest_invoice"])
    env.subscription["status"] = "past_due"
    env.subscription["latest_invoice"]["status"] = "open"
    assert webhook(env, "invoice.payment_failed", invoice).status_code == 200
    assert webhook(env, "invoice.payment_succeeded", invoice).status_code == 200
    assert_no_access(env)


def test_invalid_webhook_signature_denied(env):
    assert env.client.post("/billing/webhook", content="{}", headers={"stripe-signature": "invalid"}).status_code == 400
    assert_no_access(env)


def test_zero_due_checkout_requires_paid_invoice(env):
    env.session["payment_status"] = "no_payment_required"
    env.session["amount_total"] = 0
    assert sync(env).status_code == 200
    env.subscription["latest_invoice"]["status"] = "open"
    assert sync(env).status_code == 409
    assert_no_access(env)


def test_old_stripe_period_and_new_invoice_parent_supported(env):
    item = env.subscription["items"]["data"][0]
    env.subscription["current_period_end"] = item.pop("current_period_end")
    invoice = env.subscription["latest_invoice"]
    invoice["parent"] = {"subscription_details": {"subscription": invoice.pop("subscription")}}
    assert sync(env).status_code == 200


def test_cancel_at_period_end_allows_only_remaining_verified_period(env):
    env.subscription["cancel_at_period_end"] = True
    response = sync(env)
    assert response.status_code == 200
    assert response.json()["user"]["subscription_status"] == "canceling"
    env.subscription["items"]["data"][0]["current_period_end"] = 1
    assert sync(env).status_code == 409
    assert_no_access(env)


@pytest.mark.parametrize("plan", ["individual_pro", "individual_premium", "agent_pro"])
@pytest.mark.parametrize("status", [None, "", "unpaid", "incomplete", "past_due", "canceled", "trialing", "complete", "paid"])
def test_guards_fail_closed_for_invalid_status(plan, status):
    user = User(plan=plan, role="individual", subscription_status=status,
                subscription_current_period_end=datetime.now(timezone.utc) + timedelta(days=1))
    assert not access.has_active_paid_access(user)
    assert not access.has_agent_plan(user)
    assert not _can_download_forms(user)
    assert not _can_export_forms_pdf(user)
    assert _resolve_ai_plan(user) == "free"


@pytest.mark.parametrize("period", [None, "invalid", datetime(2000, 1, 1)])
def test_guards_fail_closed_for_missing_or_expired_period(period):
    user = User(plan="agent_pro", subscription_status="active", subscription_current_period_end=period)
    assert not access.has_active_paid_access(user)
    assert not access.has_agent_plan(user)


def test_existing_authorized_promo_grant_still_works(env):
    with env.db() as db:
        db.add(PromoCode(code="VERIFIED", access_type="individual_pro", duration_days=30, active=True))
        db.commit()
        user = db.get(User, 1)
        redeem_promo_code(db, user=user, code="VERIFIED")
        assert access.has_individual_pro(user)


@pytest.mark.parametrize("price", [{"id": "price_unknown"}, {"id": "price_premium"},
    {"id": "price_dynamic", "product": "prod_UTyGsfJo7qcmbi", "unit_amount": 1,
     "currency": "cad", "recurring": {"interval": "day", "interval_count": 30}}])
def test_price_must_match_expected_plan_and_amount(env, price):
    env.subscription["items"]["data"][0]["price"] = price
    assert sync(env).status_code == 409
    assert_no_access(env)


def test_matching_inline_price_supported(env):
    config = billing.STRIPE_PLAN_CONFIG["individual_pro"]
    env.subscription["items"]["data"][0]["price"] = {
        "id": "price_dynamic", "product": config["product_id"], "unit_amount": config["unit_amount"],
        "currency": config["currency"], "recurring": {"interval": config["interval"], "interval_count": config["interval_count"]}}
    assert sync(env).status_code == 200


def test_checkout_creation_never_grants_access(env, monkeypatch):
    monkeypatch.setenv("PAID_CHECKOUT_ENABLED", "true")
    monkeypatch.setattr(billing, "require_global_disclosures_accepted", lambda *args: None)
    monkeypatch.setattr(billing.stripe.Customer, "modify", Mock())
    create = Mock(return_value=SimpleNamespace(id="cs_open", url="https://checkout.stripe.com/test"))
    monkeypatch.setattr(billing.stripe.checkout.Session, "create", create)
    response = env.client.post("/billing/create-checkout-session", headers=headers(), json={"plan": "pro"})
    assert response.status_code == 200
    assert create.call_args.kwargs["customer"] == "cus_1"
    assert create.call_args.kwargs["mode"] == "subscription"
    assert create.call_args.kwargs["subscription_data"]["metadata"] == {"user_id": "1", "plan": "individual_pro"}
    assert_no_access(env)


def test_unpaid_checkout_webhook_cannot_grant(env):
    env.session.update(status="open", payment_status="unpaid", subscription=None)
    assert webhook(env, "checkout.session.completed", env.session).status_code == 200
    assert_no_access(env)


def test_old_session_cannot_replace_current_subscription(env):
    assert sync(env).status_code == 200
    env.session["subscription"] = "sub_old"
    assert sync(env).status_code == 409
    with env.db() as db:
        assert db.get(User, 1).stripe_subscription_id == "sub_1"
        assert access.has_individual_pro(db.get(User, 1))


def test_old_subscription_event_cannot_revoke_or_replace_current_subscription(env):
    assert sync(env).status_code == 200
    old = {"id": "sub_old", "customer": "cus_1", "status": "canceled"}
    assert webhook(env, "customer.subscription.deleted", old).status_code == 200
    with env.db() as db:
        assert access.has_individual_pro(db.get(User, 1))
        assert db.get(User, 1).stripe_subscription_id == "sub_1"


def test_failed_new_checkout_preserves_separately_verified_access(env):
    assert sync(env).status_code == 200
    env.session.update(id="cs_1", status="open", payment_status="unpaid", subscription=None)
    assert sync(env).status_code == 409
    with env.db() as db:
        assert access.has_individual_pro(db.get(User, 1))


def test_strategy_cannot_bypass_expired_entitlement(monkeypatch):
    from app.routes import strategy_routes
    monkeypatch.setattr(strategy_routes, "get_profile_for_user", lambda *a: object())
    monkeypatch.setattr(strategy_routes, "get_household_members", lambda *a: [])
    monkeypatch.setattr(strategy_routes, "resolve_application_context", lambda *a: SimpleNamespace(case=None, members=[]))
    build = Mock(return_value={})
    monkeypatch.setattr(strategy_routes, "build_strategy", build)
    monkeypatch.setattr(strategy_routes, "build_strategy_payload", lambda *a, **kw: {})
    user = User(id=1, role="individual", plan="individual_premium", subscription_status="active",
                subscription_current_period_end=datetime(2000, 1, 1))
    result = strategy_routes.get_my_strategy(case_id=None, language="en", db=None, current_user=user)
    assert not result["access"]["is_premium"]
    assert not result["access"]["is_pro"]
    assert build.call_args.kwargs["include_immigration_intelligence"] is False


@pytest.mark.parametrize("flag", [None, "false", "", "yes", "1", "invalid"])
@pytest.mark.parametrize("plan", ["pro", "premium", "individual_pro", "individual_premium", "agent_pro", "free"])
def test_wave1_checkout_fails_closed(env, monkeypatch, flag, plan):
    if flag is None:
        monkeypatch.delenv("PAID_CHECKOUT_ENABLED", raising=False)
    else:
        monkeypatch.setenv("PAID_CHECKOUT_ENABLED", flag)
    customer = Mock(side_effect=AssertionError("Customer must not be created"))
    checkout = Mock(side_effect=AssertionError("Checkout must not be created"))
    monkeypatch.setattr(billing, "get_or_create_stripe_customer", customer)
    monkeypatch.setattr(billing.stripe.checkout.Session, "create", checkout)
    response = env.client.post("/billing/create-checkout-session?PAID_CHECKOUT_ENABLED=true",
        headers={**headers(), "PAID_CHECKOUT_ENABLED": "true"},
        json={"plan": plan, "checkout_available": True, "PAID_CHECKOUT_ENABLED": True})
    assert response.status_code == 403
    assert response.json()["detail"]["reason"] == "beta_checkout_disabled"
    assert response.json()["detail"]["checkout_available"] is False
    customer.assert_not_called()
    checkout.assert_not_called()
    plans = env.client.get("/billing/plans").json()
    assert plans["checkout_available"] is False
    assert all(not p["checkout_enabled"] for p in plans["plans"])
    assert_no_access(env)


def test_wave1_anonymous_and_aliases(env, monkeypatch):
    monkeypatch.setenv("PAID_CHECKOUT_ENABLED", "false")
    assert env.client.post("/billing/create-checkout-session", json={"plan":"pro"}).status_code == 401
    for path in ("/billing/checkout", "/checkout", "/billing/checkout/pro", "/billing/plans/pro/checkout"):
        assert env.client.post(path, headers=headers(), json={"plan":"pro"}).status_code in (404, 405)


def test_wave1_existing_premium_unchanged(env, monkeypatch):
    monkeypatch.setenv("PAID_CHECKOUT_ENABLED", "false")
    with env.db() as db:
        user = db.get(User, 1)
        user.plan = "individual_premium"
        user.subscription_status = "active"
        user.subscription_current_period_end = datetime.now(timezone.utc) + timedelta(days=7)
        db.commit()
        before = (user.plan, user.subscription_status, user.subscription_current_period_end)
    assert env.client.post("/billing/create-checkout-session",headers=headers(),json={"plan":"pro"}).status_code == 403
    assert env.client.get("/test/pro",headers=headers()).status_code == 200
    with env.db() as db:
        user = db.get(User,1)
        assert (user.plan,user.subscription_status,user.subscription_current_period_end) == before
        assert access.has_premium_access(user)


@pytest.mark.parametrize("plan", ["individual_pro", "individual_premium"])
def test_wave1_bounded_promo(env, monkeypatch, plan):
    monkeypatch.setenv("PAID_CHECKOUT_ENABLED", "false")
    from fastapi import HTTPException
    with env.db() as db:
        code = PromoCode(code="WAVEONE", access_type=plan, duration_days=7, max_uses=1,
                         current_uses=0, active=True, expires_at=datetime.now(timezone.utc)+timedelta(days=1))
        db.add(code); db.commit()
        owner = db.get(User,1)
        redeem_promo_code(db,user=owner,code=" waveone ")
        assert access.has_individual_pro(owner)
        assert owner.plan == plan
        assert db.get(User,2).plan == "free"
        for user in (owner, db.get(User,2)):
            with pytest.raises(HTTPException):
                redeem_promo_code(db,user=user,code="WAVEONE")
        assert db.query(PromoCodeRedemption).count() == 1
        assert code.current_uses == 1


def test_wave1_reconciliation_preserved(env, monkeypatch):
    monkeypatch.setenv("PAID_CHECKOUT_ENABLED", "false")
    assert sync(env).status_code == 200
    assert webhook(env,"customer.subscription.updated",env.subscription).status_code == 200
    assert env.client.get("/test/pro",headers=headers()).status_code == 200


@pytest.mark.parametrize("kind", ["missing", "expired", "inactive", "invalid_plan"])
def test_wave1_invalid_promo_preserves_access(env, monkeypatch, kind):
    from fastapi import HTTPException
    monkeypatch.setenv("PAID_CHECKOUT_ENABLED", "false")
    with env.db() as db:
        if kind != "missing":
            db.add(PromoCode(code="INVALID", access_type="agent_pro" if kind == "invalid_plan" else "individual_pro",
                duration_days=7, max_uses=1, current_uses=0, active=kind != "inactive",
                expires_at=datetime.now(timezone.utc)+timedelta(days=-1 if kind == "expired" else 1)))
            db.commit()
        user = db.get(User, 1)
        with pytest.raises(HTTPException):
            redeem_promo_code(db, user=user, code="INVALID")
        assert user.plan == "free"
        assert db.query(PromoCodeRedemption).count() == 0
