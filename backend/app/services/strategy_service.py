from typing import Dict, List

from app.services.ai_advisor import generate_ai_strategy
from app.services.crs_calculator import calculate_crs, build_recommendation_result
from app.services.express_entry_draw_predictor_service import predict_express_entry_draw
from app.services.probability_engine_service import estimate_immigration_probabilities
from app.services.province_targeting_service import rank_provinces_for_profile
from app.services.simulator_service import simulate_crs_improvements
from app.services.timeline_estimator_service import estimate_pr_timeline


def calculate_crs_from_profile(profile) -> int:
    return calculate_crs(profile)


def recommend_programs(crs_score: int, language: str = "en") -> List[str]:
    programs = []

    if language == "fr":
        if crs_score >= 470:
            programs.append("Entrée express")
        elif crs_score >= 430:
            programs.append("Entrée express (profil limite, amélioration recommandée)")

        if crs_score >= 400:
            programs.append("Programme ontarien des candidats à l’immigration (POCI)")
            programs.append("Volets des programmes des candidats des provinces (PCP)")

        if crs_score >= 440:
            programs.append("Sélections par catégorie")

        if not programs:
            programs.append("Permis de travail ou permis d’études avant la résidence permanente")

        return programs

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


def generate_strategy_roadmap(profile, crs_score: int, language: str = "en") -> List[Dict]:
    steps = []

    if language == "fr":
        if profile.language_score < 9:
            steps.append({
                "title": "Améliorer le score linguistique jusqu’au NCLC/CLB 9 ou plus",
                "estimated_crs_gain": 28,
                "priority": 1,
                "difficulty": "Moyen",
                "reason": "L’amélioration linguistique est l’un des moyens les plus rapides d’augmenter la compétitivité du score CRS.",
            })

        if profile.experience_years < 5:
            steps.append({
                "title": "Acquérir 1 année supplémentaire d’expérience de travail qualifié",
                "estimated_crs_gain": 10,
                "priority": 2,
                "difficulty": "Lié au temps",
                "reason": "Une expérience qualifiée supplémentaire renforce le score CRS et l’admissibilité aux programmes.",
            })

        if not profile.has_job_offer:
            steps.append({
                "title": "Obtenir une offre d’emploi valide au Canada",
                "estimated_crs_gain": 50,
                "priority": 3,
                "difficulty": "Difficile",
                "reason": "Une offre d’emploi admissible peut ajouter des points CRS et améliorer les options d’immigration.",
            })

        if not profile.has_canadian_experience:
            steps.append({
                "title": "Acquérir une expérience de travail canadienne",
                "estimated_crs_gain": 40,
                "priority": 4,
                "difficulty": "Moyen",
                "reason": "L’expérience canadienne améliore à la fois le score CRS et la flexibilité des parcours.",
            })

        if not profile.studied_in_canada:
            steps.append({
                "title": "Envisager des parcours d’études au Canada",
                "estimated_crs_gain": 30,
                "priority": 5,
                "difficulty": "Long terme",
                "reason": "Les études au Canada peuvent renforcer le profil et ouvrir des options supplémentaires.",
            })

        if profile.preferred_province:
            steps.append({
                "title": f"Cibler le programme des candidats de la province de {profile.preferred_province}",
                "estimated_crs_gain": 600,
                "priority": 6,
                "difficulty": "Impact élevé",
                "reason": "Une nomination provinciale peut considérablement augmenter la compétitivité Entrée express.",
            })
        else:
            steps.append({
                "title": "Choisir une province et cibler les programmes provinciaux pertinents",
                "estimated_crs_gain": 600,
                "priority": 6,
                "difficulty": "Impact élevé",
                "reason": "Les voies de nomination provinciale peuvent constituer un raccourci important vers la résidence permanente.",
            })

        if crs_score >= 470:
            steps.append({
                "title": "Préparer les documents pour Entrée express et surveiller les rondes d’invitations",
                "estimated_crs_gain": 0,
                "priority": 7,
                "difficulty": "Faible",
                "reason": "Votre score peut déjà être suffisamment compétitif pour vous concentrer sur la préparation et le bon moment.",
            })

        return sorted(steps, key=lambda step: step["priority"])

    if profile.language_score < 9:
        steps.append({
            "title": "Improve language score to CLB 9 or higher",
            "estimated_crs_gain": 28,
            "priority": 1,
            "difficulty": "Medium",
            "reason": "Language improvement is one of the fastest ways to increase CRS competitiveness.",
        })

    if profile.experience_years < 5:
        steps.append({
            "title": "Gain 1 more year of skilled work experience",
            "estimated_crs_gain": 10,
            "priority": 2,
            "difficulty": "Time-based",
            "reason": "More skilled experience strengthens CRS and program competitiveness.",
        })

    if not profile.has_job_offer:
        steps.append({
            "title": "Secure a valid Canadian job offer",
            "estimated_crs_gain": 50,
            "priority": 3,
            "difficulty": "Hard",
            "reason": "A qualifying job offer can add meaningful CRS points and improve pathway options.",
        })

    if not profile.has_canadian_experience:
        steps.append({
            "title": "Gain Canadian work experience",
            "estimated_crs_gain": 40,
            "priority": 4,
            "difficulty": "Medium",
            "reason": "Canadian experience improves both CRS and pathway flexibility.",
        })

    if not profile.studied_in_canada:
        steps.append({
            "title": "Consider study-based pathways in Canada",
            "estimated_crs_gain": 30,
            "priority": 5,
            "difficulty": "Long-term",
            "reason": "Canadian education can strengthen profile quality and open additional options.",
        })

    if profile.preferred_province:
        steps.append({
            "title": f"Target {profile.preferred_province} Provincial Nominee Program",
            "estimated_crs_gain": 600,
            "priority": 6,
            "difficulty": "High impact",
            "reason": "A provincial nomination can dramatically increase Express Entry competitiveness.",
        })
    else:
        steps.append({
            "title": "Choose a province and target relevant Provincial Nominee Programs",
            "estimated_crs_gain": 600,
            "priority": 6,
            "difficulty": "High impact",
            "reason": "Provincial nomination pathways can be a major shortcut to permanent residence.",
        })

    if crs_score >= 470:
        steps.append({
            "title": "Prepare Express Entry documents and monitor draws",
            "estimated_crs_gain": 0,
            "priority": 7,
            "difficulty": "Low",
            "reason": "Your score may already be competitive enough to focus on readiness and timing.",
        })

    return sorted(steps, key=lambda step: step["priority"])


def build_strategy(profile, language: str = "en") -> Dict:
    language = (language or "en").lower()
    if language not in {"en", "fr"}:
        language = "en"

    crs_score = calculate_crs(profile)

    recommendation_result = build_recommendation_result(profile, crs_score)
    programs = [p["name"] for p in recommendation_result.get("eligible_pathways", [])]

    if not programs:
        programs = recommend_programs(crs_score, language=language)

    try:
        ai_advice = generate_ai_strategy(
            profile,
            crs_score,
            programs,
            language=language,
        )
    except Exception as e:
        ai_advice = None
        print("OPENAI ERROR:", repr(e))

    scenarios = simulate_crs_improvements(profile)
    roadmap = generate_strategy_roadmap(profile, crs_score, language=language)
    province_recommendations = rank_provinces_for_profile(profile, crs_score)
    timeline_estimate = estimate_pr_timeline(profile, crs_score)
    probability_estimate = estimate_immigration_probabilities(profile, crs_score)
    draw_prediction = predict_express_entry_draw(profile, crs_score)

    return {
        "crs_score": crs_score,
        "recommended_programs": programs,
        "improvement_scenarios": scenarios,
        "ai_strategy": ai_advice,
        "roadmap": roadmap,
        "province_recommendations": province_recommendations,
        "timeline_estimate": timeline_estimate,
        "probability_estimate": probability_estimate,
        "draw_prediction": draw_prediction,
        "strengths": recommendation_result.get("strengths", []),
        "weaknesses": recommendation_result.get("weaknesses", []),
        "next_steps": recommendation_result.get("next_steps", []),
        "advisor_summary": recommendation_result.get("advisor_summary"),
    }