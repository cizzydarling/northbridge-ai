from typing import List, Dict, Any


def _safe_get(profile, field, default=None):
    if isinstance(profile, dict):
        return profile.get(field, default)
    return getattr(profile, field, default)


def _normalize_text(value: str) -> str:
    return (value or "").strip().lower()


def _extract_teer(noc_code: str) -> int:
    digits = "".join(ch for ch in str(noc_code or "") if ch.isdigit())
    if len(digits) < 2:
        return -1
    try:
        return int(digits[1])
    except (TypeError, ValueError):
        return -1


def _is_tech_noc(noc_code: str) -> bool:
    noc_code = str(noc_code or "")
    return noc_code.startswith(("21", "212", "213"))


def _is_healthcare_noc(noc_code: str) -> bool:
    noc_code = str(noc_code or "")
    return noc_code.startswith(("31", "32"))


def _is_trade_noc(noc_code: str) -> bool:
    noc_code = str(noc_code or "")
    return noc_code.startswith(("72", "73"))


def _score_match(base_score: int, boosts: List[int]) -> int:
    return min(base_score + sum(boosts), 100)


def _chance_label(score: int) -> str:
    if score >= 75:
        return "High"
    if score >= 50:
        return "Medium"
    return "Low"


def match_pnp_programs(profile) -> List[Dict[str, Any]]:
    province_matches = []

    occupation = _normalize_text(_safe_get(profile, "occupation", ""))
    experience = int(_safe_get(profile, "experience_years", 0) or 0)
    crs = int(_safe_get(profile, "crs_score", 0) or 0)
    noc_code = str(_safe_get(profile, "noc_code", "") or "")

    teer = _extract_teer(noc_code)

    # fallback for older profiles without noc
    tech_keywords = ["software", "developer", "data", "it", "engineer"]

    is_tech = _is_tech_noc(noc_code) or any(k in occupation for k in tech_keywords)
    is_health = _is_healthcare_noc(noc_code)
    is_trade = _is_trade_noc(noc_code)

    # =========================
    # ONTARIO (OINP TECH)
    # =========================
    if is_tech:
        score = _score_match(
            base_score=65,
            boosts=[
                10 if crs >= 450 else 0,
                5 if teer in [0, 1, 2] else 0,
            ],
        )

        province_matches.append({
            "province": "Ontario",
            "program": "OINP Tech Draw",
            "chance": _chance_label(score),
            "score": score,
            "reason": "Tech occupation aligns with Ontario targeted draws.",
        })

    # =========================
    # ALBERTA (AOS / EE)
    # =========================
    if crs >= 300:
        score = _score_match(
            base_score=55,
            boosts=[
                10 if crs < 450 else 5,
                5 if teer in [0, 1, 2, 3] else 0,
            ],
        )

        province_matches.append({
            "province": "Alberta",
            "program": "Alberta Express Entry Stream",
            "chance": _chance_label(score),
            "score": score,
            "reason": "Alberta favors moderate CRS profiles.",
        })

    # =========================
    # SASKATCHEWAN (SINP)
    # =========================
    if experience >= 3:
        score = _score_match(
            base_score=60,
            boosts=[
                10 if experience >= 5 else 0,
                5 if teer in [0, 1, 2, 3] else 0,
            ],
        )

        province_matches.append({
            "province": "Saskatchewan",
            "program": "SINP Skilled Worker",
            "chance": _chance_label(score),
            "score": score,
            "reason": "Experience-driven eligibility aligns with SINP.",
        })

    # =========================
    # BRITISH COLUMBIA (TECH)
    # =========================
    if is_tech:
        score = _score_match(
            base_score=70,
            boosts=[
                10 if crs >= 440 else 0,
                5 if teer in [0, 1, 2] else 0,
            ],
        )

        province_matches.append({
            "province": "British Columbia",
            "program": "BC PNP Tech",
            "chance": _chance_label(score),
            "score": score,
            "reason": "BC strongly targets tech occupations.",
        })

    # =========================
    # HEALTHCARE BONUS (Ontario / BC)
    # =========================
    if is_health:
        province_matches.append({
            "province": "Ontario",
            "program": "Healthcare Targeted Draw",
            "chance": "High",
            "score": 80,
            "reason": "Healthcare occupations are actively targeted.",
        })

    # =========================
    # TRADES BONUS (Alberta / Saskatchewan)
    # =========================
    if is_trade:
        province_matches.append({
            "province": "Alberta",
            "program": "Alberta Opportunity Stream (Trades)",
            "chance": "High",
            "score": 78,
            "reason": "Trades occupations are in demand in Alberta.",
        })

    # =========================
    # SORT (IMPORTANT)
    # =========================
    province_matches = sorted(
        province_matches,
        key=lambda x: x.get("score", 0),
        reverse=True,
    )

    return province_matches
