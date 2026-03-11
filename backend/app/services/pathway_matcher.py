from app.data.pathways import PATHWAYS
from app.services.occupation_utils import normalize_text, classify_occupation_group
from app.services.pathway_ranker import rank_pathway


def _check_pathway(profile: dict, crs_score: int, pathway: dict):
    reasons = []
    next_steps = []
    strengths = []
    blockers = []
    score = 0
    missing = 0

    education = profile.get("education")
    language_score = profile.get("language_score", 0)
    experience_years = profile.get("experience_years", 0)
    has_job_offer = profile.get("has_job_offer", False)
    has_canadian_experience = profile.get("has_canadian_experience", False)
    studied_in_canada = profile.get("studied_in_canada", False)
    occupation = normalize_text(profile.get("occupation"))
    noc_code = str(profile.get("noc_code", "")).strip()
    occupation_group = classify_occupation_group(occupation)

    if crs_score >= pathway["min_crs"]:
        score += 30
        reasons.append(f"CRS score meets pathway threshold ({pathway['min_crs']}).")
        strengths.append(f"CRS score meets the minimum target of {pathway['min_crs']}.")
    else:
        missing += 1
        blockers.append(f"CRS score is below the target of {pathway['min_crs']}.")
        next_steps.append(f"Increase CRS score toward {pathway['min_crs']}.")

    if language_score >= pathway["language_min"]:
        score += 20
        reasons.append(f"Language score meets minimum requirement ({pathway['language_min']}).")
        strengths.append(f"Language score meets the minimum requirement of {pathway['language_min']}.")
    else:
        missing += 1
        blockers.append(f"Language score is below the required minimum of {pathway['language_min']}.")
        next_steps.append(f"Improve language score to at least {pathway['language_min']}.")

    if experience_years >= pathway["experience_min"]:
        score += 20
        reasons.append(f"Work experience meets minimum requirement ({pathway['experience_min']} year(s)).")
        strengths.append(f"Work experience meets the minimum requirement of {pathway['experience_min']} year(s).")
    else:
        missing += 1
        blockers.append(f"Work experience is below {pathway['experience_min']} year(s).")
        next_steps.append(f"Gain at least {pathway['experience_min']} year(s) of work experience.")

    if education in pathway["education_levels"]:
        score += 15
        reasons.append("Education level aligns with pathway.")
        strengths.append("Education level aligns with pathway requirements.")
    else:
        missing += 1
        blockers.append("Education level does not align with this pathway.")
        next_steps.append("Improve or verify educational eligibility.")

    if pathway["requires_job_offer"]:
        if has_job_offer:
            score += 10
            reasons.append("Profile includes a required job offer.")
            strengths.append("A qualifying job offer supports this pathway.")
        else:
            missing += 1
            blockers.append("A qualifying job offer is required.")
            next_steps.append("Secure a qualifying job offer.")
    else:
        score += 5

    if pathway["requires_canadian_experience"]:
        if has_canadian_experience:
            score += 10
            reasons.append("Canadian work experience requirement is satisfied.")
            strengths.append("Canadian work experience supports this pathway.")
        else:
            missing += 1
            blockers.append("Canadian work experience is required.")
            next_steps.append("Gain qualifying Canadian work experience.")
    else:
        score += 5

    if pathway["requires_study_in_canada"]:
        if studied_in_canada:
            score += 10
            reasons.append("Canadian study requirement is satisfied.")
            strengths.append("Canadian study background supports this pathway.")
        else:
            missing += 1
            blockers.append("Canadian study history may be needed for this pathway.")
            next_steps.append("Consider study-related eligibility pathways.")

    target_occupations = [normalize_text(x) for x in pathway.get("target_occupations", [])]
    target_noc_codes = [str(x).strip() for x in pathway.get("target_noc_codes", [])]
    occupation_groups = pathway.get("occupation_groups", [])

    if occupation and occupation in target_occupations:
        score += 20
        reasons.append("Occupation directly aligns with this pathway.")
        strengths.append("Occupation directly aligns with this pathway.")
    elif noc_code and noc_code in target_noc_codes:
        score += 25
        reasons.append("NOC code directly aligns with this pathway.")
        strengths.append("NOC code directly aligns with this pathway.")
    elif occupation_group in occupation_groups:
        score += 10
        reasons.append(f"Occupation group alignment detected: {occupation_group}.")
        strengths.append(f"Occupation group alignment detected: {occupation_group}.")
    elif target_occupations or target_noc_codes or occupation_groups:
        missing += 1
        blockers.append("Occupation or NOC code is not closely aligned with this pathway.")
        next_steps.append("This pathway may depend on a more closely targeted occupation or NOC code.")

    if missing == 0:
        status = "eligible"
    elif missing <= 2:
        status = "borderline"
    else:
        status = "not_eligible"

    rank_score = rank_pathway(profile, pathway, score)
    next_steps = list(dict.fromkeys(next_steps + pathway.get("tips", [])))

    return {
        "id": pathway["id"],
        "name": pathway["name"],
        "category": pathway["category"],
        "province": pathway["province"],
        "status": status,
        "score": score,
        "rank_score": rank_score,
        "reasons": reasons,
        "strengths": strengths,
        "blockers": blockers,
        "next_steps": next_steps,
        "description": pathway["description"],
    }


def match_pathways(profile: dict, crs_score: int):
    results = []

    for pathway in PATHWAYS:
        result = _check_pathway(profile, crs_score, pathway)
        results.append(result)

    eligible = sorted(
        [r for r in results if r["status"] == "eligible"],
        key=lambda x: x["rank_score"],
        reverse=True
    )

    borderline = sorted(
        [r for r in results if r["status"] == "borderline"],
        key=lambda x: x["rank_score"],
        reverse=True
    )

    not_eligible = sorted(
        [r for r in results if r["status"] == "not_eligible"],
        key=lambda x: x["rank_score"],
        reverse=True
    )

    return {
        "crs_score": crs_score,
        "eligible": eligible,
        "borderline": borderline,
        "not_eligible": not_eligible,
    }