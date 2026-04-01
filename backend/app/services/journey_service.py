from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.models.self_document_model import SelfDocument
from app.models.user_models import User
from app.services.strategy_service import build_strategy


def _normalize_language(language: str) -> str:
    return "fr" if (language or "").lower() == "fr" else "en"


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
    return labels[language][key]


def _safe_action(language: str, key: str) -> str:
    messages = {
        "en": {
            "start_application": "Start your application to unlock personalized guidance.",
            "complete_profile": "Complete your profile to generate a stronger strategy.",
            "review_strategy": "Review your strategy to understand your best path and next steps.",
            "complete_documents": "Complete your required documents to keep moving forward.",
            "improve_case": "Improve the weaker parts of your case before moving forward.",
            "continue_application": "Continue your application and follow the guided next steps.",

            # NEW French-priority actions
            "review_french_priority": "Review francophone and bilingual pathways first — they may be your strongest option.",
            "confirm_french_strength": "Confirm your French language strength and how it impacts your eligibility.",
        },
        "fr": {
            "start_application": "Commencez votre demande pour débloquer des conseils personnalisés.",
            "complete_profile": "Complétez votre profil pour générer une stratégie plus solide.",
            "review_strategy": "Consultez votre stratégie pour comprendre votre meilleure voie et les prochaines étapes.",
            "complete_documents": "Complétez vos documents obligatoires pour continuer à avancer.",
            "improve_case": "Renforcez les points plus faibles de votre dossier avant de continuer.",
            "continue_application": "Continuez votre demande et suivez les prochaines étapes guidées.",

            # NEW French-priority actions
            "review_french_priority": "Analysez d’abord les voies francophones ou bilingues — elles peuvent être les plus avantageuses.",
            "confirm_french_strength": "Confirmez votre niveau de français et son impact sur votre admissibilité.",
        },
    }
    return messages[language][key]


def get_user_journey(
    db: Session,
    current_user: User,
    language: str = "en",
) -> Dict[str, Any]:
    language = _normalize_language(language)

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

    french_advantage = strategy.get("french_advantage") if strategy else {}
    french_value = (french_advantage or {}).get("strategic_value", "low")

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

    # -------------------------
    # INTELLIGENT JOURNEY LOGIC
    # -------------------------

    if not application:
        return {
            "language": language,
            "current_stage": _safe_stage(language, "start"),
            "next_best_action": _safe_action(language, "start_application"),
            "recommended_route": "/self/application",
        }

    if not profile:
        return {
            "language": language,
            "current_stage": _safe_stage(language, "profile"),
            "next_best_action": _safe_action(language, "complete_profile"),
            "recommended_route": "/profile",
        }

    if not strategy:
        return {
            "language": language,
            "current_stage": _safe_stage(language, "strategy"),
            "next_best_action": _safe_action(language, "review_strategy"),
            "recommended_route": "/strategy",
        }

    # 🔥 NEW: French priority BEFORE documents
    if french_value in {"medium", "high"}:
        return {
            "language": language,
            "current_stage": _safe_stage(language, "strategy"),
            "next_best_action": _safe_action(language, "review_french_priority"),
            "recommended_route": "/strategy",
        }

    if remaining_required_count > 0:
        return {
            "language": language,
            "current_stage": _safe_stage(language, "documents"),
            "next_best_action": _safe_action(language, "complete_documents"),
            "recommended_route": "/self/documents",
        }

    if readiness == "Weak":
        return {
            "language": language,
            "current_stage": _safe_stage(language, "strategy"),
            "next_best_action": strategy.get("next_steps", [None])[0]
            or _safe_action(language, "improve_case"),
            "recommended_route": "/strategy",
        }

    return {
        "language": language,
        "current_stage": _safe_stage(language, "ready"),
        "next_best_action": strategy.get("next_steps", [None])[0]
        or _safe_action(language, "continue_application"),
        "recommended_route": "/self/application",
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
        "recommended_programs": strategy.get("recommended_programs", []),
        "strategy_next_steps": strategy.get("next_steps", []),
        "crs_score": strategy.get("crs_score"),
    }