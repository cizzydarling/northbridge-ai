from typing import Any, Dict, List, Optional

from app.services import province_targeting_service
from app.services.ai_advisor import generate_ai_strategy
from app.services.crs_calculator import calculate_crs, build_recommendation_result
from app.services.express_entry_draw_predictor_service import predict_express_entry_draw
from app.services.immigration_intelligence_service import build_immigration_intelligence
from app.services.noc_service import lookup_noc_by_code, suggest_noc_matches
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

def build_household_strategy_context(
    household_members: Optional[List[Any]] = None,
    language: str = "en",
) -> Dict[str, Any]:
    members = household_members or []

    spouse = None
    children = []
    dependents = []

    for member in members:
        relationship = str(
            getattr(member, "relationship_to_primary", "") or ""
        ).lower()

        item = {
            "id": getattr(member, "id", None),
            "first_name": getattr(member, "first_name", None),
            "last_name": getattr(member, "last_name", None),
            "relationship_to_primary": relationship,
            "nationality": getattr(member, "nationality", None),
            "current_country": getattr(member, "current_country", None),
            "date_of_birth": str(getattr(member, "date_of_birth", "") or ""),
            "email": getattr(member, "email", None),
            "is_primary_applicant": bool(
                getattr(member, "is_primary_applicant", False)
            ),
        }

        if relationship == "spouse":
            spouse = item
            dependents.append(item)
        elif relationship == "child":
            children.append(item)
            dependents.append(item)
        elif relationship not in {"self", ""}:
            dependents.append(item)

    family_size = max(1, len(members))

    required_family_documents = []

    def build_doc(doc_id, person, label, priority="high"):
        return {
            "id": doc_id,
            "person": person,
            "label": label,
            "priority": priority,
        }

    if spouse:
        required_family_documents.extend([
            build_doc(
                "spouse_passport",
                "spouse",
                _t(
                    "Spouse passport / identity document",
                    "Passeport / pièce d’identité de l’époux(se)",
                    language,
                ),
            ),
            build_doc(
                "spouse_police_certificate",
                "spouse",
                _t(
                    "Spouse police certificate",
                    "Certificat de police de l’époux(se)",
                    language,
                ),
            ),
            build_doc(
                "relationship_proof",
                "spouse",
                _t(
                    "Marriage or relationship evidence",
                    "Preuve de mariage ou de relation",
                    language,
                ),
            ),
        ])

    if children:
        required_family_documents.extend([
            build_doc(
                "child_passport",
                "child",
                _t(
                    "Child passport / identity document",
                    "Passeport / pièce d’identité de l’enfant",
                    language,
                ),
            ),
            build_doc(
                "child_birth_certificate",
                "child",
                _t(
                    "Birth certificate for dependent child",
                    "Acte de naissance de l’enfant à charge",
                    language,
                ),
            ),
        ])

        def mark_document_status(doc):
            # simple logic for now
            return {
                **doc,
                "status": "missing",  # default
            }

        required_family_documents = [
            mark_document_status(doc)
            for doc in required_family_documents
        ]

    return {
        "family_size": family_size,
        "has_spouse": bool(spouse),
        "spouse": spouse,
        "children": children,
        "dependents": dependents,
        "dependent_count": len(dependents),
        "required_family_documents": required_family_documents,
        "household_members": members,
    }
    


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


def _get_job_description(profile) -> str:
    return (
        _safe_get(profile, "job_description", "")
        or _safe_get(profile, "occupation_description", "")
        or _safe_get(profile, "work_description", "")
        or ""
    ).strip()


def _get_job_duties(profile) -> List[str]:
    raw = (
        _safe_get(profile, "duties", None)
        or _safe_get(profile, "job_duties", None)
        or _safe_get(profile, "main_duties", None)
        or []
    )

    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item or "").strip()]

    if isinstance(raw, str):
        parts = [part.strip() for part in raw.split("\n") if part.strip()]
        if parts:
            return parts
        parts = [part.strip() for part in raw.split(",") if part.strip()]
        return parts

    return []


def _extract_teer_from_noc(noc_code: str) -> int:
    cleaned = "".join(ch for ch in (noc_code or "") if ch.isdigit())
    if len(cleaned) < 2:
        return -1
    try:
        return int(cleaned[1])
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


def _resolve_noc_profile(profile) -> Dict[str, Any]:
    occupation = _get_occupation(profile)
    entered_noc_code = _get_noc_code(profile)
    job_description = _get_job_description(profile)
    duties = _get_job_duties(profile)

    entered_record = lookup_noc_by_code(entered_noc_code) if entered_noc_code else None
    suggested = None

    if occupation:
        try:
            suggested = suggest_noc_matches(
                occupation=occupation,
                job_description=job_description,
                duties=duties,
                top_k=3,
            )
        except Exception:
            suggested = None

    suggested_noc = (suggested or {}).get("suggested_noc", "") or ""
    suggested_title = (suggested or {}).get("suggested_title", "") or ""
    suggested_teer = _safe_int((suggested or {}).get("teer", -1), -1)
    suggested_confidence = _safe_float((suggested or {}).get("confidence", 0.0), 0.0)
    suggested_flags = (suggested or {}).get("immigration_flags", {}) or {}

    entered_teer = -1
    if entered_record:
        entered_teer = _safe_int(entered_record.get("teer", -1), -1)
    elif entered_noc_code:
        entered_teer = _extract_teer_from_noc(entered_noc_code)

    use_suggested = False
    if suggested_noc:
        if not entered_noc_code:
            use_suggested = True
        elif suggested_confidence >= 0.84 and suggested_noc != entered_noc_code:
            use_suggested = True

    resolved_noc_code = suggested_noc if use_suggested else entered_noc_code
    resolved_teer = suggested_teer if use_suggested else entered_teer
    resolved_title = (
        suggested_title
        if use_suggested
        else (entered_record.get("title", "") if entered_record else "")
    )
    resolved_is_high_demand = _is_high_demand_noc(resolved_noc_code)

    return {
        "entered_noc_code": entered_noc_code,
        "entered_noc_record": entered_record,
        "suggested_match": suggested,
        "suggested_noc_code": suggested_noc,
        "suggested_title": suggested_title,
        "suggested_teer": suggested_teer,
        "suggested_confidence": suggested_confidence,
        "resolved_noc_code": resolved_noc_code,
        "resolved_teer": resolved_teer,
        "resolved_title": resolved_title,
        "resolved_is_high_demand": resolved_is_high_demand,
        "used_suggested_noc": use_suggested,
        "express_entry_skilled_work": bool(
            suggested_flags.get("express_entry_skilled_work", False)
        ),
        "category_tags": list(suggested_flags.get("category_tags", []) or []),
    }


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

    noc_profile = _resolve_noc_profile(profile)
    noc_code = noc_profile.get("resolved_noc_code", "") or ""
    teer = _safe_int(noc_profile.get("resolved_teer", -1), -1)
    used_suggested_noc = bool(noc_profile.get("used_suggested_noc", False))
    suggested_confidence = _safe_float(
        noc_profile.get("suggested_confidence", 0.0), 0.0
    )

    signals = []
    recommendations = []
    strategic_value = "low"
    has_noc = bool(noc_code)
    category_tags = list(noc_profile.get("category_tags", []) or [])

    if not has_noc:
        return {
            "has_noc": False,
            "noc_code": "",
            "entered_noc_code": noc_profile.get("entered_noc_code", ""),
            "resolved_title": "",
            "teer": -1,
            "is_high_demand": False,
            "strategic_value": "low",
            "signals": [],
            "recommendations": [],
            "used_suggested_noc": False,
            "suggested_confidence": 0.0,
            "category_tags": [],
            "express_entry_skilled_work": False,
            "suggested_match": noc_profile.get("suggested_match"),
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

    if used_suggested_noc and suggested_confidence >= 0.7:
        if language == "fr":
            signals.append(
                "Le moteur a détecté automatiquement un code CNP probable à partir du titre du poste et des responsabilités."
            )
            recommendations.append(
                "Vérifiez le CNP détecté automatiquement pour confirmer qu’il correspond bien à votre rôle réel."
            )
        else:
            signals.append(
                "The engine auto-detected a likely NOC based on occupation title and responsibilities."
            )
            recommendations.append(
                "Confirm the auto-detected NOC aligns with your real role before relying on it fully."
            )
        if strategic_value == "low":
            strategic_value = "medium"

    if category_tags:
        if language == "fr":
            recommendations.append(
                "Comparer les voies ciblées associées à cette profession avec les programmes provinciaux pertinents."
            )
        else:
            recommendations.append(
                "Compare occupation-linked targeted pathways against relevant provincial programs."
            )

    return {
        "has_noc": True,
        "noc_code": noc_code,
        "entered_noc_code": noc_profile.get("entered_noc_code", ""),
        "resolved_title": noc_profile.get("resolved_title", ""),
        "teer": teer,
        "is_high_demand": is_high_demand,
        "strategic_value": strategic_value,
        "signals": deduplicate_programs(signals),
        "recommendations": deduplicate_programs(recommendations),
        "used_suggested_noc": used_suggested_noc,
        "suggested_confidence": suggested_confidence,
        "category_tags": category_tags,
        "express_entry_skilled_work": bool(
            noc_profile.get("express_entry_skilled_work", False)
        ),
        "suggested_match": noc_profile.get("suggested_match"),
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
        translated.append(
            {
                **item,
                "program": program_map.get(item.get("program"), item.get("program")),
                "chance": chance_map.get(item.get("chance"), item.get("chance")),
                "reason": reason_map.get(item.get("reason"), item.get("reason")),
            }
        )

    return translated


def rank_provinces_for_profile(profile, crs_score: int = 0, language: str = "en") -> List[Dict]:
    language = _normalize_language(language)
    noc_profile = _resolve_noc_profile(profile)

    normalized_profile = {
        "occupation": _safe_get(profile, "occupation", ""),
        "job_description": _get_job_description(profile),
        "job_duties": "\n".join(_get_job_duties(profile)),
        "experience_years": _get_experience_years(profile),
        "noc_code": noc_profile.get("resolved_noc_code", "") or _get_noc_code(profile),
        "preferred_province": _get_preferred_province(profile),
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

        if noc_advantage.get("express_entry_skilled_work") and crs_score >= 430:
            programs.append("Entrée express")

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

        if crs_score >= 400 or noc_advantage["strategic_value"] == "high":
            if preferred_province:
                programs.append(
                    f"Programme des candidats de la province de {preferred_province}"
                )
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

    if noc_advantage.get("express_entry_skilled_work") and crs_score >= 430:
        programs.append("Express Entry")

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

    if crs_score >= 400 or noc_advantage["strategic_value"] == "high":
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
            steps.append(
                {
                    "title": "Exploiter les voies d’immigration liées à la profession",
                    "estimated_crs_gain": 0,
                    "priority": 1,
                    "difficulty": "Faible",
                    "reason": "Votre profession pourrait correspondre à des sélections ciblées ou à des catégories prioritaires.",
                }
            )

        if french_advantage["strategic_value"] in {"medium", "high"}:
            steps.append(
                {
                    "title": "Évaluer les possibilités francophones et bilingues",
                    "estimated_crs_gain": 0,
                    "priority": 2,
                    "difficulty": "Faible",
                    "reason": "Les voies francophones peuvent devenir une priorité stratégique pour un profil fort en français.",
                }
            )

        if language_score < 9:
            steps.append(
                {
                    "title": "Améliorer le score linguistique jusqu’au NCLC/CLB 9 ou plus",
                    "estimated_crs_gain": 28,
                    "priority": 3,
                    "difficulty": "Moyen",
                    "reason": "L’amélioration linguistique est l’un des moyens les plus rapides d’augmenter la compétitivité du score CRS.",
                }
            )

        if experience_years < 5:
            steps.append(
                {
                    "title": "Acquérir 1 année supplémentaire d’expérience de travail qualifié",
                    "estimated_crs_gain": 10,
                    "priority": 4,
                    "difficulty": "Lié au temps",
                    "reason": "Une expérience qualifiée supplémentaire renforce le score CRS et l’admissibilité aux programmes.",
                }
            )

        if not has_job_offer:
            steps.append(
                {
                    "title": "Obtenir une offre d’emploi valide au Canada",
                    "estimated_crs_gain": 50,
                    "priority": 5,
                    "difficulty": "Difficile",
                    "reason": "Une offre d’emploi admissible peut ajouter des points CRS et améliorer les options d’immigration.",
                }
            )

        if not has_canadian_experience:
            steps.append(
                {
                    "title": "Acquérir une expérience de travail canadienne",
                    "estimated_crs_gain": 40,
                    "priority": 6,
                    "difficulty": "Moyen",
                    "reason": "L’expérience canadienne améliore à la fois le score CRS et la flexibilité des parcours.",
                }
            )

        if not studied_in_canada:
            steps.append(
                {
                    "title": "Envisager des parcours d’études au Canada",
                    "estimated_crs_gain": 30,
                    "priority": 7,
                    "difficulty": "Long terme",
                    "reason": "Les études au Canada peuvent renforcer le profil et ouvrir des options supplémentaires.",
                }
            )

        if province_recommendations:
            top_province = province_recommendations[0]
            steps.append(
                {
                    "title": f"Cibler en priorité {top_province.get('province', 'une province pertinente')} et le programme {top_province.get('program', '')}".strip(),
                    "estimated_crs_gain": 600,
                    "priority": 8,
                    "difficulty": "Impact élevé",
                    "reason": top_province.get(
                        "reason",
                        "Une nomination provinciale peut considérablement augmenter la compétitivité Entrée express.",
                    ),
                }
            )
        elif preferred_province:
            steps.append(
                {
                    "title": f"Cibler le programme des candidats de la province de {preferred_province}",
                    "estimated_crs_gain": 600,
                    "priority": 8,
                    "difficulty": "Impact élevé",
                    "reason": "Une nomination provinciale peut considérablement augmenter la compétitivité Entrée express.",
                }
            )
        else:
            steps.append(
                {
                    "title": "Choisir une province et cibler les programmes provinciaux pertinents",
                    "estimated_crs_gain": 600,
                    "priority": 8,
                    "difficulty": "Impact élevé",
                    "reason": "Les voies de nomination provinciale peuvent constituer un raccourci important vers la résidence permanente.",
                }
            )

        if crs_score >= 470:
            steps.append(
                {
                    "title": "Préparer les documents pour Entrée express et surveiller les rondes d’invitations",
                    "estimated_crs_gain": 0,
                    "priority": 9,
                    "difficulty": "Faible",
                    "reason": "Votre score peut déjà être suffisamment compétitif pour vous concentrer sur la préparation et le bon moment.",
                }
            )

        return sorted(steps, key=lambda step: step["priority"])

    if noc_advantage["strategic_value"] == "high":
        steps.append(
            {
                "title": "Leverage occupation-based immigration pathways",
                "estimated_crs_gain": 0,
                "priority": 1,
                "difficulty": "Low",
                "reason": "Your occupation may align with targeted immigration draws.",
            }
        )

    if french_advantage["strategic_value"] in {"medium", "high"}:
        steps.append(
            {
                "title": "Review francophone and bilingual immigration opportunities first",
                "estimated_crs_gain": 0,
                "priority": 2,
                "difficulty": "Low",
                "reason": "French-capable profiles may unlock stronger category-based or province-targeted options.",
            }
        )

    if language_score < 9:
        steps.append(
            {
                "title": "Improve language score to CLB 9 or higher",
                "estimated_crs_gain": 28,
                "priority": 3,
                "difficulty": "Medium",
                "reason": "Language improvement is one of the fastest ways to increase CRS competitiveness.",
            }
        )

    if experience_years < 5:
        steps.append(
            {
                "title": "Gain 1 more year of skilled work experience",
                "estimated_crs_gain": 10,
                "priority": 4,
                "difficulty": "Time-based",
                "reason": "More skilled experience strengthens CRS and program competitiveness.",
            }
        )

    if not has_job_offer:
        steps.append(
            {
                "title": "Secure a valid Canadian job offer",
                "estimated_crs_gain": 50,
                "priority": 5,
                "difficulty": "Hard",
                "reason": "A qualifying job offer can add meaningful CRS points and improve pathway options.",
            }
        )

    if not has_canadian_experience:
        steps.append(
            {
                "title": "Gain Canadian work experience",
                "estimated_crs_gain": 40,
                "priority": 6,
                "difficulty": "Medium",
                "reason": "Canadian experience improves both CRS and pathway flexibility.",
            }
        )

    if not studied_in_canada:
        steps.append(
            {
                "title": "Consider study-based pathways in Canada",
                "estimated_crs_gain": 30,
                "priority": 7,
                "difficulty": "Long-term",
                "reason": "Canadian education can strengthen profile quality and open additional options.",
            }
        )

    if province_recommendations:
        top_province = province_recommendations[0]
        steps.append(
            {
                "title": f"Target {top_province.get('province', 'the best-fit province')} through {top_province.get('program', 'a provincial pathway')}",
                "estimated_crs_gain": 600,
                "priority": 8,
                "difficulty": "High impact",
                "reason": top_province.get(
                    "reason",
                    "A provincial nomination can dramatically increase Express Entry competitiveness.",
                ),
            }
        )
    elif preferred_province:
        steps.append(
            {
                "title": f"Target {preferred_province} Provincial Nominee Program",
                "estimated_crs_gain": 600,
                "priority": 8,
                "difficulty": "High impact",
                "reason": "A provincial nomination can dramatically increase Express Entry competitiveness.",
            }
        )
    else:
        steps.append(
            {
                "title": "Choose a province and target relevant Provincial Nominee Programs",
                "estimated_crs_gain": 600,
                "priority": 8,
                "difficulty": "High impact",
                "reason": "Provincial nomination pathways can be a major shortcut to permanent residence.",
            }
        )

    if crs_score >= 470:
        steps.append(
            {
                "title": "Prepare Express Entry documents and monitor draws",
                "estimated_crs_gain": 0,
                "priority": 9,
                "difficulty": "Low",
                "reason": "Your score may already be competitive enough to focus on readiness and timing.",
            }
        )

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
        "The declared occupation may unlock NOC-targeted pathways and category-based draws.": "La profession déclarée peut ouvrir des voies ciblées liées au CNP et aux sélections par catégorie.",
        "Validate the selected NOC code and compare occupation-targeted pathways by province.": "Valider le code CNP choisi et comparer les voies ciblées selon la profession et la province.",
        "Confirm whether French ability can strengthen PR pathway options.": "Confirmer si le français peut renforcer les options de résidence permanente.",
        "CRS is highly competitive for Express Entry.": "Le score CRS est très compétitif pour Entrée express.",
        "CRS is competitive for Express Entry.": "Le score CRS est compétitif pour Entrée express.",
        "CRS is borderline for Express Entry.": "Le score CRS est à la limite pour Entrée express.",
        "French ability increases competitiveness for this pathway.": "Le français améliore la compétitivité pour ce parcours.",
        "Occupation is in a high-demand or targeted category.": "La profession se trouve dans une catégorie ciblée ou en forte demande.",
        "A valid job offer strengthens this pathway.": "Une offre d’emploi valide renforce ce parcours.",
        "Canadian work experience strengthens this pathway.": "L’expérience de travail canadienne renforce ce parcours.",
        "Canadian education strengthens this pathway.": "Les études au Canada renforcent ce parcours.",
        "Province preference aligns with this pathway.": "La préférence provinciale concorde avec ce parcours.",
        "This pathway appears to align well with the current profile.": "Ce parcours semble bien correspondre au profil actuel.",
        "Skilled work experience and language profile support this pathway.": "L’expérience qualifiée et le profil linguistique soutiennent ce parcours.",
        "Occupation appears compatible with Express Entry skilled work requirements.": "La profession semble compatible avec les exigences de travail qualifié d’Entrée express.",
        "Occupation mapping supports targeted-pathway analysis.": "Le jumelage de la profession soutient l’analyse des voies ciblées.",
    }

    output = []
    for item in items:
        translated = item
        for en_text, fr_text in translations.items():
            if translated == en_text:
                translated = fr_text
                break
        output.append(translated)
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
            "label": _t(
                "Promising but needs optimization",
                "Prometteur mais à optimiser",
                language,
            ),
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


def score_pathways(profile, crs_score: int, programs: List[str], language: str = "en") -> List[Dict[str, Any]]:
    language = _normalize_language(language)

    language_score = _get_language_score(profile)
    experience_years = _get_experience_years(profile)
    has_job_offer = _get_bool(profile, "has_job_offer")
    has_canadian_experience = _get_bool(profile, "has_canadian_experience")
    studied_in_canada = _get_bool(profile, "studied_in_canada")
    preferred_province = _get_preferred_province(profile).lower()

    noc_advantage = detect_noc_advantage(profile, language=language)
    noc_code = noc_advantage.get("noc_code", "")
    is_high_demand_noc = bool(noc_advantage.get("is_high_demand", False))
    has_strong_noc_signal = bool(noc_advantage.get("used_suggested_noc") or noc_code)
    suggested_confidence = _safe_float(noc_advantage.get("suggested_confidence", 0.0), 0.0)
    express_entry_skilled_work = bool(noc_advantage.get("express_entry_skilled_work", False))

    scored: List[Dict[str, Any]] = []

    for program in programs:
        program_text = (program or "").strip()
        normalized = program_text.lower()
        score = 0
        reasons: List[str] = []

        if "express entry" in normalized or "entrée express" in normalized:
            if crs_score >= 500:
                score += 45
                reasons.append(
                    _t(
                        "CRS is highly competitive for Express Entry.",
                        "Le score CRS est très compétitif pour Entrée express.",
                        language,
                    )
                )
            elif crs_score >= 470:
                score += 35
                reasons.append(
                    _t(
                        "CRS is competitive for Express Entry.",
                        "Le score CRS est compétitif pour Entrée express.",
                        language,
                    )
                )
            elif crs_score >= 430:
                score += 18
                reasons.append(
                    _t(
                        "CRS is borderline for Express Entry.",
                        "Le score CRS est à la limite pour Entrée express.",
                        language,
                    )
                )
            else:
                score += 5

            if express_entry_skilled_work:
                score += 14
                reasons.append(
                    _t(
                        "Occupation appears compatible with Express Entry skilled work requirements.",
                        "La profession semble compatible avec les exigences de travail qualifié d’Entrée express.",
                        language,
                    )
                )

        if "federal skilled worker" in normalized or "travailleurs qualifiés" in normalized:
            if experience_years >= 1 and language_score >= 7:
                score += 20
                reasons.append(
                    _t(
                        "Skilled work experience and language profile support this pathway.",
                        "L’expérience qualifiée et le profil linguistique soutiennent ce parcours.",
                        language,
                    )
                )

        if "canadian experience class" in normalized or "expérience canadienne" in normalized:
            if has_canadian_experience:
                score += 32
                reasons.append(
                    _t(
                        "Canadian work experience strengthens this pathway.",
                        "L’expérience de travail canadienne renforce ce parcours.",
                        language,
                    )
                )
            else:
                score -= 10

        if "francophone" in normalized or "bilingual" in normalized or "bilingue" in normalized:
            if language_score >= 9:
                score += 34
                reasons.append(
                    _t(
                        "French ability increases competitiveness for this pathway.",
                        "Le français améliore la compétitivité pour ce parcours.",
                        language,
                    )
                )
            elif language_score >= 7:
                score += 22
                reasons.append(
                    _t(
                        "French ability increases competitiveness for this pathway.",
                        "Le français améliore la compétitivité pour ce parcours.",
                        language,
                    )
                )
            else:
                score += 8

        if "category" in normalized or "catégorie" in normalized:
            if crs_score >= 440:
                score += 16
            if is_high_demand_noc:
                score += 24
                reasons.append(
                    _t(
                        "Occupation is in a high-demand or targeted category.",
                        "La profession se trouve dans une catégorie ciblée ou en forte demande.",
                        language,
                    )
                )
            elif has_strong_noc_signal and suggested_confidence >= 0.7:
                score += 10
                reasons.append(
                    _t(
                        "Occupation mapping supports targeted-pathway analysis.",
                        "Le jumelage de la profession soutient l’analyse des voies ciblées.",
                        language,
                    )
                )

        if (
            "provincial nominee" in normalized
            or "province" in normalized
            or "pcp" in normalized
            or "pnp" in normalized
        ):
            if crs_score >= 400:
                score += 18
            else:
                score += 12

            if preferred_province and preferred_province in normalized:
                score += 18
                reasons.append(
                    _t(
                        "Province preference aligns with this pathway.",
                        "La préférence provinciale concorde avec ce parcours.",
                        language,
                    )
                )

            if has_job_offer:
                score += 12
            if is_high_demand_noc:
                score += 14
            elif has_strong_noc_signal and suggested_confidence >= 0.7:
                score += 8

        if "job-offer" in normalized or "offre d’emploi" in normalized:
            if has_job_offer:
                score += 28
                reasons.append(
                    _t(
                        "A valid job offer strengthens this pathway.",
                        "Une offre d’emploi valide renforce ce parcours.",
                        language,
                    )
                )
            else:
                score -= 12

        if "study" in normalized or "études" in normalized or "post-study" in normalized:
            if studied_in_canada:
                score += 26
                reasons.append(
                    _t(
                        "Canadian education strengthens this pathway.",
                        "Les études au Canada renforcent ce parcours.",
                        language,
                    )
                )
            else:
                score += 6

        if has_canadian_experience and "canadian" not in normalized:
            score += 4
        if studied_in_canada and "study" not in normalized and "études" not in normalized:
            score += 3

        if not reasons:
            reasons.append(
                _t(
                    "This pathway appears to align well with the current profile.",
                    "Ce parcours semble bien correspondre au profil actuel.",
                    language,
                )
            )

        scored.append(
            {
                "program": program_text,
                "score": max(score, 0),
                "reasons": deduplicate_programs(reasons),
            }
        )

    return sorted(scored, key=lambda x: x["score"], reverse=True)


def _build_best_pathway_from_scores(
    scored_programs: List[Dict[str, Any]],
    province_recommendations: List[Dict],
    language: str = "en",
) -> Dict[str, Any]:
    language = _normalize_language(language)

    if not scored_programs:
        return {
            "name": _t("Permanent residence planning", "Planification de résidence permanente", language),
            "reasons": [
                _t(
                    "More profile data is needed to rank pathways confidently.",
                    "Davantage de données de profil sont nécessaires pour classer les parcours avec confiance.",
                    language,
                )
            ],
            "confidence": _t("Low", "Faible", language),
            "score": 0,
        }

    top = scored_programs[0]
    score = _safe_int(top.get("score"), 0)

    if score >= 70:
        confidence = _t("High", "Élevée", language)
    elif score >= 40:
        confidence = _t("Medium", "Moyenne", language)
    else:
        confidence = _t("Low", "Faible", language)

    reasons = list(top.get("reasons", []))

    if province_recommendations:
        top_province = province_recommendations[0]
        province_name = top_province.get("province")
        program_name = top_province.get("program")
        if province_name or program_name:
            reasons.append(
                _t(
                    f"Province targeting may also support this strategy through {province_name or 'a recommended province'} and {program_name or 'a provincial stream'}.",
                    f"Le ciblage provincial peut aussi soutenir cette stratégie via {province_name or 'une province recommandée'} et {program_name or 'un volet provincial'}.",
                    language,
                )
            )

    return {
        "name": top.get("program") or _t("Permanent residence planning", "Planification de résidence permanente", language),
        "reasons": deduplicate_programs(reasons),
        "confidence": confidence,
        "score": score,
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

    if noc_advantage.get("used_suggested_noc") and noc_advantage.get("suggested_confidence", 0) < 0.84:
        risks.append(
            {
                "risk": _t("Auto-detected NOC still needs confirmation", "Le CNP détecté automatiquement doit encore être confirmé", language),
                "impact": _t(
                    "Strategy precision may change if the actual NOC differs from the detected one.",
                    "La précision de la stratégie peut changer si le CNP réel diffère du CNP détecté.",
                    language,
                ),
                "mitigation": _t(
                    "Review the suggested occupation title and duties against the real job role.",
                    "Vérifier le titre d’emploi suggéré et les tâches par rapport au rôle réel.",
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
    noc_profile = _resolve_noc_profile(profile)

    return {
        "age": _get_age(profile),
        "education": _get_education(profile),
        "language_score": _get_language_score(profile),
        "experience_years": _get_experience_years(profile),
        "has_job_offer": _get_bool(profile, "has_job_offer"),
        "has_canadian_experience": _get_bool(profile, "has_canadian_experience"),
        "studied_in_canada": _get_bool(profile, "studied_in_canada"),
        "occupation": _get_occupation(profile),
        "job_description": _get_job_description(profile),
        "duties": _get_job_duties(profile),
        "noc_code": _get_noc_code(profile),
        "resolved_noc_code": noc_profile.get("resolved_noc_code", ""),
        "resolved_noc_title": noc_profile.get("resolved_title", ""),
        "preferred_province": _get_preferred_province(profile),
    }


def _build_timeline_summary(timeline_estimate: Any, language: str) -> str:
    language = _normalize_language(language)

    if isinstance(timeline_estimate, dict):
        low = timeline_estimate.get("estimated_pr_timeline_min_months")
        high = timeline_estimate.get("estimated_pr_timeline_max_months")
        readiness = timeline_estimate.get("readiness")

        if low is not None and high is not None:
            if readiness:
                return _t(
                    f"Estimated timeline: approximately {low}-{high} months ({readiness}).",
                    f"Délai estimé : environ {low}-{high} mois ({readiness}).",
                    language,
                )
            return _t(
                f"Estimated timeline: approximately {low}-{high} months.",
                f"Délai estimé : environ {low}-{high} mois.",
                language,
            )

        if readiness:
            return str(readiness)

    if timeline_estimate and not isinstance(timeline_estimate, dict):
        return str(timeline_estimate)

    return _t(
        "Timeline depends on pathway, profile optimization, and draw selection timing.",
        "Le délai dépend du parcours, de l’optimisation du profil et du moment des sélections.",
        language,
    )


def build_strategy(
    profile,
    language: str = "en",
    household_members: Optional[List[Any]] = None,
    application_case: Optional[Any] = None,
    include_immigration_intelligence: bool = False,
) -> Dict:
    language = _normalize_language(language)

    household_context = build_household_strategy_context(
        household_members=household_members,
        language=language,
    )
    family_size = household_context["family_size"]
    has_spouse = household_context["has_spouse"]
    required_family_documents = household_context["required_family_documents"]

    crs_score = calculate_crs(profile)

    recommendation_result = build_recommendation_result(profile, crs_score)
    programs = [p["name"] for p in recommendation_result.get("eligible_pathways", [])]

    french_advantage = detect_french_advantage(profile, language=language)
    noc_advantage = detect_noc_advantage(profile, language=language)
    noc_profile = _resolve_noc_profile(profile)

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
                "Le profil peut bénéficier d’une stratégie francophone ou bilingue prioritaire.",
            )
        else:
            strengths.insert(
                0,
                "The profile may benefit from a priority francophone or bilingual strategy.",
            )

    if noc_advantage["strategic_value"] == "high":
        if language == "fr":
            strengths.insert(
                0,
                "La profession déclarée peut ouvrir des voies ciblées liées au CNP et aux sélections par catégorie.",
            )
            next_steps.insert(
                0,
                "Valider le code CNP choisi et comparer les voies ciblées selon la profession et la province.",
            )
        else:
            strengths.insert(
                0,
                "The declared occupation may unlock NOC-targeted pathways and category-based draws.",
            )
            next_steps.insert(
                0,
                "Validate the selected NOC code and compare occupation-targeted pathways by province.",
            )

    if noc_advantage.get("used_suggested_noc") and noc_advantage.get("resolved_title"):
        if language == "fr":
            strengths.insert(
                0,
                f"Le moteur a détecté automatiquement un CNP probable pour le rôle « {noc_advantage.get('resolved_title')} ».",
            )
        else:
            strengths.insert(
                0,
                f"The engine auto-detected a likely NOC for the role '{noc_advantage.get('resolved_title')}'.",
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

    if noc_advantage.get("used_suggested_noc") and noc_advantage.get("suggested_confidence", 0) >= 0.7:
        if language == "fr":
            advisor_summary += " Un code CNP probable a aussi été détecté automatiquement pour renforcer la précision de la stratégie."
        else:
            advisor_summary += " A likely NOC was also auto-detected to improve strategy precision."

    scenarios = simulate_crs_improvements(profile)
    roadmap = generate_strategy_roadmap(profile, crs_score, language=language)
    province_recommendations = rank_provinces_for_profile(profile, crs_score, language=language)
    timeline_estimate = estimate_pr_timeline(profile, crs_score)
    probability_estimate = estimate_immigration_probabilities(
        profile,
        crs_score,
        language=language,
    )
    draw_prediction = predict_express_entry_draw(profile, crs_score)
    immigration_intelligence = (
        build_immigration_intelligence(
            profile=profile,
            crs_score=crs_score,
            province_recommendations=province_recommendations,
            language=language,
            include_live=True,
        )
        if include_immigration_intelligence
        else None
    )

    if province_recommendations:
        top_province = province_recommendations[0]
        if language == "fr":
            next_steps.insert(
                0,
                f"Examiner en priorité {top_province.get('province', 'la province recommandée')} via {top_province.get('program', 'le programme recommandé')}.",
            )
        else:
            next_steps.insert(
                0,
                f"Review {top_province.get('province', 'the recommended province')} first through {top_province.get('program', 'the recommended provincial program')}.",
            )

    if noc_advantage.get("used_suggested_noc") and noc_advantage.get("resolved_title"):
        if language == "fr":
            next_steps.insert(
                0,
                f"Confirmer si le CNP détecté pour « {noc_advantage.get('resolved_title')} » correspond exactement à votre rôle réel.",
            )
        else:
            next_steps.insert(
                0,
                f"Confirm whether the detected NOC for '{noc_advantage.get('resolved_title')}' exactly matches your real role.",
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

    scored_programs = score_pathways(
        profile=profile,
        crs_score=crs_score,
        programs=programs,
        language=language,
    )

    best_pathway = _build_best_pathway_from_scores(
        scored_programs=scored_programs,
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
        "scored_programs": scored_programs,
        "top_recommendation": best_pathway,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "next_steps": next_steps,
        "advisor_summary": advisor_summary,
        "roadmap": roadmap,
        "french_advantage": french_advantage,
        "noc_advantage": noc_advantage,
        "noc_profile": noc_profile,
        "province_recommendations": province_recommendations,
        "improvement_scenarios": scenarios,
        "timeline_estimate": timeline_estimate,
        "timeline_summary": timeline_summary,
        "probability_estimate": probability_estimate,
        "draw_prediction": draw_prediction,
        "immigration_intelligence": immigration_intelligence,
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
                (
                    (ai_result.get("advisor_summary", "") or "").strip()
                    + "\n\n"
                    + (ai_result.get("ai_strategy", "") or "").strip()
                )
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
        "scored_programs": scored_programs,
        "improvement_scenarios": scenarios,
        "ai_strategy": ai_advice,
        "roadmap": roadmap,
        "province_recommendations": province_recommendations,
        "timeline_estimate": timeline_estimate,
        "timeline_summary": timeline_summary,
        "probability_estimate": probability_estimate,
        "draw_prediction": draw_prediction,
        "immigration_intelligence": immigration_intelligence,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "next_steps": next_steps,
        "advisor_summary": advisor_summary,
        "french_advantage": french_advantage,
        "noc_advantage": noc_advantage,
        "noc_profile": noc_profile,
        "risk_analysis": risk_analysis,
        "profile_snapshot": _build_profile_snapshot(profile),
        "completion_signals": {
            "has_language_score": _get_language_score(profile) > 0,
            "has_experience_years": _get_experience_years(profile) > 0,
            "has_occupation": bool(_get_occupation(profile)),
            "has_noc_code": bool(_get_noc_code(profile)),
            "has_detected_noc": bool(noc_profile.get("resolved_noc_code")),
            "has_preferred_province": bool(_get_preferred_province(profile)),
        },
        "household_context": {
            "family_size": family_size,
            "has_spouse": has_spouse,
            "dependent_count": household_context["dependent_count"],
            "children_count": len(household_context["children"]),
        },

        "family_document_requirements": required_family_documents,

        "case_context": {
            "case_id": getattr(application_case, "id", None),
            "application_type": getattr(application_case, "application_type", None),
            "case_title": getattr(application_case, "case_title", None),
            "pathway": getattr(application_case, "pathway", None),
            "target_province": getattr(application_case, "target_province", None),
            "family_size": getattr(application_case, "family_size", family_size),
        },
        }
