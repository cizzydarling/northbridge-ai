from typing import Any


def build_study_permit_forms_assistant(
    intake: dict[str, Any] | None = None,
) -> dict[str, Any]:
    intake = intake or {}

    missing_fields: list[str] = []
    recommended_forms: list[dict[str, Any]] = [
        {
            "form_key": "study_permit_main",
            "form_name": "Study permit application package",
            "status": "Primary",
            "notes": "Main study permit application workflow for the applicant.",
        },
        {
            "form_key": "family_information",
            "form_name": "Family information form",
            "status": "Supporting",
            "notes": "Usually needed where family and background details are required.",
        },
    ]

    draft_answers = {
        "school_or_dli": intake.get("dli_name") or intake.get("school_name") or "",
        "program_name": intake.get("program_name") or "",
        "intake_term": intake.get("intake_term") or "",
        "tuition_amount": intake.get("tuition_amount") or "",
        "proof_of_funds_available": "Yes"
        if intake.get("proof_of_funds_available")
        else "No",
        "previous_refusal": "Yes" if intake.get("previous_refusal") else "No",
        "accompanying_family": "Yes" if intake.get("accompanying_family") else "No",
        "passport_valid": "Yes" if intake.get("passport_valid") else "No",
        "study_gap_explanation": intake.get("gap_in_studies_explanation") or "",
    }

    if not draft_answers["school_or_dli"]:
        missing_fields.append("School or DLI name")
    if not draft_answers["program_name"]:
        missing_fields.append("Program name")
    if not draft_answers["intake_term"]:
        missing_fields.append("Intake term")
    if not draft_answers["tuition_amount"]:
        missing_fields.append("Tuition amount")
    if draft_answers["proof_of_funds_available"] == "No":
        missing_fields.append("Proof of funds strategy")
    if draft_answers["passport_valid"] == "No":
        missing_fields.append("Passport validity confirmation")

    preparation_notes = [
        "Review all identity, travel, and education details for consistency.",
        "Make sure the study plan clearly explains school choice, program relevance, and future plans.",
        "Match proof of funds with tuition and living cost expectations.",
    ]

    if intake.get("previous_refusal"):
        preparation_notes.append(
            "Prepare a clear refusal-response explanation addressing prior concerns."
        )

    if intake.get("accompanying_family"):
        recommended_forms.append(
            {
                "form_key": "family_member_support",
                "form_name": "Accompanying family support package",
                "status": "Conditional",
                "notes": "Family-related forms and supporting information may be required.",
            }
        )

    return {
        "matter_type": "study_permit",
        "package_title": "Study Permit Forms Assistant",
        "recommended_forms": recommended_forms,
        "draft_answers": draft_answers,
        "missing_fields": missing_fields,
        "preparation_notes": preparation_notes,
        "summary": (
            "The study permit forms package looks reasonably prepared from current intake."
            if len(missing_fields) == 0
            else "Some key study permit form fields still need to be completed or reviewed."
        ),
    }


def build_work_permit_forms_assistant(
    intake: dict[str, Any] | None = None,
) -> dict[str, Any]:
    intake = intake or {}

    missing_fields: list[str] = []
    recommended_forms: list[dict[str, Any]] = [
        {
            "form_key": "work_permit_main",
            "form_name": "Work permit application package",
            "status": "Primary",
            "notes": "Main work permit workflow for the applicant.",
        },
        {
            "form_key": "family_information",
            "form_name": "Family information form",
            "status": "Supporting",
            "notes": "Usually needed where family and background details are required.",
        },
    ]

    permit_type = intake.get("permit_type") or ""

    draft_answers = {
        "permit_type": permit_type,
        "employer_name": intake.get("employer_name") or "",
        "job_title": intake.get("job_title") or "",
        "noc_code": intake.get("noc_code") or "",
        "province_of_work": intake.get("province_of_work") or "",
        "wage": intake.get("wage") or "",
        "current_status_in_canada": intake.get("current_status_in_canada") or "",
        "expires_on": intake.get("expires_on") or "",
        "lmia_available": "Yes" if intake.get("lmia_available") else "No",
        "open_work_permit_basis": intake.get("open_work_permit_basis") or "",
        "accompanying_family": "Yes" if intake.get("accompanying_family") else "No",
    }

    if not draft_answers["permit_type"]:
        missing_fields.append("Permit type")
    if not draft_answers["job_title"]:
        missing_fields.append("Job title")
    if not draft_answers["current_status_in_canada"]:
        missing_fields.append("Current status in Canada")

    lowered_permit_type = permit_type.lower()

    if "employer" in lowered_permit_type and not draft_answers["employer_name"]:
        missing_fields.append("Employer name")

    if "employer" in lowered_permit_type and draft_answers["lmia_available"] == "No":
        missing_fields.append("LMIA or exemption confirmation")

    if "open" in lowered_permit_type and not draft_answers["open_work_permit_basis"]:
        missing_fields.append("Open work permit basis")

    preparation_notes = [
        "Confirm job, employer, and NOC details are consistent across documents.",
        "Review the applicant's current immigration status and expiry timeline carefully.",
        "Confirm whether this case is LMIA-based or LMIA-exempt where relevant.",
    ]

    if intake.get("accompanying_family"):
        recommended_forms.append(
            {
                "form_key": "family_member_support",
                "form_name": "Accompanying family support package",
                "status": "Conditional",
                "notes": "Family-related forms and supporting information may be required.",
            }
        )

    return {
        "matter_type": "work_permit",
        "package_title": "Work Permit Forms Assistant",
        "recommended_forms": recommended_forms,
        "draft_answers": draft_answers,
        "missing_fields": missing_fields,
        "preparation_notes": preparation_notes,
        "summary": (
            "The work permit forms package looks reasonably prepared from current intake."
            if len(missing_fields) == 0
            else "Some key work permit form fields still need to be completed or reviewed."
        ),
    }


def build_spousal_sponsorship_forms_assistant(
    intake: dict[str, Any] | None = None,
) -> dict[str, Any]:
    intake = intake or {}

    missing_fields: list[str] = []
    recommended_forms: list[dict[str, Any]] = [
        {
            "form_key": "sponsorship_package_main",
            "form_name": "Spousal sponsorship application package",
            "status": "Primary",
            "notes": "Main sponsorship workflow for sponsor and principal applicant.",
        },
        {
            "form_key": "relationship_history",
            "form_name": "Relationship history and evidence package",
            "status": "Supporting",
            "notes": "Relationship timeline and supporting evidence planning.",
        },
    ]

    relationship_type = intake.get("relationship_type") or ""

    draft_answers = {
        "sponsor_status": intake.get("sponsor_status") or "",
        "relationship_type": relationship_type,
        "relationship_start_date": intake.get("relationship_start_date") or "",
        "marriage_date": intake.get("marriage_date") or "",
        "cohabiting": "Yes" if intake.get("cohabiting") else "No",
        "principal_applicant_country": intake.get("principal_applicant_country") or "",
        "dependent_children": "Yes" if intake.get("dependent_children") else "No",
        "previous_marriage_or_sponsorship": (
            "Yes" if intake.get("previous_marriage_or_sponsorship") else "No"
        ),
        "police_certificates_ready": (
            "Yes" if intake.get("police_certificates_ready") else "No"
        ),
        "medicals_ready": "Yes" if intake.get("medicals_ready") else "No",
        "proof_of_relationship_notes": intake.get("proof_of_relationship_notes") or "",
    }

    if not draft_answers["sponsor_status"]:
        missing_fields.append("Sponsor status")
    if not draft_answers["relationship_type"]:
        missing_fields.append("Relationship type")
    if not draft_answers["relationship_start_date"]:
        missing_fields.append("Relationship start date")
    if "spouse" in relationship_type.lower() and not draft_answers["marriage_date"]:
        missing_fields.append("Marriage date")
    if not draft_answers["proof_of_relationship_notes"]:
        missing_fields.append("Relationship evidence notes")
    if draft_answers["police_certificates_ready"] == "No":
        missing_fields.append("Police certificate planning")
    if draft_answers["medicals_ready"] == "No":
        missing_fields.append("Medical exam planning")

    preparation_notes = [
        "Ensure relationship history is consistent across all forms and evidence.",
        "Prepare a clean timeline of communication, visits, cohabitation, and major milestones.",
        "Review prior marriages, sponsorships, or dependent child issues carefully.",
    ]

    if intake.get("dependent_children"):
        recommended_forms.append(
            {
                "form_key": "dependent_children_support",
                "form_name": "Dependent children support package",
                "status": "Conditional",
                "notes": "Additional child-related supporting information may be required.",
            }
        )

    return {
        "matter_type": "spousal_sponsorship",
        "package_title": "Spousal Sponsorship Forms Assistant",
        "recommended_forms": recommended_forms,
        "draft_answers": draft_answers,
        "missing_fields": missing_fields,
        "preparation_notes": preparation_notes,
        "summary": (
            "The sponsorship forms package looks reasonably prepared from current intake."
            if len(missing_fields) == 0
            else "Some key sponsorship form fields still need to be completed or reviewed."
        ),
    }


def build_forms_assistant(
    matter_type: str | None,
    intake: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if matter_type == "study_permit":
        return build_study_permit_forms_assistant(intake)

    if matter_type == "work_permit":
        return build_work_permit_forms_assistant(intake)

    if matter_type == "spousal_sponsorship":
        return build_spousal_sponsorship_forms_assistant(intake)

    return {
        "matter_type": matter_type or "unknown",
        "package_title": "Forms Assistant",
        "recommended_forms": [],
        "draft_answers": {},
        "missing_fields": [
            "Forms assistant has not been built for this matter type yet."
        ],
        "preparation_notes": [],
        "summary": "No forms assistant is available for this matter type yet.",
    }