def evaluate_express_entry(profile):

    score = 0
    eligibility = False
    notes = []

    age = profile.get("age", 0)
    education = profile.get("education", "")
    experience = profile.get("experience", 0)
    language = profile.get("language_score", 0)

    # AGE SCORE
    if 18 <= age <= 29:
        score += 110
    elif 30 <= age <= 35:
        score += 95
    elif 36 <= age <= 40:
        score += 70

    # EDUCATION SCORE
    if education == "phd":
        score += 150
    elif education == "masters":
        score += 135
    elif education == "bachelors":
        score += 120
    elif education == "diploma":
        score += 90

    # EXPERIENCE
    if experience >= 5:
        score += 80
    elif experience >= 3:
        score += 60
    elif experience >= 1:
        score += 40

    # LANGUAGE
    if language >= 9:
        score += 120
    elif language >= 7:
        score += 80
    elif language >= 6:
        score += 60

    # Eligibility threshold
    if score >= 470:
        eligibility = True
        notes.append("Strong Express Entry candidate")
    elif score >= 430:
        notes.append("Possible with Provincial Nomination")
    else:
        notes.append("Needs improvement")

    return {
        "crs_score": score,
        "eligible": eligibility,
        "notes": notes
    }

