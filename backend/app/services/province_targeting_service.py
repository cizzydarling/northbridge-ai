from typing import Dict, List


def _normalize_text(value) -> str:
    return (value or "").strip().lower()


def rank_provinces_for_profile(profile, crs_score: int) -> List[Dict]:
    education = _normalize_text(getattr(profile, "education", ""))
    occupation = _normalize_text(getattr(profile, "occupation", ""))
    preferred_province = _normalize_text(getattr(profile, "preferred_province", ""))

    is_tech = any(
        keyword in occupation
        for keyword in [
            "software",
            "developer",
            "engineer",
            "data",
            "it",
            "cloud",
            "cyber",
            "analyst",
            "programmer",
            "web",
            "ai",
        ]
    )

    provinces = []

    def add_province(name: str, score: int, reasons: List[str]):
        provinces.append(
            {
                "province": name,
                "score": max(0, min(score, 100)),
                "reason": " ".join(reasons[:3]),
            }
        )

    # Ontario
    ontario_score = 60
    ontario_reasons = []

    if crs_score >= 470:
        ontario_score += 18
        ontario_reasons.append(
            "Your CRS is competitive for Ontario-aligned skilled worker pathways."
        )
    elif crs_score >= 430:
        ontario_score += 10
        ontario_reasons.append(
            "Your CRS is in a workable range for Ontario targeting."
        )

    if is_tech:
        ontario_score += 12
        ontario_reasons.append(
            "Your occupation appears to align well with Ontario's strong tech market."
        )

    if getattr(profile, "has_job_offer", False):
        ontario_score += 6
        ontario_reasons.append(
            "A job offer improves your attractiveness for Ontario-focused pathways."
        )

    if preferred_province == "ontario":
        ontario_score += 12
        ontario_reasons.append(
            "Ontario is already your preferred province."
        )

    add_province("Ontario", ontario_score, ontario_reasons)

    # Alberta
    alberta_score = 58
    alberta_reasons = []

    if crs_score >= 380:
        alberta_score += 12
        alberta_reasons.append(
            "Alberta can be attractive for candidates with moderate CRS scores."
        )

    if crs_score < 470:
        alberta_score += 8
        alberta_reasons.append(
            "Alberta may offer a more realistic route if federal competitiveness is still building."
        )

    if getattr(profile, "has_job_offer", False):
        alberta_score += 6
        alberta_reasons.append(
            "A job offer strengthens your Alberta positioning."
        )

    if getattr(profile, "has_canadian_experience", False):
        alberta_score += 6
        alberta_reasons.append(
            "Canadian experience supports your provincial readiness."
        )

    if preferred_province == "alberta":
        alberta_score += 12
        alberta_reasons.append(
            "Alberta is already your preferred province."
        )

    add_province("Alberta", alberta_score, alberta_reasons)

    # British Columbia
    bc_score = 57
    bc_reasons = []

    if is_tech:
        bc_score += 16
        bc_reasons.append(
            "Your occupation appears to fit well with British Columbia's tech-oriented opportunities."
        )

    if getattr(profile, "has_job_offer", False):
        bc_score += 12
        bc_reasons.append(
            "A job offer is especially helpful for British Columbia pathways."
        )

    if crs_score >= 430:
        bc_score += 8
        bc_reasons.append(
            "Your CRS gives you a solid base for BC-targeted planning."
        )

    if preferred_province in {"british columbia", "bc"}:
        bc_score += 12
        bc_reasons.append(
            "British Columbia is already your preferred province."
        )

    add_province("British Columbia", bc_score, bc_reasons)

    # Saskatchewan
    sk_score = 52
    sk_reasons = []

    if crs_score >= 400:
        sk_score += 10
        sk_reasons.append(
            "Your profile may be workable for Saskatchewan-style provincial targeting."
        )

    if getattr(profile, "experience_years", 0) >= 3:
        sk_score += 8
        sk_reasons.append(
            "Your work experience supports provincial competitiveness."
        )

    if preferred_province == "saskatchewan":
        sk_score += 12
        sk_reasons.append(
            "Saskatchewan is already your preferred province."
        )

    add_province("Saskatchewan", sk_score, sk_reasons)

    # Manitoba
    mb_score = 50
    mb_reasons = []

    if getattr(profile, "has_canadian_experience", False):
        mb_score += 8
        mb_reasons.append(
            "Canadian experience strengthens your readiness for Manitoba-style pathways."
        )

    if crs_score >= 400:
        mb_score += 8
        mb_reasons.append(
            "Your CRS is workable for provincial planning."
        )

    if preferred_province == "manitoba":
        mb_score += 12
        mb_reasons.append(
            "Manitoba is already your preferred province."
        )

    add_province("Manitoba", mb_score, mb_reasons)

    # Nova Scotia
    ns_score = 49
    ns_reasons = []

    if crs_score >= 400:
        ns_score += 10
        ns_reasons.append(
            "Your CRS may support Atlantic-focused opportunities."
        )

    if education in {"bachelor", "master", "phd"}:
        ns_score += 6
        ns_reasons.append(
            "Your education level supports skilled immigration targeting."
        )

    if preferred_province in {"nova scotia", "ns"}:
        ns_score += 12
        ns_reasons.append(
            "Nova Scotia is already your preferred province."
        )

    add_province("Nova Scotia", ns_score, ns_reasons)

    provinces.sort(key=lambda item: item["score"], reverse=True)
    return provinces[:3]