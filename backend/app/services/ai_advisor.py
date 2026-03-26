import os
import json
from typing import List, Optional, Dict, Any

from openai import OpenAI


_client: Optional[OpenAI] = None


def get_openai_client() -> Optional[OpenAI]:
    global _client

    if _client is not None:
        return _client

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    _client = OpenAI(api_key=api_key)
    return _client


def _normalize_language(language: str) -> str:
    return "fr" if (language or "").strip().lower() == "fr" else "en"


def _language_label(language: str) -> str:
    return "French" if _normalize_language(language) == "fr" else "English"


def _safe_text(value, fallback: str = "Not provided") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _safe_bool_label(value: bool, language: str = "en") -> str:
    language = _normalize_language(language)
    if language == "fr":
        return "Oui" if value else "Non"
    return "Yes" if value else "No"


def _safe_get_profile_value(profile, field_name: str, fallback=None):
    if profile is None:
        return fallback
    if isinstance(profile, dict):
        return profile.get(field_name, fallback)
    return getattr(profile, field_name, fallback)


def _format_list(
    items,
    language: str = "en",
    fallback_en: str = "None",
    fallback_fr: str = "Aucun",
):
    language = _normalize_language(language)
    if not items:
        return fallback_fr if language == "fr" else fallback_en
    cleaned = [str(item).strip() for item in items if item is not None and str(item).strip()]
    if not cleaned:
        return fallback_fr if language == "fr" else fallback_en
    return ", ".join(cleaned)


def _format_bullets(
    items,
    language: str = "en",
    fallback_en: str = "- None available",
    fallback_fr: str = "- Aucun élément disponible",
) -> str:
    language = _normalize_language(language)
    if not items:
        return fallback_fr if language == "fr" else fallback_en

    cleaned = [str(item).strip() for item in items if item is not None and str(item).strip()]
    if not cleaned:
        return fallback_fr if language == "fr" else fallback_en

    return "\n".join(f"- {item}" for item in cleaned)


def _strategic_value_label(value: str, language: str = "en") -> str:
    language = _normalize_language(language)
    value = (value or "").strip().lower()

    if language == "fr":
        if value == "high":
            return "Élevée"
        if value == "medium":
            return "Moyenne"
        return "Faible"

    if value == "high":
        return "High"
    if value == "medium":
        return "Medium"
    return "Low"


def _build_profile_context(profile, language: str = "en") -> str:
    language = _normalize_language(language)

    age = _safe_get_profile_value(profile, "age", "Not provided")
    education = _safe_get_profile_value(profile, "education", None)
    language_score = _safe_get_profile_value(profile, "language_score", "Not provided")
    experience_years = _safe_get_profile_value(profile, "experience_years", "Not provided")
    has_job_offer = bool(_safe_get_profile_value(profile, "has_job_offer", False))
    has_canadian_experience = bool(
        _safe_get_profile_value(profile, "has_canadian_experience", False)
    )
    studied_in_canada = bool(_safe_get_profile_value(profile, "studied_in_canada", False))
    occupation = _safe_get_profile_value(profile, "occupation", None)
    noc_code = _safe_get_profile_value(profile, "noc_code", None)
    preferred_province = _safe_get_profile_value(profile, "preferred_province", None)

    if language == "fr":
        return f"""
Profil utilisateur :
- Âge : {age}
- Études : {_safe_text(education, "Non précisé")}
- Score linguistique : {language_score}
- Années d’expérience : {experience_years}
- Offre d’emploi : {_safe_bool_label(has_job_offer, language)}
- Expérience canadienne : {_safe_bool_label(has_canadian_experience, language)}
- Études au Canada : {_safe_bool_label(studied_in_canada, language)}
- Profession : {_safe_text(occupation, "Non précisé")}
- Code CNP : {_safe_text(noc_code, "Non précisé")}
- Province privilégiée : {_safe_text(preferred_province, "Non précisé")}
""".strip()

    return f"""
User profile:
- Age: {age}
- Education: {_safe_text(education)}
- Language score: {language_score}
- Experience years: {experience_years}
- Has job offer: {_safe_bool_label(has_job_offer, language)}
- Has Canadian experience: {_safe_bool_label(has_canadian_experience, language)}
- Studied in Canada: {_safe_bool_label(studied_in_canada, language)}
- Occupation: {_safe_text(occupation)}
- NOC code: {_safe_text(noc_code)}
- Preferred province: {_safe_text(preferred_province)}
""".strip()


def _build_strategy_context(strategy_data: dict, language: str = "en") -> str:
    language = _normalize_language(language)

    recommended_programs = strategy_data.get("recommended_programs", [])
    strengths = strategy_data.get("strengths", [])
    weaknesses = strategy_data.get("weaknesses", [])
    next_steps = strategy_data.get("next_steps", [])
    roadmap = strategy_data.get("roadmap", [])
    advisor_summary = strategy_data.get("advisor_summary")
    crs_score = strategy_data.get("crs_score")
    french_advantage = strategy_data.get("french_advantage") or {}
    french_signals = french_advantage.get("signals") or []
    french_recommendations = french_advantage.get("recommendations") or []
    french_value = _strategic_value_label(
        french_advantage.get("strategic_value", "low"),
        language,
    )

    roadmap_lines = []
    for step in roadmap[:5]:
        title = step.get("title", "")
        reason = step.get("reason", "")
        if title:
            if reason:
                roadmap_lines.append(f"- {title}: {reason}")
            else:
                roadmap_lines.append(f"- {title}")

    if language == "fr":
        return f"""
Contexte stratégique :
- Score CRS : {crs_score if crs_score is not None else "Non disponible"}
- Programmes recommandés : {_format_list(recommended_programs, language)}
- Forces : {_format_list(strengths, language)}
- Faiblesses : {_format_list(weaknesses, language)}
- Prochaines étapes : {_format_list(next_steps, language)}
- Résumé conseiller : {_safe_text(advisor_summary, "Non disponible")}
- Valeur stratégique francophone : {french_value}
- Signaux francophones : {_format_list(french_signals, language)}
- Recommandations francophones : {_format_list(french_recommendations, language)}

Feuille de route principale :
{chr(10).join(roadmap_lines) if roadmap_lines else "- Aucune feuille de route disponible"}
""".strip()

    return f"""
Strategy context:
- CRS score: {crs_score if crs_score is not None else "Not available"}
- Recommended programs: {_format_list(recommended_programs, language)}
- Strengths: {_format_list(strengths, language)}
- Weaknesses: {_format_list(weaknesses, language)}
- Next steps: {_format_list(next_steps, language)}
- Advisor summary: {_safe_text(advisor_summary, "Not available")}
- Francophone strategic value: {french_value}
- Francophone signals: {_format_list(french_signals, language)}
- Francophone recommendations: {_format_list(french_recommendations, language)}

Top roadmap items:
{chr(10).join(roadmap_lines) if roadmap_lines else "- No roadmap available"}
""".strip()


def _build_journey_context(journey_data: Optional[dict], language: str = "en") -> str:
    language = _normalize_language(language)

    if not journey_data:
        if language == "fr":
            return """
Contexte de parcours :
- Aucune donnée de parcours disponible
""".strip()

        return """
Journey context:
- No journey data available
""".strip()

    documents = journey_data.get("documents", {})
    readiness = journey_data.get("readiness", {})
    recommended_programs = journey_data.get("recommended_programs", [])
    strategy_next_steps = journey_data.get("strategy_next_steps", [])

    if language == "fr":
        return f"""
Contexte de parcours :
- Étape actuelle : {_safe_text(journey_data.get("current_stage"), "Non disponible")}
- Meilleure prochaine action : {_safe_text(journey_data.get("next_best_action"), "Non disponible")}
- Route recommandée : {_safe_text(journey_data.get("recommended_route"), "Non disponible")}
- Demande commencée : {_safe_bool_label(bool(journey_data.get("application_started")), language)}
- Profil complété : {_safe_bool_label(bool(journey_data.get("profile_completed")), language)}
- Stratégie prête : {_safe_bool_label(bool(journey_data.get("strategy_ready")), language)}
- Documents requis restants : {documents.get("remaining_required", 0)}
- Progression des documents : {documents.get("progress_percent", 0)}%
- État de préparation : {_safe_text(readiness.get("label"), "Non disponible")}
- Score de préparation : {_safe_text(readiness.get("score"), "Non disponible")}
- Programmes recommandés : {_format_list(recommended_programs, language)}
- Prochaines étapes stratégiques : {_format_list(strategy_next_steps, language)}
""".strip()

    return f"""
Journey context:
- Current stage: {_safe_text(journey_data.get("current_stage"), "Not available")}
- Next best action: {_safe_text(journey_data.get("next_best_action"), "Not available")}
- Recommended route: {_safe_text(journey_data.get("recommended_route"), "Not available")}
- Application started: {_safe_bool_label(bool(journey_data.get("application_started")), language)}
- Profile completed: {_safe_bool_label(bool(journey_data.get("profile_completed")), language)}
- Strategy ready: {_safe_bool_label(bool(journey_data.get("strategy_ready")), language)}
- Remaining required documents: {documents.get("remaining_required", 0)}
- Document progress: {documents.get("progress_percent", 0)}%
- Readiness label: {_safe_text(readiness.get("label"), "Not available")}
- Readiness score: {_safe_text(readiness.get("score"), "Not available")}
- Recommended programs: {_format_list(recommended_programs, language)}
- Strategy next steps: {_format_list(strategy_next_steps, language)}
""".strip()


def _build_actionable_suggestions(
    strategy_data: dict,
    journey_data: Optional[dict] = None,
    language: str = "en",
) -> Dict[str, Any]:
    language = _normalize_language(language)
    strategy_data = strategy_data or {}
    journey_data = journey_data or {}

    next_steps = list(strategy_data.get("next_steps") or [])
    pathways = list(strategy_data.get("recommended_programs") or [])
    french_advantage = strategy_data.get("french_advantage") or {}
    french_recommendations = list(french_advantage.get("recommendations") or [])
    next_best_action = journey_data.get("next_best_action")

    suggestions: List[str] = []
    if next_best_action:
        suggestions.append(str(next_best_action).strip())

    suggestions.extend([str(step).strip() for step in next_steps if str(step).strip()])

    if french_advantage.get("strategic_value") in {"medium", "high"}:
        suggestions.extend(
            [str(item).strip() for item in french_recommendations if str(item).strip()]
        )

    deduped_suggestions = []
    seen = set()
    for item in suggestions:
        normalized = item.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped_suggestions.append(item)

    return {
        "suggested_next_actions": deduped_suggestions[:3],
        "pathways": pathways[:5],
        "french_advantage": french_advantage,
    }


def _fallback_ai_strategy(
    profile,
    crs_score: int,
    programs: List[str],
    language: str = "en",
    strategy_data: Optional[dict] = None,
) -> Dict[str, Any]:
    language = _normalize_language(language)
    strategy_data = strategy_data or {}

    strengths = strategy_data.get("strengths", []) or []
    weaknesses = strategy_data.get("weaknesses", []) or []
    next_steps = strategy_data.get("next_steps", []) or []
    advisor_summary = strategy_data.get("advisor_summary")
    french_advantage = strategy_data.get("french_advantage") or {}
    french_recommendations = french_advantage.get("recommendations") or []
    french_value = french_advantage.get("strategic_value", "low")

    top_program = programs[0] if programs else None

    if language == "fr":
        sections = [
            "### Résumé stratégique",
            (
                f"Votre score CRS actuel est de **{crs_score}**. "
                f"La voie la plus forte pour le moment semble être **{top_program}**."
                if top_program
                else f"Votre score CRS actuel est de **{crs_score}**."
            ),
        ]

        if advisor_summary:
            sections.append(f"\n{advisor_summary}")

        sections.extend(
            [
                "\n### Meilleures voies à considérer",
                _format_bullets(programs[:3], language, fallback_fr="- Aucune voie recommandée pour le moment"),
                "\n### Ce qui aide votre profil",
                _format_bullets(strengths[:4], language, fallback_fr="- Aucun point fort identifié pour le moment"),
                "\n### Ce qui peut limiter votre profil",
                _format_bullets(weaknesses[:4], language, fallback_fr="- Aucune faiblesse principale identifiée pour le moment"),
                "\n### Vos 3 prochaines actions",
                _format_bullets(next_steps[:3], language, fallback_fr="- Compléter votre profil\n- Vérifier votre stratégie\n- Préparer vos documents prioritaires"),
            ]
        )

        if french_value in {"medium", "high"}:
            sections.extend(
                [
                    "\n### Angle francophone",
                    "Votre profil pourrait tirer parti d’une stratégie francophone ou bilingue, surtout si vos résultats détaillés en français sont solides.",
                    _format_bullets(
                        french_recommendations[:3],
                        language,
                        fallback_fr="- Vérifier si vos capacités en français peuvent renforcer votre stratégie",
                    ),
                ]
            )

        sections.append(
            "\n*Cette réponse est fournie à titre informatif général et ne constitue pas un avis juridique.*"
        )
        reply = "\n".join(sections).strip()
    else:
        sections = [
            "### Strategic summary",
            (
                f"Your current CRS score is **{crs_score}**. "
                f"Your strongest pathway right now appears to be **{top_program}**."
                if top_program
                else f"Your current CRS score is **{crs_score}**."
            ),
        ]

        if advisor_summary:
            sections.append(f"\n{advisor_summary}")

        sections.extend(
            [
                "\n### Best pathways to consider",
                _format_bullets(programs[:3], language, fallback_en="- No recommended pathways yet"),
                "\n### What helps your profile",
                _format_bullets(strengths[:4], language, fallback_en="- No main strengths identified yet"),
                "\n### What may limit your profile",
                _format_bullets(weaknesses[:4], language, fallback_en="- No major weaknesses identified yet"),
                "\n### Your top 3 next actions",
                _format_bullets(next_steps[:3], language, fallback_en="- Complete your profile\n- Review your strategy\n- Prepare your priority documents"),
            ]
        )

        if french_value in {"medium", "high"}:
            sections.extend(
                [
                    "\n### Francophone angle",
                    "Your profile may benefit from a francophone or bilingual strategy, especially if your detailed French results are strong.",
                    _format_bullets(
                        french_recommendations[:3],
                        language,
                        fallback_en="- Confirm whether French ability can strengthen your strategy",
                    ),
                ]
            )

        sections.append(
            "\n*This response is general informational guidance and not legal advice.*"
        )
        reply = "\n".join(sections).strip()

    metadata = _build_actionable_suggestions(
        strategy_data=strategy_data,
        journey_data=None,
        language=language,
    )
    metadata["reply"] = reply
    return metadata


def _fallback_ai_chat_reply(
    user_message: str,
    strategy_data: dict,
    journey_data: Optional[dict] = None,
    language: str = "en",
) -> Dict[str, Any]:
    language = _normalize_language(language)

    next_best_action = None
    if journey_data:
        next_best_action = journey_data.get("next_best_action")

    recommended_programs = strategy_data.get("recommended_programs", [])
    next_steps = strategy_data.get("next_steps", [])
    advisor_summary = strategy_data.get("advisor_summary")
    french_advantage = strategy_data.get("french_advantage") or {}
    french_recommendations = french_advantage.get("recommendations") or []
    french_value = french_advantage.get("strategic_value", "low")

    if language == "fr":
        lines = [
            "Je peux vous aider à partir de votre profil, de votre stratégie actuelle et de votre progression.",
        ]

        if advisor_summary:
            lines.append(f"\n**Résumé actuel** : {advisor_summary}")

        if next_best_action:
            lines.append(f"\n**Meilleure prochaine action** : {next_best_action}")

        if recommended_programs:
            lines.append(
                f"\n**Programmes recommandés** : {_format_list(recommended_programs[:3], language)}"
            )

        if next_steps:
            lines.append("\n**Étapes utiles** :")
            for step in next_steps[:3]:
                lines.append(f"- {step}")

        if french_value in {"medium", "high"} and french_recommendations:
            lines.append("\n**Angle francophone à considérer** :")
            for item in french_recommendations[:2]:
                lines.append(f"- {item}")

        lines.append(
            "\nJe peux donner une réponse plus avancée dès que le service IA est configuré. "
            "Pour l’instant, cette réponse reste informative et ne constitue pas un avis juridique."
        )
    else:
        lines = [
            "I can help using your current profile, strategy, and progress context.",
        ]

        if advisor_summary:
            lines.append(f"\n**Current summary**: {advisor_summary}")

        if next_best_action:
            lines.append(f"\n**Best next action**: {next_best_action}")

        if recommended_programs:
            lines.append(
                f"\n**Recommended programs**: {_format_list(recommended_programs[:3], language)}"
            )

        if next_steps:
            lines.append("\n**Useful next steps**:")
            for step in next_steps[:3]:
                lines.append(f"- {step}")

        if french_value in {"medium", "high"} and french_recommendations:
            lines.append("\n**Francophone angle to consider**:")
            for item in french_recommendations[:2]:
                lines.append(f"- {item}")

        lines.append(
            "\nI can provide a more advanced response once the AI service is configured. "
            "For now, this is general informational guidance and not legal advice."
        )

    metadata = _build_actionable_suggestions(
        strategy_data=strategy_data,
        journey_data=journey_data,
        language=language,
    )
    metadata["reply"] = "\n".join(lines).strip()
    return metadata


def _parse_actionable_response(raw_text: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not raw_text or not str(raw_text).strip():
        return fallback

    try:
        parsed = json.loads(raw_text)
        reply = str(parsed.get("reply", "")).strip()
        if not reply:
            return fallback

        suggested_next_actions = parsed.get("suggested_next_actions")
        if not isinstance(suggested_next_actions, list):
            suggested_next_actions = fallback.get("suggested_next_actions", [])

        pathways = parsed.get("pathways")
        if not isinstance(pathways, list):
            pathways = fallback.get("pathways", [])

        french_advantage = parsed.get("french_advantage")
        if not isinstance(french_advantage, dict):
            french_advantage = fallback.get("french_advantage")

        return {
            "reply": reply,
            "suggested_next_actions": suggested_next_actions[:3],
            "pathways": pathways[:5],
            "french_advantage": french_advantage,
        }
    except Exception:
        return fallback


def generate_ai_strategy(
    profile,
    crs_score: int,
    programs: List[str],
    language: str = "en",
    strategy_data: Optional[dict] = None,
) -> Dict[str, Any]:
    language = _normalize_language(language)
    client = get_openai_client()

    if client is None:
        return _fallback_ai_strategy(
            profile=profile,
            crs_score=crs_score,
            programs=programs,
            language=language,
            strategy_data=strategy_data,
        )

    response_language = _language_label(language)
    profile_context = _build_profile_context(profile, language)

    strategy_context = ""
    if strategy_data:
        strategy_context = _build_strategy_context(strategy_data, language)

    fallback = _fallback_ai_strategy(
        profile=profile,
        crs_score=crs_score,
        programs=programs,
        language=language,
        strategy_data=strategy_data,
    )

    if language == "fr":
        user_prompt = f"""
Répondez entièrement en {response_language}.

Vous êtes le conseiller stratégique principal de NorthBridgeAI pour l’immigration canadienne.

Votre rôle :
- analyser le profil comme un stratège d’immigration, pas comme un simple chatbot
- prioriser la meilleure voie principale, une voie secondaire et les prochaines étapes les plus utiles
- tenir compte de l’intérêt potentiel d’une stratégie francophone ou bilingue quand le contexte le suggère
- expliquer clairement pourquoi certaines voies sont plus fortes que d’autres
- rester prudent, utile et structuré

{profile_context}

Contexte principal :
- Score CRS : {crs_score}
- Programmes recommandés : {_format_list(programs, language)}

{strategy_context if strategy_context else ""}

Retournez uniquement un objet JSON valide avec les clés :
- "reply": string markdown
- "suggested_next_actions": string[]
- "pathways": string[]
- "french_advantage": object | null

Le champ "reply" doit contenir exactement ces sections markdown :
1. ### Résumé stratégique
2. ### Meilleures voies à considérer
3. ### Ce qui aide votre profil
4. ### Ce qui peut limiter votre profil
5. ### Vos 3 prochaines actions
6. ### Angle francophone (uniquement si pertinent)

Règles :
- Soyez clair, rassurant et professionnel
- Soyez précis et pratique
- N’inventez pas d’informations absentes du profil ou du contexte
- Si une donnée manque, dites-le simplement
- Ne prétendez pas être avocat ou consultant réglementé
- Ne promettez jamais un résultat d’immigration
- Ne mentionnez jamais de détails techniques internes
- Terminez par une courte phrase rappelant qu’il s’agit d’information générale et non d’un avis juridique
""".strip()
    else:
        user_prompt = f"""
Respond entirely in {response_language}.

You are NorthBridgeAI's lead strategy advisor for Canadian immigration planning.

Your job:
- analyze the profile like an immigration strategist, not a generic chatbot
- prioritize the strongest primary pathway, one backup pathway, and the most useful next steps
- account for potential francophone or bilingual strategy value when the context suggests it
- explain clearly why some pathways are stronger than others
- stay cautious, practical, and structured

{profile_context}

Primary context:
- CRS score: {crs_score}
- Recommended programs: {_format_list(programs, language)}

{strategy_context if strategy_context else ""}

Return only valid JSON with the keys:
- "reply": string markdown
- "suggested_next_actions": string[]
- "pathways": string[]
- "french_advantage": object | null

The "reply" field must contain exactly these markdown sections:
1. ### Strategic summary
2. ### Best pathways to consider
3. ### What helps your profile
4. ### What may limit your profile
5. ### Your top 3 next actions
6. ### Francophone angle (only if relevant)

Rules:
- Be clear, reassuring, and professional
- Be specific and practical
- Do not invent information missing from the profile or context
- If information is missing, say so simply
- Do not claim to be a lawyer or regulated consultant
- Never promise immigration outcomes
- Never mention internal technical details
- End with one short sentence reminding the user this is general information, not legal advice
""".strip()

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are NorthBridgeAI's trusted Canadian immigration planning assistant. "
                        "You give structured, practical, careful guidance based only on the profile and strategy context provided. "
                        "You prioritize pathway ranking, reasoning, next actions, and realistic planning. "
                        "You must not invent facts, promise outcomes, or present yourself as a lawyer or regulated consultant."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.35,
        )
        raw = (response.choices[0].message.content or "").strip()
        return _parse_actionable_response(raw, fallback)
    except Exception:
        return fallback


def generate_ai_chat_reply(
    user_message: str,
    profile,
    strategy_data: dict,
    journey_data: Optional[dict] = None,
    language: str = "en",
    chat_history: Optional[List] = None,
) -> Dict[str, Any]:
    language = _normalize_language(language)
    client = get_openai_client()

    if client is None:
        return _fallback_ai_chat_reply(
            user_message=user_message,
            strategy_data=strategy_data,
            journey_data=journey_data,
            language=language,
        )

    profile_context = _build_profile_context(profile, language)
    strategy_context = _build_strategy_context(strategy_data, language)
    journey_context = _build_journey_context(journey_data, language)

    fallback = _fallback_ai_chat_reply(
        user_message=user_message,
        strategy_data=strategy_data,
        journey_data=journey_data,
        language=language,
    )

    history_messages = []
    for item in chat_history or []:
        role = item.role if hasattr(item, "role") else item.get("role", "user")
        content = item.content if hasattr(item, "content") else item.get("content", "")

        if role in {"user", "assistant"} and content and str(content).strip():
            history_messages.append(
                {
                    "role": role,
                    "content": str(content).strip(),
                }
            )

    if language == "fr":
        system_prompt = f"""
Vous êtes l’assistant IA principal de NorthBridgeAI pour l’immigration canadienne.

Répondez toujours en français.

Votre personnalité :
- Simple comme ChatGPT
- Fiable comme une banque
- Guidé comme un GPS

Votre mission :
- Répondre de façon claire, calme et structurée
- Utiliser le profil réel de l’utilisateur, son contexte stratégique et son contexte de parcours
- Donner des étapes concrètes et utiles
- Prioriser la meilleure prochaine action quand c’est pertinent
- Aligner vos réponses avec la prochaine étape recommandée par le moteur de parcours
- Répondre comme un stratège d’immigration pratique
- Intégrer la logique francophone ou bilingue quand elle est pertinente
- Rassurer sans exagérer
- Dire clairement lorsqu’une information n’est pas disponible
- Ne jamais révéler d’informations techniques, internes, backend, erreurs système, noms de fonctions, routes API, bases de données, logs ou détails d’implémentation

Règles strictes :
- N’inventez pas de faits
- Ne mentionnez jamais de détails techniques internes
- Ne dites pas que vous êtes avocat ou consultant réglementé
- Ne promettez pas de résultat d’immigration
- Si la question dépasse le contexte disponible, dites-le simplement et proposez la prochaine meilleure étape
- Quand l’utilisateur demande quoi faire ensuite, privilégiez d’abord "Meilleure prochaine action" du contexte de parcours
- Quand utile, terminez avec 2 ou 3 actions concrètes
- Quand pertinent, expliquez brièvement pourquoi une voie semble meilleure qu’une autre
- Rappelez brièvement au besoin qu’il s’agit d’information générale et non d’un avis juridique

{profile_context}

{strategy_context}

{journey_context}
""".strip()

        user_prompt = f"""
Message utilisateur :
{user_message.strip()}

Retournez uniquement un objet JSON valide avec les clés :
- "reply": string markdown
- "suggested_next_actions": string[]
- "pathways": string[]
- "french_advantage": object | null

Le champ "reply" doit être une réponse utile, claire, concrète et naturelle.
Les "suggested_next_actions" doivent être courtes, exploitables et liées au contexte réel.
Les "pathways" doivent refléter les voies les plus pertinentes du contexte stratégique.
""".strip()
    else:
        system_prompt = f"""
You are NorthBridgeAI's core AI assistant for Canadian immigration planning.

Always respond in English.

Your personality:
- Simple like ChatGPT
- Trustworthy like a bank
- Guided like a GPS

Your job:
- Answer clearly, calmly, and in a structured way
- Use the user's real profile, strategy context, and journey context
- Give practical, useful next steps
- Prioritize the best next action when relevant
- Align your advice with the journey engine's recommended next action
- Answer like a practical immigration strategist
- Integrate francophone or bilingual logic when relevant
- Be reassuring without overstating certainty
- Clearly say when information is unavailable
- Never reveal technical, internal, backend, system error, function name, API route, database, log, or implementation details

Strict rules:
- Do not invent facts
- Never mention internal technical details
- Do not claim to be a lawyer or regulated consultant
- Do not promise immigration outcomes
- If the question goes beyond the available context, say so simply and offer the best next step
- When the user asks what to do next, prioritize "Next best action" from the journey context first
- When helpful, end with 2 or 3 concrete actions
- When relevant, briefly explain why one pathway appears stronger than another
- Briefly remind the user when appropriate that this is general information, not legal advice

{profile_context}

{strategy_context}

{journey_context}
""".strip()

        user_prompt = f"""
User message:
{user_message.strip()}

Return only valid JSON with the keys:
- "reply": string markdown
- "suggested_next_actions": string[]
- "pathways": string[]
- "french_advantage": object | null

The "reply" field should be natural, clear, useful, and practical.
The "suggested_next_actions" should be short, actionable, and grounded in the real context.
The "pathways" should reflect the strongest relevant pathways from the strategy context.
""".strip()

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history_messages)
    messages.append({"role": "user", "content": user_prompt})

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            response_format={"type": "json_object"},
            messages=messages,
            temperature=0.45,
        )
        raw = (response.choices[0].message.content or "").strip()
        return _parse_actionable_response(raw, fallback)
    except Exception:
        return fallback