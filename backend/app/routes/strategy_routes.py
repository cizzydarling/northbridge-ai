from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.services.auth_service import get_current_user
from app.services.strategy_service import build_strategy

router = APIRouter(prefix="/strategy", tags=["Strategy"])


@router.get("/me")
def get_my_strategy(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return build_strategy(profile)