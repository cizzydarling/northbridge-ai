import os
from typing import List, Optional

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


def _language_label(language: str) -> str:
    return "French" if language == "fr" else "English"


def _safe_text(value, fallback: str = "Not provided") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _safe_bool_label(value: bool, language: str = "en") -> str:
    if language == "fr":
        return "Oui" if value else "Non"
    return "Yes" if value else "No"


def _format_list(
    items,
    language: str = "en",
    fallback_en: str = "None",
    fallback_fr: str = "Aucun",
):
    if not items:
        return fallback_fr if language == "fr" else fallback_en
    cleaned = [str(item).strip() for item in items if item is not None and str(item).strip()]
    if not cleaned:
        return fallback_fr if language == "fr" else fallback_en
    return ", ".join(cleaned)


def _build_profile_context(profile, language: str = "en") -> str:
    if language == "fr":
        return f"""
Profil utilisateur :
- Âge : {profile.age}
- Études : {_safe_text(profile.education, "Non précisé")}
- Score linguistique : {profile.language_score}
- Années d’expérience : {profile.experience_years}
- Offre d’emploi : {_safe_bool_label(profile.has_job_offer, language)}
- Expérience canadienne : {_safe_bool_label(profile.has_canadian_experience, language)}
- Études au Canada : {_safe_bool_label(profile.studied_in_canada, language)}
- Profession : {_safe_text(profile.occupation, "Non précisé")}
- Code CNP : {_safe_text(profile.noc_code, "Non précisé")}
- Province privilégiée : {_safe_text(profile.preferred_province, "Non précisé")}
""".strip()

    return f"""
User profile:
- Age: {profile.age}
- Education: {_safe_text(profile.education)}
- Language score: {profile.language_score}
- Experience years: {profile.experience_years}
- Has job offer: {_safe_bool_label(profile.has_job_offer, language)}
- Has Canadian experience: {_safe_bool_label(profile.has_canadian_experience, language)}
- Studied in Canada: {_safe_bool_label(profile.studied_in_canada, language)}
- Occupation: {_safe_text(profile.occupation)}
- NOC code: {_safe_text(profile.noc_code)}
- Preferred province: {_safe_text(profile.preferred_province)}
""".strip()


def _build_strategy_context(strategy_data: dict, language: str = "en") -> str:
    recommended_programs = strategy_data.get("recommended_programs", [])
    strengths = strategy_data.get("strengths", [])
    weaknesses = strategy_data.get("weaknesses", [])
    next_steps = strategy_data.get("next_steps", [])
    roadmap = strategy_data.get("roadmap", [])
    advisor_summary = strategy_data.get("advisor_summary")
    crs_score = strategy_data.get("crs_score")

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

Top roadmap items:
{chr(10).join(roadmap_lines) if roadmap_lines else "- No roadmap available"}
""".strip()


def _build_journey_context(journey_data: Optional[dict], language: str = "en") -> str:
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


def _fallback_ai_strategy(
    profile,
    crs_score: int,
    programs: List[str],
    language: str = "en",
) -> str:
    program_text = _format_list(programs, language)

    if language == "fr":
        return f"""
### Résumé stratégique
Votre score CRS actuel est de **{crs_score}**. Les programmes actuellement les plus pertinents sont : **{program_text}**.

### Principales opportunités
- Renforcer les facteurs déjà favorables dans votre profil.
- Cibler les programmes déjà compatibles avec votre profil actuel.
- Prioriser les actions qui peuvent améliorer rapidement votre compétitivité.

### Principaux risques
- Certaines informations du profil peuvent être encore incomplètes.
- La compétitivité dépend des seuils, programmes et priorités en vigueur.
- Cette analyse reste générale et informative.

### Prochaines étapes
1. Vérifier que le profil est complet et exact.
2. Prioriser le programme le plus adapté parmi les recommandations.
3. Préparer les documents et les améliorations de profil les plus utiles.

*Cette réponse est fournie à titre informatif général et ne constitue pas un avis juridique.*
""".strip()

    return f"""
### Strategic summary
Your current CRS score is **{crs_score}**. The most relevant programs right now are: **{program_text}**.

### Main opportunities
- Strengthen the factors already working in your profile.
- Focus on the programs already aligned with your current background.
- Prioritize actions that can improve competitiveness quickly.

### Main risks
- Some profile details may still be incomplete.
- Competitiveness depends on thresholds, programs, and current priorities.
- This analysis is general and informational.

### Next steps
1. Make sure the profile is complete and accurate.
2. Prioritize the strongest recommended program.
3. Prepare the most useful documents and profile improvements.

*This response is general informational guidance and not legal advice.*
""".strip()


def _fallback_ai_chat_reply(
    user_message: str,
    strategy_data: dict,
    journey_data: Optional[dict] = None,
    language: str = "en",
) -> str:
    next_best_action = None
    if journey_data:
        next_best_action = journey_data.get("next_best_action")

    recommended_programs = strategy_data.get("recommended_programs", [])
    next_steps = strategy_data.get("next_steps", [])
    advisor_summary = strategy_data.get("advisor_summary")

    if language == "fr":
        lines = [
            "Je peux vous aider à partir de votre profil et de votre stratégie actuelle.",
        ]

        if advisor_summary:
            lines.append(f"\n**Résumé actuel** : {advisor_summary}")

        if next_best_action:
            lines.append(f"\n**Meilleure prochaine action** : {next_best_action}")

        if recommended_programs:
            lines.append(
                f"\n**Programmes recommandés** : {_format_list(recommended_programs, language)}"
            )

        if next_steps:
            lines.append("\n**Étapes utiles** :")
            for step in next_steps[:3]:
                lines.append(f"- {step}")

        lines.append(
            "\nJe peux donner une réponse plus avancée dès que le service IA est configuré. "
            "Pour l’instant, cette réponse reste informative et ne constitue pas un avis juridique."
        )
        return "\n".join(lines).strip()

    lines = [
        "I can help using your current profile and strategy context.",
    ]

    if advisor_summary:
        lines.append(f"\n**Current summary**: {advisor_summary}")

    if next_best_action:
        lines.append(f"\n**Best next action**: {next_best_action}")

    if recommended_programs:
        lines.append(
            f"\n**Recommended programs**: {_format_list(recommended_programs, language)}"
        )

    if next_steps:
        lines.append("\n**Useful next steps**:")
        for step in next_steps[:3]:
            lines.append(f"- {step}")

    lines.append(
        "\nI can provide a more advanced response once the AI service is configured. "
        "For now, this is general informational guidance and not legal advice."
    )
    return "\n".join(lines).strip()


def generate_ai_strategy(
    profile,
    crs_score: int,
    programs: List[str],
    language: str = "en",
) -> str:
    client = get_openai_client()
    if client is None:
        return _fallback_ai_strategy(
            profile=profile,
            crs_score=crs_score,
            programs=programs,
            language=language,
        )

    response_language = _language_label(language)
    profile_context = _build_profile_context(profile, language)

    if language == "fr":
        user_prompt = f"""
Répondez entièrement en {response_language}.

Vous êtes l’assistant stratégique de NorthBridgeAI pour l’immigration canadienne.

{profile_context}

Contexte :
- Score CRS : {crs_score}
- Programmes recommandés : {_format_list(programs, language)}

Fournissez :
1. Un résumé stratégique court
2. Les principales opportunités
3. Les principaux risques
4. Les prochaines étapes les plus utiles

Règles :
- Soyez clair, rassurant et professionnel
- Soyez pratique et précis
- N’inventez pas d’informations absentes du profil
- Ne prétendez pas être avocat ou consultant réglementé
- Rappelez brièvement que ce contenu est informatif et ne constitue pas un avis juridique
"""
    else:
        user_prompt = f"""
Respond entirely in {response_language}.

You are the NorthBridgeAI strategy assistant for Canadian immigration planning.

{profile_context}

Context:
- CRS score: {crs_score}
- Recommended programs: {_format_list(programs, language)}

Provide:
1. A short strategic summary
2. Main opportunities
3. Main risks
4. The most useful next steps

Rules:
- Be clear, reassuring, and professional
- Be practical and specific
- Do not invent information missing from the profile
- Do not claim to be a lawyer or regulated consultant
- Briefly remind the user that this is informational guidance, not legal advice
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are NorthBridgeAI's trusted Canadian immigration planning assistant. "
                        "You provide clear, structured, practical guidance grounded only in the user's profile."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.35,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception:
        return _fallback_ai_strategy(
            profile=profile,
            crs_score=crs_score,
            programs=programs,
            language=language,
        )


def generate_ai_chat_reply(
    user_message: str,
    profile,
    strategy_data: dict,
    journey_data: Optional[dict] = None,
    language: str = "en",
    chat_history: Optional[List] = None,
) -> str:
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
- Rappelez brièvement au besoin qu’il s’agit d’information générale et non d’un avis juridique

{profile_context}

{strategy_context}

{journey_context}
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
- Briefly remind the user when appropriate that this is general information, not legal advice

{profile_context}

{strategy_context}

{journey_context}
""".strip()

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history_messages)
    messages.append({"role": "user", "content": user_message.strip()})

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            temperature=0.45,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception:
        return _fallback_ai_chat_reply(
            user_message=user_message,
            strategy_data=strategy_data,
            journey_data=journey_data,
            language=language,
        )