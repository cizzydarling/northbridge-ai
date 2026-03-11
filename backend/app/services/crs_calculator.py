def calculate_crs(profile):
    score = 0

    # Age points
    if 20 <= profile["age"] <= 29:
        score += 110
    elif 30 <= profile["age"] <= 35:
        score += 95
    elif 36 <= profile["age"] <= 40:
        score += 70
    else:
        score += 40

    # Education points
    education_points = {
        "phd": 150,
        "master": 135,
        "bachelor": 120,
        "college": 90
    }
    score += education_points.get(profile["education"], 0)

    # Language points
    score += profile["language_score"] * 10

    # Work experience
    if profile["experience_years"] >= 5:
        score += 80
    elif profile["experience_years"] >= 3:
        score += 60
    elif profile["experience_years"] >= 1:
        score += 40

    return score