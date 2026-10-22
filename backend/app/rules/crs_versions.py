"""Unreleased CRS ruleset foundation, deliberately not a complete CRS engine.

No production approval exists. Dates select candidates, never authorize scoring.
The provisional LMI arithmetic is exercised by fixtures only. It assumes already
validated qualifying, non-overlapping full-time-equivalent work periods; period
qualification, ITA list locking and FSW/FST eligibility remain separate blockers.
"""
from datetime import date
from types import MappingProxyType

from app.rules.registry import Rule, RuleRegistry, ValidationStatus

CHANGE_DATE = date(2026, 11, 3)
SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html"
CRITERIA = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html"
NOC_SOURCE = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/high-wage.html"
NOC_LIST_VERSION = "ircc-high-wage-2026-11-03.2023-2025.pending"
# Full code lists transcribed from IRCC on 2026-10-18; independent comparison pending.
NOC_LEVELS = MappingProxyType({
    3: frozenset("00011 00012 00013 10010 10011 10012 10020 10021 20010 20011 20012 21330 21332 31100 31101 31102 31103 31302 31303 40010 40011 40012 40019 40040 40041 41100 41101 41200 60010 80010 90011".split()),
    2: frozenset("00014 00015 10019 10022 10029 10030 11103 11201 21100 21102 21103 21109 21111 21120 21202 21210 21211 21220 21221 21222 21223 21230 21231 21232 21300 21301 21310 21311 21320 21321 21322 21331 21390 21399 22231 22312 30010 31110 31112 31120 31200 31202 31203 31300 31301 32111 40020 40021 40030 40042 41210 41220 41221 41310 41311 41320 41401 41402 41404 41407 42100 42101 50010 50011 51100 70010 70012 70020 70021 72011 72012 72023 72103 72202 72203 72301 72406 72600 72601 72604 73310 82020 82021 83101 90010 92011 92100 93100 93101".split()),
    1: frozenset("00010 11100 11101 11102 11109 11200 12201 12203 21101 21110 21112 21200 21201 21203 21234 22214 22232 22233 22310 22313 31121 32102 32103 32120 32121 32122 41300 41400 41403 41405 41409 43201 43203 50012 51101 51102 51111 51112 51120 52112 60020 60031 60040 72010 72013 72014 72020 72021 72102 72105 72201 72302 72320 72321 72401 72403 72404 72500 72602 72603 73311 82010 83100 83120 92010 93102".split()),
})

RULES = (
    Rule("crs", "express_entry", "CA", CRITERIA, date(2025, 3, 25), None,
         "crs-2025-03-25.pending", ValidationStatus.UNDER_REVIEW, ("ranking",),
         effective_to=CHANGE_DATE, numerical=True),
    Rule("crs", "express_entry", "CA", SOURCE, CHANGE_DATE, None,
         "crs-2026-11-03.pending", ValidationStatus.UNDER_REVIEW, ("ranking",),
         supersedes="crs-2025-03-25.pending", numerical=True),
)
REGISTRY = RuleRegistry(RULES)  # No reviewer or release approval; cannot calculate.


def candidate_for(as_of):
    if type(as_of) is not date or as_of < RULES[0].effective_from:
        raise ValueError("Unsupported CRS evaluation date")
    return RULES[1] if as_of >= CHANGE_DATE else RULES[0]


def noc_level(code):
    if not isinstance(code, str) or len(code) != 5 or not code.isascii() or not code.isdigit():
        raise ValueError("Explicit five-digit NOC classification required")
    level = next((level for level, codes in NOC_LEVELS.items() if code in codes), None)
    if level is not None:
        return level
    from app.services.noc_service import lookup_noc_by_code
    if not lookup_noc_by_code(code):
        raise ValueError("Unsupported occupation classification")
    return 0


def _provisional_lmi(*, spouse, canadian_months, qualifying_months_by_noc, offer_noc, offer_qualifies):
    """Internal fixture arithmetic only, never mounted or called by an API.

    No salary/LMIA boolean can establish an occupation level or genuine offer.
    None means missing, distinct from an explicitly empty high-wage history.
    """
    if type(spouse) is not bool or type(offer_qualifies) is not bool:
        raise ValueError("Explicit spouse and offer qualification required")
    if type(canadian_months) is not int or canadian_months < 0 or not isinstance(qualifying_months_by_noc, dict):
        raise ValueError("Validated work duration and NOC history required")
    if any(type(months) is not int or months < 0 for months in qualifying_months_by_noc.values()):
        raise ValueError("Invalid work months")
    if sum(qualifying_months_by_noc.values()) > canadian_months:
        raise ValueError("High-wage periods exceed qualifying Canadian duration")
    levels = [(noc_level(code), months) for code, months in qualifying_months_by_noc.items()]
    extra = next((points for level, points in ((3, 70), (2, 40), (1, 20))
                  if sum(months for found, months in levels if found >= level) >= 12), 0)
    years = min(canadian_months // 12, 5)
    length = ((0, 35, 46, 56, 63, 70) if spouse else (0, 40, 53, 64, 72, 80))[years]
    offer = {0: 0, 1: 50, 2: 70, 3: 100}[noc_level(offer_noc)] if offer_qualifies else 0
    work = length + extra
    return {"work_length": length, "high_wage_experience": extra,
            "work_option": work, "offer_option": offer,
            "factor": min(max(work, offer), 140 if spouse else 150),
            "eligibility": "not_assessed", "provisional_fixture_only": True}


def policy_metadata(as_of):
    future = candidate_for(as_of).effective_from == CHANGE_DATE
    return {"candidate_version": candidate_for(as_of).version, "active": False,
            "occupation_source": NOC_SOURCE, "occupation_list_version": NOC_LIST_VERSION,
            "personal_salary_is_classification": False, "eligibility_assessed": False,
            "lmia_requirement": "removed_for_qualifying_offers" if future else "prior_program_specific_rules_require_verification",
            "offer_genuineness_review_required": True,
            "fsw_fst_offer_eligibility_separate_from_crs": True,
            "ita_occupation_list_date_lock_required": True,
            "blockers": ["independent full CRS and NOC-list fixture review", "controlling instructions reconciliation",
                         "qualifying non-overlapping work-period validation", "FSW/FST-specific offer eligibility verification",
                         "explicit reviewed release activation"]}
