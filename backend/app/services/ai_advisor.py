import json
import os
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

from openai import OpenAI


def _normalize_language(language: Optional[str]) -> str:
    value = (language or "en").strip().lower()
    return "fr" if value == "fr" else "en"


def _get_openai_client() -> Optional[OpenAI]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


def get_openai_client() -> Optional[OpenAI]:
    """
    Public wrapper kept for compatibility with services that import
    get_openai_client directly.
    """
    return _get_openai_client()


def _t(en: str, fr: str, language: str) -> str:
    return fr if _normalize_language(language) == "fr" else en


def _safe_join(items: List[Any], empty_value: str) -> str:
    cleaned = [str(item).strip() for item in items if str(item).strip()]
    return ", ".join(cleaned) if cleaned else empty_value


def _safe_get(profile: Any, field_name: str, default: Any = None) -> Any:
    if isinstance(profile, dict):
        return profile.get(field_name, default)
    return getattr(profile, field_name, default)


def _extract_profile_context(profile: Any, language: str) -> str:
    if not profile:
        return (
            "No profile available."
            if language == "en"
            else "Aucun profil disponible."
        )

    fields = {
        "first_name": _safe_get(profile, "first_name"),
        "last_name": _safe_get(profile, "last_name"),
        "nationality": _safe_get(profile, "nationality"),
        "current_country": _safe_get(profile, "current_country"),
        "current_city": _safe_get(profile, "current_city"),
        "marital_status": _safe_get(profile, "marital_status"),
        "preferred_language": _safe_get(profile, "preferred_language"),
        "age": _safe_get(profile, "age"),
        "education": _safe_get(profile, "education"),
        "language_score": _safe_get(profile, "language_score"),
        "experience_years": _safe_get(profile, "experience_years"),
        "has_job_offer": _safe_get(profile, "has_job_offer"),
        "has_canadian_experience": _safe_get(profile, "has_canadian_experience"),
        "studied_in_canada": _safe_get(profile, "studied_in_canada"),
        "occupation": _safe_get(profile, "occupation"),
        "noc_code": _safe_get(profile, "noc_code"),
        "preferred_province": _safe_get(profile, "preferred_province"),
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

def _ensure_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _extract_strategy_context(strategy: Optional[Dict[str, Any]], language: str) -> str:
    if not strategy:
        return (
            "No strategy available."
            if language == "en"
            else "Aucune stratégie disponible."
        )

    empty_word = "none" if language == "en" else "aucun"

    recommended_programs = _ensure_list(strategy.get("recommended_programs"))
    strengths = _ensure_list(strategy.get("strengths"))
    weaknesses = _ensure_list(strategy.get("weaknesses"))
    next_steps = _ensure_list(strategy.get("next_steps"))
    roadmap = _ensure_list(strategy.get("roadmap"))
    improvement_scenarios = _ensure_list(strategy.get("improvement_scenarios"))
    province_recommendations = _ensure_list(strategy.get("province_recommendations"))
    french_advantage = strategy.get("french_advantage") or {}
    noc_advantage = strategy.get("noc_advantage") or {}
    advisor_summary = strategy.get("advisor_summary")
    crs_score = strategy.get("crs_score")
    noc_summary = strategy.get("noc_summary") or {}
    timeline_estimate = strategy.get("timeline_estimate")
    probability_estimate = strategy.get("probability_estimate")
    draw_prediction = strategy.get("draw_prediction")

    roadmap_titles = [
        step.get("title")
        for step in roadmap
        if isinstance(step, dict) and step.get("title")
    ]

    scenario_labels = []
    for item in improvement_scenarios[:8]:
        if isinstance(item, dict):
            label = item.get("change") or item.get("label") or item.get("title")
            if label:
                scenario_labels.append(label)
        elif str(item).strip():
            scenario_labels.append(str(item).strip())

    province_labels = []
    for item in province_recommendations[:8]:
        if isinstance(item, dict):
            province = item.get("province")
            program = item.get("program")
            chance = item.get("chance")
            joined = " | ".join(
                [str(x).strip() for x in [province, program, chance] if str(x).strip()]
            )
            if joined:
                province_labels.append(joined)
        elif str(item).strip():
            province_labels.append(str(item).strip())

    parts = [
        f"crs_score: {crs_score}",
        f"recommended_programs: {_safe_join(recommended_programs, empty_word)}",
        f"strengths: {_safe_join(strengths[:5], empty_word)}",
        f"weaknesses: {_safe_join(weaknesses[:5], empty_word)}",
        f"next_steps: {_safe_join(next_steps[:5], empty_word)}",
        f"roadmap: {_safe_join(roadmap_titles[:5], empty_word)}",
        f"improvement_scenarios: {_safe_join(scenario_labels[:5], empty_word)}",
        f"province_recommendations: {_safe_join(province_labels[:5], empty_word)}",
        f"french_advantage: {json.dumps(french_advantage, ensure_ascii=False)}",
        f"noc_advantage: {json.dumps(noc_advantage, ensure_ascii=False)}",
        f"noc_summary: {json.dumps(noc_summary, ensure_ascii=False)}",
        f"timeline_estimate: {json.dumps(timeline_estimate, ensure_ascii=False)}",
        f"probability_estimate: {json.dumps(probability_estimate, ensure_ascii=False)}",
        f"draw_prediction: {json.dumps(draw_prediction, ensure_ascii=False)}",
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


def _extract_application_context(
    application_context: Optional[Dict[str, Any]],
    language: str,
) -> str:
    if not application_context:
        return (
            "No application context available."
            if language == "en"
            else "Aucun contexte de demande disponible."
        )

    matter_type = application_context.get("matter_type")
    checklist = _ensure_list(application_context.get("checklist"))
    missing_fields = _ensure_list(application_context.get("missing_fields"))
    recommended_forms = _ensure_list(application_context.get("recommended_forms"))
    intake_payload = application_context.get("intake_payload") or {}

    checklist_items = []
    for item in checklist[:8]:
        if isinstance(item, dict):
            name = item.get("name")
            reason = item.get("reason")
            status = item.get("status")
            checklist_items.append(
                f"name={name}, status={status}, reason={reason}"
            )
        else:
            checklist_items.append(str(item))

    if language == "fr":
        return (
            f"matter_type: {matter_type or 'non précisé'}\n"
            f"missing_fields: {_safe_join(missing_fields[:8], 'aucun')}\n"
            f"recommended_forms: {json.dumps(recommended_forms[:5], ensure_ascii=False)}\n"
            f"checklist: {_safe_join(checklist_items, 'aucune')}\n"
            f"intake_payload: {json.dumps(intake_payload, ensure_ascii=False)}"
        )

    return (
        f"matter_type: {matter_type or 'not specified'}\n"
        f"missing_fields: {_safe_join(missing_fields[:8], 'none')}\n"
        f"recommended_forms: {json.dumps(recommended_forms[:5], ensure_ascii=False)}\n"
        f"checklist: {_safe_join(checklist_items, 'none')}\n"
        f"intake_payload: {json.dumps(intake_payload, ensure_ascii=False)}"
    )


def _extract_decision_context(
    decision_context: Optional[Dict[str, Any]],
    language: str,
) -> str:
    if not decision_context:
        return (
            "No decision context available."
            if language == "en"
            else "Aucun contexte décisionnel disponible."
        )

    return json.dumps(decision_context, ensure_ascii=False, indent=2)


def _build_chat_system_prompt(language: str, plan: str = "free") -> str:
    if language == "fr":
        if plan == "premium":
            plan_block = """
Niveau premium:
- inclure une analyse plus stratégique
- inclure les principaux risques ou blocages
- inclure les meilleures optimisations possibles
- relier clairement les recommandations au profil et à la stratégie
"""
        elif plan == "pro":
            plan_block = """
Niveau pro:
- répondre de façon structurée
- donner des actions pratiques et prioritaires
- être précis, concret et orienté exécution
"""
        else:
            plan_block = """
Niveau gratuit:
- rester utile mais plus concis
- donner l’essentiel seulement
- montrer une direction claire sans entrer dans une profondeur maximale
"""

        return f"""
Tu es NorthBridgeAI, un copilote stratégique en immigration canadienne pour utilisateurs individuels.

Ton rôle:
- répondre directement et intelligemment à la question de l’utilisateur
- identifier le meilleur parcours, le principal blocage ou la prochaine action à plus fort impact
- raisonner comme un conseiller stratégique, pas comme un chatbot générique
- rester concret, clair, calme et utile
- répondre UNIQUEMENT en français

Règles:
- ne donne pas d’avis juridique définitif
- ne prétends pas garantir un résultat
- base-toi sur le profil, la stratégie, la demande et le contexte décisionnel fournis
- si le contexte est incomplet, indique clairement ce qui manque
- ne mentionne jamais des limitations internes, de configuration ou d’indisponibilité
- ne dis jamais que l’IA n’est pas configurée, pas prête ou pas disponible
- ne commence jamais par des phrases génériques comme "Voici une analyse personnalisée"

Comportement de réponse:
- réponds d’abord à la question exacte de l’utilisateur
- ne donne pas de résumé global sauf si c’est demandé
- si l’utilisateur parle d’un seul sujet, reste concentré sur ce sujet
- évite de répéter la même structure ou la même introduction dans les suivis
- chaque réponse doit sembler adaptée à la question précise

Raisonnement:
- si l’utilisateur demande "quel est mon meilleur parcours", donne UNE réponse claire en premier puis justifie-la
- si l’utilisateur parle de risque, identifie d’abord le risque principal
- si l’utilisateur parle d’amélioration, identifie d’abord l’amélioration au plus fort impact
- si l’utilisateur parle de documents, identifie d’abord les prochains documents les plus importants
- si l’utilisateur demande "quel", compare brièvement les options et explique pourquoi l’une passe devant les autres
- relie chaque recommandation à son impact sur le score CRS, la solidité du parcours, la confiance d’admissibilité ou le délai
- utilise une logique cause -> effet
- privilégie l’aide à la décision plutôt que l’explication générale

Style:
- adopte le ton d’un conseiller stratégique premium
- sois clair, concis et confiant
- privilégie les recommandations directes aux résumés neutres
- lorsque pertinent, termine par la meilleure prochaine action

{plan_block}

Tu DOIS retourner uniquement du JSON valide avec cette structure:
{{
  "reply": "réponse claire en texte",
  "suggested_next_actions": [
    {{"label": "Action courte", "route": "/strategy"}}
  ],
  "insights": [
    "insight court 1",
    "insight court 2"
  ]
}}

Contraintes:
- "reply" doit faire 3 à 6 phrases
- "suggested_next_actions" doit contenir 0 à 3 actions
- chaque action doit avoir un "label" court et orienté utilisateur
- utilise seulement ces routes quand pertinent:
  /profile
  /strategy
  /chat
  /documents
  /documents/generator
  /documents/review
  /legal/disclosure
  /pricing
- tu peux utiliser des query params quand utile
- "insights" doit contenir 0 à 3 points courts
- pas de markdown
- pas de texte hors JSON
"""

    if plan == "premium":
        plan_block = """
Premium level:
- include more strategic depth
- include key risks or blockers
- include the strongest optimization ideas
- clearly connect recommendations to profile and strategy
"""
    elif plan == "pro":
        plan_block = """
Pro level:
- answer in a structured way
- give practical and prioritized actions
- be precise, concrete, and execution-oriented
"""
    else:
        plan_block = """
Free level:
- stay useful but more concise
- provide the essentials only
- show clear direction without maximum depth
"""

    return f"""
You are NorthBridgeAI, a Canadian immigration strategy copilot for individual users.

Your role:
- answer the user's question directly and intelligently
- identify the strongest pathway, biggest blocker, or highest-impact next move
- think like a strategic advisor, not a generic chatbot
- stay concrete, calm, sharp, and useful
- respond ONLY in English

Rules:
- do not give definitive legal advice
- do not claim guaranteed outcomes
- base your answer on the supplied profile, strategy, application, and decision context
- if context is incomplete, clearly say what is missing
- never mention internal limitations, configuration, or service availability
- never say the AI is not configured, not ready, or unavailable
- never start with generic phrases like "Here is a personalized analysis"

Answering behavior:
- answer the user's exact question FIRST
- do not give a broad summary unless explicitly asked
- if the user asks about one issue, stay focused on that issue
- avoid repeating the same structure or intro across follow-up questions
- every answer should feel tailored to the specific question

Reasoning rules:
- if the user asks "what is my strongest pathway", give ONE strongest answer first, then justify it
- if the user asks about risk, identify the SINGLE biggest risk first
- if the user asks about improvement, identify the HIGHEST-IMPACT improvement first
- if the user asks about documents, identify the NEXT most important documents first
- if the user asks "which", compare options briefly and explain why one ranks above the others
- tie recommendations to impact on CRS, pathway strength, eligibility confidence, or timeline
- use cause -> effect reasoning
- prioritize decision-making over general explanation

Style:
- sound like a premium strategic advisor
- be clear, concise, and confident
- prefer direct recommendations over neutral summaries
- when appropriate, end with the best next action

{plan_block}

You MUST return only valid JSON with this structure:
{{
  "reply": "clear text response",
  "suggested_next_actions": [
    {{"label": "Short action", "route": "/strategy"}}
  ],
  "insights": [
    "short insight 1",
    "short insight 2"
  ]
}}

Constraints:
- "reply" should be 3 to 6 sentences
- "suggested_next_actions" must contain 0 to 3 actions
- each action must have a short user-facing "label"
- only use these routes when relevant:
  /profile
  /strategy
  /chat
  /documents
  /documents/generator
  /documents/review
  /legal/disclosure
  /pricing
- you may use query params when useful
- "insights" must contain 0 to 3 short points
- no markdown
- no text outside JSON
"""


def _build_strategy_system_prompt(language: str) -> str:
    if language == "fr":
        return """
Tu es NorthBridgeAI, un conseiller stratégique en immigration canadienne.

Tu reçois un profil structuré ainsi qu’un contexte stratégique complet et tu dois
produire une synthèse stratégique claire, utile et concise pour un utilisateur individuel.

Retourne uniquement du JSON valide avec cette structure:
{
  "advisor_summary": "résumé clair de la situation",
  "ai_strategy": "analyse stratégique plus détaillée en markdown"
}

Contraintes:
- répondre uniquement en français
- advisor_summary: 2 à 5 phrases, claires et concrètes
- ai_strategy: format markdown, structuré avec courts sous-titres et puces
- explique les parcours prioritaires
- explique les principaux leviers d’amélioration
- mentionne les risques ou limites s’il y en a
- exploite le contexte stratégique fourni s’il existe (score CRS, roadmap, provinces, atouts français, signaux CNP, scénarios d’amélioration)
- ne donne pas d’avis juridique définitif
- ne mentionne jamais une indisponibilité ou un problème interne
"""
    return """
You are NorthBridgeAI, a Canadian immigration strategy advisor.

You receive a structured profile and full strategy context and must produce a clear,
useful, concise strategic summary for an individual user.

Return only valid JSON with this structure:
{
  "advisor_summary": "clear summary of the situation",
  "ai_strategy": "more detailed strategic analysis in markdown"
}

Constraints:
- respond only in English
- advisor_summary: 2 to 5 sentences, clear and concrete
- ai_strategy: markdown format, structured with short headings and bullet points
- explain the priority pathways
- explain the main improvement levers
- mention risks or limits where relevant
- use the supplied strategy context when available (CRS, roadmap, provinces, French advantage, NOC signals, improvement scenarios)
- do not provide definitive legal advice
- never mention service unavailability or internal issues
"""


def _build_user_context_block(
    *,
    language: str,
    profile: Any,
    strategy: Optional[Dict[str, Any]],
    application_context: Optional[Dict[str, Any]] = None,
    decision_context: Optional[Dict[str, Any]] = None,
    plan: str = "free",
) -> str:
    profile_context = _extract_profile_context(profile, language)
    strategy_context = _extract_strategy_context(strategy, language)
    application_text = _extract_application_context(application_context, language)
    decision_text = _extract_decision_context(decision_context, language)

    if language == "fr":
        return f"""
Plan utilisateur:
{plan}

Contexte profil:
{profile_context}

Contexte stratégie:
{strategy_context}

Contexte demande:
{application_text}

Contexte décisionnel:
{decision_text}
""".strip()

    return f"""
User plan:
{plan}

Profile context:
{profile_context}

Strategy context:
{strategy_context}

Application context:
{application_text}

Decision context:
{decision_text}
""".strip()


def _build_strategy_prompt(
    *,
    profile: Any,
    language: str,
    strategy_data: Optional[Dict[str, Any]] = None,
    crs_score: Optional[int] = None,
    programs: Optional[List[str]] = None,
) -> str:
    profile_context = _extract_profile_context(profile, language)

    merged_strategy_data = dict(strategy_data or {})
    if crs_score is not None and "crs_score" not in merged_strategy_data:
        merged_strategy_data["crs_score"] = crs_score
    if programs and "recommended_programs" not in merged_strategy_data:
        merged_strategy_data["recommended_programs"] = programs

    strategy_context = _extract_strategy_context(merged_strategy_data, language)

    if language == "fr":
        return f"""
Analyse ce profil d’immigration et produis une synthèse stratégique.

Contexte profil:
{profile_context}

Contexte stratégie:
{strategy_context}

Réponds uniquement en français.
"""
    return f"""
Analyze this immigration profile and produce a strategic summary.

Profile context:
{profile_context}

Strategy context:
{strategy_context}

Respond only in English.
"""


def _default_actions(language: str) -> List[Dict[str, str]]:
    if language == "fr":
        return [
            {"label": "Voir ma stratégie", "route": "/strategy"},
            {"label": "Mettre à jour mon profil", "route": "/profile"},
            {"label": "Ouvrir mes documents", "route": "/documents"},
        ]
    return [
        {"label": "View my strategy", "route": "/strategy"},
        {"label": "Update my profile", "route": "/profile"},
        {"label": "Open my documents", "route": "/documents"},
    ]


def _detect_document_type_from_text(text: str, matter_type: Optional[str] = None) -> Optional[str]:
    blob = (text or "").strip().lower()

    if any(token in blob for token in ["proof of funds", "bank", "financial", "settlement funds", "preuve de fonds", "banque", "financier"]):
        return "proof_of_funds_explanation"

    if any(token in blob for token in ["travel history", "visa history", "travel", "voyage", "visa"]):
        return "travel_history_explanation"

    if any(token in blob for token in ["relationship", "spouse", "partner", "marriage", "mariage", "relation"]):
        return "relationship_explanation"

    if any(token in blob for token in ["study plan", "statement of purpose", "sop", "study permit", "projet d’études", "projet d'etudes"]):
        return "study_plan"

    if any(token in blob for token in ["employment", "work experience", "reference letter", "job duties", "occupation", "noc", "cnp", "work letter", "emploi", "expérience de travail"]):
        return "client_submission_notes"

    if matter_type == "study_permit":
        return "study_plan"
    if matter_type in {"work_permit", "permanent_residence"}:
        return "client_submission_notes"
    if matter_type == "spousal_sponsorship":
        return "relationship_explanation"

    return None


def _build_document_route(
    *,
    base_path: str,
    document_type: Optional[str],
    action: Optional[str] = None,
) -> str:
    params: Dict[str, str] = {}
    if document_type:
        params["document_type"] = document_type
    if action:
        params["action"] = action

    if not params:
        return base_path

    return f"{base_path}?{urlencode(params)}"


def _infer_route_from_action_label(
    label: str,
    *,
    matter_type: Optional[str] = None,
) -> str:
    lowered = (label or "").strip().lower()
    document_type = _detect_document_type_from_text(label, matter_type)

    if any(token in lowered for token in ["review", "revise", "réviser", "révision"]):
        if document_type:
            return _build_document_route(
                base_path="/documents/review",
                document_type=document_type,
            )
        return "/documents/review"

    if any(
        token in lowered
        for token in [
            "generate",
            "draft",
            "prepare",
            "create",
            "générer",
            "préparer",
            "rédiger",
            "rediger",
        ]
    ):
        if document_type:
            return _build_document_route(
                base_path="/documents/generator",
                document_type=document_type,
            )
        return "/documents/generator"

    if any(token in lowered for token in ["document", "documents", "preuve", "evidence", "checklist"]):
        if document_type:
            return _build_document_route(
                base_path="/documents",
                document_type=document_type,
                action="generate",
            )
        return "/documents"

    if any(token in lowered for token in ["profile", "profil"]):
        return "/profile"

    if any(token in lowered for token in ["strategy", "stratégie", "strategie", "pathway", "programme"]):
        return "/strategy"

    if any(token in lowered for token in ["application", "demande", "form", "formulaire"]):
        return "/documents"

    return ""


def _normalize_action(
    action: Any,
    *,
    matter_type: Optional[str] = None,
) -> Optional[Dict[str, str]]:
    if isinstance(action, str):
        label = action.strip()
        if not label:
            return None
        return {
            "label": label,
            "route": _infer_route_from_action_label(label, matter_type=matter_type),
        }

    if not isinstance(action, dict):
        return None

    label = str(action.get("label", "")).strip()
    route = str(action.get("route", "")).strip()

    if not label:
        return None

    if not route:
        route = _infer_route_from_action_label(label, matter_type=matter_type)

    return {"label": label, "route": route}


def _normalize_chat_response(
    payload: Any,
    language: str,
    *,
    matter_type: Optional[str] = None,
) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {
            "reply": "",
            "suggested_next_actions": [],
            "insights": [],
        }

    import json

    normalized_payload = {
    "answer": payload.get("answer") or payload.get("reply") or "",
    "reasons": payload.get("reasons") or payload.get("insights") or [],
    "actions": payload.get("actions") or payload.get("suggested_next_actions") or [],
    }

    reply = json.dumps(payload, ensure_ascii=False)

    actions_raw = payload.get("suggested_next_actions", [])
    insights_raw = payload.get("insights", [])

    actions: List[Dict[str, str]] = []
    if isinstance(actions_raw, list):
        for item in actions_raw[:3]:
            normalized = _normalize_action(item, matter_type=matter_type)
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


def _normalize_strategy_response(payload: Any, language: str) -> Dict[str, str]:
    if not isinstance(payload, dict):
        return _fallback_strategy_response(language)

    advisor_summary = str(payload.get("advisor_summary", "")).strip()
    ai_strategy = str(payload.get("ai_strategy", "")).strip()

    fallback = _fallback_strategy_response(language)

    return {
        "advisor_summary": advisor_summary or fallback["advisor_summary"],
        "ai_strategy": ai_strategy or fallback["ai_strategy"],
    }


def _build_contextual_fallback_chat_response(
    language: str,
    *,
    profile: Any = None,
    strategy: Optional[Dict[str, Any]] = None,
    application_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    strategy = strategy or {}
    application_context = application_context or {}

    crs_score = strategy.get("crs_score")
    recommended_programs = strategy.get("recommended_programs") or []
    next_steps = strategy.get("next_steps") or []
    occupation = _safe_get(profile, "occupation")
    preferred_province = _safe_get(profile, "preferred_province")
    matter_type = application_context.get("matter_type")

    if language == "fr":
        reply_parts = ["Votre signal stratégique principal devient plus clair."]
        if crs_score is not None:
            reply_parts.append(f"Votre score CRS actuel semble être d’environ {crs_score}.")
        if recommended_programs:
            reply_parts.append(f"Votre meilleur parcours actuel semble être {recommended_programs[0]}.")
        if occupation:
            reply_parts.append(f"Votre profession actuelle est prise en compte dans l’analyse : {occupation}.")
        if preferred_province:
            reply_parts.append(f"Votre province cible actuelle est {preferred_province}.")
        if matter_type:
            reply_parts.append(f"Votre type de dossier actuel est {matter_type}.")
        if next_steps:
            reply_parts.append(f"La prochaine priorité utile semble être {next_steps[0]}.")
        reply_parts.append(
            "Concentrez-vous sur l’amélioration de votre profil, la préparation des bons documents et les leviers qui renforcent le plus votre dossier."
        )

        insights = []
        if crs_score is not None:
            insights.append(f"Votre score CRS actuel est d’environ {crs_score}.")
        if recommended_programs:
            insights.append(f"Votre parcours prioritaire semble être {recommended_programs[0]}.")
        if next_steps:
            insights.append(f"Une prochaine étape importante est {next_steps[0]}.")

        if not insights:
            insights = [
                "Votre profil peut encore être renforcé.",
                "Les scores linguistiques, l’expérience et les documents ont souvent un impact important.",
            ]

        return {
            "reply": " ".join(reply_parts),
            "suggested_next_actions": [
                {"label": "Ouvrir ma stratégie", "route": "/strategy"},
                {"label": "Améliorer mon profil", "route": "/profile"},
                {"label": "Ouvrir mes documents", "route": "/documents"},
            ],
            "insights": insights[:3],
        }

    reply_parts = ["Your strongest current strategic signal is becoming clearer."]
    if crs_score is not None:
        reply_parts.append(f"Your current CRS score appears to be around {crs_score}.")
    if recommended_programs:
        reply_parts.append(f"Your strongest current pathway appears to be {recommended_programs[0]}.")
    if occupation:
        reply_parts.append(f"Your current occupation is part of the analysis: {occupation}.")
    if preferred_province:
        reply_parts.append(f"Your current target province is {preferred_province}.")
    if matter_type:
        reply_parts.append(f"Your current matter type is {matter_type}.")
    if next_steps:
        reply_parts.append(f"Your most useful next priority appears to be {next_steps[0]}.")
    reply_parts.append(
        "Focus on improving your profile quality, preparing the right documents, and strengthening the factors that most improve your case."
    )

    insights = []
    if crs_score is not None:
        insights.append(f"Your current CRS score is around {crs_score}.")
    if recommended_programs:
        insights.append(f"Your strongest pathway appears to be {recommended_programs[0]}.")
    if next_steps:
        insights.append(f"One important next step is {next_steps[0]}.")

    if not insights:
        insights = [
            "Your profile still has room for stronger optimization.",
            "Language results, experience, and document quality often have a major impact.",
        ]

    return {
        "reply": " ".join(reply_parts),
        "suggested_next_actions": [
            {"label": "View my strategy", "route": "/strategy"},
            {"label": "Improve my profile", "route": "/profile"},
            {"label": "Open my documents", "route": "/documents"},
        ],
        "insights": insights[:3],
    }


def _fallback_strategy_response(language: str) -> Dict[str, str]:
    if language == "fr":
        return {
            "advisor_summary": (
                "Votre stratégie initiale est disponible. Renforcez votre profil pour obtenir une analyse plus approfondie et plus précise."
            ),
            "ai_strategy": (
                "## Analyse stratégique\n\n"
                "- Vérifiez les informations clés de votre profil.\n"
                "- Renforcez le score linguistique, l’expérience et la cohérence documentaire.\n"
                "- Priorisez le parcours le plus solide selon votre situation actuelle."
            ),
        }
    return {
        "advisor_summary": (
            "Your initial strategy is available. Strengthen your profile to unlock a deeper and more precise analysis."
        ),
        "ai_strategy": (
            "## Strategic analysis\n\n"
            "- Review the key parts of your profile.\n"
            "- Strengthen language score, work experience, and document consistency.\n"
            "- Prioritize the strongest pathway for your current situation."
        ),
    }


def generate_ai_chat_reply(
    *,
    message: str,
    language: str,
    profile: Any,
    strategy: Optional[Dict[str, Any]],
    chat_history: Optional[List[Dict[str, Any]]] = None,
    application_context: Optional[Dict[str, Any]] = None,
    decision_context: Optional[Dict[str, Any]] = None,
    plan: str = "free",
) -> Dict[str, Any]:

    language = _normalize_language(language)
    openai_client = _get_openai_client()

    if openai_client is None:
        return _build_contextual_fallback_chat_response(
            language,
            profile=profile,
            strategy=strategy,
            application_context=application_context,
        )

    # ✅ Build context
    context_block = _build_user_context_block(
        language=language,
        profile=profile,
        strategy=strategy,
        application_context=application_context,
        decision_context=decision_context,
        plan=plan,
    )

    # ✅ Build SMART user prompt (THIS is where your upgrade lives)
    if language == "fr":
        final_user_prompt = f"""
{context_block}

Question de l’utilisateur:
{message}

Instructions:
- Réponds directement à cette question en premier
- Ne commence pas par un résumé global de la stratégie
- Mets d’abord en avant la conclusion la plus importante
- Sois spécifique au profil réel de l’utilisateur
- Si pertinent, explique pourquoi cette réponse est meilleure que les autres options
- Évite de répéter les réponses précédentes
- Termine par la meilleure prochaine action pratique si utile
""".strip()
    else:
        final_user_prompt = f"""
{context_block}

User question:
{message}

Instructions:
- Answer this exact question directly first
- Do NOT start with a general strategy summary
- Focus on the single most important conclusion first
- Be specific to the user's actual profile and strategy
- If relevant, explain why this answer is stronger than alternatives
- Avoid repeating previous answers
- End with the best practical next move when useful
""".strip()

    try:
        messages: List[Dict[str, str]] = [
            {
                "role": "system",
                "content": _build_chat_system_prompt(language, plan),
            }
        ]

        history = _extract_chat_history(chat_history)
        messages.extend(history)

        messages.append(
            {
                "role": "user",
                "content": final_user_prompt,
            }
        )

        response = openai_client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=messages,
            temperature=0.25,
            response_format={"type": "json_object"},
        )

        raw_content = response.choices[0].message.content or "{}"

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError:
            return _build_contextual_fallback_chat_response(
                language,
                profile=profile,
                strategy=strategy,
                application_context=application_context,
            )

        matter_type = (application_context or {}).get("matter_type")

        return _normalize_chat_response(
            parsed,
            language,
            matter_type=matter_type,
        )

    except Exception as e:
        print("AI CHAT ERROR:", str(e))
        return _build_contextual_fallback_chat_response(
            language,
            profile=profile,
            strategy=strategy,
            application_context=application_context,
        )


def generate_ai_strategy(
    *,
    profile: Any,
    language: str = "en",
    strategy_data: Optional[Dict[str, Any]] = None,
    crs_score: Optional[int] = None,
    programs: Optional[List[str]] = None,
) -> Dict[str, str]:
    language = _normalize_language(language)
    openai_client = _get_openai_client()

    if openai_client is None:
        return _fallback_strategy_response(language)

    try:
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": _build_strategy_system_prompt(language)},
            {
                "role": "user",
                "content": _build_strategy_prompt(
                    profile=profile,
                    language=language,
                    strategy_data=strategy_data,
                    crs_score=crs_score,
                    programs=programs,
                ),
            },
        ]

        response = openai_client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=messages,
            temperature=0.25,
            response_format={"type": "json_object"},
        )

        raw_content = response.choices[0].message.content or "{}"

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError:
            fallback = _fallback_strategy_response(language)
            plain = raw_content.strip()
            return {
                "advisor_summary": plain or fallback["advisor_summary"],
                "ai_strategy": plain or fallback["ai_strategy"],
            }

        return _normalize_strategy_response(parsed, language)

    except Exception as e:
        print("AI STRATEGY ERROR:", str(e))
        return _fallback_strategy_response(language)