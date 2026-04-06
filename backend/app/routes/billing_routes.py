import os

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

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# 🔥 UPDATED — separate self-user plans
STRIPE_PRICE_INDIVIDUAL_PRO = os.getenv("STRIPE_PRICE_INDIVIDUAL_PRO")
STRIPE_PRICE_INDIVIDUAL_PREMIUM = os.getenv("STRIPE_PRICE_INDIVIDUAL_PREMIUM")
STRIPE_PRICE_AGENT_PRO = os.getenv("STRIPE_PRICE_AGENT_PRO")

APP_ENV = os.getenv("APP_ENV", "development").lower()

router = APIRouter(prefix="/billing", tags=["Billing"])


# --------------------------------------------------
# CONFIG VALIDATION
# --------------------------------------------------

def require_stripe_config() -> None:
    missing = []

    if not stripe.api_key:
        missing.append("STRIPE_SECRET_KEY")
    if not FRONTEND_URL:
        missing.append("FRONTEND_URL")
    if not STRIPE_PRICE_INDIVIDUAL_PRO:
        missing.append("STRIPE_PRICE_INDIVIDUAL_PRO")
    if not STRIPE_PRICE_INDIVIDUAL_PREMIUM:
        missing.append("STRIPE_PRICE_INDIVIDUAL_PREMIUM")

    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Missing Stripe configuration: {', '.join(missing)}",
        )


def ensure_dev_mode() -> None:
    if APP_ENV == "production":
        raise HTTPException(
            status_code=403,
            detail="This endpoint is not available in production.",
        )


# --------------------------------------------------
# STRIPE HELPERS
# --------------------------------------------------

def get_or_create_stripe_customer(user: User, db: Session) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id

    try:
        customer = stripe.Customer.create(
            email=user.email,
            metadata={
                "user_id": str(user.id),
                "role": user.role,
            },
        )
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe customer creation failed: {getattr(e, 'user_message', None) or str(e)}",
        )

    user.stripe_customer_id = customer.id
    db.commit()
    db.refresh(user)

    return customer.id


# --------------------------------------------------
# PLAN LOGIC (UPDATED)
# --------------------------------------------------

def get_allowed_plans_for_role(role: str) -> list[str]:
    if role == "individual":
        return ["free", "individual_pro", "individual_premium"]

    if role == "agent":
        return ["free", "agent_pro"]

    if role == "admin":
        return ["free", "individual_pro", "individual_premium", "agent_pro"]

    return ["free"]


def get_price_id_for_plan(role: str, plan: str) -> str:
    allowed_plans = get_allowed_plans_for_role(role)

    if plan not in allowed_plans:
        raise HTTPException(status_code=400, detail="Invalid plan selected for this role")

    if plan == "individual_pro":
        return STRIPE_PRICE_INDIVIDUAL_PRO

    if plan == "individual_premium":
        return STRIPE_PRICE_INDIVIDUAL_PREMIUM

    if plan == "agent_pro":
        return STRIPE_PRICE_AGENT_PRO

    raise HTTPException(status_code=400, detail="Invalid paid plan selected")


# --------------------------------------------------
# ROUTES
# --------------------------------------------------

@router.get("/plans")
def get_available_plans(current_user: User = Depends(get_current_user)):
    allowed = get_allowed_plans_for_role(current_user.role)

    return {
        "role": current_user.role,
        "current_plan": get_user_plan(current_user),
        "raw_plan": get_raw_user_plan(current_user),
        "available_plans": allowed,
        "normalized_available_plans": [
            FREE_PLAN,
            *([PRO_PLAN] if "individual_pro" in allowed else []),
            *([PREMIUM_PLAN] if "individual_premium" in allowed else []),
        ],
    }


@router.get("/me")
def get_billing_status(current_user: User = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "role": current_user.role,
        "plan": get_user_plan(current_user),
        "raw_plan": get_raw_user_plan(current_user),
        "subscription_status": current_user.subscription_status,
        "stripe_customer_id": current_user.stripe_customer_id,
        "stripe_subscription_id": current_user.stripe_subscription_id,
    }


@router.get("/access")
def get_billing_access(current_user: User = Depends(get_current_user)):
    return build_access_response(user=current_user)


# --------------------------------------------------
# DEV PLAN SWITCH (UPDATED)
# --------------------------------------------------

@router.post("/dev/set-plan")
def dev_set_plan(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_dev_mode()

    selected_plan = (payload.get("plan") or "").strip().lower()
    selected_status = payload.get("subscription_status", "active")

    normalized_to_raw = {
        FREE_PLAN: "free",
        PRO_PLAN: "individual_pro",
        PREMIUM_PLAN: "individual_premium",
        "free": "free",
        "individual_pro": "individual_pro",
        "individual_premium": "individual_premium",
        "agent_pro": "agent_pro",
    }

    raw_selected_plan = normalized_to_raw.get(selected_plan)

    if not raw_selected_plan:
        raise HTTPException(status_code=400, detail="Invalid plan")

    allowed = get_allowed_plans_for_role(current_user.role)

    if raw_selected_plan not in allowed:
        raise HTTPException(
            status_code=403,
            detail="This role cannot use the selected plan",
        )

    current_user.plan = raw_selected_plan
    current_user.subscription_status = (
        None if raw_selected_plan == "free" else selected_status
    )

    if raw_selected_plan == "free":
        current_user.stripe_subscription_id = None

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Plan updated for development",
        "access": build_access_response(user=current_user),
    }


# --------------------------------------------------
# CHECKOUT (UPDATED)
# --------------------------------------------------

@router.post("/create-checkout-session")
def create_checkout_session(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_stripe_config()

    selected_plan = (payload.get("plan") or "").strip().lower()

    normalized_to_raw = {
        PRO_PLAN: "individual_pro",
        PREMIUM_PLAN: "individual_premium",
        "individual_pro": "individual_pro",
        "individual_premium": "individual_premium",
    }

    raw_selected_plan = normalized_to_raw.get(selected_plan)

    if selected_plan in {FREE_PLAN, "free"}:
        raise HTTPException(status_code=400, detail="Free plan does not require checkout")

    if not raw_selected_plan:
        raise HTTPException(status_code=400, detail="Invalid plan")

    allowed = get_allowed_plans_for_role(current_user.role)

    if raw_selected_plan not in allowed:
        raise HTTPException(
            status_code=403,
            detail="This user role cannot subscribe to the selected plan",
        )

    customer_id = get_or_create_stripe_customer(current_user, db)
    price_id = get_price_id_for_plan(current_user.role, raw_selected_plan)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",  # ⚠️ keep for now (safe launch)
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/pricing",
            metadata={
                "user_id": str(current_user.id),
                "selected_plan": raw_selected_plan,
                "role": current_user.role,
            },
            allow_promotion_codes=True,
        )

        return {"url": session.url}

    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe error: {getattr(e, 'user_message', None) or str(e)}",
        )


# --------------------------------------------------
# PORTAL
# --------------------------------------------------

@router.post("/create-portal-session")
def create_portal_session(current_user: User = Depends(get_current_user)):
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found")

    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f"{FRONTEND_URL}/dashboard",
    )

    return {"url": session.url}


# --------------------------------------------------
# WEBHOOK (UPDATED PLAN SUPPORT)
# --------------------------------------------------

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    event = stripe.Webhook.construct_event(
        payload,
        sig_header,
        STRIPE_WEBHOOK_SECRET,
    )

    data = event["data"]["object"]

    if event["type"] == "checkout.session.completed":
        user = db.query(User).filter(
            User.stripe_customer_id == data.get("customer")
        ).first()

        if user:
            user.subscription_status = "active"
            user.stripe_subscription_id = data.get("subscription")

            selected_plan = data.get("metadata", {}).get("selected_plan")
            if selected_plan:
                user.plan = selected_plan

            db.commit()

    return JSONResponse({"received": True})