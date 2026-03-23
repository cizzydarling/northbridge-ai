from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.profile_schema import ProfileCreate, ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/profiles", tags=["Profiles"])


def get_user_profile_or_404(db: Session, user_id: int) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return profile


def _create_profile_for_user(
    profile_data: ProfileCreate,
    db: Session,
    current_user: User,
) -> Profile:
    existing_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")

    new_profile = Profile(
        user_id=current_user.id,
        age=profile_data.age,
        education=profile_data.education,
        language_score=profile_data.language_score,
        experience_years=profile_data.experience_years,
        has_job_offer=profile_data.has_job_offer,
        has_canadian_experience=profile_data.has_canadian_experience,
        studied_in_canada=profile_data.studied_in_canada,
        occupation=profile_data.occupation,
        noc_code=profile_data.noc_code,
        preferred_province=profile_data.preferred_province,
    )

    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    return new_profile


@router.post("/create", response_model=ProfileResponse)
def create_profile(
    profile_data: ProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _create_profile_for_user(profile_data, db, current_user)


@router.post("", response_model=ProfileResponse)
def create_profile_alias(
    profile_data: ProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _create_profile_for_user(profile_data, db, current_user)


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_profile_or_404(db, current_user.id)


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_user_profile_or_404(db, current_user.id)

    update_data = profile_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile