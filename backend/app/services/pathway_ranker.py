from app.services.occupation_utils import normalize_text, classify_occupation_group


def rank_pathway(profile: dict, pathway: dict, base_score: int) -> int:
    rank_score = base_score

    preferred_province = normalize_text(profile.get("preferred_province"))
    occupation = normalize_text(profile.get("occupation"))
    noc_code = str(profile.get("noc_code", "")).strip()
    has_job_offer = profile.get("has_job_offer", False)
    has_canadian_experience = profile.get("has_canadian_experience", False)

    pathway_province = normalize_text(pathway.get("province"))
    pathway_category = normalize_text(pathway.get("category"))
    occupation_group = classify_occupation_group(occupation)

    target_occupations = [normalize_text(x) for x in pathway.get("target_occupations", [])]
    target_noc_codes = [str(x).strip() for x in pathway.get("target_noc_codes", [])]
    occupation_groups = pathway.get("occupation_groups", [])

    if preferred_province and preferred_province in pathway_province:
        rank_score += 25

    if occupation and occupation in target_occupations:
        rank_score += 20

    if noc_code and noc_code in target_noc_codes:
        rank_score += 25

    if occupation_group in occupation_groups:
        rank_score += 10

    if has_job_offer and pathway.get("requires_job_offer"):
        rank_score += 15

    if has_canadian_experience and pathway.get("requires_canadian_experience"):
        rank_score += 15

    if pathway_category == "pnp":
        rank_score += 5

    if pathway_category == "express entry" and profile.get("language_score", 0) >= 8:
        rank_score += 5

    return rank_score