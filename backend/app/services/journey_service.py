from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.models.self_document_model import SelfDocument
from app.models.user_models import User
from app.services.strategy_service import build_strategy


def _safe_stage(language: str, key: str) -> str:
    labels = {
        "en": {
            "start": "Start",
            "profile": "Complete profile",
            "strategy": "Review strategy",
            "documents": "Prepare documents",
            "ready": "Ready to proceed",
        },
        "fr": {
            "start": "Commencer",
            "profile": "Compléter le profil",
            "strategy": "Consulter la stratégie",
            "documents": "Préparer les documents",
            "ready": "Prêt à avancer",
        },
    }
    return labels["fr" if language == "fr" else "en"][key]


def _safe_action(language: str, key: str, **kwargs) -> str:
    messages = {
        "en": {
            "start_application": "Start your application to unlock personalized guidance.",
            "complete_profile": "Complete your profile to generate a stronger strategy.",
            "review_strategy": "Review your strategy to understand your best path and next steps.",
            "complete_documents": "Complete your required documents to keep moving forward.",
            "improve_case": "Improve the weaker parts of your case before moving forward.",
            "continue_application": "Continue your application and follow the guided next steps.",
        },
        "fr": {
            "start_application": "Commencez votre demande pour débloquer des conseils personnalisés.",
            "complete_profile": "Complétez votre profil pour générer une stratégie plus solide.",
            "review_strategy": "Consultez votre stratégie pour comprendre votre meilleure voie et les prochaines étapes.",
            "complete_documents": "Complétez vos documents obligatoires pour continuer à avancer.",
            "improve_case": "Renforcez les points plus faibles de votre dossier avant de continuer.",
            "continue_application": "Continuez votre demande et suivez les prochaines étapes guidées.",
        },
    }
    return messages["fr" if language == "fr" else "en"][key].format(**kwargs)


def get_user_journey(
    db: Session,
    current_user: User,
    language: str = "en",
) -> Dict[str, Any]:
    language = (language or "en").lower()
    if language not in {"en", "fr"}:
        language = "en"

    profile: Optional[Profile] = (
        db.query(Profile).filter(Profile.user_id == current_user.id).first()
    )

    application: Optional[SelfApplication] = (
        db.query(SelfApplication)
        .filter(SelfApplication.user_id == current_user.id)
        .order_by(SelfApplication.updated_at.desc(), SelfApplication.created_at.desc())
        .first()
    )

    strategy = build_strategy(profile, language=language) if profile else None

    documents = []
    if application and application.matter_type:
        documents = (
            db.query(SelfDocument)
            .filter(
                SelfDocument.user_id == current_user.id,
                SelfDocument.matter_type == application.matter_type,
            )
            .all()
        )

    required_documents = [doc for doc in documents if getattr(doc, "required", False)]
    completed_required_documents = [
        doc for doc in required_documents if getattr(doc, "completed", False)
    ]

    required_count = len(required_documents)
    completed_required_count = len(completed_required_documents)
    remaining_required_count = max(required_count - completed_required_count, 0)
    document_progress_percent = (
        round((completed_required_count / required_count) * 100)
        if required_count > 0
        else 0
    )

    readiness = None
    readiness_score = None
    if application and application.eligibility_result:
        readiness = application.eligibility_result.get("readiness")
        readiness_score = application.eligibility_result.get("score")

    current_stage = _safe_stage(language, "start")
    next_best_action = _safe_action(language, "start_application")
    recommended_route = "/self/application"

    if not application:
        current_stage = _safe_stage(language, "start")
        next_best_action = _safe_action(language, "start_application")
        recommended_route = "/self/application"
    elif not profile:
        current_stage = _safe_stage(language, "profile")
        next_best_action = _safe_action(language, "complete_profile")
        recommended_route = "/profile"
    elif not strategy:
        current_stage = _safe_stage(language, "strategy")
        next_best_action = _safe_action(language, "review_strategy")
        recommended_route = "/strategy"
    elif remaining_required_count > 0:
        current_stage = _safe_stage(language, "documents")
        next_best_action = _safe_action(language, "complete_documents")
        recommended_route = "/self/documents"
    elif readiness == "Weak":
        current_stage = _safe_stage(language, "strategy")
        next_best_action = (
            strategy.get("next_steps", [None])[0]
            or _safe_action(language, "improve_case")
        )
        recommended_route = "/strategy"
    else:
        current_stage = _safe_stage(language, "ready")
        next_best_action = (
            strategy.get("next_steps", [None])[0]
            or _safe_action(language, "continue_application")
        )
        recommended_route = "/self/application"

    return {
        "language": language,
        "profile_completed": profile is not None,
        "application_started": application is not None,
        "strategy_ready": strategy is not None,
        "documents": {
            "total": len(documents),
            "required": required_count,
            "completed_required": completed_required_count,
            "remaining_required": remaining_required_count,
            "progress_percent": document_progress_percent,
        },
        "readiness": {
            "label": readiness,
            "score": readiness_score,
        },
        "current_stage": current_stage,
        "next_best_action": next_best_action,
        "recommended_route": recommended_route,
        "matter_type": getattr(application, "matter_type", None),
        "recommended_programs": strategy.get("recommended_programs", []) if strategy else [],
        "strategy_next_steps": strategy.get("next_steps", []) if strategy else [],
        "crs_score": strategy.get("crs_score") if strategy else None,
    }