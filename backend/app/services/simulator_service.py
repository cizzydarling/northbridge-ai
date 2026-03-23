def simulate_crs_improvements(profile):
    """
    Simulates improvements to the user's CRS-related profile factors.
    This version is defensive and avoids circular imports.
    """

    if profile is None:
        raise ValueError("Profile is required.")

    current_profile = {
        "age": getattr(profile, "age", None),
        "education": getattr(profile, "education", None),
        "language_score": getattr(profile, "language_score", None),
        "experience_years": getattr(profile, "experience_years", None),
        "has_job_offer": getattr(profile, "has_job_offer", False),
        "has_canadian_experience": getattr(profile, "has_canadian_experience", False),
        "studied_in_canada": getattr(profile, "studied_in_canada", False),
        "occupation": getattr(profile, "occupation", None),
        "noc_code": getattr(profile, "noc_code", None),
        "preferred_province": getattr(profile, "preferred_province", None),
    }

    current_language = current_profile["language_score"] or 0
    current_experience = current_profile["experience_years"] or 0

    simulated_changes = {
        "language_score": max(current_language, 9),
        "experience_years": max(current_experience, current_experience + 1 if current_experience else 1),
        "has_job_offer": current_profile["has_job_offer"],
        "has_canadian_experience": current_profile["has_canadian_experience"],
        "studied_in_canada": current_profile["studied_in_canada"],
    }

    # Placeholder CRS estimation logic
    current_crs_score = estimate_crs(current_profile)
    simulated_profile = {**current_profile, **simulated_changes}
    simulated_crs_score = estimate_crs(simulated_profile)

    pathway_comparison = {
        "current_eligible_pathways": get_eligible_pathways(current_profile),
        "simulated_eligible_pathways": get_eligible_pathways(simulated_profile),
        "newly_unlocked_pathways": [
            pathway
            for pathway in get_eligible_pathways(simulated_profile)
            if pathway not in get_eligible_pathways(current_profile)
        ],
    }

    return {
        "current_profile": current_profile,
        "simulated_changes": simulated_changes,
        "crs_comparison": {
            "current_crs_score": current_crs_score,
            "simulated_crs_score": simulated_crs_score,
            "difference": simulated_crs_score - current_crs_score,
        },
        "pathway_comparison": pathway_comparison,
    }


def estimate_crs(profile_data):
    score = 0

    age = profile_data.get("age")
    education = profile_data.get("education")
    language_score = profile_data.get("language_score", 0) or 0
    experience_years = profile_data.get("experience_years", 0) or 0
    has_job_offer = profile_data.get("has_job_offer", False)
    has_canadian_experience = profile_data.get("has_canadian_experience", False)
    studied_in_canada = profile_data.get("studied_in_canada", False)

    if age:
        if 20 <= age <= 29:
            score += 110
        elif 30 <= age <= 35:
            score += 95
        elif 36 <= age <= 40:
            score += 70
        else:
            score += 40

    education_points = {
        "high_school": 30,
        "diploma": 60,
        "bachelor": 90,
        "master": 120,
        "phd": 140,
    }
    score += education_points.get(str(education).lower(), 0)

    score += min(language_score * 12, 136)
    score += min(experience_years * 15, 80)

    if has_job_offer:
        score += 50

    if has_canadian_experience:
        score += 40

    if studied_in_canada:
        score += 30

    return score


def get_eligible_pathways(profile_data):
    pathways = []

    preferred_province = profile_data.get("preferred_province")
    language_score = profile_data.get("language_score", 0) or 0
    experience_years = profile_data.get("experience_years", 0) or 0
    has_job_offer = profile_data.get("has_job_offer", False)

    if language_score >= 7 and experience_years >= 1:
        pathways.append("Express Entry")

    if preferred_province == "Ontario":
        pathways.append("Ontario Provincial Nominee Program")

    if preferred_province == "British Columbia":
        pathways.append("BC Provincial Nominee Program")

    if preferred_province == "Alberta":
        pathways.append("Alberta Advantage Immigration Program")

    if has_job_offer:
        pathways.append("Employer-Supported Provincial Streams")

    return pathways