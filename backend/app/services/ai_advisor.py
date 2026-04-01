import json
import os
from typing import Any

from openai import OpenAI

_client = None


def get_openai_client():
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return str(value).strip()


def serialize_profile(profile) -> str:
    if not profile:
        return "No profile found."

    fields = [
        "first_name",
        "last_name",
        "age",
        "education",
        "language_score",
        "experience_years",
        "has_job_offer",
        "has_canadian_experience",
        "studied_in_canada",
        "occupation",
        "noc_code",
        "preferred_province",
    ]

    lines = []
    for field in fields:
        value = getattr(profile, field, None)
        if value is not None:
            lines.append(f"- {field}: {value}")

    return "\n".join(lines) if lines else "Profile exists but has limited visible fields."


def serialize_strategy(strategy) -> str:
    if not strategy:
        return "No strategy found."

    safe_keys = [
        "crs_score",
        "advisor_summary",
        "recommended_programs",
        "strengths",
        "weaknesses",
        "next_steps",
        "timeline_estimate",
        "probability_estimate",
        "french_advantage",
        "roadmap",
        "province_recommendations",
        "improvement_scenarios",
        "draw_prediction",
    ]

    lines = []
    for key in safe_keys:
        value = strategy.get(key)
        if value is not None:
            lines.append(f"- {key}: {_safe_text(value)}")

    return "\n".join(lines) if lines else "Strategy exists but no summarized fields were available."


def build_chat_system_prompt(profile, strategy, language: str) -> str:
    profile_text = serialize_profile(profile)
    strategy_text = serialize_strategy(strategy)

    if language == "fr":
        return f"""
Tu es NorthBridgeAI, un copilote d’immigration canadienne clair, stratégique et pratique.

Ton rôle :
- analyser la situation de l’utilisateur en profondeur
- guider l’utilisateur étape par étape
- agir comme un conseiller professionnel et structuré
- éviter les réponses génériques
- ne pas prétendre être un avocat ni donner un avis juridique définitif

Contexte du profil utilisateur :
{profile_text}

Contexte de la stratégie utilisateur :
{strategy_text}

Tu dois répondre en JSON valide avec cette structure exacte :
{{
  "reply": "réponse claire et utile en français",
  "suggested_next_actions": [
    "action courte 1",
    "action courte 2",
    "action courte 3"
  ]
}}

Consignes pour le contenu de "reply" :
- Structure la réponse avec ces sections claires :
  1. Situation
  2. Points clés
  3. Stratégie recommandée
  4. Prochaines étapes
- Sois concise, pratique et orientée action
- Utilise des puces ou des étapes numérotées quand utile
- Explique la logique simplement
- Adapte la réponse au profil et à la stratégie fournis
- Évite le jargon inutile

Règles :
- suggested_next_actions doit contenir 0 à 3 actions courtes
- chaque action doit être concrète et orientée vers une étape
- ne retourne aucun texte hors du JSON
"""
    return f"""
You are NorthBridgeAI, a Canadian immigration copilot that is clear, strategic, and practical.

Your role:
- analyze the user's situation deeply
- guide the user step by step
- act like a professional advisor
- avoid generic answers
- do not claim to be a lawyer or provide definitive legal advice

User profile context:
{profile_text}

User strategy context:
{strategy_text}

You must respond in valid JSON with this exact structure:
{{
  "reply": "clear and useful answer in English",
  "suggested_next_actions": [
    "short action 1",
    "short action 2",
    "short action 3"
  ]
}}

Instructions for the "reply" content:
- Structure the answer using these clear sections:
  1. Situation
  2. Key Insights
  3. Recommended Strategy
  4. Next Steps
- Be concise, practical, and action-oriented
- Use bullets or numbered steps when helpful
- Explain the reasoning simply
- Tailor the response to the provided profile and strategy
- Avoid unnecessary jargon

Rules:
- suggested_next_actions must contain 0 to 3 short actions
- each action must be concrete and next-step oriented
- return no text outside JSON
"""


def generate_ai_chat_reply(
    message,
    language="en",
    profile=None,
    strategy=None,
    chat_history=None,
):
    client = get_openai_client()
    system_prompt = build_chat_system_prompt(profile, strategy, language)

    messages = [{"role": "system", "content": system_prompt}]

    for msg in chat_history or []:
        role = msg.get("role", "user")
        content = (msg.get("content") or "").strip()
        if content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": message})

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.4,
            response_format={"type": "json_object"},
            messages=messages,
        )

        raw = response.choices[0].message.content or "{}"
        parsed = json.loads(raw)

        reply = (parsed.get("reply") or "").strip()
        suggested_next_actions = parsed.get("suggested_next_actions") or []

        if not isinstance(suggested_next_actions, list):
            suggested_next_actions = []

        suggested_next_actions = [
            str(item).strip()
            for item in suggested_next_actions
            if str(item).strip()
        ][:3]

        if not reply:
            reply = (
                "Situation\n- I’m here to help with your immigration strategy.\n\n"
                "Key Insights\n- Your profile and strategy can be used to guide the next steps.\n\n"
                "Recommended Strategy\n- Focus on the strongest pathway shown in your strategy.\n\n"
                "Next Steps\n1. Review your strategy\n2. Update missing profile details\n3. Organize your documents."
                if language != "fr"
                else "Situation\n- Je suis là pour vous aider avec votre stratégie d’immigration.\n\n"
                "Points clés\n- Votre profil et votre stratégie peuvent guider les prochaines étapes.\n\n"
                "Stratégie recommandée\n- Concentrez-vous sur la voie la plus forte indiquée dans votre stratégie.\n\n"
                "Prochaines étapes\n1. Revoyez votre stratégie\n2. Mettez à jour les éléments manquants du profil\n3. Organisez vos documents."
            )

        return {
            "reply": reply,
            "suggested_next_actions": suggested_next_actions,
        }

    except Exception as e:
        return {
            "reply": (
                f"AI error: {str(e)}"
                if language != "fr"
                else f"Erreur IA : {str(e)}"
            ),
            "suggested_next_actions": [],
        }


def _strategy_prompt(profile, strategy_data: dict, language: str) -> str:
    profile_text = serialize_profile(profile)
    strategy_text = serialize_strategy(strategy_data)

    if language == "fr":
        return f"""
Tu es NorthBridgeAI, un stratège d’immigration canadienne.

À partir du profil et des données de stratégie ci-dessous, rédige une analyse stratégique utile, claire et professionnelle en français.

Profil :
{profile_text}

Données de stratégie :
{strategy_text}

Consignes :
- explique la situation actuelle
- résume les meilleures voies
- souligne les forces
- souligne les faiblesses ou risques
- propose les prochaines étapes concrètes
- reste pratique, structurée et concise
- ne retourne que le texte final, pas de JSON
"""
    return f"""
You are NorthBridgeAI, a Canadian immigration strategist.

Using the profile and strategy data below, write a clear, useful, professional strategy analysis in English.

Profile:
{profile_text}

Strategy data:
{strategy_text}

Instructions:
- explain the current situation
- summarize the best-fit pathways
- highlight strengths
- highlight weaknesses or risks
- propose concrete next steps
- stay practical, structured, and concise
- return only the final text, not JSON
"""


def generate_ai_strategy(profile=None, strategy_data=None, language="en") -> str:
    client = get_openai_client()
    prompt = _strategy_prompt(profile, strategy_data or {}, language)

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.5,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a clear and practical immigration strategy writer."
                        if language != "fr"
                        else "Tu es un rédacteur stratégique clair et pratique en immigration."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )

        content = (response.choices[0].message.content or "").strip()
        if content:
            return content

    except Exception as e:
        return (
            f"AI strategy unavailable: {str(e)}"
            if language != "fr"
            else f"Stratégie IA indisponible : {str(e)}"
        )

    return (
        "AI strategy unavailable at the moment."
        if language != "fr"
        else "La stratégie IA est indisponible pour le moment."
    )