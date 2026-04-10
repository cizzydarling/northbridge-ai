from typing import Any, Dict, List


def _safe_get(profile, field, default=None):
    if isinstance(profile, dict):
        return profile.get(field, default)
    return getattr(profile, field, default)


def _normalize_text(value: str) -> str:
    return (value or "").strip().lower()


def _extract_digits(value: str) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _extract_teer(noc_code: str) -> int:
    digits = _extract_digits(noc_code)
    if not digits:
        return -1
    try:
        return int(digits[0])
    except (TypeError, ValueError):
        return -1


def _is_tech_noc(noc_code: str) -> bool:
    digits = _extract_digits(noc_code)
    return digits.startswith(("21", "212", "213"))


def _is_healthcare_noc(noc_code: str) -> bool:
    digits = _extract_digits(noc_code)
    return digits.startswith(("31", "32", "33"))


def _is_trade_noc(noc_code: str) -> bool:
    digits = _extract_digits(noc_code)
    return digits.startswith(("72", "73"))


def _score_match(base_score: int, boosts: List[int]) -> int:
    return min(base_score + sum(boosts), 100)


def _chance_label(score: int) -> str:
    if score >= 75:
        return "High"
    if score >= 50:
        return "Medium"
    return "Low"


def match_pnp_programs(profile) -> List[Dict[str, Any]]:
    province_matches: List[Dict[str, Any]] = []

    occupation = _normalize_text(_safe_get(profile, "occupation", ""))
    experience = int(
        _safe_get(
            profile,
            "experience_years",
            _safe_get(profile, "experience", 0),
        )
        or 0
    )
    crs = int(_safe_get(profile, "crs_score", 0) or 0)
    noc_code = str(_safe_get(profile, "noc_code", "") or "")
    preferred_province = _normalize_text(_safe_get(profile, "preferred_province", ""))

    teer = _extract_teer(noc_code)

    tech_keywords = [
        "software",
        "developer",
        "engineer",
        "data",
        "it",
        "programmer",
        "web",
        "analyst",
    ]

    is_tech = _is_tech_noc(noc_code) or any(k in occupation for k in tech_keywords)
    is_health = _is_healthcare_noc(noc_code)
    is_trade = _is_trade_noc(noc_code)

    if is_tech:
        score = _score_match(
            base_score=65,
            boosts=[
                10 if crs >= 450 else 0,
                5 if teer in [0, 1, 2] else 0,
                5 if preferred_province == "ontario" else 0,
            ],
        )
        province_matches.append(
            {
                "province": "Ontario",
                "program": "OINP Tech Draw",
                "chance": _chance_label(score),
                "score": score,
                "reason": "Tech occupation aligns with Ontario targeted draws.",
            }
        )

    if crs >= 300:
        score = _score_match(
            base_score=55,
            boosts=[
                10 if crs < 450 else 5,
                5 if teer in [0, 1, 2, 3] else 0,
                5 if preferred_province == "alberta" else 0,
            ],
        )
        province_matches.append(
            {
                "province": "Alberta",
                "program": "Alberta Express Entry Stream",
                "chance": _chance_label(score),
                "score": score,
                "reason": "Alberta favors moderate CRS profiles.",
            }
        )

    if experience >= 3:
        score = _score_match(
            base_score=60,
            boosts=[
                10 if experience >= 5 else 0,
                5 if teer in [0, 1, 2, 3] else 0,
                5 if preferred_province == "saskatchewan" else 0,
            ],
        )
        province_matches.append(
            {
                "province": "Saskatchewan",
                "program": "SINP Skilled Worker",
                "chance": _chance_label(score),
                "score": score,
                "reason": "Experience-driven eligibility aligns with SINP.",
            }
        )

    if is_tech:
        score = _score_match(
            base_score=70,
            boosts=[
                10 if crs >= 440 else 0,
                5 if teer in [0, 1, 2] else 0,
                5 if preferred_province in {"british columbia", "bc"} else 0,
            ],
        )
        province_matches.append(
            {
                "province": "British Columbia",
                "program": "BC PNP Tech",
                "chance": _chance_label(score),
                "score": score,
                "reason": "BC strongly targets tech occupations.",
            }
        )

    if is_health:
        score = _score_match(
            base_score=78,
            boosts=[
                5 if teer in [0, 1, 2] else 0,
                5 if preferred_province == "ontario" else 0,
            ],
        )
        province_matches.append(
            {
                "province": "Ontario",
                "program": "Healthcare Targeted Draw",
                "chance": _chance_label(score),
                "score": score,
                "reason": "Healthcare occupations are actively targeted.",
            }
        )

    if is_trade:
        score = _score_match(
            base_score=76,
            boosts=[
                5 if experience >= 3 else 0,
                5 if preferred_province == "alberta" else 0,
            ],
        )
        province_matches.append(
            {
                "province": "Alberta",
                "program": "Alberta Opportunity Stream (Trades)",
                "chance": _chance_label(score),
                "score": score,
                "reason": "Trades occupations are in demand in Alberta.",
            }
        )

    province_matches = sorted(
        province_matches,
        key=lambda x: x.get("score", 0),
        reverse=True,
    )

    return province_matches


def _translate_province_matches(matches: List[Dict[str, Any]], language: str = "en") -> List[Dict[str, Any]]:
    lang = (language or "en").strip().lower()
    if lang != "fr":
        return matches

    chance_map = {
        "High": "Élevée",
        "Medium": "Moyenne",
        "Low": "Faible",
    }

    program_map = {
        "OINP Tech Draw": "Volet Tech de l’OINP",
        "Alberta Express Entry Stream": "Volet Entrée express de l’Alberta",
        "SINP Skilled Worker": "Volet travailleur qualifié du SINP",
        "BC PNP Tech": "Volet Tech du BC PNP",
        "Healthcare Targeted Draw": "Sélection ciblée en santé",
        "Alberta Opportunity Stream (Trades)": "Volet d’opportunité de l’Alberta (métiers spécialisés)",
    }

    reason_map = {
        "Tech occupation aligns with Ontario targeted draws.": "La profession technologique correspond aux sélections ciblées de l’Ontario.",
        "Alberta favors moderate CRS profiles.": "L’Alberta favorise souvent les profils avec un score CRS modéré.",
        "Experience-driven eligibility aligns with SINP.": "L’admissibilité fondée sur l’expérience correspond bien au SINP.",
        "BC strongly targets tech occupations.": "La Colombie-Britannique cible fortement les professions technologiques.",
        "Healthcare occupations are actively targeted.": "Les professions de la santé sont activement ciblées.",
        "Trades occupations are in demand in Alberta.": "Les métiers spécialisés sont recherchés en Alberta.",
    }

    translated = []
    for item in matches:
        translated.append(
            {
                **item,
                "chance": chance_map.get(item.get("chance"), item.get("chance")),
                "program": program_map.get(item.get("program"), item.get("program")),
                "reason": reason_map.get(item.get("reason"), item.get("reason")),
            }
        )

    return translated


def rank_provinces_for_profile(profile, crs_score: int = 0, language: str = "en") -> List[Dict[str, Any]]:
    normalized_profile = {
        "occupation": _safe_get(profile, "occupation", ""),
        "experience_years": int(
            _safe_get(
                profile,
                "experience_years",
                _safe_get(profile, "experience", 0),
            )
            or 0
        ),
        "noc_code": _safe_get(profile, "noc_code", ""),
        "preferred_province": _safe_get(profile, "preferred_province", ""),
        "crs_score": int(crs_score or _safe_get(profile, "crs_score", 0) or 0),
    }

    matches = match_pnp_programs(normalized_profile)
    return _translate_province_matches(matches, language=language)