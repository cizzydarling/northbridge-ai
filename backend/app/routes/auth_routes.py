from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.services.auth_service import create_user_db, login_user
from app.data.db import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register_user(user: RegisterRequest, db: Session = Depends(get_db)):
    return create_user_db(db, user.email, user.password)


@router.post("/login")
def login(user: LoginRequest, db: Session = Depends(get_db)):
    return login_user(db, user.email, user.password)