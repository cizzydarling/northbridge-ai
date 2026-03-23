from app.models.profile_model import Profile


def calculate_crs_breakdown(profile: Profile) -> dict:
    age_points = 0
    education_points = 0
    language_points = 0
    experience_points = 0
    job_offer_points = 0
    canadian_experience_points = 0
    canadian_study_points = 0

    if 20 <= profile.age <= 29:
        age_points = 110
    elif 30 <= profile.age <= 35:
        age_points = 95
    else:
        age_points = 70

    education = profile.education.lower()

    if education in ["bachelor", "bachelors", "undergraduate"]:
        education_points = 120
    elif education in ["master", "masters"]:
        education_points = 135
    elif education == "phd":
        education_points = 150
    else:
        education_points = 90

    language_points = min(profile.language_score * 8, 136)
    experience_points = min(profile.experience_years * 10, 50)

    if profile.has_job_offer:
        job_offer_points = 50

    if profile.has_canadian_experience:
        canadian_experience_points = 40

    if profile.studied_in_canada:
        canadian_study_points = 30

    total = (
        age_points
        + education_points
        + language_points
        + experience_points
        + job_offer_points
        + canadian_experience_points
        + canadian_study_points
    )

    return {
        "total_crs": total,
        "breakdown": {
            "age": age_points,
            "education": education_points,
            "language": language_points,
            "experience": experience_points,
            "job_offer": job_offer_points,
            "canadian_experience": canadian_experience_points,
            "canadian_study": canadian_study_points,
        },
    }


def calculate_crs(profile: Profile) -> int:
    return int(calculate_crs_breakdown(profile)["total_crs"])


def build_recommendation_result(profile: Profile, crs_score: int) -> dict:
    eligible_pathways = []
    borderline_pathways = []
    strengths = []
    weaknesses = []
    next_steps = []

    if crs_score >= 470:
        eligible_pathways.append({
            "name": "Express Entry",
            "reason": f"Your estimated CRS score of {crs_score} is competitive."
        })
        strengths.append("Competitive CRS score for Express Entry")
    elif crs_score >= 430:
        borderline_pathways.append({
            "name": "Express Entry",
            "reason": f"Your estimated CRS score of {crs_score} is promising but may need improvement."
        })
        strengths.append("CRS score is within reach of some federal opportunities")
        weaknesses.append("CRS score may still be below recent competitive draws")
    else:
        weaknesses.append("Current CRS score is likely too low for direct Express Entry selection")

    if profile.preferred_province:
        eligible_pathways.append({
            "name": f"{profile.preferred_province} Provincial Nominee Program",
            "reason": "You selected a preferred province, which strengthens PNP targeting."
        })
        strengths.append(f"Provincial focus improves options in {profile.preferred_province}")
    else:
        borderline_pathways.append({
            "name": "Provincial Nominee Program",
            "reason": "A stronger province-targeting strategy could improve eligibility."
        })
        weaknesses.append("No preferred province selected for targeted PNP strategy")

    if profile.language_score >= 9:
        strengths.append("Strong language score")
    else:
        weaknesses.append("Language score could be improved for a stronger CRS boost")
        next_steps.append("Retake language test and target CLB 9 or higher")

    if profile.experience_years >= 5:
        strengths.append("Solid work experience")
    else:
        weaknesses.append("More work experience would improve competitiveness")
        next_steps.append("Gain additional skilled work experience")

    if profile.has_job_offer:
        strengths.append("Valid job offer increases pathway flexibility")
    else:
        weaknesses.append("No job offer currently on file")
        next_steps.append("Explore Canadian employers and job offer pathways")

    if profile.has_canadian_experience:
        strengths.append("Canadian work experience is a major advantage")
    else:
        next_steps.append("Consider gaining Canadian work experience if possible")

    if profile.studied_in_canada:
        strengths.append("Canadian education improves profile strength")
    else:
        next_steps.append("Consider study-based pathways if aligned with your goals")

    strategy = {
        "improve_language": profile.language_score < 9,
        "gain_experience": profile.experience_years < 5,
        "seek_job_offer": not profile.has_job_offer,
        "target_pnp": crs_score < 470 or bool(profile.preferred_province),
    }

    if eligible_pathways:
        pathway_text = ", ".join([p["name"] for p in eligible_pathways])
    else:
        pathway_text = "no immediately strong pathways"

    advisor_summary = (
        f"Based on your profile, your estimated CRS score is {crs_score}. "
        f"Your strongest current options are {pathway_text}. "
    )

    if weaknesses:
        advisor_summary += "Key areas to improve include " + ", ".join(weaknesses[:2]) + ". "

    if next_steps:
        advisor_summary += "Recommended next steps: " + ", ".join(next_steps[:3]) + "."

    return {
        "crs_score": crs_score,
        "eligible_pathways": eligible_pathways,
        "borderline_pathways": borderline_pathways,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "next_steps": next_steps,
        "strategy": strategy,
        "advisor_summary": advisor_summary,
    }