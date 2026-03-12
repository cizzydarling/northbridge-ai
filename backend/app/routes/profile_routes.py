from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.schemas.profile_schema import ProfileCreate, ProfileResponse
from app.routes.auth_routes import get_current_user

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.post("/create", response_model=ProfileResponse)
def create_profile(
    profile_data: ProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")

    new_profile = Profile(
        age=profile_data.age,
        education=profile_data.education,
        language_score=profile_data.language_score,
        work_experience=profile_data.work_experience,
        marital_status=profile_data.marital_status,
        province=profile_data.province,
        user_id=current_user.id
    )

    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    return new_profile


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return profile

@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return profile