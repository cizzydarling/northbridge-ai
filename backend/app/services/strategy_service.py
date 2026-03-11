from typing import Dict, List
from app.services.ai_advisor import generate_ai_strategy
from app.services.simulator_service import simulate_crs_improvements

def calculate_crs_from_profile(profile) -> int:
    score = 0

    # Age
    if 20 <= profile.age <= 29:
        score += 110
    elif 30 <= profile.age <= 35:
        score += 95
    elif 36 <= profile.age <= 40:
        score += 70
    else:
        score += 40

    # Education
    education_points = {
        "high school": 30,
        "diploma": 60,
        "bachelor": 90,
        "master": 120,
        "phd": 140
    }
    score += education_points.get(profile.education.strip().lower(), 0)

    # Language
    score += profile.language_score * 12

    # Foreign work experience
    if profile.experience_years >= 5:
        score += 80
    elif profile.experience_years >= 3:
        score += 60
    elif profile.experience_years >= 1:
        score += 40

    # Canadian job offer
    if profile.has_job_offer:
        score += 50

    # Canadian work experience
    if profile.has_canadian_experience:
        score += 40

    # Study in Canada
    if profile.studied_in_canada:
        score += 30

    return score


def recommend_programs(crs_score: int) -> List[str]:
    programs = []

    if crs_score >= 470:
        programs.append("Express Entry")
    elif crs_score >= 430:
        programs.append("Express Entry (borderline, improve score if possible)")

    if crs_score >= 400:
        programs.append("Ontario Immigrant Nominee Program (OINP)")
        programs.append("Provincial Nominee Program (PNP) pathways")

    if crs_score >= 440:
        programs.append("Category-based draws")

    if not programs:
        programs.append("Work permit or study pathway before permanent residence")

    return programs


def build_strategy(profile) -> Dict:
    crs_score = calculate_crs_from_profile(profile)
    programs = recommend_programs(crs_score)
    ai_advice = generate_ai_strategy(profile, crs_score, programs)
    scenarios = simulate_crs_improvements(profile, crs_score)

    return {
        "crs_score": crs_score,
        "recommended_programs": programs,
        "improvement_scenarios": scenarios,
        "ai_strategy": ai_advice
    }