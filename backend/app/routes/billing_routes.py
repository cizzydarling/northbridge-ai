import os
from typing import Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.access_control import (
    FREE_PLAN,
    PREMIUM_PLAN,
    PRO_PLAN,
    build_access_response,
    get_raw_user_plan,
    get_user_plan,
)
from app.data.db import get_db
from app.models.user_models import User
from app.routes.auth_routes import get_current_user

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

STRIPE_PRICE_INDIVIDUAL_PRO = os.getenv("STRIPE_PRICE_INDIVIDUAL_PRO")
STRIPE_PRICE_INDIVIDUAL_PREMIUM = os.getenv("STRIPE_PRICE_INDIVIDUAL_PREMIUM")
STRIPE_PRODUCT_INDIVIDUAL_PRO = os.getenv(
    "STRIPE_PRODUCT_INDIVIDUAL_PRO",
    "prod_UTyGsfJo7qcmbi",
)
STRIPE_PRODUCT_INDIVIDUAL_PREMIUM = os.getenv(
    "STRIPE_PRODUCT_INDIVIDUAL_PREMIUM",
    "prod_UTyIWa3nkPA4PR",
)

STRIPE_PLAN_CONFIG = {
    "individual_pro": {
        "price_id": STRIPE_PRICE_INDIVIDUAL_PRO,
        "product_id": STRIPE_PRODUCT_INDIVIDUAL_PRO,
        "unit_amount": 3900,
        "currency": "cad",
        "interval": "day",
        "interval_count": 30,
        "name": "NorthbridgeAI Pro",
    },
    "individual_premium": {
        "price_id": STRIPE_PRICE_INDIVIDUAL_PREMIUM,
        "product_id": STRIPE_PRODUCT_INDIVIDUAL_PREMIUM,
        "unit_amount": 9900,
        "currency": "cad",
        "interval": "day",
        "interval_count": 90,
        "name": "NorthbridgeAI Premium",
    },
}

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
DEV_ENVS = {"development", "dev", "local", "test"}

router = APIRouter(prefix="/billing", tags=["Billing"])


def _stripe_ready() -> bool:
    return bool(stripe.api_key)


def ensure_stripe_configured() -> None:
    if not _stripe_ready():
        raise HTTPException(status_code=500, detail="Stripe secret key is not configured.")


def ensure_webhook_configured() -> None:
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook secret is not configured.")


def ensure_dev_mode() -> None:
    if APP_ENV not in DEV_ENVS:
        raise HTTPException(status_code=404, detail="Not found")


def _stripe_get(value: Any, key: str, default: Any = None) -> Any:
    if value is None:
        return default
    if isinstance(value, dict):
        return value.get(key, default)
    return getattr(value, key, default)


def _normalize_plan(plan: str | None) -> str:
    value = str(plan or "").strip().lower()
    if value in {"pro", "individual_pro"}:
        return "individual_pro"
    if value in {"premium", "individual_premium"}:
        return "individual_premium"
    return "free"


def get_or_create_stripe_customer(user: User, db: Session) -> str:
    ensure_stripe_configured()

    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        metadata={"user_id": str(user.id)},
    )

    user.stripe_customer_id = customer.id
    db.commit()
    db.refresh(user)

    return customer.id


def get_price_id_for_plan(plan: str) -> str:
    selected_plan = _normalize_plan(plan)
    plan_config = STRIPE_PLAN_CONFIG.get(selected_plan) or {}
    price_id = plan_config.get("price_id")

    if price_id:
        return price_id

    raise HTTPException(
        status_code=500,
        detail="Stripe price ID is not configured for this plan.",
    )


def get_checkout_line_item_for_plan(plan: str) -> dict:
    selected_plan = _normalize_plan(plan)
    plan_config = STRIPE_PLAN_CONFIG.get(selected_plan)

    if not plan_config:
        raise HTTPException(status_code=400, detail="Invalid billing plan.")

    product_id = plan_config.get("product_id")
    if product_id:
        return {
            "price_data": {
                "currency": plan_config["currency"],
                "product": product_id,
                "unit_amount": plan_config["unit_amount"],
                "recurring": {
                    "interval": plan_config["interval"],
                    "interval_count": plan_config["interval_count"],
                },
            },
            "quantity": 1,
        }

    price_id = plan_config.get("price_id")
    if price_id:
        return {"price": price_id, "quantity": 1}

    raise HTTPException(
        status_code=500,
        detail="Stripe product or price is not configured for this plan.",
    )


def map_price_to_plan(
    price_id: str | None = None,
    *,
    product_id: str | None = None,
    price: Any = None,
) -> str | None:
    price_product_id = product_id or _stripe_get(price, "product")

    for plan, config in STRIPE_PLAN_CONFIG.items():
        if price_id and config.get("price_id") and price_id == config.get("price_id"):
            return plan
        if price_product_id and config.get("product_id") and price_product_id == config.get("product_id"):
            return plan

    return None


def _subscription_price(subscription: Any) -> Any | None:
    items = _stripe_get(_stripe_get(subscription, "items"), "data", []) or []
    if not items:
        return None

    first_item = items[0]
    return _stripe_get(first_item, "price", {}) or {}


def _subscription_price_id(subscription: Any) -> str | None:
    return _stripe_get(_subscription_price(subscription), "id")


def _find_user_for_customer(
    db: Session,
    *,
    customer_id: str | None = None,
    user_id: str | int | None = None,
) -> User | None:
    if user_id:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user:
            return user

    if customer_id:
        return db.query(User).filter(User.stripe_customer_id == customer_id).first()

    return None


def _apply_subscription_to_user(
    db: Session,
    user: User,
    *,
    customer_id: str | None = None,
    subscription_id: str | None = None,
    status: str | None = None,
    price_id: str | None = None,
    product_id: str | None = None,
    price: Any = None,
    plan: str | None = None,
) -> User:
    resolved_plan = map_price_to_plan(
        price_id,
        product_id=product_id,
        price=price,
    ) or _normalize_plan(plan)

    if customer_id and not user.stripe_customer_id:
        user.stripe_customer_id = customer_id

    if subscription_id:
        user.stripe_subscription_id = subscription_id

    if status:
        user.subscription_status = status
    elif subscription_id:
        user.subscription_status = "active"

    if resolved_plan != "free":
        user.plan = resolved_plan

    db.commit()
    db.refresh(user)
    return user


def _apply_subscription_event(db: Session, subscription: Any) -> User | None:
    customer_id = _stripe_get(subscription, "customer")
    subscription_id = _stripe_get(subscription, "id")
    status = _stripe_get(subscription, "status")
    price = _subscription_price(subscription)
    price_id = _stripe_get(price, "id")
    product_id = _stripe_get(price, "product")
    metadata = _stripe_get(subscription, "metadata", {}) or {}

    user = _find_user_for_customer(
        db,
        customer_id=customer_id,
        user_id=metadata.get("user_id"),
    )

    if not user:
        return None

    if status == "canceled":
        user.plan = "free"
        user.subscription_status = "canceled"
        user.stripe_subscription_id = None
        db.commit()
        db.refresh(user)
        return user

    return _apply_subscription_to_user(
        db,
        user,
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=status,
        price_id=price_id,
        product_id=product_id,
        price=price,
        plan=metadata.get("plan"),
    )


def _apply_checkout_session(db: Session, session: Any) -> User | None:
    customer_id = _stripe_get(session, "customer")
    subscription_id = _stripe_get(session, "subscription")
    metadata = _stripe_get(session, "metadata", {}) or {}
    client_reference_id = _stripe_get(session, "client_reference_id")
    payment_status = _stripe_get(session, "payment_status")

    user = _find_user_for_customer(
        db,
        customer_id=customer_id,
        user_id=metadata.get("user_id") or client_reference_id,
    )

    if not user:
        return None

    status = "active" if payment_status in {"paid", "no_payment_required"} else None
    price_id = None
    product_id = None
    price = None

    if subscription_id:
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            status = _stripe_get(subscription, "status") or status
            price = _subscription_price(subscription)
            price_id = _stripe_get(price, "id")
            product_id = _stripe_get(price, "product")
        except Exception:
            pass

    return _apply_subscription_to_user(
        db,
        user,
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=status,
        price_id=price_id,
        product_id=product_id,
        price=price,
        plan=metadata.get("plan"),
    )


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "plan": get_user_plan(user),
        "raw_plan": get_raw_user_plan(user),
        "subscription_status": user.subscription_status,
        "stripe_customer_id": user.stripe_customer_id,
        "stripe_subscription_id": user.stripe_subscription_id,
    }


@router.get("/plans")
def list_billing_plans():
    return {
        "available_plans": ["free", "pro", "premium"],
        "stripe_configured": {
            "secret_key": bool(stripe.api_key),
            "individual_pro_price": bool(STRIPE_PLAN_CONFIG["individual_pro"].get("price_id")),
            "individual_premium_price": bool(STRIPE_PLAN_CONFIG["individual_premium"].get("price_id")),
            "individual_pro_product": bool(STRIPE_PLAN_CONFIG["individual_pro"].get("product_id")),
            "individual_premium_product": bool(STRIPE_PLAN_CONFIG["individual_premium"].get("product_id")),
            "webhook_secret": bool(STRIPE_WEBHOOK_SECRET),
        },
        "plans": [
            {"key": "free", "backend_plan": "free", "checkout_enabled": False},
            {
                "key": "pro",
                "backend_plan": "individual_pro",
                "checkout_enabled": bool(
                    stripe.api_key
                    and (
                        STRIPE_PLAN_CONFIG["individual_pro"].get("price_id")
                        or STRIPE_PLAN_CONFIG["individual_pro"].get("product_id")
                    )
                ),
            },
            {
                "key": "premium",
                "backend_plan": "individual_premium",
                "checkout_enabled": bool(
                    stripe.api_key
                    and (
                        STRIPE_PLAN_CONFIG["individual_premium"].get("price_id")
                        or STRIPE_PLAN_CONFIG["individual_premium"].get("product_id")
                    )
                ),
            },
        ],
    }


@router.get("/me")
def get_billing_status(current_user: User = Depends(get_current_user)):
    return _user_payload(current_user)


@router.get("/access")
def get_billing_access(current_user: User = Depends(get_current_user)):
    return build_access_response(user=current_user)


@router.post("/create-checkout-session")
def create_checkout_session(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    selected_plan = _normalize_plan(payload.get("plan"))

    if selected_plan == "free":
        raise HTTPException(status_code=400, detail="Free plan does not require checkout.")

    customer_id = get_or_create_stripe_customer(current_user, db)
    line_item = get_checkout_line_item_for_plan(selected_plan)

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        client_reference_id=str(current_user.id),
        line_items=[line_item],
        success_url=f"{FRONTEND_URL}/pricing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/pricing?cancelled=true",
        allow_promotion_codes=True,
        metadata={
            "user_id": str(current_user.id),
            "plan": selected_plan,
        },
        subscription_data={
            "metadata": {
                "user_id": str(current_user.id),
                "plan": selected_plan,
            },
        },
    )

    return {"id": session.id, "url": session.url}


@router.post("/sync-checkout-session")
def sync_checkout_session(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_stripe_configured()

    session_id = str(payload.get("session_id") or "").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="Checkout session ID is required.")

    session = stripe.checkout.Session.retrieve(session_id)

    session_user_id = str(
        _stripe_get(_stripe_get(session, "metadata", {}) or {}, "user_id")
        or _stripe_get(session, "client_reference_id")
        or ""
    )

    if session_user_id and session_user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Checkout session does not belong to this user.")

    user = _apply_checkout_session(db, session)
    if not user or user.id != current_user.id:
        raise HTTPException(status_code=404, detail="Unable to sync checkout session.")

    return {
        "user": _user_payload(user),
        "access": build_access_response(user=user),
    }


@router.post("/create-portal-session")
def create_portal_session(current_user: User = Depends(get_current_user)):
    ensure_stripe_configured()

    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found.")

    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f"{FRONTEND_URL}/dashboard",
    )

    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    ensure_webhook_configured()

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature.")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            STRIPE_WEBHOOK_SECRET,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        _apply_checkout_session(db, data)

    elif event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.resumed",
    }:
        _apply_subscription_event(db, data)

    elif event_type == "customer.subscription.deleted":
        customer_id = _stripe_get(data, "customer")
        user = _find_user_for_customer(db, customer_id=customer_id)
        if user:
            user.plan = "free"
            user.subscription_status = "canceled"
            user.stripe_subscription_id = None
            db.commit()

    elif event_type == "customer.subscription.paused":
        user = _apply_subscription_event(db, data)
        if user:
            user.subscription_status = "paused"
            db.commit()

    elif event_type == "invoice.payment_succeeded":
        customer_id = _stripe_get(data, "customer")
        user = _find_user_for_customer(db, customer_id=customer_id)
        if user and user.plan != "free":
            user.subscription_status = "active"
            db.commit()

    elif event_type == "invoice.payment_failed":
        customer_id = _stripe_get(data, "customer")
        user = _find_user_for_customer(db, customer_id=customer_id)
        if user:
            user.subscription_status = "past_due"
            db.commit()

    return JSONResponse({"received": True})


@router.post("/dev/set-plan")
def dev_set_plan(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_dev_mode()

    selected_plan = (payload.get("plan") or "").strip().lower()
    selected_status = (payload.get("subscription_status") or "active").strip().lower()

    if not selected_plan:
        raise HTTPException(status_code=400, detail="Plan is required")

    normalized_to_raw = {
        FREE_PLAN: "free",
        PRO_PLAN: "individual_pro",
        PREMIUM_PLAN: "individual_premium",
        "free": "free",
        "pro": "individual_pro",
        "premium": "individual_premium",
        "individual_pro": "individual_pro",
        "individual_premium": "individual_premium",
        "agent_pro": "agent_pro",
    }

    raw_selected_plan = normalized_to_raw.get(selected_plan)
    if not raw_selected_plan:
        raise HTTPException(status_code=400, detail="Invalid plan")

    allowed_plans_by_role = {
        "individual": ["free", "individual_pro", "individual_premium"],
        "agent": ["free", "agent_pro"],
        "admin": ["free", "individual_pro", "individual_premium", "agent_pro"],
    }

    allowed_plans = allowed_plans_by_role.get(current_user.role, ["free"])

    if raw_selected_plan not in allowed_plans:
        raise HTTPException(
            status_code=403,
            detail="This role cannot use the selected plan",
        )

    current_user.plan = raw_selected_plan
    current_user.subscription_status = None if raw_selected_plan == "free" else selected_status

    if raw_selected_plan == "free":
        current_user.stripe_subscription_id = None

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Plan updated for development",
        "user": _user_payload(current_user),
        "access": build_access_response(user=current_user),
    }
