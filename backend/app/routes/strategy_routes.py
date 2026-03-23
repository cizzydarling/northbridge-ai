from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.access_control import has_individual_pro, require_individual_pro
from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.services.report_builder_service import build_strategy_report_html
from app.services.strategy_service import build_strategy

router = APIRouter(prefix="/strategy", tags=["Strategy"])


def build_basic_strategy_payload(strategy: dict, language: str, current_user: User, profile: Profile) -> dict:
    return {
        "user_id": current_user.id,
        "profile_id": profile.id,
        "language": language,
        "is_premium": False,
        "crs_score": strategy.get("crs_score"),
        "recommended_programs": strategy.get("recommended_programs", [])[:3],
        "strengths": strategy.get("strengths", [])[:3],
        "weaknesses": strategy.get("weaknesses", [])[:3],
        "next_steps": strategy.get("next_steps", [])[:3],
        "advisor_summary": strategy.get("advisor_summary"),
        "improvement_scenarios": [],
        "roadmap": [],
        "province_recommendations": [],
        "timeline_estimate": {},
        "probability_estimate": {},
        "draw_prediction": {},
        "ai_strategy": "",
    }


@router.get("/me")
def get_my_strategy(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    language = (language or "en").lower()
    if language not in {"en", "fr"}:
        language = "en"

    strategy = build_strategy(profile, language=language)

    if has_individual_pro(current_user):
        return {
            "user_id": current_user.id,
            "profile_id": profile.id,
            "language": language,
            "is_premium": True,
            **strategy,
        }

    return build_basic_strategy_payload(
        strategy=strategy,
        language=language,
        current_user=current_user,
        profile=profile,
    )


@router.get("")
def get_my_strategy_alias(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_my_strategy(language=language, db=db, current_user=current_user)


@router.get("/report")
def export_strategy_report(
    language: str = Query(default="en"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_individual_pro),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    language = (language or "en").lower()
    if language not in {"en", "fr"}:
        language = "en"

    strategy = build_strategy(profile, language=language)
    html = build_strategy_report_html(
        profile=profile,
        strategy_data=strategy,
        user_email=getattr(current_user, "email", None),
        language=language,
    )

    filename = (
        "rapport_strategie_northbridge.html"
        if language == "fr"
        else "northbridge_strategy_report.html"
    )

    return Response(
        content=html,
        media_type="text/html",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        },
    )