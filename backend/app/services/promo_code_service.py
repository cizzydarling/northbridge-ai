from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.promo_code_model import PromoCode, PromoCodeRedemption
from app.models.user_models import User

VALID_ACCESS_TYPES = {
    "individual_pro",
    "individual_premium",
    "agent_pro",
}


def normalize_promo_code(code: str | None) -> str:
    return str(code or "").strip().upper()


def _aware(value: datetime | None) -> datetime | None:
    if not value:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _validate_promo_code(promo_code: PromoCode | None) -> PromoCode:
    now = datetime.now(timezone.utc)

    if not promo_code or not promo_code.active:
        raise HTTPException(status_code=400, detail="Invalid or inactive access code.")

    expires_at = _aware(promo_code.expires_at)
    if expires_at and expires_at <= now:
        raise HTTPException(status_code=400, detail="This access code has expired.")

    current_uses = promo_code.current_uses or 0
    if promo_code.max_uses is not None and current_uses >= promo_code.max_uses:
        raise HTTPException(status_code=400, detail="This access code has reached its usage limit.")

    if promo_code.access_type not in VALID_ACCESS_TYPES:
        raise HTTPException(status_code=400, detail="This access code is not configured correctly.")

    if promo_code.duration_days <= 0:
        raise HTTPException(status_code=400, detail="This access code duration is not configured correctly.")

    return promo_code


def redeem_promo_code(db: Session, *, user: User, code: str, commit: bool = True) -> dict:
    normalized_code = normalize_promo_code(code)
    if not normalized_code:
        raise HTTPException(status_code=400, detail="Access code is required.")

    promo_code = (
        db.query(PromoCode)
        .filter(PromoCode.code == normalized_code)
        .with_for_update()
        .first()
    )
    promo_code = _validate_promo_code(promo_code)

    existing_redemption = (
        db.query(PromoCodeRedemption)
        .filter(PromoCodeRedemption.promo_code_id == promo_code.id)
        .filter(PromoCodeRedemption.user_id == user.id)
        .first()
    )
    if existing_redemption:
        raise HTTPException(status_code=400, detail="You have already redeemed this access code.")

    now = datetime.now(timezone.utc)
    current_period_end = _aware(user.subscription_current_period_end)
    base_date = current_period_end if current_period_end and current_period_end > now else now
    granted_until = base_date + timedelta(days=promo_code.duration_days)

    user.plan = promo_code.access_type
    user.subscription_status = "active"
    user.subscription_cancel_at_period_end = True
    user.subscription_current_period_end = granted_until

    redemption = PromoCodeRedemption(
        promo_code_id=promo_code.id,
        user_id=user.id,
        code=promo_code.code,
        access_type=promo_code.access_type,
        granted_until=granted_until,
    )
    promo_code.current_uses = (promo_code.current_uses or 0) + 1

    db.add(redemption)
    if commit:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=400, detail="You have already redeemed this access code.")

        db.refresh(user)
        db.refresh(promo_code)
    else:
        db.flush()

    return {
        "message": "Access code redeemed.",
        "code": promo_code.code,
        "access_type": promo_code.access_type,
        "granted_until": granted_until,
        "current_uses": promo_code.current_uses,
        "max_uses": promo_code.max_uses,
    }
