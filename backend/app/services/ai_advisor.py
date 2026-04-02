import json
import os
from typing import Any, Dict, List, Optional

from openai import OpenAI


def _normalize_language(language: Optional[str]) -> str:
    value = (language or "en").strip().lower()
    return "fr" if value == "fr" else "en"


def _get_openai_client() -> Optional[OpenAI]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


def _safe_join(items: List[str], empty_value: str) -> str:
    cleaned = [str(item).strip() for item in items if str(item).strip()]
    return ", ".join(cleaned) if cleaned else empty_value


def _extract_profile_context(profile: Any, language: str) -> str:
    if not profile:
        return (
            "No profile available."
            if language == "en"
            else "Aucun profil disponible."
        )

    fields = {
        "first_name": getattr(profile, "first_name", None),
        "nationality": getattr(profile, "nationality", None),
        "current_country": getattr(profile, "current_country", None),
        "current_city": getattr(profile, "current_city", None),
        "marital_status": getattr(profile, "marital_status", None),
        "preferred_language": getattr(profile, "preferred_language", None),
        "age": getattr(profile, "age", None),
        "education": getattr(profile, "education", None),
        "language_score": getattr(profile, "language_score", None),
        "experience_years": getattr(profile, "experience_years", None),
        "has_job_offer": getattr(profile, "has_job_offer", None),
        "has_canadian_experience": getattr(profile, "has_canadian_experience", None),
        "studied_in_canada": getattr(profile, "studied_in_canada", None),
        "occupation": getattr(profile, "occupation", None),
        "noc_code": getattr(profile, "noc_code", None),
        "preferred_province": getattr(profile, "preferred_province", None),
    }

    non_empty = []
    for key, value in fields.items():
        if value is None or value == "":
            continue
        non_empty.append(f"{key}: {value}")

    if not non_empty:
        return (
            "Profile exists but contains very little information."
            if language == "en"
            else "Le profil existe mais contient très peu d’informations."
        )

    return "\n".join(non_empty)


def _extract_strategy_context(strategy: Optional[Dict[str, Any]], language: str) -> str:
    if not strategy:
        return (
            "No strategy available."
            if language == "en"
            else "Aucune stratégie disponible."
        )

    empty_word = "none" if language == "en" else "aucun"

    recommended_programs = strategy.get("recommended_programs") or []
    strengths = strategy.get("strengths") or []
    weaknesses = strategy.get("weaknesses") or []
    next_steps = strategy.get("next_steps") or []
    roadmap = strategy.get("roadmap") or []
    french_advantage = strategy.get("french_advantage") or {}
    advisor_summary = strategy.get("advisor_summary")
    crs_score = strategy.get("crs_score")

    roadmap_titles = [
        step.get("title")
        for step in roadmap
        if isinstance(step, dict) and step.get("title")
    ]

    parts = [
        f"crs_score: {crs_score}",
        f"recommended_programs: {_safe_join(recommended_programs, empty_word)}",
        f"strengths: {_safe_join(strengths[:5], empty_word)}",
        f"weaknesses: {_safe_join(weaknesses[:5], empty_word)}",
        f"next_steps: {_safe_join(next_steps[:5], empty_word)}",
        f"roadmap: {_safe_join(roadmap_titles[:5], empty_word)}",
        f"french_strategic_value: {french_advantage.get('strategic_value', 'low')}",
    ]

    if advisor_summary:
        parts.append(f"advisor_summary: {advisor_summary}")

    return "\n".join(parts)


def _extract_chat_history(
    chat_history: Optional[List[Dict[str, Any]]],
) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []

    for item in chat_history or []:
        if not isinstance(item, dict):
            continue

        role = str(item.get("role", "")).strip()
        content = str(item.get("content", "")).strip()

        if role not in {"user", "assistant", "system"}:
            continue
        if not content:
            continue

        normalized.append({"role": role, "content": content})

    return normalized[-6:]


def _build_system_prompt(language: str) -> str:
    if language == "fr":
        return """
Tu es NorthBridgeAI, un copilote d’immigration canadienne pour utilisateurs individuels.

Ton rôle:
- expliquer la situation de l’utilisateur de façon simple
- identifier les points forts et les blocages
- recommander les meilleures prochaines étapes
- rester concret, rassurant, structuré et utile

Règles:
- ne donne pas d’avis juridique définitif
- ne prétends pas garantir un résultat
- base-toi sur le profil et la stratégie fournis
- si le contexte est incomplet, indique clairement ce qui manque
- suggère des actions courtes et pratiques

Tu DOIS retourner uniquement du JSON valide avec cette structure:
{
  "reply": "réponse claire en texte",
  "suggested_next_actions": [
    {"label": "Action courte", "route": "/strategy"}
  ],
  "insights": [
    "insight court 1",
    "insight court 2"
  ]
}

Contraintes:
- "reply" doit être clair, humain, et utile
- "suggested_next_actions" doit contenir 0 à 3 actions
- chaque action doit avoir un "label" court
- utilise seulement ces routes quand pertinent:
  /profile
  /strategy
  /chat
  /self/application
  /self/documents
  /documents/generator
  /documents/review
  /legal/disclosure
  /pricing
- "insights" doit contenir 0 à 3 points courts
"""
    return """
You are NorthBridgeAI, a Canadian immigration copilot for individual users.

Your role:
- explain the user's situation simply
- identify strengths and blockers
- recommend the best next steps
- stay concrete, calm, structured, and useful

Rules:
- do not give definitive legal advice
- do not claim guaranteed outcomes
- base your answer on the supplied profile and strategy
- if context is incomplete, clearly say what is missing
- suggest short, practical actions

You MUST return only valid JSON with this structure:
{
  "reply": "clear text response",
  "suggested_next_actions": [
    {"label": "Short action", "route": "/strategy"}
  ],
  "insights": [
    "short insight 1",
    "short insight 2"
  ]
}

Constraints:
- "reply" should be clear, human, and useful
- "suggested_next_actions" must contain 0 to 3 actions
- each action must have a short "label"
- only use these routes when relevant:
  /profile
  /strategy
  /chat
  /self/application
  /self/documents
  /documents/generator
  /documents/review
  /legal/disclosure
  /pricing
- "insights" must contain 0 to 3 short points
"""


def _build_user_prompt(
    *,
    message: str,
    language: str,
    profile: Any,
    strategy: Optional[Dict[str, Any]],
) -> str:
    profile_context = _extract_profile_context(profile, language)
    strategy_context = _extract_strategy_context(strategy, language)

    if language == "fr":
        return f"""
Message utilisateur:
{message}

Contexte profil:
{profile_context}

Contexte stratégie:
{strategy_context}

Réponds en français.
"""
    return f"""
User message:
{message}

Profile context:
{profile_context}

Strategy context:
{strategy_context}

Respond in English.
"""


def _default_actions(language: str) -> List[Dict[str, str]]:
    if language == "fr":
        return [
            {"label": "Voir ma stratégie", "route": "/strategy"},
            {"label": "Mettre à jour mon profil", "route": "/profile"},
            {"label": "Ouvrir ma demande", "route": "/self/application"},
        ]
    return [
        {"label": "View my strategy", "route": "/strategy"},
        {"label": "Update my profile", "route": "/profile"},
        {"label": "Open my application", "route": "/self/application"},
    ]


def _fallback_response(language: str) -> Dict[str, Any]:
    if language == "fr":
        return {
            "reply": (
                "Je peux déjà vous aider à comprendre votre stratégie et vos prochaines étapes, "
                "mais la réponse IA complète n’est pas disponible pour le moment."
            ),
            "suggested_next_actions": _default_actions(language),
            "insights": [],
        }
    return {
        "reply": (
            "I can still help explain your strategy and next steps, "
            "but the full AI response is not available right now."
        ),
        "suggested_next_actions": _default_actions(language),
        "insights": [],
    }


def _normalize_action(action: Any) -> Optional[Dict[str, str]]:
    if isinstance(action, str):
        label = action.strip()
        if not label:
            return None
        return {"label": label, "route": ""}

    if not isinstance(action, dict):
        return None

    label = str(action.get("label", "")).strip()
    route = str(action.get("route", "")).strip()

    if not label:
        return None

    return {"label": label, "route": route}


def _normalize_response(payload: Any, language: str) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return _fallback_response(language)

    reply = str(payload.get("reply", "")).strip()
    if not reply:
        reply = _fallback_response(language)["reply"]

    actions_raw = payload.get("suggested_next_actions", [])
    insights_raw = payload.get("insights", [])

    actions: List[Dict[str, str]] = []
    if isinstance(actions_raw, list):
        for item in actions_raw[:3]:
            normalized = _normalize_action(item)
            if normalized:
                actions.append(normalized)

    insights: List[str] = []
    if isinstance(insights_raw, list):
        for item in insights_raw[:3]:
            text = str(item).strip()
            if text:
                insights.append(text)

    return {
        "reply": reply,
        "suggested_next_actions": actions,
        "insights": insights,
    }


def generate_ai_chat_reply(
    *,
    message: str,
    language: str,
    profile: Any,
    strategy: Optional[Dict[str, Any]],
    chat_history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    language = _normalize_language(language)
    openai_client = _get_openai_client()

    if openai_client is None:
        return _fallback_response(language)

    try:
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": _build_system_prompt(language)}
        ]

        history = _extract_chat_history(chat_history)
        messages.extend(history)

        messages.append(
            {
                "role": "user",
                "content": _build_user_prompt(
                    message=message,
                    language=language,
                    profile=profile,
                    strategy=strategy,
                ),
            }
        )

        response = openai_client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=messages,
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        raw_content = response.choices[0].message.content or "{}"

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError:
            return {
                "reply": raw_content.strip() or _fallback_response(language)["reply"],
                "suggested_next_actions": _default_actions(language),
                "insights": [],
            }

        return _normalize_response(parsed, language)

    except Exception as e:
        print("AI ERROR:", str(e))
        return _fallback_response(language)