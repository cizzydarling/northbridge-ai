from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.schemas.profile_schema import ProfileCreate, ProfileResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.post("/create", response_model=ProfileResponse)
def create_profile(
    profile: ProfileCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    existing_profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists for this user")

    new_profile = Profile(
        user_id=user.id,
        age=profile.age,
        education=profile.education,
        language_score=profile.language_score,
        experience_years=profile.experience_years,
        has_job_offer=profile.has_job_offer,
        has_canadian_experience=profile.has_canadian_experience,
        studied_in_canada=profile.studied_in_canada,
        occupation=profile.occupation,
        noc_code=profile.noc_code,
        preferred_province=profile.preferred_province
    )

    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    return new_profile


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return profile


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    updated_profile: ProfileCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile.age = updated_profile.age
    profile.education = updated_profile.education
    profile.language_score = updated_profile.language_score
    profile.experience_years = updated_profile.experience_years
    profile.has_job_offer = updated_profile.has_job_offer
    profile.has_canadian_experience = updated_profile.has_canadian_experience
    profile.studied_in_canada = updated_profile.studied_in_canada
    profile.occupation = updated_profile.occupation
    profile.noc_code = updated_profile.noc_code
    profile.preferred_province = updated_profile.preferred_province

    db.commit()
    db.refresh(profile)

    return profile