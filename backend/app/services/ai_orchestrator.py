from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

import app.services.ai_advisor as ai_advisor
from app.core.access_control import has_individual_pro
from app.models.profile_model import Profile
from app.models.self_application_model import SelfApplication
from app.models.user_models import User
from app.services.decision_engine import build_user_decision_context
from app.services.strategy_service import build_strategy


def _normalize_language(language: str | None) -> str:
    value = (language or "en").strip().lower()
    return "fr" if value == "fr" else "en"


def _t(en: str, fr: str, language: str) -> str:
    return fr if _normalize_language(language) == "fr" else en


def _safe_model_dump(value: Any) -> Any:
    """
    Safely convert Pydantic objects to plain dicts when needed.
    Leaves primitive Python values untouched.
    """
    if value is None:
        return None

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return model_dump()

    return value


def _serialize_chat_history(chat_history: Optional[List[Any]]) -> List[Dict[str, Any]]:
    """
    Normalize chat history into a list of dicts.
    Supports plain dicts and Pydantic models.
    """
    output: List[Dict[str, Any]] = []

    for item in chat_history or []:
        if isinstance(item, dict):
            output.append(item)
            continue

        dumped = _safe_model_dump(item)
        if isinstance(dumped, dict):
            output.append(dumped)

    return output


def _build_chat_fallback(language: str) -> Dict[str, Any]:
    language = _normalize_language(language)

    if language == "fr":
        return {
            "reply": (
                "J’ai bien reçu votre message. Je peux déjà vous aider à comprendre "
                "votre stratégie, vos prochaines étapes et vos documents, mais "
                "certaines fonctions IA avancées ne sont pas encore entièrement configurées."
            ),
            "suggested_next_actions": [
                {
                    "label": "Voir ma stratégie",
                    "route": "/strategy",
                },
                {
                    "label": "Mettre à jour mon profil",
                    "route": "/profile",
                },
                {
                    "label": "Ouvrir mes documents",
                    "route": "/self/documents",
                },
            ],
        }

    return {
        "reply": (
            "I received your message. I can already help explain your strategy, "
            "next steps, and documents, but some advanced AI capabilities are "
            "not fully configured yet."
        ),
        "suggested_next_actions": [
            {
                "label": "View my strategy",
                "route": "/strategy",
            },
            {
                "label": "Update my profile",
                "route": "/profile",
            },
            {
                "label": "Open my documents",
                "route": "/self/documents",
            },
        ],
    }


def get_latest_self_application(db: Session, user_id: int) -> Optional[SelfApplication]:
    return (
        db.query(SelfApplication)
        .filter(SelfApplication.user_id == user_id)
        .order_by(SelfApplication.updated_at.desc())
        .first()
    )


def get_self_profile(db: Session, user_id: int) -> Optional[Profile]:
    return db.query(Profile).filter(Profile.user_id == user_id).first()


def build_self_user_ai_context(
    *,
    db: Session,
    current_user: User,
    language: str = "en",
) -> Dict[str, Any]:
    """
    Build a single reusable AI context for self users.

    This context is intended to power:
    - dashboard AI summaries
    - strategy copilots
    - chat
    - self-application guidance
    - document generation / review helpers
    """
    language = _normalize_language(language)

    profile = get_self_profile(db, current_user.id)
    application = get_latest_self_application(db, current_user.id)
    is_premium = has_individual_pro(current_user)

    strategy = build_strategy(profile, language=language) if profile else None

    decision = build_user_decision_context(
        strategy=strategy,
        eligibility=(application.eligibility_result if application else None),
        forms_assistant=(application.forms_result if application else None),
        checklist=(application.checklist_result if application else None),
        language=language,
    )

    return {
        "user": current_user,
        "language": language,
        "is_premium": is_premium,
        "profile": profile,
        "application": application,
        "strategy": strategy,
        "decision": decision,
        "profile_found": bool(profile),
        "application_found": bool(application),
        "strategy_loaded": bool(strategy),
    }


def build_self_user_summary_cards(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns lightweight AI-ready summary data that frontend pages can use
    without needing to understand backend internals.
    """
    language = _normalize_language(context.get("language"))
    strategy = context.get("strategy") or {}
    decision = context.get("decision") or {}
    is_premium = bool(context.get("is_premium"))

    recommended_programs = strategy.get("recommended_programs") or []
    next_steps = strategy.get("next_steps") or []
    french_advantage = strategy.get("french_advantage") or {}
    crs_score = strategy.get("crs_score")

    top_program = recommended_programs[0] if recommended_programs else None
    next_priority = next_steps[0] if next_steps else None
    french_value = french_advantage.get("strategic_value", "low")

    if language == "fr":
        headline = (
            "Votre stratégie est prête."
            if strategy
            else "Complétez votre profil pour générer votre stratégie."
        )
        status = (
            "Premium actif" if is_premium else "Version gratuite active"
        )
    else:
        headline = (
            "Your strategy is ready."
            if strategy
            else "Complete your profile to generate your strategy."
        )
        status = "Premium active" if is_premium else "Free plan active"

    return {
        "headline": headline,
        "status": status,
        "crs_score": crs_score,
        "top_program": top_program,
        "next_priority": next_priority,
        "french_strategic_value": french_value,
        "recommended_programs": recommended_programs,
        "next_steps": next_steps,
        "decision": decision,
    }


def ask_self_user_copilot(
    *,
    db: Session,
    current_user: User,
    message: str,
    language: str = "en",
    chat_history: Optional[List[Any]] = None,
    fail_silently: bool = False,
) -> Dict[str, Any]:
    """
    Main self-user chat/copilot entry point.

    Uses the centralized self-user AI context so dashboard, strategy,
    application pages, and chat all rely on the same source context.
    """
    language = _normalize_language(language)
    context = build_self_user_ai_context(
        db=db,
        current_user=current_user,
        language=language,
    )

    fn = getattr(ai_advisor, "generate_ai_chat_reply", None)
    if not callable(fn):
        if fail_silently:
            fallback = _build_chat_fallback(language)
            return {
                **fallback,
                "profile_found": context["profile_found"],
                "strategy_loaded": context["strategy_loaded"],
                "language": language,
                "pathways": (
                    context["strategy"].get("recommended_programs", [])
                    if context["strategy"]
                    else []
                ),
                "french_advantage": (
                    context["strategy"].get("french_advantage", {})
                    if context["strategy"]
                    else {}
                ),
            }
        raise RuntimeError("generate_ai_chat_reply not found in ai_advisor")

    try:
        result = fn(
            message=(message or "").strip(),
            language=language,
            profile=context["profile"],
            strategy=context["strategy"],
            chat_history=_serialize_chat_history(chat_history),
        )

        if not isinstance(result, dict):
            raise ValueError("AI advisor returned invalid format.")

        return {
            "reply": result.get("reply", ""),
            "suggested_next_actions": result.get("suggested_next_actions", []),
            "profile_found": context["profile_found"],
            "strategy_loaded": context["strategy_loaded"],
            "language": language,
            "pathways": (
                context["strategy"].get("recommended_programs", [])
                if context["strategy"]
                else []
            ),
            "french_advantage": (
                context["strategy"].get("french_advantage", {})
                if context["strategy"]
                else {}
            ),
        }

    except Exception:
        if not fail_silently:
            raise

        fallback = _build_chat_fallback(language)
        return {
            **fallback,
            "profile_found": context["profile_found"],
            "strategy_loaded": context["strategy_loaded"],
            "language": language,
            "pathways": (
                context["strategy"].get("recommended_programs", [])
                if context["strategy"]
                else []
            ),
            "french_advantage": (
                context["strategy"].get("french_advantage", {})
                if context["strategy"]
                else {}
            ),
        }


def build_dashboard_copilot_prompt(context: Dict[str, Any]) -> str:
    """
    Generates a consistent prompt for dashboard-level AI summaries.
    Useful if you want a dedicated dashboard copilot endpoint later.
    """
    language = _normalize_language(context.get("language"))
    strategy = context.get("strategy") or {}
    summary = build_self_user_summary_cards(context)

    crs_score = summary.get("crs_score")
    top_program = summary.get("top_program")
    next_priority = summary.get("next_priority")
    programs = strategy.get("recommended_programs") or []

    if language == "fr":
        return (
            "Agis comme un copilote d’immigration pour utilisateur individuel. "
            f"Le score CRS actuel est: {crs_score}. "
            f"Le meilleur programme actuel est: {top_program}. "
            f"La prochaine priorité est: {next_priority}. "
            f"Programmes recommandés: {', '.join(programs) if programs else 'aucun'}. "
            "Explique la situation simplement, indique ce qui bloque le plus le dossier, "
            "et propose 3 actions concrètes et courtes."
        )

    return (
        "Act as an immigration copilot for an individual user. "
        f"Current CRS score: {crs_score}. "
        f"Current best-fit program: {top_program}. "
        f"Top next priority: {next_priority}. "
        f"Recommended programs: {', '.join(programs) if programs else 'none'}. "
        "Explain the situation simply, identify the biggest blocker, "
        "and provide 3 short concrete next actions."
    )


def build_strategy_copilot_prompt(context: Dict[str, Any]) -> str:
    """
    Generates a consistent prompt for strategy-page copilots.
    """
    language = _normalize_language(context.get("language"))
    strategy = context.get("strategy") or {}
    french_advantage = strategy.get("french_advantage") or {}
    roadmap = strategy.get("roadmap") or []
    next_steps = strategy.get("next_steps") or []

    roadmap_titles = [step.get("title") for step in roadmap if isinstance(step, dict)]
    strategic_value = french_advantage.get("strategic_value", "low")

    if language == "fr":
        return (
            "Explique la stratégie actuelle de l’utilisateur en langage simple. "
            f"Valeur stratégique du français: {strategic_value}. "
            f"Prochaines étapes: {', '.join(next_steps) if next_steps else 'aucune'}. "
            f"Feuille de route: {', '.join(roadmap_titles) if roadmap_titles else 'aucune'}. "
            "Résume la logique de la stratégie, explique pourquoi certains parcours sont prioritaires, "
            "et retourne aussi 3 suggested_next_actions très courtes."
        )

    return (
        "Explain the user's current strategy in simple language. "
        f"French strategic value: {strategic_value}. "
        f"Next steps: {', '.join(next_steps) if next_steps else 'none'}. "
        f"Roadmap: {', '.join(roadmap_titles) if roadmap_titles else 'none'}. "
        "Summarize the logic behind the strategy, explain why certain pathways are prioritized, "
        "and also return 3 very short suggested_next_actions."
    )


def build_documents_copilot_prompt(context: Dict[str, Any]) -> str:
    """
    Generates a reusable prompt for self-documents/document-generator pages.
    """
    language = _normalize_language(context.get("language"))
    application = context.get("application")
    strategy = context.get("strategy") or {}
    decision = context.get("decision") or {}

    matter_type = getattr(application, "matter_type", None) if application else None
    top_program = (strategy.get("recommended_programs") or [None])[0]

    if language == "fr":
        return (
            "Agis comme un copilote de préparation documentaire pour un utilisateur individuel. "
            f"Type de dossier: {matter_type or 'non précisé'}. "
            f"Programme principal suggéré: {top_program or 'non déterminé'}. "
            f"Contexte décisionnel disponible: {'oui' if decision else 'non'}. "
            "Explique quels documents semblent les plus importants, "
            "ce qui manque potentiellement, et propose des prochaines étapes claires."
        )

    return (
        "Act as a document-preparation copilot for an individual user. "
        f"Matter type: {matter_type or 'not specified'}. "
        f"Top suggested program: {top_program or 'not determined'}. "
        f"Decision context available: {'yes' if decision else 'no'}. "
        "Explain which documents seem most important, "
        "what may be missing, and provide clear next steps."
    )


def build_self_user_access_payload(
    *,
    current_user: User,
    language: str = "en",
    locked: bool = False,
    upgrade_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Standardized access payload for self-user endpoints.
    Useful for keeping premium UX consistent across pages.
    """
    language = _normalize_language(language)
    is_premium = has_individual_pro(current_user)

    reason = upgrade_reason
    if locked and not reason:
        reason = _t(
            "Upgrade to Premium to unlock this feature.",
            "Passez à Premium pour débloquer cette fonctionnalité.",
            language,
        )

    return {
        "access": {
            "is_premium": is_premium,
            "locked": bool(locked),
            "upgrade_reason": reason,
        }
    }