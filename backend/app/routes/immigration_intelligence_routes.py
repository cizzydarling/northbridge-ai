from app.services.security_controls import enforce_rate_limit
from fastapi import APIRouter, Depends, Query
from typing import Literal
from app.routes.self_document_routes import require_self_user
from app.services.official_resources import search as search_official
from app.services.immigration_intelligence_service import official_processing_reference
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

    return {
        **build_immigration_intelligence(



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
    scope: Literal["premium_tracker", "official_reference"] = Query(default="premium_tracker"),
    application_type: str | None = Query(default=None, max_length=80),
    country: str | None = Query(default=None, max_length=80),
    language: str = Query(default="en"),
    current_user=Depends(get_current_user),
):
    language = normalize_language(language)

    if scope == "official_reference":
        require_self_user(current_user)
        resource_read_limit(current_user)
        return official_processing_reference(application_type, country, language)

    if not has_premium_access(current_user):
        return build_locked_immigration_intelligence_preview(language)

    if application_type:
        return get_processing_time_snapshot(
            application_type=application_type,
            country=country,
            language=language,
        )

    return get_processing_time_catalog(language=language)


@router.get('/schools')
def schools(query:str=Query('',max_length=100),province:str=Query('',max_length=80),city:str=Query('',max_length=80),offset:int=Query(0,ge=0,le=10000),limit:int=Query(25,ge=1,le=50),user=Depends(require_self_user)):
    resource_read_limit(user)
    return search_official('dli',query,province,city,offset,limit)

@router.get('/test-centres')
def test_centres(provider:Literal['celpip','ielts','pte','tef','tcf']='celpip',query:str=Query('',max_length=100),province:str=Query('',max_length=80),city:str=Query('',max_length=80),offset:int=Query(0,ge=0,le=10000),limit:int=Query(25,ge=1,le=50),user=Depends(require_self_user)):
    resource_read_limit(user)
    return search_official(provider,query,province,city,offset,limit)


def resource_read_limit(user):
    enforce_rate_limit('official_resources',identifiers=[str(user.id)],limit=60,window_seconds=60)
