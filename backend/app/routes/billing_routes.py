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

STRIPE_PRICE_INDIVIDUAL_PRO = os.getenv("STRIPE_PRICE_INDIVIDUAL_PRO")
STRIPE_PRICE_INDIVIDUAL_PREMIUM = os.getenv("STRIPE_PRICE_INDIVIDUAL_PREMIUM")

APP_ENV = os.getenv("APP_ENV", "development").lower()

router = APIRouter(prefix="/billing", tags=["Billing"])


# ---------------------------
# HELPERS
# ---------------------------

def get_or_create_stripe_customer(user: User, db: Session) -> str:
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
    if plan == "individual_pro":
        return STRIPE_PRICE_INDIVIDUAL_PRO
    if plan == "individual_premium":
        return STRIPE_PRICE_INDIVIDUAL_PREMIUM

    raise HTTPException(status_code=400, detail="Invalid plan")


def map_price_to_plan(price_id: str) -> str:
    if price_id == STRIPE_PRICE_INDIVIDUAL_PRO:
        return "individual_pro"
    if price_id == STRIPE_PRICE_INDIVIDUAL_PREMIUM:
        return "individual_premium"
    return "free"


# ---------------------------
# STATUS
# ---------------------------

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


# ---------------------------
# CHECKOUT
# ---------------------------

@router.post("/create-checkout-session")
def create_checkout_session(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    selected_plan = payload.get("plan")

    if selected_plan in {FREE_PLAN, "free"}:
        raise HTTPException(status_code=400, detail="Free plan does not require checkout")

    if selected_plan not in {"individual_pro", "individual_premium"}:
        raise HTTPException(status_code=400, detail="Invalid plan")

    customer_id = get_or_create_stripe_customer(current_user, db)
    price_id = get_price_id_for_plan(selected_plan)

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{FRONTEND_URL}/pricing?success=true",
        cancel_url=f"{FRONTEND_URL}/pricing",
        metadata={
            "user_id": str(current_user.id),
            "plan": selected_plan,
        },
    )

    return {"url": session.url}


# ---------------------------
# PORTAL
# ---------------------------

@router.post("/create-portal-session")
def create_portal_session(current_user: User = Depends(get_current_user)):
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found")

    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f"{FRONTEND_URL}/dashboard",
    )

    return {"url": session.url}


# ---------------------------
# WEBHOOK (FULL)
# ---------------------------

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            STRIPE_WEBHOOK_SECRET,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = event["data"]["object"]

    # ---------------------------
    # CHECKOUT COMPLETE
    # ---------------------------
    if event["type"] == "checkout.session.completed":
        user = db.query(User).filter(
            User.stripe_customer_id == data.get("customer")
        ).first()

        if user:
            user.subscription_status = "active"
            user.stripe_subscription_id = data.get("subscription")

            plan = data.get("metadata", {}).get("plan")
            if plan:
                user.plan = plan

            db.commit()

    # ---------------------------
    # SUBSCRIPTION UPDATED
    # ---------------------------
    elif event["type"] == "customer.subscription.updated":
        customer_id = data.get("customer")
        status = data.get("status")

        items = data.get("items", {}).get("data", [])
        price_id = items[0]["price"]["id"] if items else None

        user = db.query(User).filter(
            User.stripe_customer_id == customer_id
        ).first()

        if user:
            user.subscription_status = status
            user.plan = map_price_to_plan(price_id)
            db.commit()

    # ---------------------------
    # SUBSCRIPTION CANCELLED
    # ---------------------------
    elif event["type"] == "customer.subscription.deleted":
        customer_id = data.get("customer")

        user = db.query(User).filter(
            User.stripe_customer_id == customer_id
        ).first()

        if user:
            user.plan = "free"
            user.subscription_status = "canceled"
            user.stripe_subscription_id = None
            db.commit()

    # ---------------------------
    # PAYMENT FAILED
    # ---------------------------
    elif event["type"] == "invoice.payment_failed":
        customer_id = data.get("customer")

        user = db.query(User).filter(
            User.stripe_customer_id == customer_id
        ).first()

        if user:
            user.subscription_status = "past_due"
            db.commit()

    return JSONResponse({"received": True})