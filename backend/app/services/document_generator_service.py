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


def build_decision_context(
    decision: Optional[dict],
    strategy: Optional[dict],
    language: str,
) -> str:
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
    mode: str = "generate",
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

    noc = safe_get(profile, "noc_code", None)

    # =========================
    # 🔥 NOC INTELLIGENCE BLOCK
    # =========================
    noc_block = ""
    if noc:
        if language == "fr":
            noc_block = f"""
Aligner subtilement le contenu avec la CNP {noc}.
Mettre en valeur les responsabilités, compétences et logique de parcours liées à cette CNP lorsque pertinent.
Ne jamais inventer de faits.
""".strip()
        else:
            noc_block = f"""
Subtly align the content with NOC {noc}.
Emphasize responsibilities, skills, and career logic tied to this NOC where relevant.
Never invent facts.
""".strip()

    # =========================
    # 🧠 MODE SWITCH
    # =========================
    if mode == "explain":
        user_prompt = f"""
Explain why the following document works.

Focus on:
- credibility
- structure
- tone
- persuasiveness

Document:
{additional_instructions or ""}
""".strip()

    elif mode == "officer_ready":
        user_prompt = f"""
Rewrite the document to be:
- clearer
- more persuasive
- more professional
- logically stronger

Keep it human and credible.

Document:
{additional_instructions or ""}
""".strip()

    elif mode == "sections":
        user_prompt = f"""
Generate a structured document in THREE parts:

1. Introduction
2. Main Body
3. Conclusion

Do NOT label sections.

{profile_context}
{application_context}
{decision_context}
{noc_block}

Instructions:
{additional_instructions or ""}
""".strip()

    elif mode == "fix_all":
        user_prompt = f"""
Improve the following immigration document by fixing its weaknesses.

Goals:
- improve clarity
- improve structure
- improve credibility
- improve logical flow
- improve persuasiveness without exaggeration
- keep the facts consistent
- keep the tone human and professional

{noc_block}

Document:
{additional_instructions or ""}
""".strip()

    elif mode == "improve_intro":
        user_prompt = f"""
Rewrite only the introduction of this immigration document.

Goals:
- stronger opening
- clearer purpose
- more credibility
- concise and professional

Return only the improved introduction.

Document:
{additional_instructions or ""}
""".strip()

    elif mode == "improve_body":
        user_prompt = f"""
Rewrite only the main body of this immigration document.

Goals:
- stronger logic
- clearer chronology
- better supporting detail
- more persuasive but still credible

Return only the improved body section.

Document:
{additional_instructions or ""}
""".strip()

    elif mode == "improve_conclusion":
        user_prompt = f"""
Rewrite only the conclusion of this immigration document.

Goals:
- clearer close
- professional tone
- stronger final impression
- concise and credible

Return only the improved conclusion.

Document:
{additional_instructions or ""}
""".strip()

    elif mode == "confidence":
        user_prompt = f"""
Assess the following immigration document and provide:

1. A confidence score from 0 to 100
2. A one-sentence summary
3. Three strengths
4. Three weaknesses

Return plain text in this exact format:

Score: <number>
Summary: <text>
Strengths:
- ...
- ...
- ...
Weaknesses:
- ...
- ...
- ...

Document:
{additional_instructions or ""}
""".strip()

    else:
        user_prompt = f"""
Generate a complete {document_type}.

{profile_context}
{application_context}
{decision_context}
{noc_block}

Instructions:
{additional_instructions or ""}

Requirements:
- strong structure
- natural paragraphs
- credible tone
""".strip()

    # =========================
    # SYSTEM PROMPT (UPGRADED)
    # =========================
    system_prompt = """
You are a professional immigration document drafting assistant.

Your outputs must be:
- structured
- credible
- human
- persuasive but not exaggerated

Never:
- invent facts
- sound like a lawyer
- give guarantees

Write like a strong real applicant.
""".strip()

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
        )

        content = (response.choices[0].message.content or "").strip()

        if not content:
            return fallback

        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]

        intro = paragraphs[0] if len(paragraphs) > 0 else ""
        body = "\n\n".join(paragraphs[1:-1]) if len(paragraphs) > 2 else ""
        conclusion = paragraphs[-1] if len(paragraphs) > 1 else ""

        return {
            "title": title,
            "document_type": document_type,
            "language": language,
            "content": content,
            "sections": {
                "intro": intro,
                "body": body,
                "conclusion": conclusion,
            },
            "meta": {
                "tone": tone,
                "mode": mode,
            },
            "disclaimer": t(
                "This AI-generated draft should be reviewed before use.",
                "Ce document généré doit être révisé avant utilisation.",
                language,
            ),
        }
    except Exception:
        return fallback