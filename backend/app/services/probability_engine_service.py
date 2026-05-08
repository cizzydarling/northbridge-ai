from typing import Any, Dict


def _clamp(value: int, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(value, maximum))


def _safe_get(profile: Any, field: str, default=None):
    if isinstance(profile, dict):
        return profile.get(field, default)
    return getattr(profile, field, default)


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value or default)
    except (TypeError, ValueError):
        return default


def _safe_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y", "on"}
    return bool(value)


def _confidence_label(score: int, language: str) -> str:
    if score >= 75:
        return "Elevee" if language == "fr" else "High"
    if score >= 55:
        return "Moderee" if language == "fr" else "Moderate"
    return "Faible" if language == "fr" else "Low"


def estimate_immigration_probabilities(
    profile,
    crs_score: int,
    language: str = "en",
) -> Dict:
    language = "fr" if str(language or "").lower() == "fr" else "en"
    crs_score = _safe_int(crs_score, 0)
    language_score = _safe_int(_safe_get(profile, "language_score", 0), 0)
    experience_years = _safe_int(_safe_get(profile, "experience_years", 0), 0)
    preferred_province = str(_safe_get(profile, "preferred_province", "") or "").strip()
    has_canadian_experience = _safe_bool(_safe_get(profile, "has_canadian_experience", False))
    has_job_offer = _safe_bool(_safe_get(profile, "has_job_offer", False))
    studied_in_canada = _safe_bool(_safe_get(profile, "studied_in_canada", False))

    express_entry_score = 0
    pnp_score = 0

    # Express Entry probability
    if crs_score >= 520:
        express_entry_score += 85
    elif crs_score >= 500:
        express_entry_score += 75
    elif crs_score >= 470:
        express_entry_score += 65
    elif crs_score >= 430:
        express_entry_score += 45
    else:
        express_entry_score += 25

    if language_score >= 9:
        express_entry_score += 10
    elif language_score >= 8:
        express_entry_score += 5

    if experience_years >= 5:
        express_entry_score += 8
    elif experience_years >= 3:
        express_entry_score += 4

    if has_canadian_experience:
        express_entry_score += 8

    if has_job_offer:
        express_entry_score += 6

    # PNP probability
    if crs_score >= 470:
        pnp_score += 55
    elif crs_score >= 430:
        pnp_score += 50
    elif crs_score >= 400:
        pnp_score += 42
    else:
        pnp_score += 35

    if preferred_province:
        pnp_score += 15

    if has_job_offer:
        pnp_score += 10

    if has_canadian_experience:
        pnp_score += 8

    if studied_in_canada:
        pnp_score += 6

    if language_score >= 9:
        pnp_score += 6

    # Overall PR within 12 months
    overall_score = round((express_entry_score * 0.45) + (pnp_score * 0.55))

    express_entry_score = _clamp(round(express_entry_score))
    pnp_score = _clamp(round(pnp_score))
    overall_score = _clamp(round(overall_score))

    confidence = _confidence_label(overall_score, language)

    if express_entry_score >= pnp_score:
        strongest_path = "Entree express" if language == "fr" else "Express Entry"
        strongest_reason = (
            "Votre profil semble actuellement plus competitif pour la selection federale."
            if language == "fr"
            else "Your profile currently appears more competitive through federal selection."
        )
    else:
        strongest_path = (
            "Programme des candidats des provinces"
            if language == "fr"
            else "Provincial Nominee Program"
        )
        strongest_reason = (
            "Votre profil semble actuellement plus susceptible de profiter d'un ciblage provincial."
            if language == "fr"
            else "Your profile currently appears more likely to benefit from provincial targeting."
        )

    return {
        "overall_probability": overall_score,
        "score": overall_score,
        "probability": overall_score,
        "chance_of_pr_within_12_months": overall_score,
        "chance_via_express_entry": express_entry_score,
        "chance_via_pnp": pnp_score,
        "confidence": confidence,
        "strongest_path": strongest_path,
        "strongest_path_reason": strongest_reason,
    }
