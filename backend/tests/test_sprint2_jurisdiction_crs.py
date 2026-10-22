from dataclasses import replace
from datetime import date
from types import SimpleNamespace
import pytest

from app.rules.program_registry import Program, PROGRAMS, active_streams, reference_context
from app.rules.crs_versions import CHANGE_DATE, RULES, REGISTRY, NOC_LEVELS, candidate_for, noc_level, _provisional_lmi, policy_metadata
from app.rules.registry import RuleUnavailable, RuleRegistry, ReleaseApproval, ValidationStatus
from app.services.strategy_service import build_strategy
from app.services.content_scope import safe_strategy_context, AI_SCOPE
from app.services.chat_contract import boundary_intent, boundary_response
from app.services.province_targeting_service import match_pnp_programs


@pytest.mark.parametrize("destination", ["QC", "Québec", "Quebec", "Nunavut", "NU"])
def test_no_pnp_in_excluded_jurisdictions(destination):
    profile = SimpleNamespace(preferred_province=destination, occupation="software engineer", crs_score=600)
    assert match_pnp_programs(profile) == []
    context = reference_context(destination)
    assert context["pnp_exists"] is False
    assert all(p["family"] != "pnp" for p in context["references"])
    strategy = build_strategy(profile)
    assert strategy["recommended_programs"] == []
    assert safe_strategy_context(strategy)["program_registry"]["active_recommendations"] == []


def test_registry_rejects_mislabeled_quebec_and_nunavut():
    for target in ("QC", "NU"):
        with pytest.raises(ValueError):
            replace(PROGRAMS[2], jurisdiction=target)
    with pytest.raises(ValueError):
        replace(PROGRAMS[1], express_entry_linked=True)


def test_ontario_no_invented_tech_draw_or_active_unreviewed_stream():
    assert active_streams("Ontario", as_of=date(2026, 10, 18)) == []
    assert match_pnp_programs({"preferred_province": "Ontario", "noc_code": "21231", "crs_score": 999}) == []
    stream = replace(PROGRAMS[2], identifier="ontario.fixture_stream", effective_from=date(2026, 10, 1),
                     review_status="CURRENT_VERIFIED", availability="open", availability_verified_until=date(2026, 10, 31))
    result = active_streams("Ontario", as_of=date(2026, 10, 18), programs=(stream,))
    assert len(result) == 1 and result[0]["eligibility"] == "not_assessed"
    for target in ("Quebec", "Nunavut", "Alberta", "unknown"):
        assert active_streams(target, as_of=date(2026, 10, 18), programs=(stream,)) == []
    for change in ({"availability": "inactive"}, {"review_status": "UNDER_REVIEW", "availability": "unknown"}):
        assert active_streams("ON", as_of=date(2026, 10, 18), programs=(replace(stream, **change),)) == []
    assert active_streams("ON", as_of=date(2026, 11, 1), programs=(stream,)) == []


@pytest.mark.parametrize("message", ["Quebec PNP", "PCP du Québec", "Nunavut provincial nominee", "Québec Entrée express"])
def test_ai_deterministic_jurisdiction_boundary(message):
    assert boundary_intent(message) == "jurisdiction"
    for language in ("en", "fr"):
        response = boundary_response("jurisdiction", language, message)
        assert response["ai_status"] == "not_requested"
        assert not response.get("pathways")
    assert "French language does not override settlement" in AI_SCOPE


def test_date_selects_candidate_not_authorization():
    assert candidate_for(date(2026, 11, 2)) == RULES[0]
    assert candidate_for(CHANGE_DATE) == RULES[1]
    for when in (date(2026, 11, 2), CHANGE_DATE, date(2027, 1, 1)):
        with pytest.raises(RuleUnavailable):
            REGISTRY.select("crs", "express_entry", "CA", as_of=when, applicability="ranking")
        assert policy_metadata(when)["active"] is False
    # Even future metadata mislabeled verified cannot bypass absent release approval.
    forged = RuleRegistry(tuple(replace(r, status=type(r.status).CURRENT_VERIFIED, reviewed_at=date(2026, 10, 18)) for r in RULES))
    with pytest.raises(RuleUnavailable):
        forged.select("crs", "express_entry", "CA", as_of=date(2026, 11, 2), applicability="ranking")


def test_complete_official_noc_transcription_shape_and_levels():
    assert tuple(len(NOC_LEVELS[n]) for n in (3, 2, 1)) == (31, 89, 66)
    assert not (NOC_LEVELS[3] & NOC_LEVELS[2] | NOC_LEVELS[2] & NOC_LEVELS[1] | NOC_LEVELS[3] & NOC_LEVELS[1])
    assert [noc_level(n) for n in ("00011", "21231", "21234", "65201")] == [3, 2, 1, 0]
    for code in (None, "", "2123", 21231, "999999", "99999", "１２３４５"):
        with pytest.raises(ValueError):
            noc_level(code)


def test_synthetic_review_approval_respects_date_boundary_without_activating_real_registry():
    # Hypothetical approval fixture only, never a claim of completed legal review.
    reviewed = tuple(replace(r, status=ValidationStatus.CURRENT_VERIFIED, reviewed_at=date(2026, 10, 18)) for r in RULES)
    fixture = RuleRegistry(reviewed)
    approval = ReleaseApproval("synthetic-independent-reviewer", date(2026, 10, 18), fixture.digest)
    approved = RuleRegistry(reviewed, approval, authorized_reviewers=frozenset({approval.reviewer}))
    for when in (date(2026, 10, 18), date(2026, 11, 2)):
        assert approved.select("crs", "express_entry", "CA", as_of=when, applicability="ranking").version == RULES[0].version
    assert approved.select("crs", "express_entry", "CA", as_of=CHANGE_DATE, applicability="ranking").version == RULES[1].version
    with pytest.raises(RuleUnavailable):
        REGISTRY.select("crs", "express_entry", "CA", as_of=CHANGE_DATE, applicability="ranking")


@pytest.mark.parametrize("spouse,maximum", [(True, 140), (False, 150)])
def test_lmi_exclusivity_and_spouse_cap_foundation(spouse, maximum):
    result = _provisional_lmi(spouse=spouse, canadian_months=60, qualifying_months_by_noc={"00011": 12}, offer_noc="00011", offer_qualifies=True)
    assert result["factor"] == maximum
    assert result["factor"] == max(result["work_option"], result["offer_option"])
    assert result["eligibility"] == "not_assessed"


@pytest.mark.parametrize("code,extra,offer", [("00011", 70, 100), ("21231", 40, 70), ("21234", 20, 50), ("65201", 0, 0)])
def test_official_lmi_level_vectors(code, extra, offer):
    result = _provisional_lmi(spouse=False, canadian_months=12, qualifying_months_by_noc={code: 12}, offer_noc=code, offer_qualifies=True)
    assert result["high_wage_experience"] == extra
    assert result["offer_option"] == offer
    assert result["factor"] == max(40 + extra, offer)


def test_mixed_high_wage_levels_and_missing_classification():
    result = _provisional_lmi(spouse=False, canadian_months=12, qualifying_months_by_noc={"00011": 6, "21231": 6}, offer_noc=None, offer_qualifies=False)
    assert result["high_wage_experience"] == 40
    for changes in ({"qualifying_months_by_noc": None}, {"offer_noc": None}, {"qualifying_months_by_noc": {"00011": 13}}, {"canadian_months": True}):
        args = dict(spouse=False, canadian_months=12, qualifying_months_by_noc={}, offer_noc="00011", offer_qualifies=True)
        with pytest.raises(ValueError):
            _provisional_lmi(**(args | changes))
    assert policy_metadata(CHANGE_DATE)["fsw_fst_offer_eligibility_separate_from_crs"] is True
    assert policy_metadata(CHANGE_DATE)["personal_salary_is_classification"] is False
