from types import SimpleNamespace

import backend.launch_smoke_test  # noqa: F401

from app.services.crs_calculator import calculate_crs_breakdown
from app.services.simulator_service import estimate_crs, get_eligible_pathways
from app.services.strategy_service import generate_strategy_roadmap, recommend_programs, rank_provinces_for_profile
from app.services.crs_calculator import build_recommendation_result


def test_job_offer_does_not_increase_crs_in_strategy_or_simulator() -> None:
    # IRCC removed arranged-employment points effective March 25, 2025.
    profile = dict(
        age=28,
        education="bachelor",
        language_score=9,
        experience_years=3,
        has_job_offer=False,
        has_canadian_experience=False,
        studied_in_canada=False,
    )
    with_offer = {**profile, "has_job_offer": True}
    baseline = calculate_crs_breakdown(SimpleNamespace(**profile))
    offered = calculate_crs_breakdown(SimpleNamespace(**with_offer))

    assert offered["breakdown"]["job_offer"] == 0
    assert offered["total_crs"] == baseline["total_crs"]
    assert estimate_crs(with_offer) == estimate_crs(profile)

    # Employer-supported pathway consideration still uses the job-offer flag.
    pathway = "Employer-Supported Provincial Streams"
    assert pathway not in get_eligible_pathways(profile)
    assert pathway in get_eligible_pathways(with_offer)


def test_roadmaps_do_not_promise_job_offer_crs_points() -> None:
    profile = SimpleNamespace(
        age=28, education="bachelor", language_score=9, experience_years=3,
        has_job_offer=False, has_canadian_experience=False,
        studied_in_canada=False, preferred_province="Ontario",
    )
    for language, title in [
        ("en", "Secure a valid Canadian job offer"),
        ("fr", "Obtenir une offre d’emploi valide au Canada"),
    ]:
        steps = generate_strategy_roadmap(profile, 350, language=language)
        offer_step = next(step for step in steps if step["title"] == title)
        assert offer_step["estimated_crs_gain"] == 0


def test_quebec_requires_its_own_selection_review() -> None:
    for province in ("Quebec", "Québec"):
        profile = SimpleNamespace(preferred_province=province)
        recommendation = build_recommendation_result(profile, 500)
        assert recommendation["eligible_pathways"] == []
        assert recommendation["strategy"]["target_pnp"] is False
        assert rank_provinces_for_profile(profile, 500) == []
        for language in ("en", "fr"):
            programs = recommend_programs(profile, 500, language=language)
            assert len(programs) == 1
            assert "Provincial Nominee" not in programs[0]
            assert "candidats de la province" not in programs[0]
            steps = generate_strategy_roadmap(profile, 500, language=language)
            assert all(step["estimated_crs_gain"] == 0 for step in steps)
