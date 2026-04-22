from typing import Any, Dict, List

from app.services.noc_service import suggest_noc_matches


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
    except:
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


# 🔥 NEW: resolve NOC using AI engine
def _resolve_noc(profile) -> Dict[str, Any]:
    occupation = _safe_get(profile, "occupation", "")
    job_description = _safe_get(profile, "job_description", "")
    duties_raw = _safe_get(profile, "job_duties", "")

    duties = []
    if isinstance(duties_raw, str):
        duties = [d.strip() for d in duties_raw.split("\n") if d.strip()]

    suggested = None
    if occupation:
        try:
            suggested = suggest_noc_matches(
                occupation=occupation,
                job_description=job_description,
                duties=duties,
            )
        except:
            suggested = None

    suggested_noc = (suggested or {}).get("suggested_noc", "")
    confidence = (suggested or {}).get("confidence", 0)

    entered_noc = _safe_get(profile, "noc_code", "")

    # 🔥 Smart fallback logic
    if suggested_noc and confidence >= 0.75:
        return {
            "noc_code": suggested_noc,
            "confidence": confidence,
            "source": "ai",
        }

    return {
        "noc_code": entered_noc,
        "confidence": confidence,
        "source": "user",
    }


def match_pnp_programs(profile) -> List[Dict[str, Any]]:
    province_matches: List[Dict[str, Any]] = []

    occupation = _normalize_text(_safe_get(profile, "occupation", ""))
    experience = int(_safe_get(profile, "experience_years", 0) or 0)
    crs = int(_safe_get(profile, "crs_score", 0) or 0)
    preferred_province = _normalize_text(_safe_get(profile, "preferred_province", ""))

    # 🔥 USE RESOLVED NOC
    noc_data = _resolve_noc(profile)
    noc_code = noc_data["noc_code"]
    noc_confidence = noc_data["confidence"]

    teer = _extract_teer(noc_code)

    tech_keywords = ["software", "developer", "engineer", "data", "it", "programmer", "web", "analyst"]

    is_tech = _is_tech_noc(noc_code) or any(k in occupation for k in tech_keywords)
    is_health = _is_healthcare_noc(noc_code)
    is_trade = _is_trade_noc(noc_code)

    # 🔥 Confidence boost
    confidence_boost = 5 if noc_confidence >= 0.8 else 0

    # TECH
    if is_tech:
        score = _score_match(
            65,
            [
                10 if crs >= 450 else 0,
                5 if teer in [0, 1, 2] else 0,
                5 if preferred_province == "ontario" else 0,
                confidence_boost,
            ],
        )
        province_matches.append({
            "province": "Ontario",
            "program": "OINP Tech Draw",
            "chance": _chance_label(score),
            "score": score,
            "reason": "Tech occupation aligns with Ontario targeted draws.",
        })

    # ALBERTA
    if crs >= 300:
        score = _score_match(
            55,
            [
                10 if crs < 450 else 5,
                5 if teer in [0, 1, 2, 3] else 0,
                5 if preferred_province == "alberta" else 0,
                confidence_boost,
            ],
        )
        province_matches.append({
            "province": "Alberta",
            "program": "Alberta Express Entry Stream",
            "chance": _chance_label(score),
            "score": score,
            "reason": "Alberta favors moderate CRS profiles.",
        })

    # SINP
    if experience >= 3:
        score = _score_match(
            60,
            [
                10 if experience >= 5 else 0,
                5 if teer in [0, 1, 2, 3] else 0,
                5 if preferred_province == "saskatchewan" else 0,
                confidence_boost,
            ],
        )
        province_matches.append({
            "province": "Saskatchewan",
            "program": "SINP Skilled Worker",
            "chance": _chance_label(score),
            "score": score,
            "reason": "Experience-driven eligibility aligns with SINP.",
        })

    # BC TECH
    if is_tech:
        score = _score_match(
            70,
            [
                10 if crs >= 440 else 0,
                5 if teer in [0, 1, 2] else 0,
                5 if preferred_province in {"british columbia", "bc"} else 0,
                confidence_boost,
            ],
        )
        province_matches.append({
            "province": "British Columbia",
            "program": "BC PNP Tech",
            "chance": _chance_label(score),
            "score": score,
            "reason": "BC strongly targets tech occupations.",
        })

    # HEALTH
    if is_health:
        score = _score_match(
            78,
            [
                5 if teer in [0, 1, 2] else 0,
                5 if preferred_province == "ontario" else 0,
                confidence_boost,
            ],
        )
        province_matches.append({
            "province": "Ontario",
            "program": "Healthcare Targeted Draw",
            "chance": _chance_label(score),
            "score": score,
            "reason": "Healthcare occupations are actively targeted.",
        })

    # TRADES
    if is_trade:
        score = _score_match(
            76,
            [
                5 if experience >= 3 else 0,
                5 if preferred_province == "alberta" else 0,
                confidence_boost,
            ],
        )
        province_matches.append({
            "province": "Alberta",
            "program": "Alberta Opportunity Stream (Trades)",
            "chance": _chance_label(score),
            "score": score,
            "reason": "Trades occupations are in demand in Alberta.",
        })

    return sorted(province_matches, key=lambda x: x["score"], reverse=True)