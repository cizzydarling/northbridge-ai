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
    if value is None:
        return None

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return model_dump()

    return value


def _serialize_chat_history(chat_history: Optional[List[Any]]) -> List[Dict[str, Any]]:
    output: List[Dict[str, Any]] = []

    for item in chat_history or []:
        if isinstance(item, dict):
            output.append(item)
            continue

        dumped = _safe_model_dump(item)
        if isinstance(dumped, dict):
            output.append(dumped)

    return output


def _resolve_ai_plan(current_user: User) -> str:
    plan_value = (getattr(current_user, "plan", None) or "").strip().lower()

    if plan_value == "premium":
        return "premium"

    if has_individual_pro(current_user):
        return "pro"

    return "free"


def _build_profile_snapshot(profile: Optional[Profile]) -> Dict[str, Any]:
    if not profile:
        return {}

    return {
        "age": profile.age,
        "education": profile.education,
        "language_score": profile.language_score,
        "experience_years": profile.experience_years,
        "has_job_offer": profile.has_job_offer,
        "has_canadian_experience": profile.has_canadian_experience,
        "studied_in_canada": profile.studied_in_canada,
        "occupation": profile.occupation,
        "noc_code": profile.noc_code,
        "preferred_province": profile.preferred_province,
        "nationality": profile.nationality,
        "current_country": profile.current_country,
        "marital_status": profile.marital_status,
        "preferred_language": profile.preferred_language,
    }


def _build_application_snapshot(application: Optional[SelfApplication]) -> Dict[str, Any]:
    if not application:
        return {}

    return {
        "matter_type": application.matter_type,
        "intake_payload": application.intake_payload or {},
        "eligibility_result": application.eligibility_result or {},
        "forms_result": application.forms_result or {},
        "checklist_result": application.checklist_result or [],
    }


def build_user_context(
    *,
    profile: Optional[Profile] = None,
    strategy: Optional[Dict[str, Any]] = None,
    application: Optional[SelfApplication] = None,
    decision: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    application_snapshot = _build_application_snapshot(application)
    forms_result = application_snapshot.get("forms_result") or {}

    return {
        "profile": _build_profile_snapshot(profile),
        "strategy": strategy or {},
        "decision": decision or {},
        "application": {
            "matter_type": application_snapshot.get("matter_type"),
            "checklist": application_snapshot.get("checklist_result", []),
            "missing_fields": forms_result.get("missing_fields", []) or [],
            "recommended_forms": forms_result.get("recommended_forms", []) or [],
            "intake_payload": application_snapshot.get("intake_payload", {}) or {},
        },
    }


def _extract_actions(text: str, language: str) -> List[Dict[str, Any]]:
    language = _normalize_language(language)
    lines = [line.strip(" -•\t") for line in (text or "").splitlines()]
    candidates: List[str] = []

    for line in lines:
        if not line:
            continue

        lowered = line.lower()
        if lowered.startswith(("1.", "2.", "3.", "4.", "5.")):
            candidates.append(line)
            continue

        triggers = (
            ["should", "next", "prepare", "review", "update", "complete", "gather"]
            if language == "en"
            else ["devriez", "prochaine", "préparer", "réviser", "mettre", "compléter", "rassembler"]
        )
        if any(trigger in lowered for trigger in triggers):
            candidates.append(line)

    output: List[Dict[str, Any]] = []
    for item in candidates[:3]:
        output.append({"label": item, "route": None})

    return output


def _extract_insights(text: str) -> List[str]:
    if not text:
        return []

    sentences = [segment.strip() for segment in text.replace("\n", " ").split(".")]
    insights = [s for s in sentences if len(s) >= 40]

    seen: set[str] = set()
    output: List[str] = []
    for item in insights:
        if item not in seen:
            seen.add(item)
            output.append(item + ".")
        if len(output) >= 3:
            break

    return output


def _extract_risks(text: str, language: str) -> List[str]:
    if not text:
        return []

    tokens = (
        ["risk", "weak", "concern", "issue", "blocker", "gap"]
        if _normalize_language(language) == "en"
        else ["risque", "faible", "préoccupation", "problème", "blocage", "écart"]
    )

    sentences = [segment.strip() for segment in text.replace("\n", " ").split(".")]
    output: List[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(token in lowered for token in tokens) and len(sentence) >= 20:
            output.append(sentence + ".")
        if len(output) >= 3:
            break

    return output


def _extract_optimizations(text: str, language: str) -> List[str]:
    if not text:
        return []

    tokens = (
        ["improve", "increase", "strengthen", "optimize", "better", "enhance"]
        if _normalize_language(language) == "en"
        else ["amélior", "augment", "renfor", "optim", "mieux"]
    )

    sentences = [segment.strip() for segment in text.replace("\n", " ").split(".")]
    output: List[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(token in lowered for token in tokens) and len(sentence) >= 20:
            output.append(sentence + ".")
        if len(output) >= 3:
            break

    return output


def _build_free_upgrade_payload(language: str) -> Dict[str, Any]:
    return {
        "locked": True,
        "plan": "free",
        "upgrade_reason": _t(
            "Upgrade to Pro to unlock deeper AI guidance, stronger next steps, and more tailored recommendations.",
            "Passez à Pro pour débloquer une guidance IA plus approfondie, de meilleures prochaines étapes et des recommandations plus personnalisées.",
            language,
        ),
        "upgrade_title": _t(
            "Unlock deeper AI guidance",
            "Débloquez une guidance IA plus approfondie",
            language,
        ),
        "pricing_route": "/pricing",
    }


def _inject_monetization_actions(
    *,
    plan: str,
    language: str,
    actions: List[Dict[str, Any]],
    reply: str,
    strategy: Optional[Dict[str, Any]] = None,
    application: Optional[SelfApplication] = None,
) -> List[Dict[str, Any]]:
    normalized_actions = actions[:]

    if plan != "free":
        return normalized_actions[:3]

    strategy = strategy or {}
    recommended_programs = strategy.get("recommended_programs") or []
    next_steps = strategy.get("next_steps") or []
    matter_type = getattr(application, "matter_type", None) if application else None

    if not normalized_actions:
        normalized_actions.append(
            {
                "label": _t("View pricing", "Voir les tarifs", language),
                "route": "/pricing",
            }
        )

    if matter_type or next_steps:
        normalized_actions.insert(
            0,
            {
                "label": _t("Open my documents", "Ouvrir mes documents", language),
                "route": "/documents",
            },
        )

    if recommended_programs:
        normalized_actions.insert(
            0,
            {
                "label": _t("Open my strategy", "Ouvrir ma stratégie", language),
                "route": "/strategy",
            },
        )

    deduped: List[Dict[str, Any]] = []
    seen = set()
    for item in normalized_actions:
        label = str(item.get("label", "")).strip()
        route = str(item.get("route", "")).strip()
        key = (label, route)
        if not label or key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    if not any(item.get("route") == "/pricing" for item in deduped):
        deduped.append(
            {
                "label": _t("Unlock more", "Débloquer plus", language),
                "route": "/pricing",
            }
        )

    return deduped[:3]


def format_ai_response(
    *,
    raw_text: str,
    language: str,
    plan: str,
    strategy: Optional[Dict[str, Any]] = None,
    application: Optional[SelfApplication] = None,
    suggested_next_actions: Optional[List[Any]] = None,
    insights: Optional[List[str]] = None,
) -> Dict[str, Any]:
    language = _normalize_language(language)
    clean_text = (raw_text or "").strip()

    provided_actions = suggested_next_actions or []
    normalized_actions: List[Dict[str, Any]] = []

    for item in provided_actions:
        if isinstance(item, dict):
            normalized_actions.append(
                {
                    "label": item.get("label") or item.get("text") or "",
                    "route": item.get("route"),
                }
            )
        elif isinstance(item, str) and item.strip():
            normalized_actions.append({"label": item.strip(), "route": None})

    if not normalized_actions:
        normalized_actions = _extract_actions(clean_text, language)

    derived_insights = insights or _extract_insights(clean_text)

    if plan == "free":
        max_length = 420
        preview = clean_text[:max_length].rstrip()
        if clean_text and len(clean_text) > max_length:
            preview += "..."

        free_upgrade = _build_free_upgrade_payload(language)
        free_actions = _inject_monetization_actions(
            plan=plan,
            language=language,
            actions=normalized_actions,
            reply=preview,
            strategy=strategy,
            application=application,
        )

        return {
            "reply": preview,
            "suggested_next_actions": free_actions,
            "insights": derived_insights[:2],
            **free_upgrade,
        }

    if plan == "premium":
        return {
            "reply": clean_text,
            "suggested_next_actions": normalized_actions[:3],
            "insights": derived_insights[:3],
            "risk_analysis": _extract_risks(clean_text, language),
            "optimization_tips": _extract_optimizations(clean_text, language),
            "locked": False,
            "plan": "premium",
        }

    return {
        "reply": clean_text,
        "suggested_next_actions": normalized_actions[:3],
        "insights": derived_insights[:3],
        "locked": False,
        "plan": "pro",
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
    language = _normalize_language(language)

    profile = get_self_profile(db, current_user.id)
    application = get_latest_self_application(db, current_user.id)
    ai_plan = _resolve_ai_plan(current_user)
    is_premium = ai_plan in {"pro", "premium"}

    strategy = build_strategy(profile, language=language) if profile else None

    decision = build_user_decision_context(
        strategy=strategy,
        eligibility=(application.eligibility_result if application else None),
        forms_assistant=(application.forms_result if application else None),
        checklist=(application.checklist_result if application else None),
        language=language,
    )

    ai_context = build_user_context(
        profile=profile,
        strategy=strategy,
        application=application,
        decision=decision,
    )

    return {
        "user": current_user,
        "language": language,
        "ai_plan": ai_plan,
        "is_premium": is_premium,
        "profile": profile,
        "application": application,
        "strategy": strategy,
        "decision": decision,
        "ai_context": ai_context,
        "profile_found": bool(profile),
        "application_found": bool(application),
        "strategy_loaded": bool(strategy),
    }


def build_self_user_summary_cards(context: Dict[str, Any]) -> Dict[str, Any]:
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
        status = "Premium actif" if is_premium else "Version gratuite active"
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


def _coerce_ai_result(result: Any, language: str) -> Dict[str, Any]:
    if not isinstance(result, dict):
        return {
            "reply": _t(
                "Here is a personalized analysis based on your current immigration profile.",
                "Voici une analyse personnalisée basée sur votre profil actuel.",
                language,
            ),
            "suggested_next_actions": [],
            "insights": [],
        }

    coerced = {
        "reply": (result.get("reply") or "").strip(),
        "suggested_next_actions": result.get("suggested_next_actions", []) or [],
        "insights": result.get("insights", []) or [],
    }

    if not coerced["reply"]:
      coerced["reply"] = _t(
            "Here is a personalized analysis based on your current immigration profile.",
            "Voici une analyse personnalisée basée sur votre profil actuel.",
            language,
        )

    return coerced


def _build_contextual_fallback_reply(
    *,
    language: str,
    strategy: Optional[Dict[str, Any]] = None,
    application: Optional[SelfApplication] = None,
) -> str:
    strategy = strategy or {}
    recommended_programs = strategy.get("recommended_programs") or []
    next_steps = strategy.get("next_steps") or []
    top_program = recommended_programs[0] if recommended_programs else None
    top_step = next_steps[0] if next_steps else None
    matter_type = getattr(application, "matter_type", None) if application else None

    if language == "fr":
        parts = [
            "Voici une analyse personnalisée basée sur votre profil actuel."
        ]
        if top_program:
            parts.append(f"Votre meilleur parcours semble être : {top_program}.")
        if top_step:
            parts.append(f"Votre prochaine priorité semble être : {top_step}.")
        if matter_type:
            parts.append(f"Votre type de dossier actuel est : {matter_type}.")
        parts.append(
            "Concentrez-vous sur l’amélioration de votre profil, de vos documents prioritaires et de vos éléments les plus stratégiques."
        )
        return " ".join(parts)

    parts = [
        "Here is a personalized analysis based on your current profile."
    ]
    if top_program:
        parts.append(f"Your strongest pathway appears to be: {top_program}.")
    if top_step:
        parts.append(f"Your top current priority appears to be: {top_step}.")
    if matter_type:
        parts.append(f"Your current matter type is: {matter_type}.")
    parts.append(
        "Focus on improving your profile quality, your priority documents, and the strongest factors influencing your case."
    )
    return " ".join(parts)


def _build_contextual_fallback_actions(
    *,
    language: str,
    plan: str,
    strategy: Optional[Dict[str, Any]] = None,
    application: Optional[SelfApplication] = None,
) -> List[Dict[str, Any]]:
    strategy = strategy or {}
    application_exists = application is not None
    has_strategy = bool(strategy)

    actions: List[Dict[str, Any]] = []

    if has_strategy:
        actions.append(
            {
                "label": _t("Open my strategy", "Ouvrir ma stratégie", language),
                "route": "/strategy",
            }
        )

    if application_exists or has_strategy:
        actions.append(
            {
                "label": _t("Open my documents", "Ouvrir mes documents", language),
                "route": "/documents",
            }
        )

    actions.append(
        {
            "label": _t("Improve my profile", "Améliorer mon profil", language),
            "route": "/profile",
        }
    )

    if plan == "free":
        actions.append(
            {
                "label": _t("View pricing", "Voir les tarifs", language),
                "route": "/pricing",
            }
        )

    deduped: List[Dict[str, Any]] = []
    seen = set()
    for item in actions:
        key = (item.get("label"), item.get("route"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped[:3]


def _build_contextual_fallback_insights(
    *,
    language: str,
    strategy: Optional[Dict[str, Any]] = None,
) -> List[str]:
    strategy = strategy or {}
    crs_score = strategy.get("crs_score")
    next_steps = strategy.get("next_steps") or []
    recommended_programs = strategy.get("recommended_programs") or []

    insights: List[str] = []

    if crs_score is not None:
        insights.append(
            _t(
                f"Your current CRS score is approximately {crs_score}.",
                f"Votre score CRS actuel est d’environ {crs_score}.",
                language,
            )
        )

    if recommended_programs:
        insights.append(
            _t(
                f"Your strongest current pathway appears to be {recommended_programs[0]}.",
                f"Votre meilleur parcours actuel semble être {recommended_programs[0]}.",
                language,
            )
        )

    if next_steps:
        insights.append(
            _t(
                f"One of your highest-value next steps is {next_steps[0]}.",
                f"L’une de vos prochaines étapes à plus forte valeur est {next_steps[0]}.",
                language,
            )
        )

    if not insights:
        insights.append(
            _t(
                "Your current profile still has optimization potential.",
                "Votre profil actuel présente encore un potentiel d’optimisation.",
                language,
            )
        )
        insights.append(
            _t(
                "Improving your language score and file quality can meaningfully strengthen your position.",
                "L’amélioration du score linguistique et de la qualité du dossier peut renforcer sensiblement votre position.",
                language,
            )
        )

    return insights[:3]


def ask_self_user_copilot(
    *,
    db: Session,
    current_user: User,
    message: str,
    language: str = "en",
    chat_history: Optional[List[Any]] = None,
    fail_silently: bool = False,
) -> Dict[str, Any]:
    language = _normalize_language(language)
    context = build_self_user_ai_context(
        db=db,
        current_user=current_user,
        language=language,
    )

    fn = getattr(ai_advisor, "generate_ai_chat_reply", None)
    if not callable(fn):
        fallback = format_ai_response(
            raw_text=_build_contextual_fallback_reply(
                language=language,
                strategy=context.get("strategy") or {},
                application=context.get("application"),
            ),
            language=language,
            plan=context["ai_plan"],
            strategy=context.get("strategy") or {},
            application=context.get("application"),
            suggested_next_actions=_build_contextual_fallback_actions(
                language=language,
                plan=context["ai_plan"],
                strategy=context.get("strategy") or {},
                application=context.get("application"),
            ),
            insights=_build_contextual_fallback_insights(
                language=language,
                strategy=context.get("strategy") or {},
            ),
        )

        if fail_silently:
            return {
                **fallback,
                "profile_found": context["profile_found"],
                "strategy_loaded": context["strategy_loaded"],
                "application_found": context["application_found"],
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
                "decision": context.get("decision") or {},
                "matter_type": (
                    getattr(context.get("application"), "matter_type", None)
                    if context.get("application")
                    else None
                ),
            }
        raise RuntimeError("generate_ai_chat_reply not found in ai_advisor")

    try:
        ai_context = context.get("ai_context") or {}
        strategy = context.get("strategy") or {}
        application = context.get("application")
        decision = context.get("decision") or {}
        plan = context.get("ai_plan", "free")

        result = fn(
            message=(message or "").strip(),
            language=language,
            profile=context["profile"],
            strategy=strategy,
            chat_history=_serialize_chat_history(chat_history),
            application_context=ai_context.get("application", {}),
            decision_context=decision,
            plan=plan,
        )

        result = _coerce_ai_result(result, language)

        raw_reply = (result.get("reply") or "").strip()

        formatted = format_ai_response(
            raw_text=raw_reply,
            language=language,
            plan=plan,
            strategy=strategy,
            application=application,
            suggested_next_actions=result.get("suggested_next_actions", []),
            insights=result.get("insights", []),
        )

        return {
            **formatted,
            "reply": raw_reply or formatted.get("reply", ""),
            "profile_found": context["profile_found"],
            "strategy_loaded": context["strategy_loaded"],
            "application_found": context["application_found"],
            "language": language,
            "pathways": strategy.get("recommended_programs", []) if strategy else [],
            "french_advantage": strategy.get("french_advantage", {}) if strategy else {},
            "decision": decision,
            "matter_type": getattr(application, "matter_type", None) if application else None,
        }

    except Exception:
        if not fail_silently:
            raise

        fallback = format_ai_response(
            raw_text=_build_contextual_fallback_reply(
                language=language,
                strategy=context.get("strategy") or {},
                application=context.get("application"),
            ),
            language=language,
            plan=context["ai_plan"],
            strategy=context.get("strategy") or {},
            application=context.get("application"),
            suggested_next_actions=_build_contextual_fallback_actions(
                language=language,
                plan=context["ai_plan"],
                strategy=context.get("strategy") or {},
                application=context.get("application"),
            ),
            insights=_build_contextual_fallback_insights(
                language=language,
                strategy=context.get("strategy") or {},
            ),
        )

        return {
            **fallback,
            "profile_found": context["profile_found"],
            "strategy_loaded": context["strategy_loaded"],
            "application_found": context["application_found"],
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
            "decision": context.get("decision") or {},
            "matter_type": (
                getattr(context.get("application"), "matter_type", None)
                if context.get("application")
                else None
            ),
        }


def build_dashboard_copilot_prompt(context: Dict[str, Any]) -> str:
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
            "et propose 3 actions concrètes et courtes. "
            "Retourne la réponse dans cette structure: "
            "une explication claire en 2 à 4 phrases, "
            "3 suggested_next_actions courtes, "
            "et 2 ou 3 insights utiles. "
            "N’utilise pas de markdown ni de formatage supplémentaire."
        )

    return (
        "Act as an immigration copilot for an individual user. "
        f"Current CRS score: {crs_score}. "
        f"Current best-fit program: {top_program}. "
        f"Top next priority: {next_priority}. "
        f"Recommended programs: {', '.join(programs) if programs else 'none'}. "
        "Explain the situation simply, identify the biggest blocker, "
        "and provide 3 short concrete next actions. "
        "Return the answer in this structure: "
        "one clear explanation in 2 to 4 sentences, "
        "3 short suggested_next_actions, "
        "and 2 to 3 helpful insights. "
        "Do not use markdown or extra formatting."
    )


def build_strategy_copilot_prompt(context: Dict[str, Any]) -> str:
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
            "et retourne aussi 3 suggested_next_actions très courtes. "
            "Retourne la réponse dans cette structure: "
            "une explication claire en 2 à 4 phrases, "
            "3 suggested_next_actions courtes, "
            "et 2 ou 3 insights utiles. "
            "N’utilise pas de markdown ni de formatage supplémentaire."
        )

    return (
        "Explain the user's current strategy in simple language. "
        f"French strategic value: {strategic_value}. "
        f"Next steps: {', '.join(next_steps) if next_steps else 'none'}. "
        f"Roadmap: {', '.join(roadmap_titles) if roadmap_titles else 'none'}. "
        "Summarize the logic behind the strategy, explain why certain pathways are prioritized, "
        "and also return 3 very short suggested_next_actions. "
        "Return the answer in this structure: "
        "one clear explanation in 2 to 4 sentences, "
        "3 short suggested_next_actions, "
        "and 2 to 3 helpful insights. "
        "Do not use markdown or extra formatting."
    )


def build_documents_copilot_prompt(context: Dict[str, Any]) -> str:
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
            "ce qui manque potentiellement, et propose des prochaines étapes claires. "
            "Retourne la réponse dans cette structure: "
            "une explication claire en 2 à 4 phrases, "
            "3 suggested_next_actions courtes, "
            "et 2 ou 3 insights utiles. "
            "N’utilise pas de markdown ni de formatage supplémentaire."
        )

    return (
        "Act as a document-preparation copilot for an individual user. "
        f"Matter type: {matter_type or 'not specified'}. "
        f"Top suggested program: {top_program or 'not determined'}. "
        f"Decision context available: {'yes' if decision else 'no'}. "
        "Explain which documents seem most important, "
        "what may be missing, and provide clear next steps. "
        "Return the answer in this structure: "
        "one clear explanation in 2 to 4 sentences, "
        "3 short suggested_next_actions, "
        "and 2 to 3 helpful insights. "
        "Do not use markdown or extra formatting."
    )


def build_self_user_access_payload(
    *,
    current_user: User,
    language: str = "en",
    locked: bool = False,
    upgrade_reason: Optional[str] = None,
) -> Dict[str, Any]:
    language = _normalize_language(language)
    ai_plan = _resolve_ai_plan(current_user)
    is_premium = ai_plan in {"pro", "premium"}

    reason = upgrade_reason
    if locked and not reason:
        reason = _t(
            "Upgrade to Pro to unlock this AI feature.",
            "Passez à Pro pour débloquer cette fonctionnalité IA.",
            language,
        )

    return {
        "access": {
            "is_premium": is_premium,
            "ai_plan": ai_plan,
            "locked": bool(locked),
            "upgrade_reason": reason,
        }
    }