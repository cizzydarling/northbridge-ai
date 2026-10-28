"""Deterministic ranking candidate for independent review, never an eligibility decision.

Current tables: IRCC CRS criteria and Instructions sections 8–30, checked 2026-10-26.
No HTTP route calls the arithmetic. Release approval remains absent in crs_versions.
The November candidate is intentionally withheld: do not guess its overall cap or
qualifying-offer/transition requirements from an announcement or personal salary.
"""
from datetime import date
from hashlib import sha256
import json
from types import MappingProxyType
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from app.rules.crs_versions import CHANGE_DATE, CRITERIA, SOURCE, candidate_for

INSTRUCTIONS = "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-application-management-system/current.html"
EDUCATION = ("less_than_secondary", "secondary", "one_year", "two_year", "bachelor", "two_or_more", "master", "doctorate")
TABLES = {
    "education": [[0, 28, 84, 91, 112, 119, 126, 140], [0, 30, 90, 98, 120, 128, 135, 150]],
    "age_30_44": [[95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 35, 25, 15, 5], [105, 99, 94, 88, 83, 77, 72, 66, 61, 55, 50, 39, 28, 17, 6]],
    "first_language": [[0, 0, 0, 0, 6, 6, 8, 16, 22, 29, 32, 32, 32], [0, 0, 0, 0, 6, 6, 9, 17, 23, 31, 34, 34, 34]],
    "second_language": [0, 0, 0, 0, 0, 1, 1, 3, 3, 6, 6, 6, 6],
    "canadian_work": [[0, 35, 46, 56, 63, 70], [0, 40, 53, 64, 72, 80]],
    "spouse_education": [0, 2, 6, 7, 8, 9, 10, 10],
    "spouse_language": [0, 0, 0, 0, 0, 1, 1, 3, 3, 5, 5, 5, 5],
    "spouse_work": [0, 5, 7, 8, 9, 10],
}
TABLE_DIGEST = sha256(json.dumps(TABLES, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
TABLES = MappingProxyType({key: tuple(tuple(row) if isinstance(row, list) else row for row in value) for key, value in TABLES.items()})


class Skills(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    listening: int | None = Field(default=None, ge=1, le=12)
    reading: int | None = Field(default=None, ge=1, le=12)
    writing: int | None = Field(default=None, ge=1, le=12)
    speaking: int | None = Field(default=None, ge=1, le=12)


class RankingFacts(BaseModel):
    """Explicit qualified evidence, not legacy combined language/experience fields.

    Qualification booleans are declarations for a review candidate, not findings.
    Null means missing; zero/False are intentional negative answers.
    """
    model_config = ConfigDict(extra="forbid", strict=True)
    age: int | None = Field(default=None, ge=0, le=120)
    education: Literal["less_than_secondary", "secondary", "one_year", "two_year", "bachelor", "two_or_more", "master", "doctorate"] | None = None
    education_evidence_current: bool | None = None
    spouse_status: Literal["none", "non_accompanying", "citizen_or_pr", "accompanying"] | None = None
    first_language: Literal["en", "fr"] | None = None
    english: Skills | None = None
    french: Skills | None = None
    no_second_language_test: bool | None = None
    language_evidence_current: bool | None = None
    canadian_work_years: int | None = Field(default=None, ge=0, le=60)
    canadian_work_qualified: bool | None = None
    foreign_work_years: int | None = Field(default=None, ge=0, le=60)
    foreign_work_qualified: bool | None = None
    spouse_education: Literal["less_than_secondary", "secondary", "one_year", "two_year", "bachelor", "two_or_more", "master", "doctorate"] | None = None
    spouse_education_evidence_current: bool | None = None
    spouse_language: Skills | None = None
    spouse_no_language_test: bool | None = None
    spouse_language_evidence_current: bool | None = None
    spouse_canadian_work_years: int | None = Field(default=None, ge=0, le=60)
    spouse_work_qualified: bool | None = None
    certificate_of_qualification: bool | None = None
    provincial_nomination: bool | None = None
    canadian_education: Literal["none", "one_or_two_years", "three_or_more_years"] | None = None
    sibling_in_canada: bool | None = None
    additional_evidence_qualified: bool | None = None


def missing_evidence(facts):
    required = ["age", "education", "education_evidence_current", "spouse_status", "first_language",
                "language_evidence_current", "canadian_work_years", "foreign_work_years",
                "certificate_of_qualification", "provincial_nomination", "canadian_education",
                "sibling_in_canada", "additional_evidence_qualified"]
    missing = [k for k in required if getattr(facts, k) is None]
    first = facts.english if facts.first_language == "en" else facts.french if facts.first_language == "fr" else None
    second = facts.french if facts.first_language == "en" else facts.english
    if first is None or any(v is None for v in first.model_dump().values()):
        missing.append("first_language_four_skills")
    if second is not None and any(v is None for v in second.model_dump().values()):
        missing.append("second_language_four_skills")
    if second is None and facts.no_second_language_test is not True:
        missing.append("second_language_or_explicit_no_test")
    if second is not None and facts.no_second_language_test is True:
        missing.append("conflicting_second_language_evidence")
    for k in ("education_evidence_current", "language_evidence_current", "additional_evidence_qualified"):
        if getattr(facts, k) is False:
            missing.append(k + "_requires_review")
    for prefix in ("canadian", "foreign"):
        if (getattr(facts, prefix + "_work_years") or 0) > 0 and getattr(facts, prefix + "_work_qualified") is not True:
            missing.append(prefix + "_work_qualification")
    if facts.spouse_status == "accompanying":
        if facts.spouse_language is not None and any(v is None for v in facts.spouse_language.model_dump().values()):
            missing.append("spouse_language_four_skills")
        for k in ("spouse_education", "spouse_education_evidence_current", "spouse_canadian_work_years"):
            if getattr(facts, k) is None:
                missing.append(k)
        if facts.spouse_education_evidence_current is False:
            missing.append("spouse_education_requires_review")
        if facts.spouse_language is None and facts.spouse_no_language_test is not True:
            missing.append("spouse_language_or_explicit_no_test")
        if facts.spouse_language is not None and (facts.spouse_no_language_test is True or facts.spouse_language_evidence_current is not True):
            missing.append("spouse_language_requires_review")
        if (facts.spouse_canadian_work_years or 0) > 0 and facts.spouse_work_qualified is not True:
            missing.append("spouse_work_qualification")
    return sorted(set(missing))


def _values(skills):
    return list(skills.model_dump().values())


def evaluate_candidate(facts: RankingFacts, *, as_of: date):
    """Offline review only. Never public scoring or automatic rule activation."""
    if not isinstance(facts, RankingFacts):
        facts = RankingFacts.model_validate(facts)
    rule = candidate_for(as_of)
    missing = missing_evidence(facts)
    result = {"status": "REVIEW_REQUIRED", "score": None, "missing_inputs": missing,
              "ruleset_version": rule.version, "effective_date": rule.effective_from.isoformat(),
              "source_checked_on": "2026-10-26", "table_digest": TABLE_DIGEST,
              "sources": [CRITERIA, INSTRUCTIONS, SOURCE], "breakdown": [],
              "maximum_points": None if as_of >= CHANGE_DATE else 1200,
              "program_eligibility": "not_assessed", "invitation_eligibility": "not_assessed",
              "evidence_provenance": "declared_qualified_inputs_not_independently_verified",
              "production_activation": False, "offline_review_only": True}
    if as_of >= CHANGE_DATE:
        result["blockers"] = ["revised_controlling_instructions", "overall_cap_reconciliation",
                              "offer_and_work_qualification", "ITA_date_occupation_list_lock", "independent_release_review"]
        return result
    if missing:
        result["status"] = "incomplete"
        return result
    spouse = facts.spouse_status == "accompanying"
    column = 0 if spouse else 1
    education = EDUCATION.index(facts.education)
    first = _values(facts.english if facts.first_language == "en" else facts.french)
    second_record = facts.french if facts.first_language == "en" else facts.english
    second = _values(second_record) if second_record else [0] * 4
    ca, foreign = min(facts.canadian_work_years, 5), facts.foreign_work_years
    age = facts.age
    age_points = (0 if age <= 17 or age >= 45 else (90 if spouse else 99) if age == 18 else
                  (95 if spouse else 105) if age == 19 else (100 if spouse else 110) if age <= 29 else TABLES["age_30_44"][column][age-30])
    factors = []
    def add(factor, points, maximum, section):
        factors.append({"factor": factor, "points": points, "maximum": maximum, "section": section})
    add("age", age_points, 100 if spouse else 110, "core")
    add("education", TABLES["education"][column][education], 140 if spouse else 150, "core")
    add("first_language", sum(TABLES["first_language"][column][v] for v in first), 128 if spouse else 136, "core")
    add("second_language", min(sum(TABLES["second_language"][v] for v in second), 22 if spouse else 24), 22 if spouse else 24, "core")
    add("canadian_work", TABLES["canadian_work"][column][ca], 70 if spouse else 80, "core")
    add("spouse_education", TABLES["spouse_education"][EDUCATION.index(facts.spouse_education)] if spouse else 0, 10 if spouse else 0, "spouse")
    add("spouse_language", sum(TABLES["spouse_language"][v] for v in _values(facts.spouse_language)) if spouse and facts.spouse_language else 0, 20 if spouse else 0, "spouse")
    add("spouse_work", TABLES["spouse_work"][min(facts.spouse_canadian_work_years, 5)] if spouse else 0, 10 if spouse else 0, "spouse")
    minimum = min(first)
    # Each education/foreign combination is capped at 50, all transferability at 100.
    high_education = education >= 5
    band = 2 if minimum >= 9 else 1 if minimum >= 7 else 0
    edu_lang = ((0, 25, 50) if high_education else (0, 13, 25))[band] if education >= 2 else 0
    edu_work = ((0, 25, 50) if high_education else (0, 13, 25))[min(ca, 2)] if education >= 2 else 0
    foreign_lang = ((0, 25, 50) if foreign >= 3 else (0, 13, 25))[band] if foreign else 0
    foreign_ca = ((0, 25, 50) if foreign >= 3 else (0, 13, 25))[min(ca, 2)] if foreign else 0
    certificate = (50 if minimum >= 7 else 25 if minimum >= 5 else 0) if facts.certificate_of_qualification else 0
    add("education_transferability", min(edu_lang + edu_work, 50), 50, "transferability")
    add("foreign_work_transferability", min(foreign_lang + foreign_ca, 50), 50, "transferability")
    add("certificate_transferability", certificate, 50, "transferability")
    transfer_raw = sum(f["points"] for f in factors if f["section"] == "transferability")
    add("transferability_cap_adjustment", min(transfer_raw, 100)-transfer_raw, 0, "transferability")
    french = _values(facts.french) if facts.french else [0] * 4
    english = _values(facts.english) if facts.english else [0] * 4
    french_points = (50 if min(english) >= 5 else 25) if min(french) >= 7 else 0
    add("nomination", 600 if facts.provincial_nomination else 0, 600, "additional")
    add("canadian_education", {"none": 0, "one_or_two_years": 15, "three_or_more_years": 30}[facts.canadian_education], 30, "additional")
    add("french", french_points, 50, "additional")
    add("sibling", 15 if facts.sibling_in_canada else 0, 15, "additional")
    additional_raw = sum(f["points"] for f in factors if f["section"] == "additional")
    add("additional_cap_adjustment", min(additional_raw, 600)-additional_raw, 0, "additional")
    result.update(status="draft_for_independent_review", score=sum(f["points"] for f in factors), breakdown=factors,
                  section_totals={s: sum(f["points"] for f in factors if f["section"] == s) for s in ("core", "spouse", "transferability", "additional")})
    return result
