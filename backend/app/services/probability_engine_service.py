from typing import Dict


def _clamp(value: int, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(value, maximum))


def estimate_immigration_probabilities(profile, crs_score: int) -> Dict:
    express_entry_score = 0
    pnp_score = 0
    overall_score = 0

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

    if profile.language_score >= 9:
        express_entry_score += 10
    elif profile.language_score >= 8:
        express_entry_score += 5

    if profile.experience_years >= 5:
        express_entry_score += 8
    elif profile.experience_years >= 3:
        express_entry_score += 4

    if profile.has_canadian_experience:
        express_entry_score += 8

    if profile.has_job_offer:
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

    if profile.preferred_province:
        pnp_score += 15

    if profile.has_job_offer:
        pnp_score += 10

    if profile.has_canadian_experience:
        pnp_score += 8

    if profile.studied_in_canada:
        pnp_score += 6

    if profile.language_score >= 9:
        pnp_score += 6

    # Overall PR within 12 months
    overall_score = round((express_entry_score * 0.45) + (pnp_score * 0.55))

    express_entry_score = _clamp(round(express_entry_score))
    pnp_score = _clamp(round(pnp_score))
    overall_score = _clamp(round(overall_score))

    if overall_score >= 75:
        confidence = "High"
    elif overall_score >= 55:
        confidence = "Moderate"
    else:
        confidence = "Low"

    if express_entry_score >= pnp_score:
        strongest_path = "Express Entry"
        strongest_reason = (
            "Your profile currently appears more competitive through federal selection."
        )
    else:
        strongest_path = "Provincial Nominee Program"
        strongest_reason = (
            "Your profile currently appears more likely to benefit from provincial targeting."
        )

    return {
        "chance_of_pr_within_12_months": overall_score,
        "chance_via_express_entry": express_entry_score,
        "chance_via_pnp": pnp_score,
        "confidence": confidence,
        "strongest_path": strongest_path,
        "strongest_path_reason": strongest_reason,
    }