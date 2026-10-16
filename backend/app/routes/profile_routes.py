from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.profile_schema import LegacyProfilePut, ProfileCreate, ProfileResponse, ProfileUpdate
from app.services.language_evidence import valid_benchmark

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
        english_language_score=payload.english_language_score,
        french_language_score=payload.french_language_score,
        experience_years=payload.experience_years,
        has_job_offer=payload.has_job_offer,
        has_canadian_experience=payload.has_canadian_experience,
        studied_in_canada=payload.studied_in_canada,
        occupation=payload.occupation,
        noc_code=payload.noc_code,
        preferred_province=payload.preferred_province,
        job_description=payload.job_description,
        job_duties=payload.job_duties,
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


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    # PATCH always uses the strict write contract.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    _sync_user_identity_from_profile(current_user, payload)

    db.commit()
    db.refresh(profile)

    return profile


def _legacy_put_changes(payload: LegacyProfilePut, profile: Profile) -> dict:
    data = payload.model_dump(exclude_unset=True)
    languages = ("language_score", "english_language_score", "french_language_score")
    # Production writers send this shape. Partial PUT has no exceptions.
    # Shape identifies a contract, never proof of user intent.
    full = set(languages + ("first_name", "last_name", "age", "education",
                           "occupation", "experience_years", "preferred_language")) <= data.keys()
    if not full:
        try:
            return ProfileUpdate.model_validate(data).model_dump(exclude_unset=True)
        except ValidationError:
            raise HTTPException(status_code=422, detail="Invalid benchmark: use integers 1-12 or null.")

    combined = data.pop("language_score")
    english = data["english_language_score"]
    french = data["french_language_score"]
    stored_combined = profile.language_score
    # Old hydration copies combined into missing/zero English. This request
    # cannot distinguish that copy from an intentional edit. Preserve evidence;
    # explicit PATCH can establish new attribution.
    fallback_echo = (not profile.english_language_score and bool(stored_combined)
                     and english == stored_combined)
    for field in languages[1:]:
        value = data[field]
        stored = getattr(profile, field)
        if field == "english_language_score" and fallback_echo:
            data.pop(field)
        elif value == stored:
            data.pop(field)  # unchanged invalid integers are not new writes
        elif value is not None and valid_benchmark(value) is None:
            raise HTTPException(status_code=422, detail="Invalid benchmark: use integers 1-12 or null.")

    derived = max(english or 0, french or 0) or None
    # Old client recomputes combined. Never replace the stored scalar with
    # an automatic max, zero or null. Noncanonical mutations fail closed.
    if combined != stored_combined and combined != derived:
        raise HTTPException(status_code=422, detail="Ambiguous combined benchmark update; use PATCH.")
    # Old API normalization inserts null/false for fields omitted by onboarding.
    # A full PUT cannot distinguish those defaults from intentional clears.
    # Preserve unrelated existing data; explicit PATCH supports those clears.
    for field in tuple(data):
        if field not in languages and (data[field] is None or
                data[field] is False):
            data.pop(field)
    return data


@router.put("/me", response_model=ProfileResponse)
def update_my_profile_legacy_put(
    payload: LegacyProfilePut,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    changes = _legacy_put_changes(payload, profile)
    # Only declared profile fields survive input parsing; IDs cannot be assigned.
    for field, value in changes.items():
        setattr(profile, field, value)
    _sync_user_identity_from_profile(current_user, payload)
    db.commit()
    db.refresh(profile)
    return profile
