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


def _safe_get(profile, field_name, default=None):
    if isinstance(profile, dict):
        return profile.get(field_name, default)
    return getattr(profile, field_name, default)


def _normalize_language(language: str) -> str:
    language = (language or "en").lower()
    return "fr" if language == "fr" else "en"


def _get_language_score(profile) -> int:
    value = _safe_get(profile, "language_score", 0)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _get_experience_years(profile) -> int:
    value = _safe_get(profile, "experience_years", 0)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _get_bool(profile, field_name: str) -> bool:
    return bool(_safe_get(profile, field_name, False))


def _get_preferred_province(profile) -> str:
    return (_safe_get(profile, "preferred_province", "") or "").strip()


def deduplicate_programs(programs: List[str]) -> List[str]:
    seen = set()
    ordered = []

    for program in programs:
        normalized = (program or "").strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(program)

    return ordered


def prioritize_french_programs(
    programs: List[str],
    french_advantage: Dict,
    language: str = "en",
) -> List[str]:
    language = _normalize_language(language)
    strategic_value = (french_advantage or {}).get("strategic_value", "low")

    if strategic_value not in {"medium", "high"}:
        return deduplicate_programs(programs)

    prioritized = []
    remaining = []

    french_keywords = [
        "francophone",
        "bilingual",
        "bilingue",
        "category",
        "catégorie",
        "express entry",
        "entrée express",
    ]

    for program in programs:
        normalized = (program or "").strip().lower()
        if any(keyword in normalized for keyword in french_keywords):
            prioritized.append(program)
        else:
            remaining.append(program)

    ordered = prioritized + remaining

    if strategic_value == "high":
        if language == "fr" and not any(
            "francophone" in (p or "").lower() or "bilingue" in (p or "").lower()
            for p in ordered
        ):
            ordered.insert(0, "Voies francophones et bilingues")
        elif language != "fr" and not any(
            "francophone" in (p or "").lower() or "bilingual" in (p or "").lower()
            for p in ordered
        ):
            ordered.insert(0, "Francophone and bilingual pathways")

    return deduplicate_programs(ordered)


def prioritize_next_steps(
    next_steps: List[str],
    french_advantage: Dict,
    language: str = "en",
) -> List[str]:
    language = _normalize_language(language)
    strategic_value = (french_advantage or {}).get("strategic_value", "low")

    if strategic_value not in {"medium", "high"}:
        return deduplicate_programs(next_steps)

    if language == "fr":
        french_step = "Confirmer si le français peut renforcer les options de résidence permanente."
    else:
        french_step = "Confirm whether French ability can strengthen PR pathway options."

    ordered = [french_step] + list(next_steps)
    return deduplicate_programs(ordered)


def detect_french_advantage(profile, language: str = "en") -> Dict:
    language = _normalize_language(language)

    language_score = _get_language_score(profile)
    preferred_province = _get_preferred_province(profile)

    french_signals = []
    recommendations = []
    is_potentially_french_competitive = False
    strategic_value = "low"

    if language == "fr":
        french_signals.append("Le profil est actuellement évalué en français.")
        strategic_value = "medium"

    if language_score >= 7:
        if language == "fr":
            french_signals.append(
                "Le profil linguistique fort peut appuyer une stratégie bilingue ou francophone."
            )
            recommendations.append(
                "Si vous pouvez démontrer une bonne maîtrise du français, intégrez les voies francophones dans votre stratégie d’immigration."
            )
        else:
            french_signals.append(
                "Strong language profile may support bilingual or francophone pathway exploration."
            )
            recommendations.append(
                "If you have or can prove strong French ability, include francophone-focused pathways in your immigration plan."
            )
        strategic_value = "medium"

    if language_score >= 9:
        if language == "fr":
            french_signals.append(
                "Un très bon score linguistique peut améliorer la compétitivité pour les voies axées sur la langue."
            )
        else:
            french_signals.append(
                "Very strong language score may improve competitiveness for language-driven pathways."
            )
        is_potentially_french_competitive = True
        strategic_value = "high"

    if preferred_province and preferred_province.lower() != "quebec":
        if language == "fr":
            french_signals.append(
                f"La préférence pour une destination hors Québec peut renforcer la valeur d’une stratégie francophone, notamment pour {preferred_province}."
            )
            recommendations.append(
                f"Examinez les programmes provinciaux liés à {preferred_province} et comparez-les avec les autres options de résidence permanente."
            )
        else:
            french_signals.append(
                f"Preferred destination outside Quebec may strengthen the value of a francophone-focused strategy in provinces such as {preferred_province}."
            )
            recommendations.append(
                f"Review provincial pathways connected to {preferred_province} and compare them with broader permanent residence options."
            )
        if strategic_value == "low":
            strategic_value = "medium"

    if language == "fr":
        recommendations.insert(
            0,
            "Évaluez les possibilités d’immigration francophones et bilingues en parallèle des voies classiques de résidence permanente.",
        )
        if not preferred_province:
            recommendations.append(
                "Comparez Entrée express et les voies provinciales pour identifier le meilleur parcours vers la résidence permanente."
            )
    else:
        recommendations.insert(
            0,
            "Assess dedicated francophone and bilingual immigration opportunities alongside standard permanent residence pathways.",
        )
        if not preferred_province:
            recommendations.append(
                "Compare Express Entry with province-specific pathways to identify the strongest permanent residence route."
            )

    recommendations = deduplicate_programs(recommendations)

    return {
        "is_potentially_french_competitive": is_potentially_french_competitive,
        "strategic_value": strategic_value,
        "signals": french_signals,
        "recommendations": recommendations,
    }


def recommend_programs(profile, crs_score: int, language: str = "en") -> List[str]:
    language = _normalize_language(language)

    programs: List[str] = []
    language_score = _get_language_score(profile)
    experience_years = _get_experience_years(profile)
    has_job_offer = _get_bool(profile, "has_job_offer")
    has_canadian_experience = _get_bool(profile, "has_canadian_experience")
    studied_in_canada = _get_bool(profile, "studied_in_canada")
    preferred_province = _get_preferred_province(profile)

    french_advantage = detect_french_advantage(profile, language=language)

    if language == "fr":
        if french_advantage["strategic_value"] in {"medium", "high"}:
            programs.append("Voies francophones et bilingues")

        if crs_score >= 440:
            programs.append("Sélections par catégorie")

        if has_canadian_experience and crs_score >= 430:
            programs.append("Catégorie de l’expérience canadienne")

        if crs_score >= 470:
            programs.append("Entrée express")
        elif crs_score >= 430:
            programs.append("Entrée express (profil limite, amélioration recommandée)")

        if experience_years >= 1 and language_score >= 7:
            programs.append("Programme des travailleurs qualifiés (fédéral)")

        if crs_score >= 400:
            if preferred_province:
                programs.append(f"Programme des candidats de la province de {preferred_province}")
            else:
                programs.append("Volets des programmes des candidats des provinces (PCP)")

        if has_job_offer:
            programs.append("Parcours fondés sur une offre d’emploi valide")

        if studied_in_canada:
            programs.append("Parcours de transition après études vers la résidence permanente")

        if not programs:
            programs.append("Permis de travail ou permis d’études avant la résidence permanente")

        return prioritize_french_programs(
            deduplicate_programs(programs),
            french_advantage,
            language=language,
        )

    if french_advantage["strategic_value"] in {"medium", "high"}:
        programs.append("Francophone and bilingual pathways")

    if crs_score >= 440:
        programs.append("Category-based draws")

    if has_canadian_experience and crs_score >= 430:
        programs.append("Canadian Experience Class")

    if crs_score >= 470:
        programs.append("Express Entry")
    elif crs_score >= 430:
        programs.append("Express Entry (borderline, improve score if possible)")

    if experience_years >= 1 and language_score >= 7:
        programs.append("Federal Skilled Worker")

    if crs_score >= 400:
        if preferred_province:
            programs.append(f"{preferred_province} Provincial Nominee Program")
        else:
            programs.append("Provincial Nominee Program (PNP) pathways")

    if has_job_offer:
        programs.append("Valid job-offer-based pathways")

    if studied_in_canada:
        programs.append("Post-study transition pathways to permanent residence")

    if not programs:
        programs.append("Work permit or study pathway before permanent residence")

    return prioritize_french_programs(
        deduplicate_programs(programs),
        french_advantage,
        language=language,
    )


def generate_strategy_roadmap(profile, crs_score: int, language: str = "en") -> List[Dict]:
    language = _normalize_language(language)
    steps = []

    language_score = _get_language_score(profile)
    experience_years = _get_experience_years(profile)
    has_job_offer = _get_bool(profile, "has_job_offer")
    has_canadian_experience = _get_bool(profile, "has_canadian_experience")
    studied_in_canada = _get_bool(profile, "studied_in_canada")
    preferred_province = _get_preferred_province(profile)

    french_advantage = detect_french_advantage(profile, language=language)

    if language == "fr":
        if french_advantage["strategic_value"] in {"medium", "high"}:
            steps.append({
                "title": "Évaluer les possibilités francophones et bilingues",
                "estimated_crs_gain": 0,
                "priority": 1,
                "difficulty": "Faible",
                "reason": "Les voies francophones peuvent devenir une priorité stratégique pour un profil fort en français.",
            })

        if language_score < 9:
            steps.append({
                "title": "Améliorer le score linguistique jusqu’au NCLC/CLB 9 ou plus",
                "estimated_crs_gain": 28,
                "priority": 2,
                "difficulty": "Moyen",
                "reason": "L’amélioration linguistique est l’un des moyens les plus rapides d’augmenter la compétitivité du score CRS.",
            })

        if experience_years < 5:
            steps.append({
                "title": "Acquérir 1 année supplémentaire d’expérience de travail qualifié",
                "estimated_crs_gain": 10,
                "priority": 3,
                "difficulty": "Lié au temps",
                "reason": "Une expérience qualifiée supplémentaire renforce le score CRS et l’admissibilité aux programmes.",
            })

        if not has_job_offer:
            steps.append({
                "title": "Obtenir une offre d’emploi valide au Canada",
                "estimated_crs_gain": 50,
                "priority": 4,
                "difficulty": "Difficile",
                "reason": "Une offre d’emploi admissible peut ajouter des points CRS et améliorer les options d’immigration.",
            })

        if not has_canadian_experience:
            steps.append({
                "title": "Acquérir une expérience de travail canadienne",
                "estimated_crs_gain": 40,
                "priority": 5,
                "difficulty": "Moyen",
                "reason": "L’expérience canadienne améliore à la fois le score CRS et la flexibilité des parcours.",
            })

        if not studied_in_canada:
            steps.append({
                "title": "Envisager des parcours d’études au Canada",
                "estimated_crs_gain": 30,
                "priority": 6,
                "difficulty": "Long terme",
                "reason": "Les études au Canada peuvent renforcer le profil et ouvrir des options supplémentaires.",
            })

        if preferred_province:
            steps.append({
                "title": f"Cibler le programme des candidats de la province de {preferred_province}",
                "estimated_crs_gain": 600,
                "priority": 7,
                "difficulty": "Impact élevé",
                "reason": "Une nomination provinciale peut considérablement augmenter la compétitivité Entrée express.",
            })
        else:
            steps.append({
                "title": "Choisir une province et cibler les programmes provinciaux pertinents",
                "estimated_crs_gain": 600,
                "priority": 7,
                "difficulty": "Impact élevé",
                "reason": "Les voies de nomination provinciale peuvent constituer un raccourci important vers la résidence permanente.",
            })

        if crs_score >= 470:
            steps.append({
                "title": "Préparer les documents pour Entrée express et surveiller les rondes d’invitations",
                "estimated_crs_gain": 0,
                "priority": 8,
                "difficulty": "Faible",
                "reason": "Votre score peut déjà être suffisamment compétitif pour vous concentrer sur la préparation et le bon moment.",
            })

        return sorted(steps, key=lambda step: step["priority"])

    if french_advantage["strategic_value"] in {"medium", "high"}:
        steps.append({
            "title": "Review francophone and bilingual immigration opportunities first",
            "estimated_crs_gain": 0,
            "priority": 1,
            "difficulty": "Low",
            "reason": "French-capable profiles may unlock stronger category-based or province-targeted options.",
        })

    if language_score < 9:
        steps.append({
            "title": "Improve language score to CLB 9 or higher",
            "estimated_crs_gain": 28,
            "priority": 2,
            "difficulty": "Medium",
            "reason": "Language improvement is one of the fastest ways to increase CRS competitiveness.",
        })

    if experience_years < 5:
        steps.append({
            "title": "Gain 1 more year of skilled work experience",
            "estimated_crs_gain": 10,
            "priority": 3,
            "difficulty": "Time-based",
            "reason": "More skilled experience strengthens CRS and program competitiveness.",
        })

    if not has_job_offer:
        steps.append({
            "title": "Secure a valid Canadian job offer",
            "estimated_crs_gain": 50,
            "priority": 4,
            "difficulty": "Hard",
            "reason": "A qualifying job offer can add meaningful CRS points and improve pathway options.",
        })

    if not has_canadian_experience:
        steps.append({
            "title": "Gain Canadian work experience",
            "estimated_crs_gain": 40,
            "priority": 5,
            "difficulty": "Medium",
            "reason": "Canadian experience improves both CRS and pathway flexibility.",
        })

    if not studied_in_canada:
        steps.append({
            "title": "Consider study-based pathways in Canada",
            "estimated_crs_gain": 30,
            "priority": 6,
            "difficulty": "Long-term",
            "reason": "Canadian education can strengthen profile quality and open additional options.",
        })

    if preferred_province:
        steps.append({
            "title": f"Target {preferred_province} Provincial Nominee Program",
            "estimated_crs_gain": 600,
            "priority": 7,
            "difficulty": "High impact",
            "reason": "A provincial nomination can dramatically increase Express Entry competitiveness.",
        })
    else:
        steps.append({
            "title": "Choose a province and target relevant Provincial Nominee Programs",
            "estimated_crs_gain": 600,
            "priority": 7,
            "difficulty": "High impact",
            "reason": "Provincial nomination pathways can be a major shortcut to permanent residence.",
        })

    if crs_score >= 470:
        steps.append({
            "title": "Prepare Express Entry documents and monitor draws",
            "estimated_crs_gain": 0,
            "priority": 8,
            "difficulty": "Low",
            "reason": "Your score may already be competitive enough to focus on readiness and timing.",
        })

    return sorted(steps, key=lambda step: step["priority"])


def _translate_list_items(items: List[str], language: str) -> List[str]:
    language = _normalize_language(language)
    if language != "fr":
        return items

    translations = {
        "Canadian Experience Class": "Catégorie de l’expérience canadienne",
        "Express Entry": "Entrée express",
        "Express Entry (borderline, improve score if possible)": "Entrée express (profil limite, amélioration recommandée)",
        "Federal Skilled Worker": "Programme des travailleurs qualifiés (fédéral)",
        "Francophone and bilingual pathways": "Voies francophones et bilingues",
        "Provincial Nominee Program (PNP) pathways": "Volets des programmes des candidats des provinces (PCP)",
        "Valid job-offer-based pathways": "Parcours fondés sur une offre d’emploi valide",
        "Post-study transition pathways to permanent residence": "Parcours de transition après études vers la résidence permanente",
        "Category-based draws": "Sélections par catégorie",
        "Work permit or study pathway before permanent residence": "Permis de travail ou permis d’études avant la résidence permanente",
        "The profile may benefit from a priority francophone or bilingual strategy.": "Le profil peut bénéficier d’une stratégie francophone ou bilingue prioritaire.",
        "The profile may benefit from a francophone or bilingual strategy.": "Le profil peut bénéficier d’une stratégie francophone ou bilingue.",
        "Confirm whether French ability can strengthen PR pathway options.": "Confirmer si le français peut renforcer les options de résidence permanente.",
    }

    output = []
    for item in items:
        output.append(translations.get(item, item))
    return output


def build_strategy(profile, language: str = "en") -> Dict:
    language = _normalize_language(language)

    crs_score = calculate_crs(profile)

    recommendation_result = build_recommendation_result(profile, crs_score)
    programs = [p["name"] for p in recommendation_result.get("eligible_pathways", [])]

    french_advantage = detect_french_advantage(profile, language=language)

    if not programs:
        programs = recommend_programs(profile, crs_score, language=language)
    else:
        fallback_programs = recommend_programs(profile, crs_score, language=language)
        programs = prioritize_french_programs(
            deduplicate_programs(_translate_list_items(programs, language) + fallback_programs),
            french_advantage,
            language=language,
        )

    strengths = list(recommendation_result.get("strengths", []))
    weaknesses = list(recommendation_result.get("weaknesses", []))
    next_steps = list(recommendation_result.get("next_steps", []))
    advisor_summary = recommendation_result.get("advisor_summary")

    strengths = _translate_list_items(strengths, language)
    weaknesses = _translate_list_items(weaknesses, language)
    next_steps = _translate_list_items(next_steps, language)

    if french_advantage["strategic_value"] in {"medium", "high"}:
        if language == "fr":
            strengths.insert(
                0,
                "Le profil peut bénéficier d’une stratégie francophone ou bilingue prioritaire."
            )
        else:
            strengths.insert(
                0,
                "The profile may benefit from a priority francophone or bilingual strategy."
            )

    next_steps = prioritize_next_steps(next_steps, french_advantage, language=language)

    if not advisor_summary:
        advisor_summary = (
            "Cette stratégie est basée sur votre profil actuel, votre score CRS estimé et vos leviers d’amélioration."
            if language == "fr"
            else "This strategy is based on your current profile, estimated CRS score, and improvement levers."
        )

    if french_advantage["strategic_value"] == "high":
        if language == "fr":
            advisor_summary += " Les possibilités francophones devraient être traitées comme une priorité stratégique."
        else:
            advisor_summary += " Francophone opportunities should be treated as a strategic priority."

    scenarios = simulate_crs_improvements(profile)
    roadmap = generate_strategy_roadmap(profile, crs_score, language=language)
    province_recommendations = rank_provinces_for_profile(profile, crs_score)
    timeline_estimate = estimate_pr_timeline(profile, crs_score)
    probability_estimate = estimate_immigration_probabilities(profile, crs_score)
    draw_prediction = predict_express_entry_draw(profile, crs_score)

    strategy_context = {
        "crs_score": crs_score,
        "recommended_programs": programs,
        "strengths": deduplicate_programs(strengths),
        "weaknesses": deduplicate_programs(weaknesses),
        "next_steps": deduplicate_programs(next_steps),
        "advisor_summary": advisor_summary,
        "roadmap": roadmap,
        "french_advantage": french_advantage,
    }

    try:
        ai_result = generate_ai_strategy(
            profile,
            crs_score,
            programs,
            language=language,
            strategy_data=strategy_context,
        )
        ai_advice = ai_result.get("reply")
    except Exception as e:
        ai_advice = None
        print("OPENAI ERROR:", repr(e))

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
        "strengths": strategy_context["strengths"],
        "weaknesses": strategy_context["weaknesses"],
        "next_steps": strategy_context["next_steps"],
        "advisor_summary": advisor_summary,
        "french_advantage": french_advantage,
    }