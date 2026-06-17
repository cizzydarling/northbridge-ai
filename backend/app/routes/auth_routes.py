import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.services.email_service import (
    build_email_confirmation_email,
    build_onboarding_email,
    build_password_reset_email,
    get_email_settings_summary,
    send_email,
)
from app.services.promo_code_service import redeem_promo_code

router = APIRouter(prefix="/auth", tags=["Auth"])

ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("APP_ENV", "development")).lower()
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if ENVIRONMENT in {"prod", "production"}:
        raise RuntimeError("SECRET_KEY must be configured in production.")
    SECRET_KEY = "dev_secret_key_change_me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
PASSWORD_RESET_EXPIRE_MINUTES = 45
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "individual"
    access_code: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or fewer")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        allowed_roles = {"individual", "agent", "admin"}
        if value not in allowed_roles:
            raise ValueError("Role must be one of: individual, agent, admin")
        return value


class EmailRequest(BaseModel):
    email: EmailStr


class EmailTestRequest(BaseModel):
    email: EmailStr | None = None


class TokenRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    token: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or fewer")
        return value


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password must be 72 bytes or fewer")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "plan": getattr(user, "plan", "free"),
        "subscription_status": getattr(user, "subscription_status", None),
        "subscription_cancel_at_period_end": getattr(
            user, "subscription_cancel_at_period_end", None
        ),
        "subscription_current_period_end": getattr(
            user, "subscription_current_period_end", None
        ),
        "email_confirmed_at": getattr(user, "email_confirmed_at", None),
        "first_name": getattr(user, "first_name", None),
        "last_name": getattr(user, "last_name", None),
    }


def create_default_profile_for_user(db: Session, user: User) -> Profile:
    existing_profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if existing_profile:
        return existing_profile

    profile = Profile(
        user_id=user.id,
        first_name=None,
        last_name=None,
        nationality=None,
        current_country=None,
        current_city=None,
        phone_number=None,
        date_of_birth=None,
        marital_status=None,
        preferred_language="en",
        age=None,
        education=None,
        language_score=None,
        english_language_score=None,
        french_language_score=None,
        experience_years=None,
        has_job_offer=False,
        has_canadian_experience=False,
        studied_in_canada=False,
        occupation=None,
        noc_code=None,
        preferred_province=None,
    )

    db.add(profile)
    db.flush()
    return profile


def _send_onboarding_email(db: Session, user: User) -> None:
    if user.onboarding_email_sent_at:
        return

    subject, text_body, html_body = build_onboarding_email()
    result = send_email(
        to_email=user.email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )

    user.onboarding_email_status = result.status
    user.onboarding_email_error = result.error
    if result.sent:
        user.onboarding_email_sent_at = datetime.now(timezone.utc)
    db.flush()


def _send_email_confirmation(db: Session, user: User) -> None:
    if user.email_confirmed_at:
        user.email_confirmation_status = "already_confirmed"
        db.flush()
        return

    token = _new_token()
    user.email_confirmation_token_hash = _hash_token(token)
    user.email_confirmation_sent_at = datetime.now(timezone.utc)
    confirmation_url = f"{FRONTEND_URL}/auth?confirm_token={token}"
    subject, text_body, html_body = build_email_confirmation_email(
        confirmation_url=confirmation_url,
    )
    result = send_email(
        to_email=user.email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )

    user.email_confirmation_status = result.status
    user.email_confirmation_error = result.error
    db.flush()


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = get_user_by_email(db, data.email)

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        new_user = User(
            email=data.email,
            password=hash_password(data.password),
            role=data.role,
        )

        db.add(new_user)
        db.flush()

        create_default_profile_for_user(db, new_user)
        if data.access_code:
            redeem_promo_code(db, user=new_user, code=data.access_code, commit=False)
        _send_email_confirmation(db, new_user)
        _send_onboarding_email(db, new_user)

        db.commit()
        db.refresh(new_user)

        return serialize_user(new_user)

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    try:
        user = get_user_by_email(db, form_data.username)

        if not user or not verify_password(form_data.password, user.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        create_default_profile_for_user(db, user)
        db.commit()

        access_token = create_access_token(
            {
                "sub": user.email,
                "role": user.role,
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": serialize_user(user),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception

    return user


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.post("/request-email-confirmation")
def request_email_confirmation(
    data: EmailRequest,
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, data.email)
    email_status = "not_found"
    if user:
        _send_email_confirmation(db, user)
        db.commit()
        email_status = user.email_confirmation_status or "failed"

    if email_status in {"failed", "not_configured"}:
        return {
            "message": "Confirmation email could not be sent. Please contact support.",
            "email_status": email_status,
            "email_sent": False,
            "delivery_failed": True,
        }

    return {
        "message": "If that account exists, a confirmation email has been sent.",
        "email_status": "sent_or_not_found",
        "email_sent": email_status == "sent",
        "delivery_failed": False,
    }


@router.post("/confirm-email")
def confirm_email(data: TokenRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(data.token)
    user = (
        db.query(User)
        .filter(User.email_confirmation_token_hash == token_hash)
        .first()
    )

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired confirmation link.")

    user.email_confirmed_at = datetime.now(timezone.utc)
    user.email_confirmation_token_hash = None
    user.email_confirmation_status = "confirmed"
    user.email_confirmation_error = None
    db.commit()

    return {"message": "Email confirmed."}


@router.get("/confirm-email")
def confirm_email_get(token: str, db: Session = Depends(get_db)):
    return confirm_email(TokenRequest(token=token), db)


@router.post("/request-password-reset")
def request_password_reset(data: EmailRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, data.email)
    email_status = "not_found"
    if user:
        token = _new_token()
        user.password_reset_token_hash = _hash_token(token)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=PASSWORD_RESET_EXPIRE_MINUTES
        )
        user.password_reset_sent_at = datetime.now(timezone.utc)
        reset_url = f"{FRONTEND_URL}/auth?reset_token={token}"
        subject, text_body, html_body = build_password_reset_email(reset_url=reset_url)
        result = send_email(
            to_email=user.email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        user.password_reset_status = result.status
        user.password_reset_error = result.error
        db.commit()
        email_status = result.status

    if email_status in {"failed", "not_configured"}:
        return {
            "message": "Password reset email could not be sent. Please contact support.",
            "email_status": email_status,
            "email_sent": False,
            "delivery_failed": True,
        }

    return {
        "message": "If that account exists, a password reset email has been sent.",
        "email_status": "sent_or_not_found",
        "email_sent": email_status == "sent",
        "delivery_failed": False,
    }


@router.post("/reset-password")
def reset_password(data: PasswordResetRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(data.token)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash).first()

    if not user or not user.password_reset_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset link.")

    expires_at = user.password_reset_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired password reset link.")

    user.password = hash_password(data.password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.password_reset_status = "used"
    user.password_reset_error = None
    db.commit()

    return {"message": "Password reset complete."}


def require_agent(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {"agent", "admin"}:
        raise HTTPException(status_code=403, detail="Agent access required")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/admin/email-settings")
def get_auth_email_settings(current_user: User = Depends(require_admin)):
    del current_user
    return get_email_settings_summary()


@router.post("/admin/test-email")
def send_auth_test_email(
    data: EmailTestRequest,
    current_user: User = Depends(require_admin),
):
    to_email = data.email or current_user.email
    subject = "NorthBridgeAI email test"
    text_body = (
        "This is a NorthBridgeAI SMTP test email. "
        "If you received it, backend email delivery is configured."
    )
    html_body = """
    <p>This is a <strong>NorthBridgeAI SMTP test email</strong>.</p>
    <p>If you received it, backend email delivery is configured.</p>
    """
    result = send_email(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )
    return {
        "sent": result.sent,
        "status": result.status,
        "error": result.error,
        "to": to_email,
        "settings": get_email_settings_summary(),
    }
