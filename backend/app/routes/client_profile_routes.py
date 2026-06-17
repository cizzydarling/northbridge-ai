from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.access_control import require_agent_plan
from app.data.db import get_db
from app.models.client_model import Client
from app.models.profile_model import Profile
from app.schemas.profile_schema import ProfileCreate, ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/clients", tags=["Client Profiles"])


def get_owned_client_or_404(db: Session, client_id: int, current_user) -> Client:
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.owner_user_id == current_user.id,
        )
        .first()
    )

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return client


def get_client_profile_or_404(db: Session, client_id: int) -> Profile:
    profile = db.query(Profile).filter(Profile.client_id == client_id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Client profile not found")

    return profile


@router.get("/{client_id}/profile", response_model=ProfileResponse)
def get_client_profile(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    get_owned_client_or_404(db, client_id, current_user)
    return get_client_profile_or_404(db, client_id)


@router.post("/{client_id}/profile", response_model=ProfileResponse)
def create_client_profile(
    client_id: int,
    payload: ProfileCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    get_owned_client_or_404(db, client_id, current_user)

    existing_profile = db.query(Profile).filter(Profile.client_id == client_id).first()

    if existing_profile:
        raise HTTPException(status_code=400, detail="Client profile already exists")

    profile = Profile(
        user_id=None,
        client_id=client_id,
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
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{client_id}/profile", response_model=ProfileResponse)
def update_client_profile(
    client_id: int,
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    get_owned_client_or_404(db, client_id, current_user)
    profile = get_client_profile_or_404(db, client_id)

    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{client_id}/profile")
def delete_client_profile(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_agent_plan),
):
    get_owned_client_or_404(db, client_id, current_user)
    profile = get_client_profile_or_404(db, client_id)

    db.delete(profile)
    db.commit()

    return {"message": "Client profile deleted successfully"}
