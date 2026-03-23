from typing import Dict, List


def predict_express_entry_draw(profile, crs_score: int) -> Dict:
    """
    Heuristic draw predictor.
    This is not an official IRCC prediction.
    """

    scenarios: List[Dict] = []

    # Base prediction bands
    if crs_score >= 520:
        scenarios.append({
            "draw_type": "General / category-based",
            "predicted_cutoff_min": 490,
            "predicted_cutoff_max": 510,
            "likelihood": "Very High",
            "estimated_time_window": "1-2 months",
            "reason": "Your CRS is well above a typical competitive range."
        })
    elif crs_score >= 500:
        scenarios.append({
            "draw_type": "General / category-based",
            "predicted_cutoff_min": 485,
            "predicted_cutoff_max": 505,
            "likelihood": "High",
            "estimated_time_window": "1-3 months",
            "reason": "Your CRS is strong and may be competitive in near-term rounds."
        })
    elif crs_score >= 470:
        scenarios.append({
            "draw_type": "General / category-based",
            "predicted_cutoff_min": 470,
            "predicted_cutoff_max": 495,
            "likelihood": "Moderate to High",
            "estimated_time_window": "2-4 months",
            "reason": "Your CRS is around the range where draw competitiveness can vary."
        })
    elif crs_score >= 430:
        scenarios.append({
            "draw_type": "Category-based / targeted pathways",
            "predicted_cutoff_min": 430,
            "predicted_cutoff_max": 475,
            "likelihood": "Moderate",
            "estimated_time_window": "3-6 months",
            "reason": "Your profile may be more competitive in targeted or category-based draws."
        })
    else:
        scenarios.append({
            "draw_type": "Category-based / PNP-supported strategy",
            "predicted_cutoff_min": 440,
            "predicted_cutoff_max": 500,
            "likelihood": "Low",
            "estimated_time_window": "6+ months",
            "reason": "Your current CRS may need improvement or provincial support before a draw invitation is likely."
        })

    # Category hints
    category_hints = []

    occupation = (getattr(profile, "occupation", "") or "").strip().lower()
    education = (getattr(profile, "education", "") or "").strip().lower()

    tech_keywords = [
        "software",
        "developer",
        "engineer",
        "data",
        "it",
        "cloud",
        "cyber",
        "programmer",
        "web",
        "ai",
    ]

    if any(keyword in occupation for keyword in tech_keywords):
        category_hints.append(
            "Your occupation may align better with tech-oriented provincial and category-based opportunities."
        )

    if getattr(profile, "language_score", 0) >= 9:
        category_hints.append(
            "A strong language score improves your competitiveness in federal and targeted draws."
        )

    if getattr(profile, "has_canadian_experience", False):
        category_hints.append(
            "Canadian work experience may strengthen your draw competitiveness."
        )

    if education in {"master", "phd"}:
        category_hints.append(
            "Your education level supports stronger Express Entry competitiveness."
        )

    next_best_move = "Increase CRS and monitor Express Entry draw trends."
    if crs_score >= 500:
        next_best_move = "Keep your profile active and prepare documents for a near-term invitation."
    elif crs_score >= 470:
        next_best_move = "Stay draw-ready while improving one high-impact factor such as language or job offer."
    elif crs_score >= 430:
        next_best_move = "Focus on category-based opportunities and parallel provincial strategies."
    else:
        next_best_move = "Prioritize CRS improvement and provincial nomination targeting before relying on federal draws."

    primary = scenarios[0]

    return {
        "predicted_draw_type": primary["draw_type"],
        "predicted_cutoff_min": primary["predicted_cutoff_min"],
        "predicted_cutoff_max": primary["predicted_cutoff_max"],
        "likelihood": primary["likelihood"],
        "estimated_time_window": primary["estimated_time_window"],
        "reason": primary["reason"],
        "category_hints": category_hints,
        "next_best_move": next_best_move,
        "scenarios": scenarios,
        "disclaimer": "This draw predictor is an internal estimate based on profile strength and general competitiveness patterns. It is not an official IRCC forecast."
    }