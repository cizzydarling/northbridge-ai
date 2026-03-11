def match_pnp_programs(profile):

    province_matches = []

    occupation = profile.get("occupation", "").lower()
    experience = profile.get("experience", 0)
    crs = profile.get("crs_score", 0)

    tech_jobs = [
        "software engineer",
        "developer",
        "data analyst",
        "it project manager"
    ]

    # Ontario Tech Draw
    tech_jobs = ["software engineer", "data analyst", "developer", "it project manager"]

    if occupation in tech_jobs:
        province_matches.append({
            "province": "Ontario",
            "program": "OINP Tech Draw",
            "chance": "High"
        })

    # Alberta Opportunity Stream
    if crs >= 300:
        province_matches.append({
            "province": "Alberta",
            "program": "Alberta Express Entry Stream",
            "chance": "Medium"
        })

    # Saskatchewan Skilled Worker
    if experience >= 3:
        province_matches.append({
            "province": "Saskatchewan",
            "program": "SINP Skilled Worker",
            "chance": "High"
        })

    # BC Tech
    if occupation in tech_jobs:
        province_matches.append({
            "province": "British Columbia",
            "program": "BC PNP Tech",
            "chance": "High"
        })

    return province_matches