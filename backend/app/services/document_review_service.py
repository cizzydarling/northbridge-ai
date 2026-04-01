from typing import Any, Optional

from app.services.ai_advisor import get_openai_client


def normalize_language(language: str | None) -> str:
    value = (language or "en").strip().lower()
    return "fr" if value == "fr" else "en"


def t(en: str, fr: str, language: str) -> str:
    return fr if normalize_language(language) == "fr" else en


def safe_get(source: Any, key: str, default=None):
    if source is None:
        return default
    if isinstance(source, dict):
        return source.get(key, default)
    return getattr(source, key, default)


def document_type_label(document_type: str, language: str) -> str:
    language = normalize_language(language)

    labels = {
        "letter_of_explanation": ("Letter of Explanation", "Lettre d’explication"),
        "study_plan": ("Study Plan", "Projet d’études"),
        "client_submission_notes": ("Client Submission Notes", "Notes de soumission du client"),
        "travel_history_explanation": (
            "Travel History Explanation",
            "Explication de l’historique de voyage",
        ),
        "proof_of_funds_explanation": (
            "Proof of Funds Explanation",
            "Explication de la preuve de fonds",
        ),
        "relationship_explanation": (
            "Relationship Explanation",
            "Explication de la relation",
        ),
        "other": ("Other Document", "Autre document"),
    }

    en, fr = labels.get(document_type, ("Other Document", "Autre document"))
    return fr if language == "fr" else en


def build_profile_context(profile: Any, language: str) -> str:
    language = normalize_language(language)

    age = safe_get(profile, "age", "Not provided")
    education = safe_get(profile, "education", "Not provided")
    occupation = safe_get(profile, "occupation", "Not provided")
    language_score = safe_get(profile, "language_score", "Not provided")
    experience_years = safe_get(profile, "experience_years", "Not provided")
    preferred_province = safe_get(profile, "preferred_province", "Not provided")
    has_job_offer = bool(safe_get(profile, "has_job_offer", False))
    has_canadian_experience = bool(safe_get(profile, "has_canadian_experience", False))
    studied_in_canada = bool(safe_get(profile, "studied_in_canada", False))

    if language == "fr":
        return f"""
Profil utilisateur:
- Âge: {age}
- Études: {education}
- Profession: {occupation}
- Score linguistique: {language_score}
- Expérience professionnelle (années): {experience_years}
- Province préférée: {preferred_province}
- Offre d’emploi: {"Oui" if has_job_offer else "Non"}
- Expérience canadienne: {"Oui" if has_canadian_experience else "Non"}
- Études au Canada: {"Oui" if studied_in_canada else "Non"}
""".strip()

    return f"""
User profile:
- Age: {age}
- Education: {education}
- Occupation: {occupation}
- Language score: {language_score}
- Work experience (years): {experience_years}
- Preferred province: {preferred_province}
- Job offer: {"Yes" if has_job_offer else "No"}
- Canadian experience: {"Yes" if has_canadian_experience else "No"}
- Studied in Canada: {"Yes" if studied_in_canada else "No"}
""".strip()


def build_strategy_context(strategy: Optional[dict], decision: Optional[dict], language: str) -> str:
    language = normalize_language(language)
    strategy = strategy or {}
    decision = decision or {}

    recommended_programs = strategy.get("recommended_programs", []) or []
    next_steps = strategy.get("next_steps", []) or []
    french_advantage = strategy.get("french_advantage", {}) or {}
    priority_label = decision.get("priority_label", "Not available")
    primary_recommendation = decision.get("primary_recommendation", "Not available")

    if language == "fr":
        return f"""
Contexte stratégique:
- Programmes recommandés: {recommended_programs}
- Prochaines étapes: {next_steps}
- Avantage francophone: {french_advantage}
- Priorité actuelle: {priority_label}
- Recommandation principale: {primary_recommendation}
""".strip()

    return f"""
Strategy context:
- Recommended programs: {recommended_programs}
- Next steps: {next_steps}
- French advantage: {french_advantage}
- Current priority: {priority_label}
- Primary recommendation: {primary_recommendation}
""".strip()


def fallback_review(
    *,
    document_type: str,
    content: str,
    language: str,
) -> dict:
    language = normalize_language(language)

    preview = content[:1200].strip()
    if len(content) > 1200:
      preview += "\n\n[...]"

    if language == "fr":
        return {
            "language": "fr",
            "document_type": document_type,
            "summary": (
                "Le document semble utilisable comme base, mais il devrait être revu pour "
                "améliorer la clarté, la cohérence et les éléments de preuve."
            ),
            "strengths": [
                "Le document fournit déjà un point de départ structuré.",
                "Le ton général peut être adapté à une soumission formelle.",
            ],
            "concerns": [
                "Certaines affirmations peuvent manquer de détails précis.",
                "Le lien entre les faits et l’objectif du document peut être renforcé.",
            ],
            "missing_support": [
                "Ajouter des preuves ou pièces justificatives pour appuyer les points importants.",
                "Préciser les dates, événements et éléments contextuels clés si disponibles.",
            ],
            "improvement_actions": [
                "Clarifier l’objectif principal du document dès le début.",
                "Rendre les paragraphes plus précis et mieux structurés.",
                "Vérifier que chaque affirmation importante peut être soutenue par un document.",
            ],
            "reviewed_document_preview": preview,
            "disclaimer": (
                "Cette révision IA est fournie à titre informatif général et doit être vérifiée "
                "avant utilisation."
            ),
        }

    return {
        "language": "en",
        "document_type": document_type,
        "summary": (
            "The document appears usable as a starting point, but it should be reviewed "
            "to improve clarity, coherence, and supporting evidence."
        ),
        "strengths": [
            "The document already provides a structured starting point.",
            "The overall tone can be adapted for a formal submission.",
        ],
        "concerns": [
            "Some claims may still lack precise detail.",
            "The link between the facts and the document’s purpose could be strengthened.",
        ],
        "missing_support": [
            "Add supporting evidence or exhibits for the most important points.",
            "Clarify dates, events, and key contextual details where available.",
        ],
        "improvement_actions": [
            "State the main purpose of the document more clearly at the beginning.",
            "Make each paragraph more specific and better organized.",
            "Check that each important claim can be supported by documentation.",
        ],
        "reviewed_document_preview": preview,
        "disclaimer": (
            "This AI review is general informational support and should be verified before use."
        ),
    }


def _trim_list(items: list[str], max_items: int) -> list[str]:
    cleaned = []
    seen = set()

    for item in items:
        value = str(item or "").strip()
        key = value.lower()
        if not value or key in seen:
            continue
        seen.add(key)
        cleaned.append(value)
        if len(cleaned) >= max_items:
            break

    return cleaned


def review_document_with_ai(
    *,
    document_type: str,
    content: str,
    language: str,
    review_depth: str,
    additional_context: Optional[str],
    profile: Any,
    strategy: Optional[dict],
    decision: Optional[dict],
) -> dict:
    language = normalize_language(language)
    client = get_openai_client()

    fallback = fallback_review(
        document_type=document_type,
        content=content,
        language=language,
    )

    if client is None:
        return fallback

    doc_label = document_type_label(document_type, language)
    profile_context = build_profile_context(profile, language)
    strategy_context = build_strategy_context(strategy, decision, language)

    if language == "fr":
        system_prompt = """
Vous êtes le réviseur de documents de NorthBridgeAI.

Répondez toujours en français.
Votre rôle est de revoir un document d’immigration ou de soutien connexe.
Soyez concret, structuré, prudent et utile.
N’inventez pas de faits.
N’affirmez pas qu’un document sera accepté.
Ne donnez pas d’avis juridique définitif.
Retournez une réponse JSON stricte avec les clés:
summary, strengths, concerns, missing_support, improvement_actions, reviewed_document_preview
""".strip()

        user_prompt = f"""
Type de document: {doc_label}
Profondeur de revue: {review_depth}

{profile_context}

{strategy_context}

Contexte additionnel:
{additional_context or "Aucun"}

Document à revoir:
\"\"\"
{content}
\"\"\"

Instructions:
- Résumer rapidement la qualité générale du document
- Relever les points forts
- Relever les faiblesses ou risques
- Identifier les preuves ou détails potentiellement manquants
- Donner des actions d’amélioration concrètes
- Fournir un extrait d’aperçu du document revu
- Répondre en JSON strict uniquement
""".strip()
    else:
        system_prompt = """
You are NorthBridgeAI's document review assistant.

Always respond in English.
Your role is to review an immigration-related or supporting document.
Be concrete, structured, cautious, and useful.
Do not invent facts.
Do not say a document will be approved.
Do not provide definitive legal advice.
Return strict JSON with the keys:
summary, strengths, concerns, missing_support, improvement_actions, reviewed_document_preview
""".strip()

        user_prompt = f"""
Document type: {doc_label}
Review depth: {review_depth}

{profile_context}

{strategy_context}

Additional context:
{additional_context or "None"}

Document to review:
\"\"\"
{content}
\"\"\"

Instructions:
- Briefly summarize overall document quality
- Identify strengths
- Identify weaknesses or risks
- Identify potentially missing evidence or details
- Give concrete improvement actions
- Provide a reviewed preview excerpt
- Return strict JSON only
""".strip()

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        import json

        raw = response.choices[0].message.content or "{}"
        parsed = json.loads(raw)

        return {
            "language": language,
            "document_type": document_type,
            "summary": str(parsed.get("summary") or fallback["summary"]).strip(),
            "strengths": _trim_list(parsed.get("strengths") or fallback["strengths"], 6),
            "concerns": _trim_list(parsed.get("concerns") or fallback["concerns"], 6),
            "missing_support": _trim_list(
                parsed.get("missing_support") or fallback["missing_support"],
                6,
            ),
            "improvement_actions": _trim_list(
                parsed.get("improvement_actions") or fallback["improvement_actions"],
                6,
            ),
            "reviewed_document_preview": str(
                parsed.get("reviewed_document_preview")
                or fallback["reviewed_document_preview"]
            ).strip(),
            "disclaimer": t(
                "This AI review is general informational support and should be verified before use.",
                "Cette révision IA est fournie à titre informatif général et doit être vérifiée avant utilisation.",
                language,
            ),
        }
    except Exception:
        return fallback