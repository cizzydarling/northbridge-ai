from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException

from app.models.user_models import User
from app.routes.auth_routes import get_current_user

FREE_PLAN = "free"
PRO_PLAN = "pro"
PREMIUM_PLAN = "premium"
AGENT_PLAN = "agent"

ACTIVE_STATUSES = {"active", "trialing", "paid", "complete", "completed", "canceling"}

PLAN_MAPPING = {
    "free": FREE_PLAN,
    "individual_pro": PRO_PLAN,
    "individual_premium": PREMIUM_PLAN,
    "agent_pro": AGENT_PLAN,
    "pro": PRO_PLAN,
    "premium": PREMIUM_PLAN,
    "agent": AGENT_PLAN,
}


def _normalize(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def get_user_plan(user: Optional[User]) -> str:
    if not user:
        return FREE_PLAN

    raw_plan = _normalize(getattr(user, "plan", None))
    return PLAN_MAPPING.get(raw_plan, FREE_PLAN)


def get_raw_user_plan(user: Optional[User]) -> str:
    if not user:
        return FREE_PLAN
    return _normalize(getattr(user, "plan", None)) or FREE_PLAN


def get_subscription_status(user: Optional[User]) -> str:
    if not user:
        return ""
    return _normalize(getattr(user, "subscription_status", None))


def has_confirmed_email(user: Optional[User]) -> bool:
    if not user:
        return False
    return bool(getattr(user, "email_confirmed_at", None))


def ensure_confirmed_email(user: Optional[User]) -> None:
    if has_confirmed_email(user):
        return
    raise HTTPException(
        status_code=403,
        detail={
            "code": "email_confirmation_required",
            "message": "Please confirm your email address before continuing.",
        },
    )


def has_current_access_period(user: Optional[User]) -> bool:
    if not user:
        return False

    period_end = getattr(user, "subscription_current_period_end", None)
    if not period_end:
        return True

    if period_end.tzinfo is None:
        period_end = period_end.replace(tzinfo=timezone.utc)

    return period_end > datetime.now(timezone.utc)


def has_active_paid_access(user: Optional[User]) -> bool:
    plan = get_user_plan(user)
    raw_plan = get_raw_user_plan(user)
    status = get_subscription_status(user)

    if plan == FREE_PLAN and raw_plan == "free":
        return False

    if not has_current_access_period(user):
        return False

    if not status:
        return True

    return status in ACTIVE_STATUSES


def has_individual_pro(user: Optional[User]) -> bool:
    plan = get_user_plan(user)
    return plan in {PRO_PLAN, PREMIUM_PLAN} and has_active_paid_access(user)


def has_premium_access(user: Optional[User]) -> bool:
    plan = get_user_plan(user)
    return plan == PREMIUM_PLAN and has_active_paid_access(user)


def has_agent_plan(user: Optional[User]) -> bool:
    """
    Backward-compatible helper for old agent routes.
    Keeps agent access separate from self-user premium.
    """
    raw_plan = get_raw_user_plan(user)
    status = get_subscription_status(user)

    if raw_plan != "agent_pro":
        return False

    if not status:
        return True

    return status in ACTIVE_STATUSES


def has_simulation_access(user: Optional[User]) -> bool:
    """
    Launch logic:
    - Pro and Premium self-users can access simulations.
    - Free users cannot.
    """
    return has_individual_pro(user)


def is_free_user(user: Optional[User]) -> bool:
    return not has_individual_pro(user)


def get_feature_access_map(user: Optional[User]) -> Dict[str, bool]:
    plan = get_user_plan(user)
    raw_plan = get_raw_user_plan(user)
    paid = has_active_paid_access(user)

    is_pro = plan in {PRO_PLAN, PREMIUM_PLAN} and paid
    is_premium = plan == PREMIUM_PLAN and paid
    is_agent = raw_plan == "agent_pro" and paid

    return {
        # ---- STRATEGY ----
        "basic_strategy": True,
        "full_strategy": is_pro,

        # ---- FORMS ----
        "forms_preview": True,
        "forms_download": is_pro,
        "forms_ai_assistant": is_pro,

        # ---- DOCUMENT GENERATOR ----
        "document_generator_preview": True,
        "document_generator_full": is_pro,
        "document_docx_download": is_pro,

        # ---- DOCUMENT REVIEW ----
        "document_review_preview": True,
        "document_review_full": is_pro,

        # ---- AI ----
        "basic_ai": True,
        "advanced_ai": is_pro,
        "priority_ai": is_premium,

        # ---- EXPORTS ----
        "pdf_export": is_premium,
        "exports": is_premium,

        # ---- PREMIUM IMMIGRATION INTELLIGENCE ----
        "live_ircc_draws": is_premium,
        "processing_time_tracker": is_premium,
        "job_opportunity_matching": is_premium,
        "official_finders": is_premium,

        # ---- CAREER MATCH ----
        "career_match_preview": True,
        "career_match_full": is_pro,
        "career_saved_jobs": is_pro,
        "career_advanced_intelligence": is_premium,

        # ---- CITIZENSHIP & LANGUAGE PRACTICE ----
        "citizenship_study_guide": True,
        "citizenship_practice_quiz": True,
        "citizenship_progress": is_pro,
        "citizenship_mock_exam": is_premium,
        "language_practice": is_premium,

        # ---- WORKSPACES ----
        "self_workspace": is_pro,
        "client_workspace": is_agent,
        "agent_workspace": is_agent,

        # ---- LEGACY / COMPATIBILITY ----
        "decision_engine": is_pro,
        "document_generator": True,
        "unlimited_document_generation": is_pro,
        "document_review": is_pro,
        "advanced_ai_copilot": is_pro,
        "simulation_access": is_pro,
    }


def build_upgrade_payload(
    *,
    feature: str,
    language: str = "en",
    minimum_plan: str = PRO_PLAN,
) -> Dict[str, Any]:
    lang = "fr" if (language or "").strip().lower() == "fr" else "en"

    feature_labels = {
        "full_strategy": ("full strategy", "la stratégie complète"),
        "decision_engine": ("the decision engine", "le moteur de décision"),
        "document_review": ("AI document review", "la révision IA des documents"),
        "document_review_full": ("full AI document review", "la révision IA complète"),
        "advanced_ai_copilot": ("advanced AI copilot", "le copilote IA avancé"),
        "advanced_ai": ("advanced AI tools", "les outils IA avancés"),
        "priority_ai": ("priority AI", "l’IA prioritaire"),
        "exports": ("exports", "les exports"),
        "live_ircc_draws": ("live IRCC draw monitoring", "la veille des rondes IRCC"),
        "processing_time_tracker": ("processing-time tracking", "le suivi des delais"),
        "job_opportunity_matching": ("job and province opportunity matching", "le jumelage emplois et provinces"),
        "career_match_full": ("full Career Match", "la correspondance carrière complète"),
        "career_saved_jobs": ("saved career jobs", "les emplois carrière sauvegardés"),
        "career_advanced_intelligence": (
            "advanced career intelligence",
            "l'analyse carrière avancée",
        ),
        "pdf_export": ("PDF export", "l’export PDF"),
        "client_workspace": ("the client workspace", "l’espace client"),
        "agent_workspace": ("the agent workspace", "l’espace agent"),
        "simulation_access": ("simulation tools", "les outils de simulation"),
        "citizenship_progress": (
            "citizenship progress tracking",
            "le suivi de progression citoyenneté",
        ),
        "citizenship_mock_exam": (
            "full citizenship mock exams",
            "les examens blancs complets de citoyenneté",
        ),
        "language_practice": (
            "language practice coaching",
            "la pratique linguistique guidée",
        ),
        "document_generator": ("the document generator", "le générateur de documents"),
        "document_generator_full": ("full document generation", "la génération complète de documents"),
        "document_docx_download": ("document downloads", "le téléchargement des documents"),
        "unlimited_document_generation": (
            "unlimited document generation",
            "la génération illimitée de documents",
        ),
        "forms_download": ("forms package download", "le téléchargement du dossier de formulaires"),
        "forms_ai_assistant": ("AI forms assistance", "l’assistance IA pour les formulaires"),
        "self_workspace": ("the self-service workspace", "l’espace personnel"),
    }

    en_label, fr_label = feature_labels.get(feature, (feature, feature))
    target_label = fr_label if lang == "fr" else en_label

    if lang == "fr":
        title = "Passez à une offre supérieure"
        reason = (
            f"Passez à Premium pour débloquer {target_label}."
            if minimum_plan == PREMIUM_PLAN
            else f"Passez à Pro pour débloquer {target_label}."
        )
        button = "Voir les tarifs"
    else:
        title = "Upgrade your plan"
        reason = (
            f"Upgrade to Premium to unlock {target_label}."
            if minimum_plan == PREMIUM_PLAN
            else f"Upgrade to Pro to unlock {target_label}."
        )
        button = "View pricing"

    return {
        "locked": True,
        "required_plan": minimum_plan,
        "upgrade_title": title,
        "upgrade_reason": reason,
        "upgrade_button_label": button,
        "pricing_route": "/pricing",
    }


def _raise_upgrade(
    *,
    feature: str,
    language: str,
    minimum_plan: str,
) -> None:
    payload = build_upgrade_payload(
        feature=feature,
        language=language,
        minimum_plan=minimum_plan,
    )
    raise HTTPException(status_code=403, detail=payload["upgrade_reason"])


# ---- manual callable guards ----

def ensure_individual_pro(
    user: Optional[User],
    *,
    feature: str = "advanced_ai_copilot",
    language: str = "en",
) -> None:
    if has_individual_pro(user):
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PRO_PLAN)


def ensure_premium(
    user: Optional[User],
    *,
    feature: str = "priority_ai",
    language: str = "en",
) -> None:
    if has_premium_access(user):
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PREMIUM_PLAN)


def ensure_agent_plan(
    user: Optional[User],
    *,
    feature: str = "agent_workspace",
    language: str = "en",
) -> None:
    if has_agent_plan(user):
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PREMIUM_PLAN)


def ensure_simulation_access(
    user: Optional[User],
    *,
    feature: str = "simulation_access",
    language: str = "en",
) -> None:
    if has_simulation_access(user):
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PRO_PLAN)


def ensure_forms_download(
    user: Optional[User],
    *,
    feature: str = "forms_download",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["forms_download"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PRO_PLAN)


def ensure_document_generator_full(
    user: Optional[User],
    *,
    feature: str = "document_generator_full",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["document_generator_full"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PRO_PLAN)


def ensure_document_review_full(
    user: Optional[User],
    *,
    feature: str = "document_review_full",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["document_review_full"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PRO_PLAN)


def ensure_pdf_export(
    user: Optional[User],
    *,
    feature: str = "pdf_export",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["pdf_export"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PREMIUM_PLAN)


def ensure_citizenship_progress(
    user: Optional[User],
    *,
    feature: str = "citizenship_progress",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["citizenship_progress"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PRO_PLAN)


def ensure_citizenship_mock_exam(
    user: Optional[User],
    *,
    feature: str = "citizenship_mock_exam",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["citizenship_mock_exam"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PREMIUM_PLAN)


def ensure_language_practice(
    user: Optional[User],
    *,
    feature: str = "language_practice",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["language_practice"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PREMIUM_PLAN)


def ensure_career_match_full(
    user: Optional[User],
    *,
    feature: str = "career_match_full",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["career_match_full"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PRO_PLAN)


def ensure_career_saved_jobs(
    user: Optional[User],
    *,
    feature: str = "career_saved_jobs",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["career_saved_jobs"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PRO_PLAN)


def ensure_career_advanced_intelligence(
    user: Optional[User],
    *,
    feature: str = "career_advanced_intelligence",
    language: str = "en",
) -> None:
    if get_feature_access_map(user)["career_advanced_intelligence"]:
        return
    _raise_upgrade(feature=feature, language=language, minimum_plan=PREMIUM_PLAN)


# ---- FastAPI dependency-safe guards ----

def require_individual_pro(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_individual_pro(current_user)
    return current_user


def require_premium(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_premium(current_user)
    return current_user


def require_agent_plan(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_agent_plan(current_user)
    return current_user


def require_simulation_access(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_simulation_access(current_user)
    return current_user


def require_forms_download(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_forms_download(current_user)
    return current_user


def require_document_generator_full(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_document_generator_full(current_user)
    return current_user


def require_document_review_full(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_document_review_full(current_user)
    return current_user


def require_pdf_export(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_pdf_export(current_user)
    return current_user


def require_citizenship_progress(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_citizenship_progress(current_user)
    return current_user


def require_citizenship_mock_exam(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_citizenship_mock_exam(current_user)
    return current_user


def require_language_practice(
    current_user: User = Depends(get_current_user),
) -> User:
    ensure_language_practice(current_user)
    return current_user


def build_access_response(
    *,
    user: Optional[User],
    language: str = "en",
) -> Dict[str, Any]:
    normalized_plan = get_user_plan(user)
    raw_plan = get_raw_user_plan(user)
    features = get_feature_access_map(user)

    return {
        "plan": normalized_plan,
        "raw_plan": raw_plan,
        "subscription_status": get_subscription_status(user),
        "is_free": normalized_plan == FREE_PLAN,
        "is_pro": has_individual_pro(user),
        "is_premium": has_premium_access(user),
        "is_agent": has_agent_plan(user),
        "features": features,

        # ---- flattened frontend helpers ----
        "can_view_basic_strategy": features["basic_strategy"],
        "can_view_full_strategy": features["full_strategy"],

        "can_preview_forms": features["forms_preview"],
        "can_download_forms": features["forms_download"],
        "can_use_forms_ai_assistant": features["forms_ai_assistant"],

        "can_preview_document_generator": features["document_generator_preview"],
        "can_generate_documents_full": features["document_generator_full"],
        "can_download_document_docx": features["document_docx_download"],

        "can_preview_document_review": features["document_review_preview"],
        "can_review_documents_full": features["document_review_full"],

        "can_use_basic_ai": features["basic_ai"],
        "can_use_advanced_ai": features["advanced_ai"],
        "can_use_priority_ai": features["priority_ai"],

        "can_export_pdf": features["pdf_export"],
        "can_use_live_ircc_draws": features["live_ircc_draws"],
        "can_view_processing_times": features["processing_time_tracker"],
        "can_use_job_opportunity_matching": features["job_opportunity_matching"],
        "can_use_official_finders": features["official_finders"],
        "can_preview_career_match": features["career_match_preview"],
        "can_use_full_career_match": features["career_match_full"],
        "can_save_career_jobs": features["career_saved_jobs"],
        "can_use_career_advanced_intelligence": features["career_advanced_intelligence"],
        "can_view_citizenship_study_guide": features["citizenship_study_guide"],
        "can_take_citizenship_practice_quiz": features["citizenship_practice_quiz"],
        "can_track_citizenship_progress": features["citizenship_progress"],
        "can_take_citizenship_mock_exam": features["citizenship_mock_exam"],
        "can_use_language_practice": features["language_practice"],
        "can_access_self_workspace": features["self_workspace"],
        "can_access_simulations": features["simulation_access"],

        "pricing_route": "/pricing",
        "language": "fr" if (language or "").strip().lower() == "fr" else "en",
    }
