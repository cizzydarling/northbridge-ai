from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.profile_schema import ProfileCreate, ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/profiles", tags=["Profiles"])


def _sync_user_identity_from_profile(
    user: User, payload: ProfileCreate | ProfileUpdate
) -> None:
    if payload.first_name is not None:
        user.first_name = payload.first_name.strip() or None

    if payload.last_name is not None:
        user.last_name = payload.last_name.strip() or None


def _build_profile_from_payload(current_user: User, payload: ProfileCreate) -> Profile:
    return Profile(
        user_id=current_user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        nationality=payload.nationality,
        current_country=payload.current_country,
        current_city=payload.current_city,
        phone_number=payload.phone_number,
        date_of_birth=payload.date_of_birth,
        marital_status=payload.marital_status,
        preferred_language=payload.preferred_language,
        age=payload.age,
        education=payload.education,
        language_score=payload.language_score,
        experience_years=payload.experience_years,
        has_job_offer=payload.has_job_offer,
        has_canadian_experience=payload.has_canadian_experience,
        studied_in_canada=payload.studied_in_canada,
        occupation=payload.occupation,
        noc_code=payload.noc_code,
        preferred_province=payload.preferred_province,
    )


def _create_profile_impl(
    payload: ProfileCreate,
    db: Session,
    current_user: User,
) -> Profile:
    existing_profile = (
        db.query(Profile).filter(Profile.user_id == current_user.id).first()
    )
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists.")

    profile = _build_profile_from_payload(current_user, payload)
    _sync_user_identity_from_profile(current_user, payload)

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    return profile


@router.post("/me", response_model=ProfileResponse)
def create_my_profile(
    payload: ProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _create_profile_impl(payload, db, current_user)


@router.post("/create", response_model=ProfileResponse)
def create_profile(
    payload: ProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _create_profile_impl(payload, db, current_user)


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    profile.first_name = payload.first_name
    profile.last_name = payload.last_name
    profile.nationality = payload.nationality
    profile.current_country = payload.current_country
    profile.current_city = payload.current_city
    profile.phone_number = payload.phone_number
    profile.date_of_birth = payload.date_of_birth
    profile.marital_status = payload.marital_status
    profile.preferred_language = payload.preferred_language

    profile.age = payload.age
    profile.education = payload.education
    profile.language_score = payload.language_score
    profile.experience_years = payload.experience_years
    profile.has_job_offer = payload.has_job_offer
    profile.has_canadian_experience = payload.has_canadian_experience
    profile.studied_in_canada = payload.studied_in_canada
    profile.occupation = payload.occupation
    profile.noc_code = payload.noc_code
    profile.preferred_province = payload.preferred_province

    _sync_user_identity_from_profile(current_user, payload)

    db.commit()
    db.refresh(profile)

    return profile