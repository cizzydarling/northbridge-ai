print("🔥 UPDATED AI_ADVISOR LOADED")
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
    improvement_scenarios = strategy.get("improvement_scenarios") or []
    province_recommendations = strategy.get("province_recommendations") or []
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
    checklist = application_context.get("checklist") or []
    missing_fields = application_context.get("missing_fields") or []
    recommended_forms = application_context.get("recommended_forms") or []
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
        premium_block = ""
        if plan == "premium":
            premium_block = """
Niveau premium:
- inclure une analyse plus stratégique
- inclure les principaux risques ou blocages
- inclure les meilleures optimisations possibles
"""
        elif plan == "pro":
            premium_block = """
Niveau pro:
- répondre de façon structurée
- donner des actions pratiques et prioritaires
- être plus précis qu’une simple réponse générale
"""
        else:
            premium_block = """
Niveau gratuit:
- rester utile mais plus concis
- donner l’essentiel seulement
"""

        return f"""
Tu es NorthBridgeAI, un copilote d’immigration canadienne pour utilisateurs individuels.

Ton rôle:
- expliquer la situation de l’utilisateur de façon simple
- identifier les points forts et les blocages
- recommander les meilleures prochaines étapes
- rester concret, rassurant, structuré et utile

Règles:
- ne donne pas d’avis juridique définitif
- ne prétends pas garantir un résultat
- base-toi sur le profil, la stratégie, la demande et le contexte décisionnel fournis
- si le contexte est incomplet, indique clairement ce qui manque
- suggère des actions courtes et pratiques

{premium_block}

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
- tu peux utiliser des query params quand utile, par exemple:
  /documents/generator?document_type=study_plan
  /documents/review?document_type=client_submission_notes
  /self/documents?document_type=proof_of_funds_explanation&action=generate
- "insights" doit contenir 0 à 3 points courts
"""
    premium_block = ""
    if plan == "premium":
        premium_block = """
Premium level:
- include more strategic depth
- include key risks or blockers
- include the strongest optimization ideas
"""
    elif plan == "pro":
        premium_block = """
Pro level:
- answer in a structured way
- give practical and prioritized actions
- be more precise than a general answer
"""
    else:
        premium_block = """
Free level:
- stay useful but more concise
- provide the essentials only
"""

    return f"""
You are NorthBridgeAI, a Canadian immigration copilot for individual users.

Your role:
- explain the user's situation simply
- identify strengths and blockers
- recommend the best next steps
- stay concrete, calm, structured, and useful

Rules:
- do not give definitive legal advice
- do not claim guaranteed outcomes
- base your answer on the supplied profile, strategy, application, and decision context
- if context is incomplete, clearly say what is missing
- suggest short, practical actions

{premium_block}

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
- you may use query params when useful, for example:
  /documents/generator?document_type=study_plan
  /documents/review?document_type=client_submission_notes
  /self/documents?document_type=proof_of_funds_explanation&action=generate
- "insights" must contain 0 to 3 short points
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
- advisor_summary: 2 à 5 phrases, claires et concrètes
- ai_strategy: format markdown, structuré avec courts sous-titres et puces
- explique les parcours prioritaires
- explique les principaux leviers d’amélioration
- mentionne les risques ou limites s’il y en a
- exploite le contexte stratégique fourni s’il existe (score CRS, roadmap, provinces, atouts français, signaux CNP, scénarios d’amélioration)
- ne donne pas d’avis juridique définitif
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
- advisor_summary: 2 to 5 sentences, clear and concrete
- ai_strategy: markdown format, structured with short headings and bullet points
- explain the priority pathways
- explain the main improvement levers
- mention risks or limits where relevant
- use the supplied strategy context when available (CRS, roadmap, provinces, French advantage, NOC signals, improvement scenarios)
- do not provide definitive legal advice
"""


def _build_user_prompt(
    *,
    message: str,
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
Message utilisateur:
{message}

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

Réponds en français.
"""
    return f"""
User message:
{message}

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

Respond in English.
"""


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

Réponds en français.
"""
    return f"""
Analyze this immigration profile and produce a strategic summary.

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


def _fallback_chat_response(language: str) -> Dict[str, Any]:
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


def _fallback_strategy_response(language: str) -> Dict[str, str]:
    if language == "fr":
        return {
            "advisor_summary": (
                "Votre stratégie initiale est disponible. Complétez ou améliorez votre profil "
                "pour obtenir une analyse IA plus approfondie."
            ),
            "ai_strategy": (
                "## Analyse stratégique\n\n"
                "- Complétez votre profil si certaines informations sont manquantes.\n"
                "- Vérifiez vos scores linguistiques, votre expérience et votre province cible.\n"
                "- Utilisez l’assistant IA pour comprendre vos prochaines priorités."
            ),
        }
    return {
        "advisor_summary": (
            "Your initial strategy is available. Complete or improve your profile "
            "to unlock a deeper AI analysis."
        ),
        "ai_strategy": (
            "## Strategic analysis\n\n"
            "- Complete your profile if some information is missing.\n"
            "- Review language scores, work experience, and target province.\n"
            "- Use the AI assistant to understand your next priorities."
        ),
    }


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
                base_path="/self/documents",
                document_type=document_type,
                action="generate",
            )
        return "/self/documents"

    if any(token in lowered for token in ["profile", "profil"]):
        return "/profile"

    if any(token in lowered for token in ["strategy", "stratégie", "strategie", "pathway", "programme"]):
        return "/strategy"

    if any(token in lowered for token in ["application", "demande", "form", "formulaire"]):
        return "/self/application"

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
        return _fallback_chat_response(language)

    reply = str(payload.get("reply", "")).strip()
    if not reply:
        reply = _fallback_chat_response(language)["reply"]

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
        return _fallback_chat_response(language)

    try:
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": _build_chat_system_prompt(language, plan)}
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
                    application_context=application_context,
                    decision_context=decision_context,
                    plan=plan,
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
                "reply": raw_content.strip() or _fallback_chat_response(language)["reply"],
                "suggested_next_actions": _default_actions(language),
                "insights": [],
            }

        matter_type = None
        if isinstance(application_context, dict):
            matter_type = application_context.get("matter_type")

        normalized = _normalize_chat_response(
            parsed,
            language,
            matter_type=matter_type,
        )

        if not normalized.get("suggested_next_actions"):
            document_type = _detect_document_type_from_text(
                f"{message}\n{normalized.get('reply', '')}",
                matter_type=matter_type,
            )
            if document_type:
                if language == "fr":
                    normalized["suggested_next_actions"] = [
                        {
                            "label": "Générer ce document",
                            "route": _build_document_route(
                                base_path="/documents/generator",
                                document_type=document_type,
                            ),
                        },
                        {
                            "label": "Réviser ce document",
                            "route": _build_document_route(
                                base_path="/documents/review",
                                document_type=document_type,
                            ),
                        },
                    ]
                else:
                    normalized["suggested_next_actions"] = [
                        {
                            "label": "Generate this document",
                            "route": _build_document_route(
                                base_path="/documents/generator",
                                document_type=document_type,
                            ),
                        },
                        {
                            "label": "Review this document",
                            "route": _build_document_route(
                                base_path="/documents/review",
                                document_type=document_type,
                            ),
                        },
                    ]

        return normalized

    except Exception as e:
        print("AI CHAT ERROR:", str(e))
        return _fallback_chat_response(language)


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
            temperature=0.3,
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