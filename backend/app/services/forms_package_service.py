from __future__ import annotations

from typing import Any, Dict, List, Tuple

from app.services.forms_catalog_service import (
    get_application_type_label,
    get_forms_for_application_type,
)
from app.services.forms_mapping_service import (
    build_applicant_context,
    map_fields_for_application_type,
)


def _required_missing_fields_for_form(form_code: str) -> List[str]:
    rules: Dict[str, List[str]] = {
        "IMM1294": [
            "given_name",
            "family_name",
            "date_of_birth",
            "citizenship",
            "country_of_residence",
            "intended_school_name",
            "program_name",
        ],
        "IMM1295": [
            "given_name",
            "family_name",
            "date_of_birth",
            "citizenship",
            "country_of_residence",
            "job_title",
        ],
        "IMM5257": [
            "given_name",
            "family_name",
            "date_of_birth",
            "citizenship",
            "country_of_residence",
            "purpose_of_travel",
        ],
        "IMM5645": [
            "applicant_given_name",
            "applicant_family_name",
            "date_of_birth",
            "nationality",
        ],
        "IMM5406": [
            "applicant_given_name",
            "applicant_family_name",
            "date_of_birth",
            "nationality",
        ],
        "IMM5532": [
            "principal_applicant_given_name",
            "principal_applicant_family_name",
            "date_of_birth",
            "relationship_type",
        ],
        "EE_PROFILE": [
            "given_name",
            "family_name",
            "date_of_birth",
            "education_level",
            "language_score",
            "experience_years",
            "occupation",
        ],
        "PR_INTAKE": [
            "given_name",
            "family_name",
            "date_of_birth",
            "education_level",
            "language_score",
            "experience_years",
            "occupation",
        ],
    }
    return rules.get(form_code, [])


def _missing_fields(mapped_fields: Dict[str, Any], form_code: str) -> List[str]:
    missing: List[str] = []

    for field_name in _required_missing_fields_for_form(form_code):
        value = mapped_fields.get(field_name)

        if value is None:
            missing.append(field_name)
            continue

        if isinstance(value, str) and not value.strip():
            missing.append(field_name)

    return missing


def _completion_score(forms: List[Dict[str, Any]]) -> int:
    total_required = 0
    total_missing = 0

    for form in forms:
        if form.get("required") or form.get("is_conditionally_required"):
            required_fields = len(_required_missing_fields_for_form(form["code"]))
            total_required += required_fields
            total_missing += len(form.get("missing_fields", []))

    if total_required == 0:
        return 100

    filled = max(total_required - total_missing, 0)
    return round((filled / total_required) * 100)


def _should_include_conditional_form(
    conditional_rule: str | None,
    applicant_context: Dict[str, Any],
) -> Tuple[bool, bool]:
    if not conditional_rule:
        return True, False

    if conditional_rule == "representative_used":
        representative_used = bool(applicant_context.get("representative_used"))
        return representative_used, representative_used

    return False, False


def build_forms_package(
    application_type: str,
    profile_data: Dict[str, Any],
    language: str = "en",
    applicant_context: Dict[str, Any] | None = None,
    application_data: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    lang = "fr" if language == "fr" else "en"
    applicant_context = applicant_context or {}

    normalized_applicant_context = build_applicant_context(
        profile_data=profile_data,
        application_data=application_data,
        language=lang,
    )

    normalized_applicant_context["representative_used"] = bool(
        applicant_context.get("representative_used")
        or normalized_applicant_context.get("representative_used")
    )

    mapped_packages = map_fields_for_application_type(
        application_type=application_type,
        applicant_context=normalized_applicant_context,
        language=lang,
    )

    catalog = get_forms_for_application_type(application_type, lang)
    selected_forms: List[Dict[str, Any]] = []

    for form in catalog:
        should_include, conditionally_required = _should_include_conditional_form(
            form.get("conditional_rule"),
            normalized_applicant_context,
        )

        if not should_include and form.get("conditional_rule"):
            continue

        mapped_fields = mapped_packages.get(form["code"], {})
        missing = _missing_fields(mapped_fields, form["code"])

        selected_forms.append(
            {
                "code": form["code"],
                "title": form["title"],
                "description": form["description"],
                "required": bool(form["required"]),
                "is_conditionally_required": conditionally_required,
                "conditional_rule": form.get("conditional_rule"),
                "mapped_fields": mapped_fields,
                "missing_fields": missing,
                "ready": len(missing) == 0,
            }
        )

    completeness_score = _completion_score(selected_forms)

    all_missing: List[Dict[str, Any]] = []
    for form in selected_forms:
        for field in form["missing_fields"]:
            all_missing.append(
                {
                    "form_code": form["code"],
                    "form_title": form["title"],
                    "field": field,
                }
            )

    if lang == "fr":
        summary = {
            "application_type": application_type,
            "application_label": get_application_type_label(application_type, lang),
            "forms_count": len(selected_forms),
            "completeness_score": completeness_score,
            "download_note": "Le téléchargement du dossier prérempli est réservé aux forfaits Pro et Premium.",
        }
    else:
        summary = {
            "application_type": application_type,
            "application_label": get_application_type_label(application_type, lang),
            "forms_count": len(selected_forms),
            "completeness_score": completeness_score,
            "download_note": "Download of the prefilled package is reserved for Pro and Premium plans.",
        }

    return {
        "summary": summary,
        "forms": selected_forms,
        "missing_fields": all_missing,
        "applicant_context_used": normalized_applicant_context,
    }