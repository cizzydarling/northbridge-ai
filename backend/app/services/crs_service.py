def calculate_age_points(age: int):
    if 20 <= age <= 29:
        return 110
    elif age == 30:
        return 105
    elif age == 31:
        return 99
    elif age == 32:
        return 94
    elif age == 33:
        return 88
    elif age == 34:
        return 83
    elif age == 35:
        return 77
    elif age == 36:
        return 72
    elif age == 37:
        return 66
    elif age == 38:
        return 61
    elif age == 39:
        return 55
    elif age == 40:
        return 50
    elif age == 41:
        return 39
    elif age == 42:
        return 28
    elif age == 43:
        return 17
    elif age == 44:
        return 6
    else:
        return 0
    
def calculate_education_points(education: str):
    education_points = {
        "phd": 150,
        "master": 135,
        "bachelor": 120,
        "two_or_more_degrees": 128,
        "college": 98,
        "secondary": 30
    }

    return education_points.get(education.lower(), 0)

def calculate_language_points(clb: int):
    if clb >= 9:
        return 136
    elif clb >= 7:
        return 64
    elif clb >= 5:
        return 32
    else:
        return 0
    
def calculate_experience_points(years: int):
    if years >= 5:
        return 80
    elif years >= 3:
        return 64
    elif years >= 1:
        return 40
    else:
        return 0
    
def calculate_crs(profile: dict):

    age_points = calculate_age_points(profile["age"])
    education_points = calculate_education_points(profile["education_level"])
    language_points = calculate_language_points(profile["clb_score"])
    experience_points = calculate_experience_points(profile["work_experience_years"])

    total = age_points + education_points + language_points + experience_points

    return {
        "age_points": age_points,
        "education_points": education_points,
        "language_points": language_points,
        "experience_points": experience_points,
        "total_crs_score": total
    }
    

