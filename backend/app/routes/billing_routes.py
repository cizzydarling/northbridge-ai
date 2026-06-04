import os
import logging
from datetime import datetime, timezone
from typing import Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.access_control import (
    FREE_PLAN,
    PREMIUM_PLAN,
    PRO_PLAN,
    build_access_response,
    ensure_confirmed_email,
    get_raw_user_plan,
    get_user_plan,
)
from app.data.db import get_db
from app.models.billing_transaction_model import BillingTransaction
from app.models.promo_code_model import PromoCode
from app.models.user_models import User
from app.routes.auth_routes import get_current_user, require_admin
from app.routes.disclosure_routes import require_global_disclosures_accepted
from app.schemas.billing_schema import BillingTransactionResponse
from app.services.email_service import (
    build_billing_issue_email,
    build_payment_confirmation_email,
    build_subscription_cancellation_email,
    send_email,
)
from app.services.promo_code_service import normalize_promo_code, redeem_promo_code

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

logger = logging.getLogger(__name__)

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
        "name": "NorthBridgeAI Pro",
    },
    "individual_premium": {
        "price_id": STRIPE_PRICE_INDIVIDUAL_PREMIUM,
        "product_id": STRIPE_PRODUCT_INDIVIDUAL_PREMIUM,
        "unit_amount": 9900,
        "currency": "cad",
        "interval": "day",
        "interval_count": 90,
        "name": "NorthBridgeAI Premium",
    },
}

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
DEV_ENVS = {"development", "dev", "local", "test"}

router = APIRouter(prefix="/billing", tags=["Billing"])


class RedeemPromoCodeRequest(BaseModel):
    code: str


class PromoCodeCreateRequest(BaseModel):
    code: str
    access_type: str = "individual_premium"
    duration_days: int = 30
    expires_at: datetime | None = None
    max_uses: int | None = None
    active: bool = True
    description: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        normalized = normalize_promo_code(value)
        if not normalized:
            raise ValueError("Code is required")
        return normalized

    @field_validator("access_type")
    @classmethod
    def validate_access_type(cls, value: str) -> str:
        normalized = str(value or "").strip().lower()
        allowed = {"individual_pro", "individual_premium", "agent_pro"}
        if normalized not in allowed:
            raise ValueError("Access type must be individual_pro, individual_premium, or agent_pro")
        return normalized

    @field_validator("duration_days")
    @classmethod
    def validate_duration_days(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Duration must be at least 1 day")
        return value

    @field_validator("max_uses")
    @classmethod
    def validate_max_uses(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("Max uses must be at least 1")
        return value


class PromoCodeUpdateRequest(BaseModel):
    access_type: str | None = None
    duration_days: int | None = None
    expires_at: datetime | None = None
    max_uses: int | None = None
    active: bool | None = None
    description: str | None = None

    @field_validator("access_type")
    @classmethod
    def validate_access_type(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = str(value or "").strip().lower()
        allowed = {"individual_pro", "individual_premium", "agent_pro"}
        if normalized not in allowed:
            raise ValueError("Access type must be individual_pro, individual_premium, or agent_pro")
        return normalized

    @field_validator("duration_days")
    @classmethod
    def validate_duration_days(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("Duration must be at least 1 day")
        return value

    @field_validator("max_uses")
    @classmethod
    def validate_max_uses(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("Max uses must be at least 1")
        return value


def _promo_code_payload(promo_code: PromoCode) -> dict:
    return {
        "id": promo_code.id,
        "code": promo_code.code,
        "access_type": promo_code.access_type,
        "duration_days": promo_code.duration_days,
        "expires_at": promo_code.expires_at,
        "max_uses": promo_code.max_uses,
        "current_uses": promo_code.current_uses,
        "active": promo_code.active,
        "description": promo_code.description,
        "created_at": promo_code.created_at,
        "updated_at": promo_code.updated_at,
    }


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


def _stripe_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _first_present(*values: Any) -> Any:
    for value in values:
        if value is not None and value != "":
            return value
    return None


def _checkout_billing_email(session: Any, user: User) -> str | None:
    customer_details = _stripe_get(session, "customer_details", {}) or {}
    return _first_present(
        _stripe_get(customer_details, "email"),
        _stripe_get(session, "customer_email"),
        user.email,
    )


def _checkout_customer_name(session: Any) -> str | None:
    customer_details = _stripe_get(session, "customer_details", {}) or {}
    return _stripe_get(customer_details, "name")


def _invoice_price(invoice: Any) -> Any | None:
    lines = _stripe_get(_stripe_get(invoice, "lines"), "data", []) or []
    if not lines:
        return None
    return _stripe_get(lines[0], "price", {}) or {}


def _plan_display_name(plan: str | None) -> str:
    normalized = _normalize_plan(plan)
    plan_config = STRIPE_PLAN_CONFIG.get(normalized)
    if plan_config:
        return plan_config["name"]
    return "NorthBridgeAI"


def _format_transaction_amount(amount: int | None, currency: str | None) -> str:
    if amount is None:
        return "Not available"
    normalized_currency = str(currency or "CAD").upper()
    return f"{amount / 100:.2f} {normalized_currency}"


def _customer_display_name(user: User, transaction: BillingTransaction) -> str | None:
    if transaction.customer_name:
        return transaction.customer_name

    return _user_display_name(user)


def _user_display_name(user: User) -> str | None:
    profile = getattr(user, "profile", None)
    first_name = str(getattr(user, "first_name", "") or getattr(profile, "first_name", "") or "").strip()
    last_name = str(getattr(user, "last_name", "") or getattr(profile, "last_name", "") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    return full_name or None


def _latest_billing_email(db: Session, user: User) -> str | None:
    transaction = (
        db.query(BillingTransaction)
        .filter(BillingTransaction.user_id == user.id)
        .filter(BillingTransaction.billing_email.isnot(None))
        .order_by(BillingTransaction.created_at.desc())
        .first()
    )
    return transaction.billing_email if transaction else None


def _format_billing_date(value: datetime | None) -> str | None:
    if not value:
        return None
    return value.strftime("%B %d, %Y")


def _upsert_billing_transaction(
    db: Session,
    *,
    user: User,
    stripe_session_id: str | None = None,
    stripe_invoice_id: str | None = None,
    **values: Any,
) -> BillingTransaction:
    transaction = None

    if stripe_session_id:
        transaction = (
            db.query(BillingTransaction)
            .filter(BillingTransaction.stripe_session_id == stripe_session_id)
            .first()
        )

    if not transaction and stripe_invoice_id:
        transaction = (
            db.query(BillingTransaction)
            .filter(BillingTransaction.stripe_invoice_id == stripe_invoice_id)
            .first()
        )

    if not transaction:
        transaction = BillingTransaction(
            user_id=user.id,
            stripe_session_id=stripe_session_id,
            stripe_invoice_id=stripe_invoice_id,
        )
        db.add(transaction)

    transaction.user_id = user.id

    if stripe_session_id:
        transaction.stripe_session_id = stripe_session_id
    if stripe_invoice_id:
        transaction.stripe_invoice_id = stripe_invoice_id

    for key, value in values.items():
        if value is not None:
            setattr(transaction, key, value)

    db.commit()
    db.refresh(transaction)
    return transaction


def _record_checkout_transaction(
    db: Session,
    *,
    user: User,
    session: Any,
    plan: str | None,
) -> BillingTransaction | None:
    stripe_session_id = _stripe_get(session, "id")
    stripe_invoice_id = _stripe_get(session, "invoice")
    invoice = None

    if stripe_invoice_id:
        try:
            invoice = stripe.Invoice.retrieve(stripe_invoice_id)
        except Exception:
            invoice = None

    amount = _first_present(
        _stripe_get(session, "amount_total"),
        _stripe_get(invoice, "amount_paid") if invoice else None,
        _stripe_get(invoice, "amount_due") if invoice else None,
    )
    currency = _first_present(
        _stripe_get(session, "currency"),
        _stripe_get(invoice, "currency") if invoice else None,
    )
    payment_status = _stripe_get(session, "payment_status")
    status = "paid" if payment_status in {"paid", "no_payment_required"} else payment_status

    return _upsert_billing_transaction(
        db,
        user=user,
        stripe_session_id=stripe_session_id,
        stripe_invoice_id=stripe_invoice_id,
        plan=plan,
        amount=amount,
        currency=str(currency).upper() if currency else None,
        status=status,
        billing_email=_checkout_billing_email(session, user),
        customer_name=_first_present(
            _checkout_customer_name(session),
            _stripe_get(invoice, "customer_name") if invoice else None,
        ),
        stripe_customer_id=_stripe_get(session, "customer"),
        stripe_subscription_id=_stripe_get(session, "subscription"),
        stripe_payment_intent_id=_stripe_get(session, "payment_intent"),
        receipt_url=_stripe_get(invoice, "hosted_invoice_url") if invoice else None,
        invoice_pdf=_stripe_get(invoice, "invoice_pdf") if invoice else None,
        paid_at=_stripe_datetime(
            _first_present(_stripe_get(session, "created"), _stripe_get(invoice, "created") if invoice else None)
        ),
    )


def _safe_record_checkout_transaction(
    db: Session,
    *,
    user: User,
    session: Any,
    plan: str | None,
) -> BillingTransaction | None:
    try:
        return _record_checkout_transaction(db, user=user, session=session, plan=plan)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to persist Stripe checkout billing transaction.")
    except Exception:
        db.rollback()
        logger.exception("Unexpected checkout billing transaction persistence error.")
    return None


def _record_invoice_transaction(
    db: Session,
    *,
    user: User,
    invoice: Any,
) -> BillingTransaction | None:
    price = _invoice_price(invoice)
    price_id = _stripe_get(price, "id")
    product_id = _stripe_get(price, "product")
    plan = map_price_to_plan(price_id, product_id=product_id, price=price) or get_raw_user_plan(user)
    status = _stripe_get(invoice, "status") or "paid"
    currency = _stripe_get(invoice, "currency")

    return _upsert_billing_transaction(
        db,
        user=user,
        stripe_invoice_id=_stripe_get(invoice, "id"),
        plan=plan,
        amount=_first_present(_stripe_get(invoice, "amount_paid"), _stripe_get(invoice, "amount_due")),
        currency=str(currency).upper() if currency else None,
        status=status,
        billing_email=_first_present(_stripe_get(invoice, "customer_email"), user.email),
        customer_name=_stripe_get(invoice, "customer_name"),
        stripe_customer_id=_stripe_get(invoice, "customer"),
        stripe_subscription_id=_stripe_get(invoice, "subscription"),
        stripe_payment_intent_id=_stripe_get(invoice, "payment_intent"),
        receipt_url=_stripe_get(invoice, "hosted_invoice_url"),
        invoice_pdf=_stripe_get(invoice, "invoice_pdf"),
        paid_at=_stripe_datetime(_stripe_get(invoice, "created")),
    )


def _safe_record_invoice_transaction(db: Session, *, user: User, invoice: Any) -> BillingTransaction | None:
    try:
        return _record_invoice_transaction(db, user=user, invoice=invoice)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to persist Stripe invoice billing transaction.")
    except Exception:
        db.rollback()
        logger.exception("Unexpected invoice billing transaction persistence error.")
    return None


def _send_payment_confirmation_email(
    db: Session,
    *,
    user: User,
    transaction: BillingTransaction,
) -> None:
    if transaction.confirmation_email_sent_at:
        return

    if str(transaction.status or "").lower() not in {"paid", "succeeded"}:
        return

    to_email = transaction.billing_email or user.email
    if not to_email:
        transaction.confirmation_email_status = "missing_recipient"
        transaction.confirmation_email_error = "No billing email is available."
        db.commit()
        return

    subject, text_body, html_body = build_payment_confirmation_email(
        customer_name=_customer_display_name(user, transaction),
        plan_name=_plan_display_name(transaction.plan),
        amount=_format_transaction_amount(transaction.amount, transaction.currency),
        billing_email=to_email,
        receipt_url=transaction.receipt_url or transaction.invoice_pdf,
    )

    result = send_email(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )

    transaction.confirmation_email_status = result.status
    transaction.confirmation_email_error = result.error
    if result.sent:
        transaction.confirmation_email_sent_at = datetime.now(timezone.utc)

    db.commit()


def _safe_send_payment_confirmation_email(
    db: Session,
    *,
    user: User,
    transaction: BillingTransaction | None,
) -> None:
    if not transaction:
        return

    try:
        _send_payment_confirmation_email(db, user=user, transaction=transaction)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to update billing confirmation email status.")
    except Exception:
        db.rollback()
        logger.exception("Unable to send billing confirmation email.")


def _send_cancellation_confirmation_email(db: Session, *, user: User) -> str:
    if (
        user.subscription_cancel_at_period_end
        and user.cancellation_email_sent_at
        and user.cancellation_email_status == "sent"
    ):
        return "already_sent"

    to_email = _latest_billing_email(db, user) or user.email
    if not to_email:
        user.cancellation_email_status = "missing_recipient"
        user.cancellation_email_error = "No billing email is available."
        db.commit()
        return user.cancellation_email_status

    subject, text_body, html_body = build_subscription_cancellation_email(
        customer_name=_user_display_name(user),
        plan_name=_plan_display_name(user.plan),
        billing_email=to_email,
        access_until=_format_billing_date(user.subscription_current_period_end),
    )

    result = send_email(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )

    user.cancellation_email_status = result.status
    user.cancellation_email_error = result.error
    if result.sent:
        user.cancellation_email_sent_at = datetime.now(timezone.utc)

    db.commit()
    return result.status


def _safe_send_cancellation_confirmation_email(db: Session, *, user: User) -> str:
    try:
        return _send_cancellation_confirmation_email(db, user=user)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to update cancellation email status.")
    except Exception:
        db.rollback()
        logger.exception("Unable to send cancellation confirmation email.")
    return "failed"


def _send_billing_issue_email(
    db: Session,
    *,
    user: User,
    invoice: Any,
) -> str:
    to_email = _first_present(_stripe_get(invoice, "customer_email"), _latest_billing_email(db, user), user.email)
    if not to_email:
        user.billing_issue_email_status = "missing_recipient"
        user.billing_issue_email_error = "No billing email is available."
        db.commit()
        return user.billing_issue_email_status

    price = _invoice_price(invoice)
    plan = map_price_to_plan(
        _stripe_get(price, "id"),
        product_id=_stripe_get(price, "product"),
        price=price,
    ) or get_raw_user_plan(user)

    subject, text_body, html_body = build_billing_issue_email(
        customer_name=_stripe_get(invoice, "customer_name") or _user_display_name(user),
        plan_name=_plan_display_name(plan),
        billing_email=to_email,
        hosted_invoice_url=_stripe_get(invoice, "hosted_invoice_url"),
    )

    result = send_email(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )

    user.billing_issue_email_status = result.status
    user.billing_issue_email_error = result.error
    if result.sent:
        user.billing_issue_email_sent_at = datetime.now(timezone.utc)

    db.commit()
    return result.status


def _safe_send_billing_issue_email(db: Session, *, user: User, invoice: Any) -> str:
    try:
        return _send_billing_issue_email(db, user=user, invoice=invoice)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to update billing issue email status.")
    except Exception:
        db.rollback()
        logger.exception("Unable to send billing issue email.")
    return "failed"


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
        try:
            stripe.Customer.modify(
                user.stripe_customer_id,
                email=user.email,
                metadata={"user_id": str(user.id)},
            )
        except Exception:
            logger.exception("Unable to refresh Stripe customer email.")
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
    cancel_at_period_end: bool | None = None,
    current_period_end: datetime | None = None,
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

    if cancel_at_period_end and status in {"active", "trialing"}:
        user.subscription_status = "canceling"
    elif status:
        user.subscription_status = status
    elif subscription_id:
        user.subscription_status = "active"

    if cancel_at_period_end is not None:
        user.subscription_cancel_at_period_end = bool(cancel_at_period_end)

    if current_period_end is not None:
        user.subscription_current_period_end = current_period_end

    if not cancel_at_period_end and user.subscription_status in {"active", "trialing"}:
        user.cancellation_email_sent_at = None
        user.cancellation_email_status = None
        user.cancellation_email_error = None

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
    cancel_at_period_end = bool(_stripe_get(subscription, "cancel_at_period_end"))
    current_period_end = _stripe_datetime(_stripe_get(subscription, "current_period_end"))

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
        user.subscription_cancel_at_period_end = False
        user.subscription_current_period_end = None
        db.commit()
        db.refresh(user)
        return user

    updated_user = _apply_subscription_to_user(
        db,
        user,
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=status,
        price_id=price_id,
        product_id=product_id,
        price=price,
        plan=metadata.get("plan"),
        cancel_at_period_end=cancel_at_period_end,
        current_period_end=current_period_end,
    )

    if cancel_at_period_end:
        _safe_send_cancellation_confirmation_email(db, user=updated_user)

    return updated_user


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
    cancel_at_period_end = None
    current_period_end = None

    if subscription_id:
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            status = _stripe_get(subscription, "status") or status
            price = _subscription_price(subscription)
            price_id = _stripe_get(price, "id")
            product_id = _stripe_get(price, "product")
            cancel_at_period_end = bool(_stripe_get(subscription, "cancel_at_period_end"))
            current_period_end = _stripe_datetime(_stripe_get(subscription, "current_period_end"))
        except Exception:
            pass

    updated_user = _apply_subscription_to_user(
        db,
        user,
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=status,
        price_id=price_id,
        product_id=product_id,
        price=price,
        plan=metadata.get("plan"),
        cancel_at_period_end=cancel_at_period_end,
        current_period_end=current_period_end,
    )

    transaction = _safe_record_checkout_transaction(
        db,
        user=updated_user,
        session=session,
        plan=map_price_to_plan(price_id, product_id=product_id, price=price)
        or _normalize_plan(metadata.get("plan")),
    )
    _safe_send_payment_confirmation_email(
        db,
        user=updated_user,
        transaction=transaction,
    )

    return updated_user


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "plan": get_user_plan(user),
        "raw_plan": get_raw_user_plan(user),
        "subscription_status": user.subscription_status,
        "subscription_cancel_at_period_end": user.subscription_cancel_at_period_end,
        "subscription_current_period_end": user.subscription_current_period_end,
        "cancellation_email_status": user.cancellation_email_status,
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


@router.post("/redeem-code")
def redeem_access_code(
    payload: RedeemPromoCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = redeem_promo_code(db, user=current_user, code=payload.code)
    return {
        **result,
        "user": _user_payload(current_user),
        "access": build_access_response(user=current_user),
    }


@router.get("/admin/promo-codes")
def list_promo_codes(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    del current_user
    return [
        _promo_code_payload(promo_code)
        for promo_code in db.query(PromoCode).order_by(PromoCode.created_at.desc()).all()
    ]


@router.post("/admin/promo-codes")
def create_promo_code(
    payload: PromoCodeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    del current_user
    normalized_code = normalize_promo_code(payload.code)
    existing = db.query(PromoCode).filter(PromoCode.code == normalized_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Access code already exists.")

    promo_code = PromoCode(
        code=normalized_code,
        access_type=payload.access_type,
        duration_days=payload.duration_days,
        expires_at=payload.expires_at,
        max_uses=payload.max_uses,
        active=payload.active,
        description=payload.description,
    )
    db.add(promo_code)
    db.commit()
    db.refresh(promo_code)
    return _promo_code_payload(promo_code)


@router.patch("/admin/promo-codes/{promo_code_identifier}")
def update_promo_code(
    promo_code_identifier: str,
    payload: PromoCodeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    del current_user
    identifier = str(promo_code_identifier or "").strip()
    promo_code = None

    if identifier.isdigit():
        promo_code = db.query(PromoCode).filter(PromoCode.id == int(identifier)).first()

    if not promo_code:
        normalized_code = normalize_promo_code(identifier)
        promo_code = db.query(PromoCode).filter(PromoCode.code == normalized_code).first()

    if not promo_code:
        raise HTTPException(status_code=404, detail="Access code not found.")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(promo_code, field, value)

    db.commit()
    db.refresh(promo_code)
    return _promo_code_payload(promo_code)


@router.get("/transactions", response_model=list[BillingTransactionResponse])
def list_billing_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(BillingTransaction)
        .filter(BillingTransaction.user_id == current_user.id)
        .order_by(BillingTransaction.paid_at.desc(), BillingTransaction.created_at.desc())
        .limit(50)
        .all()
    )


@router.post("/create-checkout-session")
def create_checkout_session(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_stripe_configured()
    ensure_confirmed_email(current_user)
    require_global_disclosures_accepted(db, current_user)

    selected_plan = _normalize_plan(payload.get("plan"))

    if selected_plan == "free":
        raise HTTPException(status_code=400, detail="Free plan does not require checkout.")

    customer_id = get_or_create_stripe_customer(current_user, db)
    line_item = get_checkout_line_item_for_plan(selected_plan)

    session = stripe.checkout.Session.create(
        mode="subscription",
        payment_method_types=["card"],
        customer=customer_id,
        customer_update={"name": "auto", "address": "auto"},
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


@router.post("/cancel-subscription")
def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_stripe_configured()

    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active Stripe subscription found.")

    try:
        subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to retrieve Stripe subscription: {str(exc)}",
        )

    if _stripe_get(subscription, "status") == "canceled":
        current_user.plan = "free"
        current_user.subscription_status = "canceled"
        current_user.stripe_subscription_id = None
        current_user.subscription_cancel_at_period_end = False
        current_user.subscription_current_period_end = None
        db.commit()
        db.refresh(current_user)
        return {
            "user": _user_payload(current_user),
            "access": build_access_response(user=current_user),
            "email_status": "not_sent",
        }

    if not bool(_stripe_get(subscription, "cancel_at_period_end")):
        try:
            subscription = stripe.Subscription.modify(
                current_user.stripe_subscription_id,
                cancel_at_period_end=True,
                metadata={
                    "user_id": str(current_user.id),
                    "plan": get_raw_user_plan(current_user),
                    "cancelled_from": "northbridgeai_account",
                },
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Unable to schedule subscription cancellation: {str(exc)}",
            )

    price = _subscription_price(subscription)
    price_id = _stripe_get(price, "id")
    product_id = _stripe_get(price, "product")

    updated_user = _apply_subscription_to_user(
        db,
        current_user,
        customer_id=_stripe_get(subscription, "customer"),
        subscription_id=_stripe_get(subscription, "id"),
        status=_stripe_get(subscription, "status") or "active",
        price_id=price_id,
        product_id=product_id,
        price=price,
        plan=get_raw_user_plan(current_user),
        cancel_at_period_end=True,
        current_period_end=_stripe_datetime(_stripe_get(subscription, "current_period_end")),
    )

    email_status = _safe_send_cancellation_confirmation_email(db, user=updated_user)

    return {
        "user": _user_payload(updated_user),
        "access": build_access_response(user=updated_user),
        "email_status": email_status,
    }


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
            user.subscription_cancel_at_period_end = False
            user.subscription_current_period_end = None
            db.commit()

    elif event_type == "customer.subscription.paused":
        user = _apply_subscription_event(db, data)
        if user:
            user.subscription_status = "paused"
            db.commit()

    elif event_type == "invoice.payment_succeeded":
        customer_id = _stripe_get(data, "customer")
        user = _find_user_for_customer(db, customer_id=customer_id)
        if user:
            price = _invoice_price(data)
            resolved_plan = map_price_to_plan(
                _stripe_get(price, "id"),
                product_id=_stripe_get(price, "product"),
                price=price,
            )
            if resolved_plan:
                user.plan = resolved_plan
            user.subscription_status = "active"
            user.billing_issue_email_status = None
            user.billing_issue_email_error = None
            user.billing_issue_email_sent_at = None
            db.commit()
            db.refresh(user)
            transaction = _safe_record_invoice_transaction(db, user=user, invoice=data)
            _safe_send_payment_confirmation_email(
                db,
                user=user,
                transaction=transaction,
            )

    elif event_type == "invoice.payment_failed":
        customer_id = _stripe_get(data, "customer")
        user = _find_user_for_customer(db, customer_id=customer_id)
        if user:
            user.subscription_status = "past_due"
            db.commit()
            _safe_send_billing_issue_email(db, user=user, invoice=data)

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
