def analyze_profile(profile):

    weaknesses = []
    strengths = []

    if profile["language_score"] < 7:
        weaknesses.append("Improve IELTS to CLB 9")

    if profile["experience"] < 3:
        weaknesses.append("Gain more skilled work experience")

    if profile["education"] in ["diploma"]:
        weaknesses.append("Higher education improves CRS")

    if profile["language_score"] >= 8:
        strengths.append("Strong language score")

    if profile["experience"] >= 5:
        strengths.append("Strong work experience")

    if profile["education"] in ["masters", "phd"]:
        strengths.append("High education level")

    return {
        "strengths": strengths,
        "weaknesses": weaknesses
    }