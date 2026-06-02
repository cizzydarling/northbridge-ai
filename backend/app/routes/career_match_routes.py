from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.access_control import ensure_career_saved_jobs, get_feature_access_map
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
    result = build_career_match(payload, profile)
    features = get_feature_access_map(current_user)
    full_access = features["career_match_full"]
    premium_access = features["career_advanced_intelligence"]

    if not full_access:
        result["matches"] = result.get("matches", [])[:2]

    if not premium_access:
        for match in result.get("matches", []):
            match["job_links"] = [
                link
                for link in match.get("job_links", [])
                if link.get("source") != "Job Bank XML"
            ]
            match["available_jobs_count"] = 0
            match["live_data_status"] = "premium_locked"

    result["access"] = {
        "preview": features["career_match_preview"],
        "full": full_access,
        "saved_jobs": features["career_saved_jobs"],
        "advanced_intelligence": premium_access,
        "limited": not full_access,
        "minimum_plan_for_full": "pro",
        "minimum_plan_for_advanced": "premium",
    }
    return result


@router.get("/saved-jobs", response_model=list[SavedCareerJobResponse])
def list_saved_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_career_saved_jobs(current_user)
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
    ensure_career_saved_jobs(current_user)
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
    ensure_career_saved_jobs(current_user)
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
