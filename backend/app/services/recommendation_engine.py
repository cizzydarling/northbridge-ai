def recommend_programs(profile):
    programs = []

    if profile["age"] < 30 and profile["language_score"] >= 7:
        programs.append("Express Entry")

    if profile["education"] in ["bachelor", "master", "phd"]:
        programs.append("Provincial Nominee Program")

    if profile["experience_years"] >= 2:
        programs.append("Atlantic Immigration Program")
    
    return programs