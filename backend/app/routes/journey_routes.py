from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.services.journey_service import get_user_journey

router = APIRouter(prefix="/journey", tags=["Journey"])


@router.get("/me")
def get_my_journey(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_journey(
        db=db,
        current_user=current_user,
        language=language,
    )