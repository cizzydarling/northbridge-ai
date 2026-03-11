def simulate_crs_improvements(profile, base_crs: int):
    scenarios = []

    # Language improvement
    improved_language = min(profile.language_score + 1, 10)
    if improved_language > profile.language_score:
        language_gain = (improved_language - profile.language_score) * 12
        scenarios.append({
            "change": f"Increase language score from {profile.language_score} to {improved_language}",
            "new_crs": base_crs + language_gain
        })

    # More work experience
    if profile.experience_years < 5:
        if profile.experience_years < 1:
            exp_gain = 40
        elif profile.experience_years < 3:
            exp_gain = 20
        else:
            exp_gain = 20

        scenarios.append({
            "change": f"Increase work experience from {profile.experience_years} to 5 years",
            "new_crs": base_crs + exp_gain
        })

    # Canadian job offer
    if not profile.has_job_offer:
        scenarios.append({
            "change": "Obtain a valid Canadian job offer",
            "new_crs": base_crs + 50
        })

    # Canadian work experience
    if not profile.has_canadian_experience:
        scenarios.append({
            "change": "Gain Canadian work experience",
            "new_crs": base_crs + 40
        })

    # Study in Canada
    if not profile.studied_in_canada:
        scenarios.append({
            "change": "Complete eligible studies in Canada",
            "new_crs": base_crs + 30
        })

    # Provincial nomination
    scenarios.append({
        "change": "Obtain a provincial nomination",
        "new_crs": base_crs + 600
    })

    return scenarios