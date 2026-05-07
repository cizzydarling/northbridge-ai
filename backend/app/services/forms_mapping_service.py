from __future__ import annotations

from typing import Any, Dict

from app.services.forms_catalog_service import normalize_application_type


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _bool_label(value: Any, language: str) -> str:
    truthy = bool(value)
    if language == "fr":
        return "Oui" if truthy else "Non"
    return "Yes" if truthy else "No"


def _get_first_non_empty(*values: Any) -> str:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and value.strip():
            return value.strip()
        if not isinstance(value, str) and value not in ("", None):
            return str(value)
    return ""


def _get_nested(data: Dict[str, Any], *keys: str) -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
        if current is None:
            return None
    return current


def normalize_profile_data(profile_data: Dict[str, Any], language: str = "en") -> Dict[str, Any]:
    lang = "fr" if language == "fr" else "en"

    return {
        "first_name": _safe_str(profile_data.get("first_name")),
        "last_name": _safe_str(profile_data.get("last_name")),
        "nationality": _safe_str(profile_data.get("nationality")),
        "current_country": _safe_str(profile_data.get("current_country")),
        "current_city": _safe_str(profile_data.get("current_city")),
        "phone_number": _safe_str(profile_data.get("phone_number")),
        "date_of_birth": _safe_str(profile_data.get("date_of_birth")),
        "marital_status": _safe_str(profile_data.get("marital_status")),
        "preferred_language": _safe_str(profile_data.get("preferred_language") or lang),
        "age": _safe_int(profile_data.get("age")),
        "education": _safe_str(profile_data.get("education")),
        "language_score": _safe_int(profile_data.get("language_score")),
        "experience_years": _safe_int(profile_data.get("experience_years")),
        "has_job_offer": _bool_label(profile_data.get("has_job_offer"), lang),
        "has_job_offer_raw": bool(profile_data.get("has_job_offer")),
        "has_canadian_experience": _bool_label(
            profile_data.get("has_canadian_experience"), lang
        ),
        "has_canadian_experience_raw": bool(profile_data.get("has_canadian_experience")),
        "studied_in_canada": _bool_label(profile_data.get("studied_in_canada"), lang),
        "studied_in_canada_raw": bool(profile_data.get("studied_in_canada")),
        "occupation": _safe_str(profile_data.get("occupation")),
        "noc_code": _safe_str(profile_data.get("noc_code")),
        "preferred_province": _safe_str(profile_data.get("preferred_province")),
    }


def normalize_application_data(application_data: Dict[str, Any] | None = None) -> Dict[str, Any]:
    data = application_data or {}

    # Flexible normalization so this works even while your intake schema evolves.
    return {
        # Common
        "application_type": _get_first_non_empty(
            data.get("application_type"),
            data.get("matter_type"),
            data.get("pathway"),
        ),
        "representative_used": bool(
            data.get("representative_used")
            or data.get("uses_representative")
            or data.get("has_representative")
        ),

        # Study permit
        "school_name": _get_first_non_empty(
            data.get("school_name"),
            data.get("institution_name"),
            data.get("dli_name"),
            _get_nested(data, "education_plan", "school_name"),
            _get_nested(data, "education_plan", "institution_name"),
        ),
        "dli_number": _get_first_non_empty(
            data.get("dli_number"),
            _get_nested(data, "education_plan", "dli_number"),
        ),
        "program_name": _get_first_non_empty(
            data.get("program_name"),
            data.get("program"),
            _get_nested(data, "education_plan", "program_name"),
        ),
        "level_of_study": _get_first_non_empty(
            data.get("level_of_study"),
            data.get("study_level"),
            _get_nested(data, "education_plan", "level_of_study"),
        ),
        "study_start_date": _get_first_non_empty(
            data.get("study_start_date"),
            data.get("program_start_date"),
            _get_nested(data, "education_plan", "start_date"),
        ),
        "study_end_date": _get_first_non_empty(
            data.get("study_end_date"),
            data.get("program_end_date"),
            _get_nested(data, "education_plan", "end_date"),
        ),
        "tuition_amount": _get_first_non_empty(
            data.get("tuition_amount"),
            data.get("tuition"),
            _get_nested(data, "financials", "tuition_amount"),
        ),

        # Work permit
        "employer_name": _get_first_non_empty(
            data.get("employer_name"),
            _get_nested(data, "employment", "employer_name"),
            _get_nested(data, "job_offer", "employer_name"),
        ),
        "job_title": _get_first_non_empty(
            data.get("job_title"),
            _get_nested(data, "employment", "job_title"),
            _get_nested(data, "job_offer", "job_title"),
        ),
        "job_location": _get_first_non_empty(
            data.get("job_location"),
            _get_nested(data, "employment", "job_location"),
            _get_nested(data, "job_offer", "location"),
        ),
        "work_start_date": _get_first_non_empty(
            data.get("work_start_date"),
            data.get("job_start_date"),
            _get_nested(data, "employment", "start_date"),
            _get_nested(data, "job_offer", "start_date"),
        ),
        "work_duration": _get_first_non_empty(
            data.get("work_duration"),
            _get_nested(data, "employment", "duration"),
            _get_nested(data, "job_offer", "duration"),
        ),
        "lmia_status": _get_first_non_empty(
            data.get("lmia_status"),
            data.get("lmia"),
            _get_nested(data, "job_offer", "lmia_status"),
        ),

        # Visitor visa
        "purpose_of_travel": _get_first_non_empty(
            data.get("purpose_of_travel"),
            data.get("travel_purpose"),
            _get_nested(data, "travel", "purpose"),
        ),
        "arrival_date": _get_first_non_empty(
            data.get("arrival_date"),
            data.get("intended_arrival_date"),
            _get_nested(data, "travel", "arrival_date"),
        ),
        "departure_date": _get_first_non_empty(
            data.get("departure_date"),
            data.get("intended_departure_date"),
            _get_nested(data, "travel", "departure_date"),
        ),
        "host_name": _get_first_non_empty(
            data.get("host_name"),
            _get_nested(data, "travel", "host_name"),
            _get_nested(data, "canada_contact", "name"),
        ),
        "host_address": _get_first_non_empty(
            data.get("host_address"),
            _get_nested(data, "travel", "host_address"),
            _get_nested(data, "canada_contact", "address"),
        ),

        # Sponsorship
        "sponsor_name": _get_first_non_empty(
            data.get("sponsor_name"),
            _get_nested(data, "sponsorship", "sponsor_name"),
        ),
        "relationship_type": _get_first_non_empty(
            data.get("relationship_type"),
            _get_nested(data, "sponsorship", "relationship_type"),
        ),
        "relationship_start_date": _get_first_non_empty(
            data.get("relationship_start_date"),
            _get_nested(data, "sponsorship", "relationship_start_date"),
        ),
        "marriage_date": _get_first_non_empty(
            data.get("marriage_date"),
            _get_nested(data, "sponsorship", "marriage_date"),
        ),
        "cohabitation_status": _get_first_non_empty(
            data.get("cohabitation_status"),
            _get_nested(data, "sponsorship", "cohabitation_status"),
        ),
        "sponsor_status_in_canada": _get_first_non_empty(
            data.get("sponsor_status_in_canada"),
            _get_nested(data, "sponsorship", "sponsor_status_in_canada"),
        ),

        # Financials / general
        "available_funds": _get_first_non_empty(
            data.get("available_funds"),
            data.get("funds_available"),
            _get_nested(data, "financials", "available_funds"),
        ),
    }


def build_applicant_context(
    profile_data: Dict[str, Any],
    application_data: Dict[str, Any] | None = None,
    language: str = "en",
) -> Dict[str, Any]:
    profile = normalize_profile_data(profile_data, language)
    application = normalize_application_data(application_data)

    context: Dict[str, Any] = {
        # Identity
        "first_name": profile["first_name"],
        "last_name": profile["last_name"],
        "full_name": " ".join(
            part for part in [profile["first_name"], profile["last_name"]] if part
        ).strip(),
        "date_of_birth": profile["date_of_birth"],
        "nationality": profile["nationality"],
        "current_country": profile["current_country"],
        "current_city": profile["current_city"],
        "phone_number": profile["phone_number"],
        "marital_status": profile["marital_status"],
        "preferred_language": profile["preferred_language"],

        # Immigration profile
        "age": profile["age"],
        "education": profile["education"],
        "language_score": profile["language_score"],
        "experience_years": profile["experience_years"],
        "occupation": profile["occupation"],
        "noc_code": profile["noc_code"],
        "preferred_province": profile["preferred_province"],
        "has_job_offer": profile["has_job_offer"],
        "has_job_offer_raw": profile["has_job_offer_raw"],
        "has_canadian_experience": profile["has_canadian_experience"],
        "has_canadian_experience_raw": profile["has_canadian_experience_raw"],
        "studied_in_canada": profile["studied_in_canada"],
        "studied_in_canada_raw": profile["studied_in_canada_raw"],

        # Common application flags
        "application_type": application["application_type"],
        "representative_used": application["representative_used"],

        # Study permit
        "school_name": application["school_name"],
        "dli_number": application["dli_number"],
        "program_name": application["program_name"],
        "level_of_study": application["level_of_study"],
        "study_start_date": application["study_start_date"],
        "study_end_date": application["study_end_date"],
        "tuition_amount": application["tuition_amount"],

        # Work permit
        "employer_name": application["employer_name"],
        "job_title": application["job_title"] or profile["occupation"],
        "job_location": application["job_location"],
        "work_start_date": application["work_start_date"],
        "work_duration": application["work_duration"],
        "lmia_status": application["lmia_status"],

        # Visitor visa
        "purpose_of_travel": application["purpose_of_travel"],
        "arrival_date": application["arrival_date"],
        "departure_date": application["departure_date"],
        "host_name": application["host_name"],
        "host_address": application["host_address"],

        # Sponsorship
        "sponsor_name": application["sponsor_name"],
        "relationship_type": application["relationship_type"],
        "relationship_start_date": application["relationship_start_date"],
        "marriage_date": application["marriage_date"],
        "cohabitation_status": application["cohabitation_status"],
        "sponsor_status_in_canada": application["sponsor_status_in_canada"],

        # Financials
        "available_funds": application["available_funds"],
    }

    return context


def map_fields_for_application_type(
    application_type: str,
    applicant_context: Dict[str, Any],
    language: str = "en",
) -> Dict[str, Dict[str, Any]]:
    lang = "fr" if language == "fr" else "en"

    common_family_info = {
        "applicant_given_name": applicant_context.get("first_name", ""),
        "applicant_family_name": applicant_context.get("last_name", ""),
        "date_of_birth": applicant_context.get("date_of_birth", ""),
        "nationality": applicant_context.get("nationality", ""),
        "current_country": applicant_context.get("current_country", ""),
        "marital_status": applicant_context.get("marital_status", ""),
    }

    representative_form = {
        "applicant_given_name": applicant_context.get("first_name", ""),
        "applicant_family_name": applicant_context.get("last_name", ""),
        "date_of_birth": applicant_context.get("date_of_birth", ""),
        "representative_used": _bool_label(
            applicant_context.get("representative_used"),
            lang,
        ),
    }

    application_type = normalize_application_type(application_type)

    if application_type == "study_permit":
        return {
            "IMM1294": {
                "given_name": applicant_context.get("first_name", ""),
                "family_name": applicant_context.get("last_name", ""),
                "date_of_birth": applicant_context.get("date_of_birth", ""),
                "citizenship": applicant_context.get("nationality", ""),
                "country_of_residence": applicant_context.get("current_country", ""),
                "marital_status": applicant_context.get("marital_status", ""),
                "preferred_language": applicant_context.get("preferred_language", ""),
                "current_occupation": applicant_context.get("occupation", ""),
                "education_level": applicant_context.get("education", ""),
                "intended_school_name": applicant_context.get("school_name", ""),
                "dli_number": applicant_context.get("dli_number", ""),
                "program_name": applicant_context.get("program_name", ""),
                "level_of_study": applicant_context.get("level_of_study", ""),
                "program_start_date": applicant_context.get("study_start_date", ""),
                "program_end_date": applicant_context.get("study_end_date", ""),
                "tuition_amount": applicant_context.get("tuition_amount", ""),
                "available_funds": applicant_context.get("available_funds", ""),
            },
            "IMM5645": common_family_info,
            "IMM5476": representative_form,
        }

    if application_type == "work_permit":
        return {
            "IMM1295": {
                "given_name": applicant_context.get("first_name", ""),
                "family_name": applicant_context.get("last_name", ""),
                "date_of_birth": applicant_context.get("date_of_birth", ""),
                "citizenship": applicant_context.get("nationality", ""),
                "country_of_residence": applicant_context.get("current_country", ""),
                "marital_status": applicant_context.get("marital_status", ""),
                "occupation": applicant_context.get("occupation", ""),
                "noc_code": applicant_context.get("noc_code", ""),
                "has_job_offer": applicant_context.get("has_job_offer", ""),
                "employer_name": applicant_context.get("employer_name", ""),
                "job_title": applicant_context.get("job_title", ""),
                "job_location": applicant_context.get("job_location", ""),
                "job_start_date": applicant_context.get("work_start_date", ""),
                "job_duration": applicant_context.get("work_duration", ""),
                "lmia_status": applicant_context.get("lmia_status", ""),
            },
            "IMM5645": common_family_info,
            "IMM5476": representative_form,
        }

    if application_type == "visitor_visa":
        return {
            "IMM5257": {
                "given_name": applicant_context.get("first_name", ""),
                "family_name": applicant_context.get("last_name", ""),
                "date_of_birth": applicant_context.get("date_of_birth", ""),
                "citizenship": applicant_context.get("nationality", ""),
                "country_of_residence": applicant_context.get("current_country", ""),
                "marital_status": applicant_context.get("marital_status", ""),
                "current_occupation": applicant_context.get("occupation", ""),
                "purpose_of_travel": applicant_context.get("purpose_of_travel", ""),
                "intended_arrival_date": applicant_context.get("arrival_date", ""),
                "intended_departure_date": applicant_context.get("departure_date", ""),
                "host_name": applicant_context.get("host_name", ""),
                "host_address": applicant_context.get("host_address", ""),
                "available_funds": applicant_context.get("available_funds", ""),
            },
            "IMM5645": common_family_info,
            "IMM5476": representative_form,
        }

    if application_type == "spousal_sponsorship":
        return {
            "IMM5532": {
                "principal_applicant_given_name": applicant_context.get("first_name", ""),
                "principal_applicant_family_name": applicant_context.get("last_name", ""),
                "date_of_birth": applicant_context.get("date_of_birth", ""),
                "marital_status": applicant_context.get("marital_status", ""),
                "citizenship": applicant_context.get("nationality", ""),
                "country_of_residence": applicant_context.get("current_country", ""),
                "sponsor_name": applicant_context.get("sponsor_name", ""),
                "relationship_type": applicant_context.get("relationship_type", ""),
                "relationship_start_date": applicant_context.get("relationship_start_date", ""),
                "marriage_date": applicant_context.get("marriage_date", ""),
                "cohabitation_status": applicant_context.get("cohabitation_status", ""),
                "sponsor_status_in_canada": applicant_context.get("sponsor_status_in_canada", ""),
            },
            "IMM5406": common_family_info,
            "IMM5476": representative_form,
        }

    if application_type == "express_entry":
        return {
            "EE_PROFILE": {
                "given_name": applicant_context.get("first_name", ""),
                "family_name": applicant_context.get("last_name", ""),
                "date_of_birth": applicant_context.get("date_of_birth", ""),
                "citizenship": applicant_context.get("nationality", ""),
                "marital_status": applicant_context.get("marital_status", ""),
                "education_level": applicant_context.get("education", ""),
                "language_score": applicant_context.get("language_score", ""),
                "experience_years": applicant_context.get("experience_years", ""),
                "occupation": applicant_context.get("occupation", ""),
                "noc_code": applicant_context.get("noc_code", ""),
                "preferred_province": applicant_context.get("preferred_province", ""),
                "has_job_offer": applicant_context.get("has_job_offer", ""),
                "has_canadian_experience": applicant_context.get("has_canadian_experience", ""),
                "studied_in_canada": applicant_context.get("studied_in_canada", ""),
            },
            "IMM5406": common_family_info,
            "IMM5476": representative_form,
        }

    if application_type == "pr_pathway":
        return {
            "PR_INTAKE": {
                "given_name": applicant_context.get("first_name", ""),
                "family_name": applicant_context.get("last_name", ""),
                "date_of_birth": applicant_context.get("date_of_birth", ""),
                "citizenship": applicant_context.get("nationality", ""),
                "current_country": applicant_context.get("current_country", ""),
                "marital_status": applicant_context.get("marital_status", ""),
                "education_level": applicant_context.get("education", ""),
                "language_score": applicant_context.get("language_score", ""),
                "experience_years": applicant_context.get("experience_years", ""),
                "occupation": applicant_context.get("occupation", ""),
                "noc_code": applicant_context.get("noc_code", ""),
                "preferred_province": applicant_context.get("preferred_province", ""),
                "available_funds": applicant_context.get("available_funds", ""),
            },
            "IMM5406": common_family_info,
            "IMM5476": representative_form,
        }

    return {}
