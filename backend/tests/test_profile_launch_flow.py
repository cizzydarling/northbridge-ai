from types import SimpleNamespace

import backend.launch_smoke_test  # noqa: F401

from app.routes.app_routes import is_profile_complete
from app.services.timeline_estimator_service import estimate_pr_timeline


def test_empty_registration_profile_requires_onboarding() -> None:
    profile = SimpleNamespace(
        first_name=None,
        last_name=None,
        nationality=None,
        current_country=None,
        current_city=None,
        marital_status=None,
        preferred_language="en",
        age=None,
        education=None,
        experience_years=None,
        occupation=None,
        noc_code=None,
        preferred_province=None,
        english_language_score=None,
        french_language_score=None,
    )

    assert is_profile_complete(profile) is False


def test_timeline_handles_empty_registration_profile() -> None:
    profile = SimpleNamespace(
        language_score=None,
        experience_years=None,
        has_job_offer=False,
        has_canadian_experience=False,
        preferred_province=None,
    )

    timeline = estimate_pr_timeline(profile, crs_score=0)

    assert timeline["readiness"] == "Needs profile strengthening"
    assert timeline["timeline_steps"]
