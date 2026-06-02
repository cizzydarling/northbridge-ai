from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.data.db import get_db
from app.models.career_match_models import SavedCareerJob
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.career_match_schema import (
    CareerMatchRequest,
    CareerMatchResponse,
    SavedCareerJobCreate,
    SavedCareerJobResponse,
)
from app.services.career_match_service import build_career_match

router = APIRouter(prefix="/career-match", tags=["Career Match"])


def _get_profile(db: Session, user_id: int) -> Profile | None:
    return db.query(Profile).filter(Profile.user_id == user_id).first()


@router.post("/match", response_model=CareerMatchResponse)
def match_career(
    payload: CareerMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = _get_profile(db, current_user.id)
    return build_career_match(payload, profile)


@router.get("/saved-jobs", response_model=list[SavedCareerJobResponse])
def list_saved_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(SavedCareerJob)
        .filter(SavedCareerJob.user_id == current_user.id)
        .order_by(SavedCareerJob.created_at.desc())
        .all()
    )


@router.post("/saved-jobs", response_model=SavedCareerJobResponse)
def save_job(
    payload: SavedCareerJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = (
        db.query(SavedCareerJob)
        .filter(
            SavedCareerJob.user_id == current_user.id,
            SavedCareerJob.job_url == payload.job_url,
        )
        .first()
    )
    if existing:
        return existing

    saved = SavedCareerJob(
        user_id=current_user.id,
        title=payload.title,
        province=payload.province,
        noc_code=payload.noc_code,
        occupation=payload.occupation,
        company=payload.company,
        job_url=payload.job_url,
        source=payload.source,
        notes=payload.notes,
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


@router.delete("/saved-jobs/{job_id}")
def delete_saved_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    saved = (
        db.query(SavedCareerJob)
        .filter(SavedCareerJob.id == job_id, SavedCareerJob.user_id == current_user.id)
        .first()
    )
    if not saved:
        raise HTTPException(status_code=404, detail="Saved job not found.")

    db.delete(saved)
    db.commit()
    return {"deleted": True}
