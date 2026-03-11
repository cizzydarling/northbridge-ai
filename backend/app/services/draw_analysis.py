def analyze_draws(crs_score):

    recent_draw_cutoff = 490

    if crs_score >= recent_draw_cutoff:
        probability = "High"
    elif crs_score >= 450:
        probability = "Medium"
    else:
        probability = "Low"

    return {
        "latest_cutoff": recent_draw_cutoff,
        "probability": probability
    }

