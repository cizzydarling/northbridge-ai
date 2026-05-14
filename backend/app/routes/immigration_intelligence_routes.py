from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.access_control import get_current_user, has_premium_access
from app.data.db import get_db
from app.models.profile_model import Profile
from app.services.crs_calculator import calculate_crs
from app.services.immigration_intelligence_service import (
    build_immigration_intelligence,
    build_locked_immigration_intelligence_preview,
    get_latest_ircc_draws,
    get_processing_time_catalog,
    get_processing_time_snapshot,
)
from app.services.strategy_service import rank_provinces_for_profile


router = APIRouter(prefix="/immigration-intelligence", tags=["Immigration Intelligence"])


def normalize_language(language: str | None) -> str:
    normalized = (language or "en").strip().lower()
    return "fr" if normalized == "fr" else "en"


def get_profile_for_user(db: Session, user_id: int) -> Profile | None:
    return db.query(Profile).filter(Profile.user_id == user_id).first()


@router.get("/summary")
def get_immigration_intelligence_summary(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    language = normalize_language(language)

    if not has_premium_access(current_user):
        return {
            **build_locked_immigration_intelligence_preview(language),
            "access": {
                "is_premium": False,
                "can_use_live_ircc_draws": False,
                "can_view_processing_times": False,
                "can_use_job_opportunity_matching": False,
            },
        }

    profile = get_profile_for_user(db, current_user.id)
    crs_score = calculate_crs(profile) if profile else 0
    province_recommendations = (
        rank_provinces_for_profile(profile, crs_score, language=language)
        if profile
        else []
    )

    return {
        **build_immigration_intelligence(
            profile=profile,
            crs_score=crs_score,
            province_recommendations=province_recommendations,
            language=language,
            include_live=True,
        ),
        "access": {
            "is_premium": True,
            "can_use_live_ircc_draws": True,
            "can_view_processing_times": True,
            "can_use_job_opportunity_matching": True,
        },
    }


@router.get("/draws")
def get_immigration_intelligence_draws(
    limit: int = Query(default=6, ge=1, le=12),
    language: str = Query(default="en"),
    current_user=Depends(get_current_user),
):
    language = normalize_language(language)

    if not has_premium_access(current_user):
        return build_locked_immigration_intelligence_preview(language)

    return get_latest_ircc_draws(limit=limit, language=language)


@router.get("/processing-times")
def get_immigration_intelligence_processing_times(
    application_type: str | None = Query(default=None),
    country: str | None = Query(default=None),
    language: str = Query(default="en"),
    current_user=Depends(get_current_user),
):
    language = normalize_language(language)

    if not has_premium_access(current_user):
        return build_locked_immigration_intelligence_preview(language)

    if application_type:
        return get_processing_time_snapshot(
            application_type=application_type,
            country=country,
            language=language,
        )

    return get_processing_time_catalog(language=language)
