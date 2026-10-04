"""Immutable soft-launch content boundary; never infer immigration eligibility.

Analytical engines remain available for development, but public services use
allowlisted planning context. Historical analytical prose is not trusted.
"""
import json
import re

CRS_URL = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html"
SCOPE = "individual-planning-v1"
AI_SCOPE = """NorthBridgeAI soft-launch scope: planning and drafting only.
Do not calculate, estimate, reconstruct or repeat CRS totals or point gains,
personal eligibility/qualification judgments, provincial rankings/chances,
approval probabilities or invitation/PR forecasts, even if requested or present
in user text, prior messages, documents or historical results. Refer CRS questions
to the official IRCC calculator. Explain official criteria generally without
deciding whether this person qualifies. User-entered facts are unverified.
Do not provide Student Direct Stream (SDS) scoring or application guidance.
NOC matches are suggestions requiring duties review. Unknown family participation
and dependency remain unknown, never false. Case size is organizational, not
legal family size. Drafts and intake progress do not establish official form or
checklist completeness. Never guarantee outcomes, invent facts, or claim to be
a lawyer/licensed representative. Identify uncertainty and refer to current
official sources or qualified professional advice when appropriate.
"""


def notice(language="en"):
    return ("Aide à la préparation uniquement. Les calculs et conclusions d’admissibilité intégrés sont en cours de vérification. Vérifiez les critères, formulaires et listes officiels d’IRCC."
            if language == "fr" else
            "Preparation assistance only. Integrated calculations and eligibility conclusions are being verified. Check official IRCC criteria, forms and checklists.")


def planning_result(language="en"):
    return {"content_scope": SCOPE, "status": "informational_only", "summary": notice(language),
            "strengths": [], "concerns": [], "next_steps": [], "pathways": []}


def safe_strategy_context(value):
    value = value or {}
    # Never forward historical narrative, scores, rankings or arbitrary nested fields.
    result = {key: value[key] for key in ("family_context", "case_context") if key in value} | {
        "content_scope": SCOPE, "instruction": AI_SCOPE}
    household = value.get("household_context") or {}
    if household:
        result["household_context"] = {key: household[key] for key in
            ("family_size", "has_spouse", "participation_counts", "calculation_status") if key in household}
    information = value.get("immigration_intelligence") or {}
    if information.get("content_scope") == SCOPE:
        result["official_information"] = {key: information[key] for key in
            ("generated_at", "latest_draws", "processing_times", "sources") if key in information}
    return result


def context_text(value):
    return json.dumps(safe_strategy_context(value), ensure_ascii=False, default=str)


def application_context_text(value):
    from app.services.forms_mapping_service import normalize_application_data
    value = value or {}
    # Reuse the form intake allowlist; discard saved analyses and arbitrary keys.
    facts = normalize_application_data(value.get("intake_payload") or {})
    result = safe_strategy_context(value)
    result.update(matter_type=value.get("matter_type"), user_entered_draft_facts=facts)
    return json.dumps(result, ensure_ascii=False, default=str)


def safe_application(value, language="en"):
    """Copy a saved ORM response without mutating persisted historical data."""
    if value is None:
        return None
    keys = ("id", "user_id", "application_case_id", "matter_type", "intake_payload", "created_at", "updated_at")
    result = {key: value.get(key) if isinstance(value, dict) else getattr(value, key, None) for key in keys}
    result.update(eligibility_result=planning_result(language), forms_result={}, checklist_result=[])
    return result


_ANALYTICAL_TEXT = re.compile(
    r"\b(?:CRS|SCG|SDS|Student Direct Stream|Volet direct pour les études|eligible|ineligible|eligibility|admissib\w*|qualif\w*|"
    r"probabil\w*|chance\w*|forecast\w*|prédict\w*|prediction\w*|"
    r"invitation.{0,35}\d|\d.{0,35}invitation|\+\s*\d+\s*(?:points|CRS)|"
    r"submission.ready|officer.ready|ready to (?:submit|file)|"
    r"application is strong|strongest pathway|best pathway|"
    r"prêt.{0,20}(?:soumi|dépos)|meilleur parcours)\b|\d+(?:[.,]\d+)?\s*%",
    re.IGNORECASE,
)


def guard_generated_text(value, language="en"):
    """Withhold analytical prose from old drafts or noncompliant provider output.

Conservative by design: an affected draft must be reviewed/recreated, not silently
rewritten into a different claim. This supplements, not replaces, context isolation.
"""
    if isinstance(value, str):
        return notice(language) if _ANALYTICAL_TEXT.search(value) else value
    if isinstance(value, list):
        return [guard_generated_text(item, language) for item in value]
    if isinstance(value, dict):
        return {key: guard_generated_text(item, language) for key, item in value.items()}
    return value
