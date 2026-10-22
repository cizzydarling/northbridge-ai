"""Explicitly unavailable numerical CRS until the complete source/fixture release is approved.

Never calls the retained heuristic calculators. Future dates cannot silently select
the announced Labour Market Integration changes. Scenarios are detached snapshots.
"""
from copy import deepcopy
from datetime import date
import hashlib
import json
from app.rules.crs_versions import candidate_for, policy_metadata

CRS_SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html"
INSTRUCTIONS = "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-application-management-system/current.html"
FUTURE_SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html"
FACTORS = ("age", "education", "first_language", "second_language", "canadian_experience",
           "spouse", "skill_transferability", "nomination", "canadian_education", "french", "sibling")


def review_crs_inputs(facts, language_context, *, as_of):
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
    return {"status": "incomplete" if missing else "verification_required", "score": None,
            "missing_inputs": missing, "calculation_date": as_of,
            "evidence_status": "user_reported_not_independently_verified", "program_eligibility": "not_assessed",
            "ruleset_version": candidate.version, "ruleset_policy": policy_metadata(as_of),
            "validation_status": "UNDER_REVIEW", "source_checked_on": "2026-10-18",
            "blocker": "Complete controlling-instruction/factor reconciliation and independent fixture review are not approved. Numerical scoring is withheld.",
            "breakdown": [{"factor": factor, "points": None, "status": "withheld_pending_verification"} for factor in FACTORS],
            "sources": [CRS_SOURCE, INSTRUCTIONS, FUTURE_SOURCE],
            "official_handoff": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html",
            "snapshot_hash": hashlib.sha256(json.dumps({"facts": snapshot, "language": language_context}, sort_keys=True, default=str).encode()).hexdigest()}
