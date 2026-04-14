from typing import Any, Dict, List, Optional

from app.services import province_targeting_service
from app.services.ai_advisor import generate_ai_strategy
from app.services.crs_calculator import calculate_crs, build_recommendation_result
from app.services.express_entry_draw_predictor_service import predict_express_entry_draw
from app.services.probability_engine_service import estimate_immigration_probabilities
from app.services.simulator_service import simulate_crs_improvements
from app.services.timeline_estimator_service import estimate_pr_timeline


def calculate_crs_from_profile(profile) -> int:
    return calculate_crs(profile)


def _safe_get(profile, field_name, default=None):
    if isinstance(profile, dict):
        return profile.get(field_name, default)
    return getattr(profile, field_name, default)


def _normalize_language(language: Optional[str]) -> str:
    language = (language or "en").lower()
    return "fr" if language == "fr" else "en"


def _t(en: str, fr: str, language: str) -> str:
    return fr if _normalize_language(language) == "fr" else en


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return default


def _safe_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y", "on"}
    return bool(value)


def _get_language_score(profile) -> int:
    value = _safe_get(profile, "language_score", 0)
    return _safe_int(value, 0)


def _get_experience_years(profile) -> int:
    value = _safe_get(profile, "experience_years", 0)
    return _safe_int(value, 0)


def _get_age(profile) -> int:
    value = _safe_get(profile, "age", 0)
    return _safe_int(value, 0)


def _get_education(profile) -> str:
    return str(_safe_get(profile, "education", "") or "").strip().lower()


def _get_bool(profile, field_name: str) -> bool:
    return _safe_bool(_safe_get(profile, field_name, False))


def _get_preferred_province(profile) -> str:
    return (_safe_get(profile, "preferred_province", "") or "").strip()


def _get_noc_code(profile) -> str:
    return (_safe_get(profile, "noc_code", "") or "").strip()


def _get_occupation(profile) -> str:
    return (_safe_get(profile, "occupation", "") or "").strip()


def _extract_teer_from_noc(noc_code: str) -> int:
    cleaned = "".join(ch for ch in (noc_code or "") if ch.isdigit())
    if len(cleaned) < 1:
        return -1
    try:
        return int(cleaned[0])
    except (TypeError, ValueError):
        return -1


def _is_high_demand_noc(noc_code: str) -> bool:
    cleaned = "".join(ch for ch in (noc_code or "") if ch.isdigit())
    if not cleaned:
        return False

    high_demand_prefixes = {
        "21",
        "212",
        "213",
        "31",
        "32",
        "33",
        "72",
        "73",
        "82",
        "41",
    }

    return any(cleaned.startswith(prefix) for prefix in high_demand_prefixes)


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


def detect_noc_advantage(profile, language: str = "en") -> Dict:
    language = _normalize_language(language)

    noc_code = _get_noc_code(profile)
    teer = _extract_teer_from_noc(noc_code)

    signals = []
    recommendations = []
    strategic_value = "low"
    has_noc = bool(noc_code)

    if not has_noc:
        return {
            "has_noc": False,
            "noc_code": "",
            "teer": -1,
            "is_high_demand": False,
            "strategic_value": "low",
            "signals": [],
            "recommendations": [],
        }

    if teer in {0, 1, 2, 3}:
        if language == "fr":
            signals.append(
                "La profession semble relever d’un niveau TEER qualifié pouvant soutenir plusieurs voies économiques."
            )
        else:
            signals.append(
                "The occupation appears to fall under a skilled TEER level that can support multiple economic pathways."
            )
        strategic_value = "medium"

    if teer in {0, 1, 2}:
        if language == "fr":
            signals.append(
                "Le niveau TEER 0 à 2 peut améliorer la compétitivité pour Entrée express et certaines voies ciblées."
            )
        else:
            signals.append(
                "TEER 0 to 2 may improve competitiveness for Express Entry and certain targeted pathways."
            )
        strategic_value = "high"

    is_high_demand = _is_high_demand_noc(noc_code)
    if is_high_demand:
        if language == "fr":
            signals.append(
                "La profession pourrait correspondre à une catégorie prioritaire ou à des sélections ciblées."
            )
            recommendations.append(
                "Priorisez les sélections par catégorie et les provinces qui ciblent cette profession."
            )
        else:
            signals.append(
                "The occupation may align with category-based or targeted selection streams."
            )
            recommendations.append(
                "Prioritize category-based draws and provinces that target this occupation."
            )
        strategic_value = "high"

    return {
        "has_noc": True,
        "noc_code": noc_code,
        "teer": teer,
        "is_high_demand": is_high_demand,
        "strategic_value": strategic_value,
        "signals": deduplicate_programs(signals),
        "recommendations": deduplicate_programs(recommendations),
    }


def _translate_province_matches(matches: List[Dict], language: str = "en") -> List[Dict]:
    language = _normalize_language(language)
    if language != "fr":
        return matches

    translated = []

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

    for item in matches:
        translated.append({
            **item,
            "program": program_map.get(item.get("program"), item.get("program")),
            "chance": chance_map.get(item.get("chance"), item.get("chance")),
            "reason": reason_map.get(item.get("reason"), item.get("reason")),
        })

    return translated


def rank_provinces_for_profile(profile, crs_score: int = 0, language: str = "en") -> List[Dict]:
    language = _normalize_language(language)

    normalized_profile = {
        "occupation": _safe_get(profile, "occupation", ""),
        "experience_years": _get_experience_years(profile),
        "noc_code": _get_noc_code(profile),
        "crs_score": crs_score or calculate_crs(profile),
    }

    matches = province_targeting_service.match_pnp_programs(normalized_profile)

    preferred_province = _get_preferred_province(profile)
    if preferred_province:
        boosted = []
        others = []
        for item in matches:
            if (item.get("province") or "").strip().lower() == preferred_province.strip().lower():
                boosted.append(item)
            else:
                others.append(item)
        matches = boosted + others

    return _translate_province_matches(matches, language=language)


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
    noc_advantage = detect_noc_advantage(profile, language=language)

    if language == "fr":
        if french_advantage["strategic_value"] in {"medium", "high"}:
            programs.append("Voies francophones et bilingues")

        if noc_advantage["strategic_value"] == "high":
            programs.append("Sélections par catégorie liées à la profession")

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

    if noc_advantage["strategic_value"] == "high":
        programs.append("Occupation-based category draws")

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
    noc_advantage = detect_noc_advantage(profile, language=language)
    province_recommendations = rank_provinces_for_profile(profile, crs_score, language=language)

    if language == "fr":
        if noc_advantage["strategic_value"] == "high":
            steps.append({
                "title": "Exploiter les voies d’immigration liées à la profession",
                "estimated_crs_gain": 0,
                "priority": 1,
                "difficulty": "Faible",
                "reason": "Votre profession pourrait correspondre à des sélections ciblées ou à des catégories prioritaires.",
            })

        if french_advantage["strategic_value"] in {"medium", "high"}:
            steps.append({
                "title": "Évaluer les possibilités francophones et bilingues",
                "estimated_crs_gain": 0,
                "priority": 2,
                "difficulty": "Faible",
                "reason": "Les voies francophones peuvent devenir une priorité stratégique pour un profil fort en français.",
            })

        if language_score < 9:
            steps.append({
                "title": "Améliorer le score linguistique jusqu’au NCLC/CLB 9 ou plus",
                "estimated_crs_gain": 28,
                "priority": 3,
                "difficulty": "Moyen",
                "reason": "L’amélioration linguistique est l’un des moyens les plus rapides d’augmenter la compétitivité du score CRS.",
            })

        if experience_years < 5:
            steps.append({
                "title": "Acquérir 1 année supplémentaire d’expérience de travail qualifié",
                "estimated_crs_gain": 10,
                "priority": 4,
                "difficulty": "Lié au temps",
                "reason": "Une expérience qualifiée supplémentaire renforce le score CRS et l’admissibilité aux programmes.",
            })

        if not has_job_offer:
            steps.append({
                "title": "Obtenir une offre d’emploi valide au Canada",
                "estimated_crs_gain": 50,
                "priority": 5,
                "difficulty": "Difficile",
                "reason": "Une offre d’emploi admissible peut ajouter des points CRS et améliorer les options d’immigration.",
            })

        if not has_canadian_experience:
            steps.append({
                "title": "Acquérir une expérience de travail canadienne",
                "estimated_crs_gain": 40,
                "priority": 6,
                "difficulty": "Moyen",
                "reason": "L’expérience canadienne améliore à la fois le score CRS et la flexibilité des parcours.",
            })

        if not studied_in_canada:
            steps.append({
                "title": "Envisager des parcours d’études au Canada",
                "estimated_crs_gain": 30,
                "priority": 7,
                "difficulty": "Long terme",
                "reason": "Les études au Canada peuvent renforcer le profil et ouvrir des options supplémentaires.",
            })

        if province_recommendations:
            top_province = province_recommendations[0]
            steps.append({
                "title": f"Cibler en priorité {top_province.get('province', 'une province pertinente')} et le programme {top_province.get('program', '')}".strip(),
                "estimated_crs_gain": 600,
                "priority": 8,
                "difficulty": "Impact élevé",
                "reason": top_province.get(
                    "reason",
                    "Une nomination provinciale peut considérablement augmenter la compétitivité Entrée express.",
                ),
            })
        elif preferred_province:
            steps.append({
                "title": f"Cibler le programme des candidats de la province de {preferred_province}",
                "estimated_crs_gain": 600,
                "priority": 8,
                "difficulty": "Impact élevé",
                "reason": "Une nomination provinciale peut considérablement augmenter la compétitivité Entrée express.",
            })
        else:
            steps.append({
                "title": "Choisir une province et cibler les programmes provinciaux pertinents",
                "estimated_crs_gain": 600,
                "priority": 8,
                "difficulty": "Impact élevé",
                "reason": "Les voies de nomination provinciale peuvent constituer un raccourci important vers la résidence permanente.",
            })

        if crs_score >= 470:
            steps.append({
                "title": "Préparer les documents pour Entrée express et surveiller les rondes d’invitations",
                "estimated_crs_gain": 0,
                "priority": 9,
                "difficulty": "Faible",
                "reason": "Votre score peut déjà être suffisamment compétitif pour vous concentrer sur la préparation et le bon moment.",
            })

        return sorted(steps, key=lambda step: step["priority"])

    if noc_advantage["strategic_value"] == "high":
        steps.append({
            "title": "Leverage occupation-based immigration pathways",
            "estimated_crs_gain": 0,
            "priority": 1,
            "difficulty": "Low",
            "reason": "Your occupation may align with targeted immigration draws.",
        })

    if french_advantage["strategic_value"] in {"medium", "high"}:
        steps.append({
            "title": "Review francophone and bilingual immigration opportunities first",
            "estimated_crs_gain": 0,
            "priority": 2,
            "difficulty": "Low",
            "reason": "French-capable profiles may unlock stronger category-based or province-targeted options.",
        })

    if language_score < 9:
        steps.append({
            "title": "Improve language score to CLB 9 or higher",
            "estimated_crs_gain": 28,
            "priority": 3,
            "difficulty": "Medium",
            "reason": "Language improvement is one of the fastest ways to increase CRS competitiveness.",
        })

    if experience_years < 5:
        steps.append({
            "title": "Gain 1 more year of skilled work experience",
            "estimated_crs_gain": 10,
            "priority": 4,
            "difficulty": "Time-based",
            "reason": "More skilled experience strengthens CRS and program competitiveness.",
        })

    if not has_job_offer:
        steps.append({
            "title": "Secure a valid Canadian job offer",
            "estimated_crs_gain": 50,
            "priority": 5,
            "difficulty": "Hard",
            "reason": "A qualifying job offer can add meaningful CRS points and improve pathway options.",
        })

    if not has_canadian_experience:
        steps.append({
            "title": "Gain Canadian work experience",
            "estimated_crs_gain": 40,
            "priority": 6,
            "difficulty": "Medium",
            "reason": "Canadian experience improves both CRS and pathway flexibility.",
        })

    if not studied_in_canada:
        steps.append({
            "title": "Consider study-based pathways in Canada",
            "estimated_crs_gain": 30,
            "priority": 7,
            "difficulty": "Long-term",
            "reason": "Canadian education can strengthen profile quality and open additional options.",
        })

    if province_recommendations:
        top_province = province_recommendations[0]
        steps.append({
            "title": f"Target {top_province.get('province', 'the best-fit province')} through {top_province.get('program', 'a provincial pathway')}",
            "estimated_crs_gain": 600,
            "priority": 8,
            "difficulty": "High impact",
            "reason": top_province.get(
                "reason",
                "A provincial nomination can dramatically increase Express Entry competitiveness.",
            ),
        })
    elif preferred_province:
        steps.append({
            "title": f"Target {preferred_province} Provincial Nominee Program",
            "estimated_crs_gain": 600,
            "priority": 8,
            "difficulty": "High impact",
            "reason": "A provincial nomination can dramatically increase Express Entry competitiveness.",
        })
    else:
        steps.append({
            "title": "Choose a province and target relevant Provincial Nominee Programs",
            "estimated_crs_gain": 600,
            "priority": 8,
            "difficulty": "High impact",
            "reason": "Provincial nomination pathways can be a major shortcut to permanent residence.",
        })

    if crs_score >= 470:
        steps.append({
            "title": "Prepare Express Entry documents and monitor draws",
            "estimated_crs_gain": 0,
            "priority": 9,
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
        "Occupation-based category draws": "Sélections par catégorie liées à la profession",
        "Work permit or study pathway before permanent residence": "Permis de travail ou permis d’études avant la résidence permanente",
        "The profile may benefit from a priority francophone or bilingual strategy.": "Le profil peut bénéficier d’une stratégie francophone ou bilingue prioritaire.",
        "The profile may benefit from a francophone or bilingual strategy.": "Le profil peut bénéficier d’une stratégie francophone ou bilingue.",
        "The declared occupation may unlock NOC-targeted pathways and category-based draws.": "La profession déclarée peut ouvrir des voies ciblées liées au CNP et aux sélections par catégorie.",
        "Validate the selected NOC code and compare occupation-targeted pathways by province.": "Valider le code CNP choisi et comparer les voies ciblées selon la profession et la province.",
        "Confirm whether French ability can strengthen PR pathway options.": "Confirmer si le français peut renforcer les options de résidence permanente.",
    }

    output = []
    for item in items:
        output.append(translations.get(item, item))
    return output


def _build_crs_band(crs_score: int, language: str) -> Dict[str, str]:
    language = _normalize_language(language)

    if crs_score >= 500:
        return {
            "label": _t("Very strong", "Très fort", language),
            "description": _t(
                "Your profile appears highly competitive for federal selection rounds.",
                "Votre profil semble très compétitif pour les rondes de sélection fédérales.",
                language,
            ),
        }
    if crs_score >= 470:
        return {
            "label": _t("Strong", "Fort", language),
            "description": _t(
                "Your profile may already be competitive depending on draw trends and pathway fit.",
                "Votre profil peut déjà être compétitif selon les tendances des rondes et l’adéquation du parcours.",
                language,
            ),
        }
    if crs_score >= 430:
        return {
            "label": _t("Promising but needs optimization", "Prometteur mais à optimiser", language),
            "description": _t(
                "Your profile has real potential, but targeted improvements could materially increase your chances.",
                "Votre profil a un vrai potentiel, mais des améliorations ciblées pourraient augmenter sensiblement vos chances.",
                language,
            ),
        }
    if crs_score >= 400:
        return {
            "label": _t("Moderate", "Modéré", language),
            "description": _t(
                "Provincial and category-based options may be more realistic than relying only on general federal draws.",
                "Les voies provinciales et par catégorie peuvent être plus réalistes que de compter uniquement sur les rondes fédérales générales.",
                language,
            ),
        }

    return {
        "label": _t("Needs improvement", "À renforcer", language),
        "description": _t(
            "Your current profile likely needs stronger immigration levers before becoming competitive for permanent residence.",
            "Votre profil actuel a probablement besoin de leviers plus solides avant d’être compétitif pour la résidence permanente.",
            language,
        ),
    }


def _build_strategy_headline(
    *,
    crs_score: int,
    programs: List[str],
    french_advantage: Dict,
    noc_advantage: Dict,
    language: str,
) -> str:
    language = _normalize_language(language)
    top_program = programs[0] if programs else _t(
        "Permanent residence strategy",
        "Stratégie de résidence permanente",
        language,
    )

    if crs_score >= 470:
        return _t(
            f"Your profile is currently strongest for {top_program}, with a CRS score that may already be competitive.",
            f"Votre profil est actuellement le plus solide pour {top_program}, avec un score CRS qui peut déjà être compétitif.",
            language,
        )

    if french_advantage.get("strategic_value") == "high":
        return _t(
            f"Your strongest near-term edge may come from a francophone-focused strategy built around {top_program}.",
            f"Votre meilleur levier à court terme peut venir d’une stratégie francophone axée sur {top_program}.",
            language,
        )

    if noc_advantage.get("strategic_value") == "high":
        return _t(
            f"Your occupation appears to be one of your strongest strategic levers, especially for {top_program}.",
            f"Votre profession semble être l’un de vos meilleurs leviers stratégiques, surtout pour {top_program}.",
            language,
        )

    return _t(
        f"Your current best path appears to be {top_program}, but your profile would benefit from targeted optimization.",
        f"Votre meilleur parcours actuel semble être {top_program}, mais votre profil gagnerait à être optimisé de façon ciblée.",
        language,
    )


def _build_best_pathway(
    *,
    programs: List[str],
    crs_score: int,
    french_advantage: Dict,
    noc_advantage: Dict,
    province_recommendations: List[Dict],
    language: str,
) -> Dict[str, Any]:
    language = _normalize_language(language)

    pathway = programs[0] if programs else _t(
        "Permanent residence planning",
        "Planification de résidence permanente",
        language,
    )
    province = province_recommendations[0] if province_recommendations else {}

    reasons: List[str] = []

    if crs_score >= 470:
        reasons.append(
            _t(
                "Your CRS score may already support stronger federal competitiveness.",
                "Votre score CRS peut déjà soutenir une meilleure compétitivité fédérale.",
                language,
            )
        )
    elif crs_score >= 430:
        reasons.append(
            _t(
                "Your profile is within a realistic optimization range for stronger selection outcomes.",
                "Votre profil se situe dans une zone réaliste d’optimisation pour de meilleurs résultats de sélection.",
                language,
            )
        )
    else:
        reasons.append(
            _t(
                "Your strategy likely depends more on targeted improvements and pathway fit than raw CRS score alone.",
                "Votre stratégie dépend probablement davantage d’améliorations ciblées et de l’adéquation du parcours que du seul score CRS.",
                language,
            )
        )

    if french_advantage.get("strategic_value") in {"medium", "high"}:
        reasons.append(
            _t(
                "French ability may improve category-based or province-specific opportunities.",
                "Le français peut améliorer les occasions par catégorie ou propres à certaines provinces.",
                language,
            )
        )

    if noc_advantage.get("strategic_value") == "high":
        reasons.append(
            _t(
                "Your declared occupation and NOC may support targeted pathway analysis.",
                "Votre profession déclarée et votre CNP peuvent soutenir une analyse ciblée des parcours.",
                language,
            )
        )

    if province:
        province_name = province.get("province")
        program_name = province.get("program")
        if province_name or program_name:
            reasons.append(
                _t(
                    f"Province targeting may be especially relevant through {province_name or 'a recommended province'} and {program_name or 'its provincial pathway'}.",
                    f"Le ciblage provincial peut être particulièrement pertinent via {province_name or 'une province recommandée'} et {program_name or 'son parcours provincial'}.",
                    language,
                )
            )

    return {
        "name": pathway,
        "reasons": deduplicate_programs(reasons),
        "confidence": _t("High", "Élevée", language) if crs_score >= 470 else _t("Medium", "Moyenne", language),
    }


def _build_risk_analysis(
    *,
    profile,
    crs_score: int,
    french_advantage: Dict,
    noc_advantage: Dict,
    language: str,
) -> List[Dict[str, str]]:
    language = _normalize_language(language)

    risks: List[Dict[str, str]] = []

    if _get_language_score(profile) < 9:
        risks.append(
            {
                "risk": _t("Language score ceiling", "Plafond du score linguistique", language),
                "impact": _t(
                    "A sub-CLB 9 language profile can limit CRS upside and pathway competitiveness.",
                    "Un profil linguistique sous CLB/NCLC 9 peut limiter le potentiel CRS et la compétitivité des parcours.",
                    language,
                ),
                "mitigation": _t(
                    "Retake language testing with a CLB 9+ target.",
                    "Repasser le test linguistique avec un objectif CLB/NCLC 9+.",
                    language,
                ),
            }
        )

    if not _get_bool(profile, "has_job_offer"):
        risks.append(
            {
                "risk": _t("No qualifying job offer", "Absence d’offre d’emploi admissible", language),
                "impact": _t(
                    "You may be relying more heavily on CRS improvements or provincial selection.",
                    "Vous pourriez dépendre davantage des améliorations CRS ou de la sélection provinciale.",
                    language,
                ),
                "mitigation": _t(
                    "Prioritize employer outreach and province-aligned job targeting.",
                    "Prioriser la prospection employeur et le ciblage d’emplois alignés avec les provinces.",
                    language,
                ),
            }
        )

    if not _get_bool(profile, "has_canadian_experience"):
        risks.append(
            {
                "risk": _t("Limited Canadian profile depth", "Profondeur limitée du profil canadien", language),
                "impact": _t(
                    "Lack of Canadian work experience may reduce flexibility across pathways.",
                    "L’absence d’expérience de travail canadienne peut réduire la flexibilité entre les parcours.",
                    language,
                ),
                "mitigation": _t(
                    "Evaluate work, study, or transitional routes that can build Canadian experience.",
                    "Évaluer les voies de travail, d’études ou de transition pouvant créer de l’expérience canadienne.",
                    language,
                ),
            }
        )

    if french_advantage.get("strategic_value") == "low":
        risks.append(
            {
                "risk": _t("Untapped language leverage", "Levier linguistique insuffisamment exploité", language),
                "impact": _t(
                    "The profile may be missing additional category-based leverage through stronger bilingual positioning.",
                    "Le profil peut manquer un levier supplémentaire par catégorie via un positionnement bilingue plus fort.",
                    language,
                ),
                "mitigation": _t(
                    "Assess whether French improvement is realistic and worthwhile.",
                    "Évaluer si une amélioration du français est réaliste et pertinente.",
                    language,
                ),
            }
        )

    if noc_advantage.get("strategic_value") != "high":
        risks.append(
            {
                "risk": _t("Occupation targeting not fully validated", "Ciblage professionnel non entièrement validé", language),
                "impact": _t(
                    "A weak or missing NOC signal can reduce strategy precision.",
                    "Un signal CNP faible ou absent peut réduire la précision de la stratégie.",
                    language,
                ),
                "mitigation": _t(
                    "Validate occupation and NOC alignment before relying on category-based assumptions.",
                    "Valider l’alignement profession-CNP avant de s’appuyer sur des hypothèses de sélection par catégorie.",
                    language,
                ),
            }
        )

    if crs_score < 430:
        risks.append(
            {
                "risk": _t("Current CRS competitiveness", "Compétitivité CRS actuelle", language),
                "impact": _t(
                    "General federal draws may be less realistic without improvements or targeted pathways.",
                    "Les rondes fédérales générales peuvent être moins réalistes sans améliorations ou voies ciblées.",
                    language,
                ),
                "mitigation": _t(
                    "Focus on score-building actions and province/category fit rather than waiting passively.",
                    "Se concentrer sur les actions d’amélioration du score et l’adéquation province/catégorie plutôt que d’attendre passivement.",
                    language,
                ),
            }
        )

    return risks[:5]


def _build_profile_snapshot(profile) -> Dict[str, Any]:
    return {
        "age": _get_age(profile),
        "education": _get_education(profile),
        "language_score": _get_language_score(profile),
        "experience_years": _get_experience_years(profile),
        "has_job_offer": _get_bool(profile, "has_job_offer"),
        "has_canadian_experience": _get_bool(profile, "has_canadian_experience"),
        "studied_in_canada": _get_bool(profile, "studied_in_canada"),
        "occupation": _get_occupation(profile),
        "noc_code": _get_noc_code(profile),
        "preferred_province": _get_preferred_province(profile),
    }


def _build_timeline_summary(timeline_estimate: Any, language: str) -> str:
    language = _normalize_language(language)

    if isinstance(timeline_estimate, dict):
        low = timeline_estimate.get("min_months")
        high = timeline_estimate.get("max_months")
        summary = timeline_estimate.get("summary")

        if summary:
            return str(summary)

        if low and high:
            return _t(
                f"Estimated timeline: approximately {low}-{high} months.",
                f"Délai estimé : environ {low}-{high} mois.",
                language,
            )

    if timeline_estimate:
        return str(timeline_estimate)

    return _t(
        "Timeline depends on pathway, profile optimization, and draw selection timing.",
        "Le délai dépend du parcours, de l’optimisation du profil et du moment des sélections.",
        language,
    )


def build_strategy(profile, language: str = "en") -> Dict:
    language = _normalize_language(language)

    crs_score = calculate_crs(profile)

    recommendation_result = build_recommendation_result(profile, crs_score)
    programs = [p["name"] for p in recommendation_result.get("eligible_pathways", [])]

    french_advantage = detect_french_advantage(profile, language=language)
    noc_advantage = detect_noc_advantage(profile, language=language)

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

    if noc_advantage["strategic_value"] == "high":
        if language == "fr":
            strengths.insert(
                0,
                "La profession déclarée peut ouvrir des voies ciblées liées au CNP et aux sélections par catégorie."
            )
            next_steps.insert(
                0,
                "Valider le code CNP choisi et comparer les voies ciblées selon la profession et la province."
            )
        else:
            strengths.insert(
                0,
                "The declared occupation may unlock NOC-targeted pathways and category-based draws."
            )
            next_steps.insert(
                0,
                "Validate the selected NOC code and compare occupation-targeted pathways by province."
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

    if noc_advantage["strategic_value"] == "high":
        if language == "fr":
            advisor_summary += " Votre profession semble aussi mériter une analyse ciblée des voies par profession et des provinces qui recrutent ce type de profil."
        else:
            advisor_summary += " Your occupation also appears to merit targeted review of occupation-based pathways and provinces that favor this kind of profile."

    scenarios = simulate_crs_improvements(profile)
    roadmap = generate_strategy_roadmap(profile, crs_score, language=language)
    province_recommendations = rank_provinces_for_profile(profile, crs_score, language=language)
    timeline_estimate = estimate_pr_timeline(profile, crs_score)
    probability_estimate = estimate_immigration_probabilities(profile, crs_score)
    draw_prediction = predict_express_entry_draw(profile, crs_score)

    if province_recommendations:
        top_province = province_recommendations[0]
        if language == "fr":
            next_steps.insert(
                0,
                f"Examiner en priorité {top_province.get('province', 'la province recommandée')} via {top_province.get('program', 'le programme recommandé')}."
            )
        else:
            next_steps.insert(
                0,
                f"Review {top_province.get('province', 'the recommended province')} first through {top_province.get('program', 'the recommended provincial program')}."
            )

    strengths = deduplicate_programs(strengths)
    weaknesses = deduplicate_programs(weaknesses)
    next_steps = deduplicate_programs(next_steps)

    crs_band = _build_crs_band(crs_score, language)
    strategy_headline = _build_strategy_headline(
        crs_score=crs_score,
        programs=programs,
        french_advantage=french_advantage,
        noc_advantage=noc_advantage,
        language=language,
    )
    best_pathway = _build_best_pathway(
        programs=programs,
        crs_score=crs_score,
        french_advantage=french_advantage,
        noc_advantage=noc_advantage,
        province_recommendations=province_recommendations,
        language=language,
    )
    risk_analysis = _build_risk_analysis(
        profile=profile,
        crs_score=crs_score,
        french_advantage=french_advantage,
        noc_advantage=noc_advantage,
        language=language,
    )
    timeline_summary = _build_timeline_summary(timeline_estimate, language)

    strategy_context = {
        "crs_score": crs_score,
        "crs_band": crs_band,
        "strategy_headline": strategy_headline,
        "best_pathway": best_pathway,
        "recommended_programs": programs,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "next_steps": next_steps,
        "advisor_summary": advisor_summary,
        "roadmap": roadmap,
        "french_advantage": french_advantage,
        "noc_advantage": noc_advantage,
        "province_recommendations": province_recommendations,
        "improvement_scenarios": scenarios,
        "timeline_estimate": timeline_estimate,
        "timeline_summary": timeline_summary,
        "probability_estimate": probability_estimate,
        "draw_prediction": draw_prediction,
        "risk_analysis": risk_analysis,
        "profile_snapshot": _build_profile_snapshot(profile),
    }

    ai_advice = None
    try:
        try:
            ai_result = generate_ai_strategy(
                profile=profile,
                language=language,
                strategy_data=strategy_context,
                crs_score=crs_score,
                programs=programs,
            )
        except TypeError:
            ai_result = generate_ai_strategy(
                profile=profile,
                language=language,
            )

        if isinstance(ai_result, dict):
            ai_advice = (
                ((ai_result.get("advisor_summary", "") or "").strip()
                 + "\n\n"
                 + (ai_result.get("ai_strategy", "") or "").strip())
            ).strip()
            if not ai_advice:
                ai_advice = (ai_result.get("reply", "") or "").strip()
        else:
            ai_advice = str(ai_result).strip()

    except Exception as e:
        ai_advice = None
        print("OPENAI ERROR:", repr(e))

    return {
        "crs_score": crs_score,
        "crs_band": crs_band,
        "strategy_headline": strategy_headline,
        "best_pathway": best_pathway,
        "recommended_programs": programs,
        "improvement_scenarios": scenarios,
        "ai_strategy": ai_advice,
        "roadmap": roadmap,
        "province_recommendations": province_recommendations,
        "timeline_estimate": timeline_estimate,
        "timeline_summary": timeline_summary,
        "probability_estimate": probability_estimate,
        "draw_prediction": draw_prediction,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "next_steps": next_steps,
        "advisor_summary": advisor_summary,
        "french_advantage": french_advantage,
        "noc_advantage": noc_advantage,
        "risk_analysis": risk_analysis,
        "profile_snapshot": _build_profile_snapshot(profile),
        "completion_signals": {
            "has_language_score": _get_language_score(profile) > 0,
            "has_experience_years": _get_experience_years(profile) > 0,
            "has_occupation": bool(_get_occupation(profile)),
            "has_noc_code": bool(_get_noc_code(profile)),
            "has_preferred_province": bool(_get_preferred_province(profile)),
        },
    }