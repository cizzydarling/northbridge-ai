"""Explicitly unavailable numerical CRS until the complete source/fixture release is approved.

Never calls the retained heuristic calculators. Future dates cannot silently select
the announced Labour Market Integration changes. Scenarios are detached snapshots.
"""
from copy import deepcopy
from datetime import date
import hashlib
import json
from app.rules.crs_versions import candidate_for, policy_metadata
from app.services.official_crs import RankingFacts, missing_evidence, qualified_facts, EDUCATION, TABLE_DIGEST

CRS_SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html"
INSTRUCTIONS = "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-application-management-system/current.html"
FUTURE_SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html"
FACTORS = ("age", "education", "first_language", "second_language", "canadian_experience",
           "spouse", "skill_transferability", "nomination", "canadian_education", "french", "sibling")


def authoritative_ranking_facts(facts, language_context, *, profile_context=None):
    """Language selection is server-owned; declarations never override its mapping.

    Legacy scalar profile scores and inferred marital/education status are not
    promoted to qualifying evidence. Explicit scenario facts remain detached.
    """
    supplied = facts.get("ranking_facts")
    values = deepcopy(supplied) if supplied is not None else {
        key: deepcopy(value) for key, value in facts.items()
        if key in RankingFacts.model_fields and key not in ("english", "french")
    }
    if supplied is None:
        if facts.get("accompanying_spouse") is not None:
            values["spouse_status"] = "accompanying" if facts["accompanying_spouse"] else "none"
        if values.get("education") not in EDUCATION:
            values.pop("education", None)
        if values.get("spouse_education") not in EDUCATION:
            values.pop("spouse_education", None)
        # The old contract's reported/no-results labels are not four-skill data.
        values.pop("spouse_language", None)
    profile = profile_context or {}
    for field in ("age", "education"):
        if values.get(field) is None and profile.get(field) is not None:
            if field != "education" or profile[field] in EDUCATION:
                values[field] = profile[field]
    provenance = {}
    for language, field in (("en", "english"), ("fr", "french")):
        record = language_context.get(language)
        values[field] = None
        if record and record.get("usable"):
            values[field] = {skill: value.get("benchmark") for skill, value in record["skills"].items()}
        if record:
            provenance[language] = {key: record.get(key) for key in ("id", "status", "mapping_version", "mapping_digest", "expires_on")}
    chosen = language_context.get(values.get("first_language"))
    values["language_evidence_current"] = bool(chosen and chosen.get("usable"))
    return RankingFacts.model_validate(values), provenance


def review_crs_inputs(facts, language_context, *, as_of, profile_context=None):
    snapshot = deepcopy(facts)
    required = ("age", "education", "accompanying_spouse", "canadian_work_years", "foreign_work_years",
                "provincial_nomination", "canadian_education", "sibling_in_canada")
    missing = [key for key in required if snapshot.get(key) is None]
    first = snapshot.get("first_language")
    evidence = language_context.get(first) if first in ("en", "fr") else None
    if not evidence or not evidence.get("usable"):
        missing.append("current_four_skill_first_language_assessment")
    if snapshot.get("accompanying_spouse") is True:
        missing.extend(key for key in ("spouse_education", "spouse_canadian_work_years", "spouse_language") if snapshot.get(key) is None)
    candidate = candidate_for(as_of)
    if as_of >= date(2026, 11, 3) and not snapshot.get("occupation_classification"):
        missing.append("qualifying_work_and_occupation_classification")
    ranking, provenance = authoritative_ranking_facts(snapshot, language_context, profile_context=profile_context)
    ranking, work, work_blockers = qualified_facts(ranking, as_of=as_of)
    if snapshot.get("ranking_facts") is not None:
        missing = missing_evidence(ranking) + work_blockers
    else:
        missing.extend(work_blockers)
    return {"status": "incomplete" if missing else "verification_required", "score": None,
            "missing_inputs": missing, "calculation_date": as_of,
            "evidence_status": "user_reported_not_independently_verified", "program_eligibility": "not_assessed",
            "ruleset_version": candidate.version, "ruleset_policy": policy_metadata(as_of),
            "validation_status": "UNDER_REVIEW", "source_checked_on": "2026-10-18",
            "table_digest": TABLE_DIGEST, "effective_from": candidate.effective_from,
            "effective_to_exclusive": candidate.effective_to,
            "selected_language_evidence": provenance, "work_normalization": work,
            "numerical_activation": False, "independent_arithmetic_acceptance": "PENDING",
            "blocker": "Complete controlling-instruction/factor reconciliation and independent fixture review are not approved. Numerical scoring is withheld.",
            "breakdown": [{"factor": factor, "points": None, "status": "withheld_pending_verification"} for factor in FACTORS],
            "sources": [CRS_SOURCE, INSTRUCTIONS, FUTURE_SOURCE],
            "official_handoff": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html",
            "snapshot_hash": hashlib.sha256(json.dumps({"facts": snapshot, "language": language_context}, sort_keys=True, default=str).encode()).hexdigest()}
