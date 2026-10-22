"""Pinned IRCC per-ability tables, retrieved 2026-10-18. No eligibility arithmetic.

The published table groups 10 and above: never invent CLB 11/12 from that band.
TEF accepts ONLY the previous-score-equivalency column, NOT Score / 699.
"""
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json

SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html"
VERSION = "ircc-language-2026-10-18.v1"
SKILLS = ("listening", "reading", "writing", "speaking")
# Thresholds ordered CLB/NCLC 4..10. Equal lower bounds are inclusive.
EXAMS = {
    "ielts_general": ("en", "general_training_original", 9, {
        "listening": [4.5, 5, 5.5, 6, 7.5, 8, 8.5],
        "reading": [3.5, 4, 5, 6, 6.5, 7, 8],
        "writing": [4, 5, 5.5, 6, 6.5, 7, 7.5],
        "speaking": [4, 5, 5.5, 6, 6.5, 7, 7.5]}),
    "celpip_general": ("en", "celpip_general", 12, {s: list(range(4, 11)) for s in SKILLS}),
    "pte_core": ("en", "pte_core", 90, {
        "listening": [28, 39, 50, 60, 71, 82, 89],
        "reading": [33, 42, 51, 60, 69, 78, 88],
        "writing": [41, 51, 60, 69, 79, 88, 90],
        "speaking": [42, 51, 59, 68, 76, 84, 89]}),
    "tef_canada": ("fr", "previous_score_equivalency", None, {
        "listening": [145, 181, 217, 249, 280, 298, 316],
        "reading": [121, 151, 181, 207, 233, 248, 263],
        "writing": [181, 226, 271, 310, 349, 371, 393],
        "speaking": [181, 226, 271, 310, 349, 371, 393]}),
    "tcf_canada": ("fr", "tcf_canada", None, {
        "listening": [331, 369, 398, 458, 503, 523, 549],
        "reading": [342, 375, 406, 453, 499, 524, 549],
        "writing": [4, 6, 7, 10, 12, 14, 16],
        "speaking": [4, 6, 7, 10, 12, 14, 16]}),
}
MAPPING_DIGEST = hashlib.sha256(json.dumps(EXAMS, sort_keys=True).encode()).hexdigest()


def today():
    return datetime.now(timezone.utc).date()


def expires_on(tested):
    # Conservative anniversary convention, including leap-day tests.
    try:
        return tested.replace(year=tested.year + 2)
    except ValueError:
        return tested.replace(year=tested.year + 2, day=28)


def convert(exam, edition, scores):
    if exam not in EXAMS or edition != EXAMS[exam][1]:
        raise ValueError("Unsupported exam/edition; IELTS Academic/One Skill Retake and TEF /699 are not accepted here")
    if set(scores) != set(SKILLS):
        raise ValueError("Exactly four skill results are required")
    _, _, maximum, thresholds = EXAMS[exam]
    result = {}
    for skill in SKILLS:
        raw = scores[skill]
        if isinstance(raw, bool) or not isinstance(raw, (str, int, float, Decimal)) or len(str(raw)) > 16:
            raise ValueError("Scores must be numeric test results")
        try:
            value = Decimal(str(raw))
        except InvalidOperation as exc:
            raise ValueError("Invalid numeric score") from exc
        upper = maximum
        if exam == "tef_canada":
            upper = {"listening": 360, "reading": 300, "writing": 450, "speaking": 450}[skill]
        if exam == "tcf_canada":
            upper = 699 if skill in ("listening", "reading") else 20
        minimum = 10 if exam == "pte_core" else 1 if exam == "celpip_general" else 0
        step = Decimal("0.5") if exam == "ielts_general" else Decimal(1)
        if not value.is_finite() or value < minimum or value > upper or value % step:
            raise ValueError("Score outside the supported test format")
        levels = [level for level, lower in enumerate(thresholds[skill], 4) if value >= Decimal(str(lower))]
        benchmark = max(levels) if levels else None
        result[skill] = {"benchmark": benchmark, "at_least": benchmark == 10,
                         "status": "mapped" if benchmark else "below_published_range"}
    return result


def assessment_payload(record, *, as_of=None):
    as_of = as_of or today()
    expiry = expires_on(record.test_date)
    supported = record.mapping_version == VERSION
    try:
        skills = convert(record.exam, record.edition, record.raw_scores) if supported else {}
    except ValueError:
        supported, skills = False, {}
    if not supported:
        skills = {s: {"benchmark": None, "at_least": False, "status": "unsupported_mapping"} for s in SKILLS}
    expired = as_of >= expiry
    complete = all(x["benchmark"] is not None for x in skills.values())
    return {"id": record.id, "language": record.language, "exam": record.exam,
            "edition": record.edition, "test_date": record.test_date,
            "expires_on": expiry, "raw_scores": record.raw_scores, "skills": skills,
            "status": "unsupported_mapping" if not supported else "expired" if expired else "current" if complete else "below_published_range",
            "usable": not expired and complete, "provenance": "user_reported",
            "independently_verified": False, "mapping_version": record.mapping_version,
            "source": SOURCE, "source_checked_on": "2026-10-18", "mapping_digest": MAPPING_DIGEST if supported else None,
            "mapping_review_status": "SOURCE_TRANSCRIBED_PENDING_INDEPENDENT_REVIEW"}
