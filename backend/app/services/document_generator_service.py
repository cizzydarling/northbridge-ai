from typing import Any, Dict, Optional

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


def document_title(document_type: str, language: str) -> str:
    language = normalize_language(language)

    titles = {
        "letter_of_explanation": (
            "Letter of Explanation",
            "Lettre d’explication",
        ),
        "study_plan": (
            "Study Plan",
            "Projet d’études",
        ),
        "client_submission_notes": (
            "Client Submission Notes",
            "Notes de soumission du client",
        ),
        "travel_history_explanation": (
            "Travel History Explanation",
            "Explication de l’historique de voyage",
        ),
        "proof_of_funds_explanation": (
            "Proof of Funds Explanation",
            "Explication de la preuve de fonds",
        ),
        "relationship_explanation": (
            "Relationship Explanation Letter",
            "Lettre d’explication de la relation",
        ),
    }

    en, fr = titles.get(document_type, ("Generated Document", "Document généré"))
    return fr if language == "fr" else en


def document_filename(document_type: str, language: str) -> str:
    language = normalize_language(language)

    names = {
        "letter_of_explanation": (
            "letter_of_explanation",
            "lettre_explication",
        ),
        "study_plan": (
            "study_plan",
            "projet_etudes",
        ),
        "client_submission_notes": (
            "client_submission_notes",
            "notes_soumission_client",
        ),
        "travel_history_explanation": (
            "travel_history_explanation",
            "explication_historique_voyage",
        ),
        "proof_of_funds_explanation": (
            "proof_of_funds_explanation",
            "explication_preuve_fonds",
        ),
        "relationship_explanation": (
            "relationship_explanation",
            "explication_relation",
        ),
    }

    en, fr = names.get(document_type, ("generated_document", "document_genere"))
    return (fr if language == "fr" else en) + ".docx"


def build_profile_context(profile: Any, language: str) -> str:
    language = normalize_language(language)

    age = safe_get(profile, "age", "Not provided")
    education = safe_get(profile, "education", "Not provided")
    language_score = safe_get(profile, "language_score", "Not provided")
    experience_years = safe_get(profile, "experience_years", "Not provided")
    occupation = safe_get(profile, "occupation", "Not provided")
    noc_code = safe_get(profile, "noc_code", "Not provided")
    preferred_province = safe_get(profile, "preferred_province", "Not provided")
    has_job_offer = bool(safe_get(profile, "has_job_offer", False))
    has_canadian_experience = bool(safe_get(profile, "has_canadian_experience", False))
    studied_in_canada = bool(safe_get(profile, "studied_in_canada", False))

    if language == "fr":
        return f"""
Profil utilisateur:
- Âge: {age}
- Études: {education}
- Score linguistique: {language_score}
- Expérience professionnelle (années): {experience_years}
- Profession: {occupation}
- Code CNP: {noc_code}
- Province préférée: {preferred_province}
- Offre d’emploi: {"Oui" if has_job_offer else "Non"}
- Expérience canadienne: {"Oui" if has_canadian_experience else "Non"}
- Études au Canada: {"Oui" if studied_in_canada else "Non"}
""".strip()

    return f"""
User profile:
- Age: {age}
- Education: {education}
- Language score: {language_score}
- Work experience (years): {experience_years}
- Occupation: {occupation}
- NOC code: {noc_code}
- Preferred province: {preferred_province}
- Job offer: {"Yes" if has_job_offer else "No"}
- Canadian experience: {"Yes" if has_canadian_experience else "No"}
- Studied in Canada: {"Yes" if studied_in_canada else "No"}
""".strip()


def build_application_context(application: Optional[dict], language: str) -> str:
    language = normalize_language(language)
    application = application or {}

    matter_type = application.get("matter_type", "Not provided")
    intake = application.get("intake_payload", {}) or {}

    if language == "fr":
        return f"""
Contexte de la demande:
- Type de demande: {matter_type}
- Données d’entrée: {intake}
""".strip()

    return f"""
Application context:
- Matter type: {matter_type}
- Intake data: {intake}
""".strip()


def build_decision_context(decision: Optional[dict], strategy: Optional[dict], language: str) -> str:
    language = normalize_language(language)
    decision = decision or {}
    strategy = strategy or {}

    priority_label = decision.get("priority_label", "Not available")
    priority_reason = decision.get("priority_reason", "Not available")
    primary_recommendation = decision.get("primary_recommendation", "Not available")
    recommended_actions = decision.get("recommended_actions", []) or []
    top_pathways = decision.get("top_pathways", []) or []
    french_advantage = strategy.get("french_advantage", {}) or {}

    if language == "fr":
        return f"""
Contexte stratégique:
- Priorité: {priority_label}
- Raison de priorité: {priority_reason}
- Recommandation principale: {primary_recommendation}
- Actions recommandées: {recommended_actions}
- Voies principales: {top_pathways}
- Avantage francophone: {french_advantage}
""".strip()

    return f"""
Strategy context:
- Priority: {priority_label}
- Priority reason: {priority_reason}
- Primary recommendation: {primary_recommendation}
- Recommended actions: {recommended_actions}
- Top pathways: {top_pathways}
- French advantage: {french_advantage}
""".strip()


def fallback_document(
    *,
    document_type: str,
    language: str,
    profile: Any,
    application: Optional[dict],
    decision: Optional[dict],
) -> dict:
    language = normalize_language(language)
    title = document_title(document_type, language)

    if language == "fr":
        content = f"""Objet : {title}

Madame, Monsieur,

Je soumets ce document afin de fournir un contexte clair et structuré concernant ma situation.

Résumé de mon profil :
- Âge : {safe_get(profile, "age", "Non précisé")}
- Études : {safe_get(profile, "education", "Non précisé")}
- Profession : {safe_get(profile, "occupation", "Non précisé")}
- Province préférée : {safe_get(profile, "preferred_province", "Non précisé")}

Contexte de la demande :
- Type de demande : {(application or {}).get("matter_type", "Non précisé")}

Éléments stratégiques importants :
- Priorité actuelle : {(decision or {}).get("priority_label", "Non précisé")}
- Recommandation principale : {(decision or {}).get("primary_recommendation", "Non précisé")}

Je confirme que les renseignements fournis sont exacts à ma connaissance et je reste disponible pour fournir tout document complémentaire requis.

Cordialement,
[Nom complet]
"""
        disclaimer = "Ce brouillon est fourni à titre informatif général et doit être révisé avant utilisation."
    else:
        content = f"""Subject: {title}

To whom it may concern,

I am submitting this document to provide clear and structured context regarding my situation.

Profile summary:
- Age: {safe_get(profile, "age", "Not provided")}
- Education: {safe_get(profile, "education", "Not provided")}
- Occupation: {safe_get(profile, "occupation", "Not provided")}
- Preferred province: {safe_get(profile, "preferred_province", "Not provided")}

Application context:
- Matter type: {(application or {}).get("matter_type", "Not provided")}

Important strategic context:
- Current priority: {(decision or {}).get("priority_label", "Not provided")}
- Primary recommendation: {(decision or {}).get("primary_recommendation", "Not provided")}

I confirm that the information provided is accurate to the best of my knowledge, and I remain available to provide any further supporting documents if required.

Sincerely,
[Full Name]
"""
        disclaimer = "This draft is general informational support and should be reviewed before use."

    return {
        "title": title,
        "document_type": document_type,
        "language": language,
        "content": content,
        "disclaimer": disclaimer,
    }


def generate_document_draft(
    *,
    document_type: str,
    language: str,
    tone: str,
    additional_instructions: Optional[str],
    profile: Any,
    application: Optional[dict],
    decision: Optional[dict],
    strategy: Optional[dict],
    context_overrides: Optional[Dict[str, Any]] = None,
) -> dict:
    language = normalize_language(language)
    client = get_openai_client()
    title = document_title(document_type, language)
    context_overrides = context_overrides or {}

    fallback = fallback_document(
        document_type=document_type,
        language=language,
        profile=profile,
        application=application,
        decision=decision,
    )

    if client is None:
        return fallback

    profile_context = build_profile_context(profile, language)
    application_context = build_application_context(application, language)
    decision_context = build_decision_context(decision, strategy, language)

    if language == "fr":
        system_prompt = """
Vous êtes l’assistant de rédaction documentaire de NorthBridgeAI.

Rédigez toujours en français.
Produisez un document propre, clair, professionnel et prêt à être révisé.
N’inventez jamais de faits précis qui ne sont pas fournis.
Si une donnée manque, utilisez un libellé neutre ou un crochet comme [à compléter].
N’utilisez pas de ton juridique agressif.
Ne prétendez pas être avocat.
""".strip()

        user_prompt = f"""
Générez un document de type: {document_type}
Titre attendu: {title}
Ton souhaité: {tone}

{profile_context}

{application_context}

{decision_context}

Informations supplémentaires de l’utilisateur:
{additional_instructions or "Aucune"}

Remplacements manuels / contexte additionnel:
{context_overrides}

Exigences:
- Produire un document complet et bien structuré
- Utiliser des paragraphes naturels
- Adapter le contenu au type de document demandé
- Garder les formulations crédibles, sobres et professionnelles
- Ne pas ajouter de promesses ni de conclusions juridiques
- Retourner seulement le corps du document
""".strip()
    else:
        system_prompt = """
You are NorthBridgeAI's document drafting assistant.

Always write in English.
Produce a clean, professional, review-ready draft.
Never invent precise facts that were not provided.
If information is missing, use neutral placeholders like [to be completed].
Do not sound overly legalistic.
Do not claim to be a lawyer.
""".strip()

        user_prompt = f"""
Generate a document of type: {document_type}
Expected title: {title}
Desired tone: {tone}

{profile_context}

{application_context}

{decision_context}

Additional user instructions:
{additional_instructions or "None"}

Manual overrides / extra context:
{context_overrides}

Requirements:
- Produce a complete, well-structured draft
- Use natural paragraphs
- Adapt content to the requested document type
- Keep the wording credible, restrained, and professional
- Do not add guarantees or legal conclusions
- Return only the body of the document
""".strip()

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
        )
        content = (response.choices[0].message.content or "").strip()

        if not content:
            return fallback

        return {
            "title": title,
            "document_type": document_type,
            "language": language,
            "content": content,
            "disclaimer": t(
                "This AI-generated draft is for general informational support and should be reviewed before use.",
                "Ce brouillon généré par IA est fourni à titre informatif général et doit être révisé avant utilisation.",
                language,
            ),
        }
    except Exception:
        return fallback