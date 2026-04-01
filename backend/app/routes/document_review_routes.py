from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.access_control import has_individual_pro
from app.data.db import get_db
from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.models.user_models import User
from app.routes.auth_routes import get_current_user
from app.schemas.document_review_schema import (
    DocumentReviewRequest,
    DocumentReviewResponse,
)
from app.services.decision_engine import build_user_decision_context
from app.services.document_review_service import review_document_with_ai
from app.services.strategy_service import build_strategy

router = APIRouter(prefix="/document-review", tags=["Document Review"])


def _normalize_language(language: str | None) -> str:
    value = (language or "en").strip().lower()
    return "fr" if value == "fr" else "en"


def _t(en: str, fr: str, language: str) -> str:
    return fr if _normalize_language(language) == "fr" else en


def _build_preview(review_result: dict, language: str) -> dict:
    return {
        **review_result,
        "concerns": review_result.get("concerns", [])[:2],
        "missing_support": review_result.get("missing_support", [])[:2],
        "improvement_actions": review_result.get("improvement_actions", [])[:2],
        "is_premium": False,
        "locked": True,
        "upgrade_reason": _t(
            "Upgrade to Premium to unlock the full AI review, deeper risk analysis, and fuller improvement guidance.",
            "Passez à Premium pour débloquer la révision IA complète, une analyse de risque plus poussée et des conseils d’amélioration plus complets.",
            language,
        ),
    }


@router.post("/review", response_model=DocumentReviewResponse)
def review_document(
    payload: DocumentReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    language = _normalize_language(payload.language)
    is_premium = has_individual_pro(current_user)

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    application = (
        db.query(SelfApplication)
        .filter(SelfApplication.user_id == current_user.id)
        .order_by(SelfApplication.updated_at.desc())
        .first()
    )

    strategy = build_strategy(profile, language=language)

    decision = build_user_decision_context(
        strategy=strategy,
        eligibility=(application.eligibility_result if application else None),
        forms_assistant=(application.forms_result if application else None),
        checklist=(application.checklist_result if application else None),
        language=language,
    )

    result = review_document_with_ai(
        document_type=payload.document_type,
        content=payload.content,
        language=language,
        review_depth=payload.review_depth,
        additional_context=payload.additional_context,
        profile=profile,
        strategy=strategy,
        decision=decision,
    )

    if is_premium:
        return {
            **result,
            "is_premium": True,
            "locked": False,
        }

    return _build_preview(result, language)