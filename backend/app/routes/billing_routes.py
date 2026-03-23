import os

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.user_models import User
from app.routes.auth_routes import get_current_user

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_INDIVIDUAL_PRO = os.getenv("STRIPE_PRICE_INDIVIDUAL_PRO")
STRIPE_PRICE_AGENT_PRO = os.getenv("STRIPE_PRICE_AGENT_PRO")
APP_ENV = os.getenv("APP_ENV", "development").lower()

router = APIRouter(prefix="/billing", tags=["Billing"])


def require_stripe_config() -> None:
    missing = []

    if not stripe.api_key:
        missing.append("STRIPE_SECRET_KEY")
    if not FRONTEND_URL:
        missing.append("FRONTEND_URL")
    if not STRIPE_PRICE_INDIVIDUAL_PRO:
        missing.append("STRIPE_PRICE_INDIVIDUAL_PRO")
    if not STRIPE_PRICE_AGENT_PRO:
        missing.append("STRIPE_PRICE_AGENT_PRO")

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


def get_allowed_plans_for_role(role: str) -> list[str]:
    if role == "individual":
        return ["free", "individual_pro"]

    if role == "agent":
        return ["free", "agent_pro"]

    if role == "admin":
        return ["free", "individual_pro", "agent_pro"]

    return ["free"]


def get_price_id_for_plan(role: str, plan: str) -> str:
    allowed_plans = get_allowed_plans_for_role(role)
    if plan not in allowed_plans:
        raise HTTPException(status_code=400, detail="Invalid plan selected for this role")

    if plan == "individual_pro":
        return STRIPE_PRICE_INDIVIDUAL_PRO

    if plan == "agent_pro":
        return STRIPE_PRICE_AGENT_PRO

    raise HTTPException(status_code=400, detail="Invalid paid plan selected")


@router.get("/plans")
def get_available_plans(current_user: User = Depends(get_current_user)):
    return {
        "role": current_user.role,
        "current_plan": current_user.plan,
        "available_plans": get_allowed_plans_for_role(current_user.role),
    }


@router.get("/me")
def get_billing_status(current_user: User = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "role": current_user.role,
        "plan": current_user.plan,
        "subscription_status": current_user.subscription_status,
        "stripe_customer_id": current_user.stripe_customer_id,
    }


@router.post("/dev/set-plan")
def dev_set_plan(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_dev_mode()

    selected_plan = payload.get("plan")
    selected_status = payload.get("subscription_status", "active")

    if not selected_plan:
        raise HTTPException(status_code=400, detail="Plan is required")

    allowed_plans = get_allowed_plans_for_role(current_user.role)
    if selected_plan not in allowed_plans:
        raise HTTPException(
            status_code=403,
            detail="This role cannot use the selected plan",
        )

    current_user.plan = selected_plan
    current_user.subscription_status = None if selected_plan == "free" else selected_status

    if selected_plan == "free":
        current_user.stripe_subscription_id = None

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Plan updated for development",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "plan": current_user.plan,
            "subscription_status": current_user.subscription_status,
        },
    }


@router.post("/create-checkout-session")
def create_checkout_session(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_stripe_config()

    selected_plan = payload.get("plan")
    if not selected_plan:
        raise HTTPException(status_code=400, detail="Plan is required")

    if selected_plan == "free":
        raise HTTPException(
            status_code=400,
            detail="Free plan does not require checkout",
        )

    allowed_plans = get_allowed_plans_for_role(current_user.role)
    if selected_plan not in allowed_plans:
        raise HTTPException(
            status_code=403,
            detail="This user role cannot subscribe to the selected plan",
        )

    customer_id = get_or_create_stripe_customer(current_user, db)
    price_id = get_price_id_for_plan(current_user.role, selected_plan)

    if not price_id or not str(price_id).startswith("price_"):
        raise HTTPException(
            status_code=500,
            detail=f"Invalid Stripe price ID configured for {selected_plan}",
        )

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            success_url=f"{FRONTEND_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/billing",
            metadata={
                "user_id": str(current_user.id),
                "selected_plan": selected_plan,
                "role": current_user.role,
            },
            allow_promotion_codes=True,
        )

        return {"url": session.url}

    except stripe.error.InvalidRequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe invalid request: {getattr(e, 'user_message', None) or str(e)}",
        )
    except stripe.error.AuthenticationError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe authentication failed: {getattr(e, 'user_message', None) or str(e)}",
        )
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe checkout error: {getattr(e, 'user_message', None) or str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected checkout error: {str(e)}",
        )


@router.post("/create-portal-session")
def create_portal_session(
    current_user: User = Depends(get_current_user),
):
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found for this user")

    try:
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/dashboard",
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe portal error: {getattr(e, 'user_message', None) or str(e)}",
        )


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Missing STRIPE_WEBHOOK_SECRET")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.stripe_subscription_id = subscription_id
            user.subscription_status = "active"

            selected_plan = data.get("metadata", {}).get("selected_plan")
            if selected_plan:
                user.plan = selected_plan

            db.commit()

    elif event_type == "customer.subscription.updated":
        customer_id = data.get("customer")
        subscription_id = data.get("id")
        status = data.get("status")

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.stripe_subscription_id = subscription_id
            user.subscription_status = status

            if status not in {"active", "trialing"}:
                user.plan = "free"

            db.commit()

    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.subscription_status = "canceled"
            user.plan = "free"
            user.stripe_subscription_id = None
            db.commit()

    return JSONResponse({"received": True})