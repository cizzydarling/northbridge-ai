from typing import Any


def normalize_language(language: str | None) -> str:
    lang = (language or "en").strip().lower()
    return "fr" if lang == "fr" else "en"


def t(en: str, fr: str, language: str) -> str:
    return fr if language == "fr" else en


def _dedupe_keep_order(items: list[str]) -> list[str]:
    seen = set()
    output: list[str] = []

    for item in items:
        normalized = str(item or "").strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        output.append(str(item).strip())

    return output


def _coerce_readiness_bucket(value: str | None) -> str:
    normalized = (value or "").strip().lower()

    if normalized in {"strong", "fort"}:
        return "strong"
    if normalized in {"moderate", "modéré", "modere"}:
        return "moderate"
    return "weak"


def _build_priority_label(
    *,
    language: str,
    french_advantage: dict[str, Any] | None,
    readiness_bucket: str,
    missing_fields_count: int,
    remaining_required_documents: int,
) -> str:
    french_value = (french_advantage or {}).get("strategic_value", "low")

    if french_value == "high":
        return t("French priority", "Priorité francophone", language)

    if remaining_required_documents > 0:
        return t("Document preparation", "Préparation documentaire", language)

    if missing_fields_count > 0:
        return t("Form completion", "Complétion des formulaires", language)

    if readiness_bucket == "weak":
        return t("Case strengthening", "Renforcement du dossier", language)

    if readiness_bucket == "moderate":
        return t("Strategy refinement", "Affinage de la stratégie", language)

    return t("Ready to advance", "Prêt à avancer", language)


def _build_priority_reason(
    *,
    language: str,
    french_advantage: dict[str, Any] | None,
    readiness_bucket: str,
    missing_fields_count: int,
    remaining_required_documents: int,
) -> str:
    french_value = (french_advantage or {}).get("strategic_value", "low")

    if french_value == "high":
        return t(
            "French-speaking or bilingual pathways appear strategically important for this profile and should be reviewed first.",
            "Les voies francophones ou bilingues semblent stratégiquement importantes pour ce profil et devraient être examinées en premier.",
            language,
        )

    if remaining_required_documents > 0:
        return t(
            "Required documents are still missing, so document readiness should be stabilized before moving further.",
            "Des documents obligatoires sont encore manquants, donc la préparation documentaire devrait être stabilisée avant d’aller plus loin.",
            language,
        )

    if missing_fields_count > 0:
        return t(
            "Important form details are still missing, so the file should be clarified before stronger recommendations are relied on.",
            "Des renseignements importants manquent encore dans les formulaires, donc le dossier devrait être clarifié avant de se fier à des recommandations plus avancées.",
            language,
        )

    if readiness_bucket == "weak":
        return t(
            "The file still needs meaningful strengthening before it appears well-positioned.",
            "Le dossier nécessite encore un renforcement important avant de paraître bien positionné.",
            language,
        )

    if readiness_bucket == "moderate":
        return t(
            "The file has a workable base, but a few targeted improvements could materially strengthen the strategy.",
            "Le dossier repose sur une base utilisable, mais quelques améliorations ciblées pourraient renforcer concrètement la stratégie.",
            language,
        )

    return t(
        "The file appears organized enough to move into a more focused execution phase.",
        "Le dossier semble suffisamment structuré pour passer à une phase d’exécution plus ciblée.",
        language,
    )


def _build_primary_recommendation(
    *,
    language: str,
    french_advantage: dict[str, Any] | None,
    eligibility: dict[str, Any] | None,
    forms_assistant: dict[str, Any] | None,
    strategy: dict[str, Any] | None,
    remaining_required_documents: int,
) -> str:
    french_value = (french_advantage or {}).get("strategic_value", "low")
    eligibility_next_steps = list((eligibility or {}).get("next_steps") or [])
    missing_fields = list((forms_assistant or {}).get("missing_fields") or [])
    strategy_next_steps = list((strategy or {}).get("next_steps") or [])

    if french_value == "high":
        return t(
            "Review francophone and bilingual pathways before defaulting to general options.",
            "Examinez les voies francophones et bilingues avant de vous limiter aux options générales.",
            language,
        )

    if remaining_required_documents > 0:
        return t(
            "Complete the remaining required documents before moving into a more advanced filing phase.",
            "Complétez les documents obligatoires restants avant de passer à une phase de préparation plus avancée.",
            language,
        )

    if missing_fields:
        return t(
            "Complete the missing form information so the file becomes more stable and reviewable.",
            "Complétez les renseignements manquants dans les formulaires afin que le dossier soit plus stable et plus facile à réviser.",
            language,
        )

    if eligibility_next_steps:
        return str(eligibility_next_steps[0])

    if strategy_next_steps:
        return str(strategy_next_steps[0])

    return t(
        "Review your strategy and confirm the strongest next action before proceeding.",
        "Examinez votre stratégie et confirmez la meilleure prochaine action avant de continuer.",
        language,
    )


def build_user_decision_context(
    *,
    strategy: dict[str, Any] | None = None,
    eligibility: dict[str, Any] | None = None,
    forms_assistant: dict[str, Any] | None = None,
    checklist: list[dict[str, Any]] | None = None,
    language: str = "en",
) -> dict[str, Any]:
    language = normalize_language(language)

    strategy = strategy or {}
    eligibility = eligibility or {}
    forms_assistant = forms_assistant or {}
    checklist = checklist or []

    french_advantage = strategy.get("french_advantage") or {}
    readiness = eligibility.get("readiness")
    readiness_bucket = _coerce_readiness_bucket(readiness)

    missing_fields = list(forms_assistant.get("missing_fields") or [])
    missing_fields_count = len(missing_fields)

    remaining_required_documents = 0
    for item in checklist:
        status = str(item.get("status") or "").strip().lower()
        if status == "required":
            remaining_required_documents += 1

    priority_label = _build_priority_label(
        language=language,
        french_advantage=french_advantage,
        readiness_bucket=readiness_bucket,
        missing_fields_count=missing_fields_count,
        remaining_required_documents=remaining_required_documents,
    )

    priority_reason = _build_priority_reason(
        language=language,
        french_advantage=french_advantage,
        readiness_bucket=readiness_bucket,
        missing_fields_count=missing_fields_count,
        remaining_required_documents=remaining_required_documents,
    )

    primary_recommendation = _build_primary_recommendation(
        language=language,
        french_advantage=french_advantage,
        eligibility=eligibility,
        forms_assistant=forms_assistant,
        strategy=strategy,
        remaining_required_documents=remaining_required_documents,
    )

    recommended_actions: list[str] = []

    if french_advantage.get("strategic_value") in {"medium", "high"}:
        french_recommendations = list(french_advantage.get("recommendations") or [])
        recommended_actions.extend(french_recommendations[:2])

    recommended_actions.extend(list(eligibility.get("next_steps") or [])[:2])

    if missing_fields_count > 0:
        recommended_actions.append(
            t(
                "Complete the missing form information before moving forward.",
                "Complétez les renseignements manquants dans les formulaires avant d’aller plus loin.",
                language,
            )
        )

    if remaining_required_documents > 0:
        recommended_actions.append(
            t(
                "Organize and complete the required documents still missing from the checklist.",
                "Organisez et complétez les documents obligatoires encore manquants dans la liste de contrôle.",
                language,
            )
        )

    recommended_actions.extend(list(strategy.get("next_steps") or [])[:2])

    recommended_actions = _dedupe_keep_order(recommended_actions)[:5]

    top_pathways = _dedupe_keep_order(list(strategy.get("recommended_programs") or []))[:5]

    confidence_label = {
        "strong": t("High", "Élevée", language),
        "moderate": t("Moderate", "Modérée", language),
        "weak": t("Low", "Faible", language),
    }[readiness_bucket]

    return {
        "priority_label": priority_label,
        "priority_reason": priority_reason,
        "primary_recommendation": primary_recommendation,
        "recommended_actions": recommended_actions,
        "top_pathways": top_pathways,
        "readiness": readiness,
        "confidence_label": confidence_label,
        "french_advantage": french_advantage,
        "missing_fields_count": missing_fields_count,
        "remaining_required_documents": remaining_required_documents,
    }