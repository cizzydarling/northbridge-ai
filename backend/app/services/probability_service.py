def calculate_success_probability(profile, crs_score, pnp_matches):

    score = 0

    if crs_score >= 470:
        score += 40
    elif crs_score >= 430:
        score += 25
    else:
        score += 10

    if profile["language_score"] >= 8:
        score += 20

    if profile["experience"] >= 3:
        score += 20

    if len(pnp_matches) > 0:
        score += 20

    if score > 100:
        score = 100

    return {
        "success_probability": score
    }