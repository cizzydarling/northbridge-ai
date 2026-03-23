from typing import Any


def _build_default_result(matter_type: str | None) -> dict[str, Any]:
    return {
        "matter_type": matter_type or "unknown",
        "score": 0,
        "readiness": "Weak",
        "strengths": [],
        "concerns": [],
        "next_steps": [],
        "category_hints": [],
        "summary": "No eligibility engine is available for this matter type yet.",
    }


def evaluate_study_permit_eligibility(
    intake: dict[str, Any] | None = None,
) -> dict[str, Any]:
    intake = intake or {}

    score = 0
    strengths: list[str] = []
    concerns: list[str] = []
    next_steps: list[str] = []
    category_hints: list[str] = []

    if intake.get("dli_name") or intake.get("school_name"):
        score += 15
        strengths.append("A school or DLI has been identified.")
    else:
        concerns.append("School or DLI information is missing.")
        next_steps.append("Confirm the school or DLI before proceeding.")

    if intake.get("program_name"):
        score += 10
        strengths.append("Program information is available.")
    else:
        concerns.append("Program name is missing.")
        next_steps.append("Add the intended program name.")

    if intake.get("intake_term"):
        score += 8
        strengths.append("The intended intake term has been identified.")
    else:
        concerns.append("Intake term is not yet recorded.")
        next_steps.append("Confirm the intended intake term.")

    if intake.get("tuition_amount"):
        score += 8
        strengths.append("Tuition information is available.")
    else:
        concerns.append("Tuition amount is missing.")
        next_steps.append("Gather tuition details or fee statement information.")

    if intake.get("proof_of_funds_available"):
        score += 18
        strengths.append("Proof of funds appears available.")
    else:
        concerns.append("Proof of funds is not confirmed.")
        next_steps.append("Build a funding plan and gather proof of funds.")

    if intake.get("passport_valid"):
        score += 12
        strengths.append("Passport validity appears confirmed.")
    else:
        concerns.append("Passport validity is not confirmed.")
        next_steps.append("Review passport validity and renewal timing.")

    if intake.get("sds_eligible"):
        score += 10
        strengths.append("The file may qualify for SDS-style preparation.")
        category_hints.append("SDS review may be relevant.")
    else:
        category_hints.append("Regular study permit preparation may apply.")

    if intake.get("previous_refusal"):
        score -= 12
        concerns.append("A previous refusal may make the application more sensitive.")
        next_steps.append(
            "Prepare a clear explanation addressing the previous refusal."
        )

    gap_explanation = str(intake.get("gap_in_studies_explanation") or "").strip()
    if gap_explanation:
        score += 6
        strengths.append("A study gap explanation has been provided.")
    else:
        concerns.append("No study gap explanation is recorded.")
        next_steps.append("Review education and work timeline for any gaps.")

    if intake.get("accompanying_family"):
        score -= 2
        category_hints.append("Family accompaniment may add document complexity.")
        next_steps.append(
            "Prepare family relationship and status documentation."
        )

    if score >= 65:
        readiness = "Strong"
    elif score >= 40:
        readiness = "Moderate"
    else:
        readiness = "Weak"

    if not next_steps:
        next_steps.append("Review supporting documents for consistency.")

    summary = {
        "Strong": "The study permit profile looks fairly organized from the current intake.",
        "Moderate": "The study permit file has a workable base but several items still need attention.",
        "Weak": "The study permit file needs more preparation before it appears ready.",
    }[readiness]

    return {
        "matter_type": "study_permit",
        "score": max(score, 0),
        "readiness": readiness,
        "strengths": strengths,
        "concerns": concerns,
        "next_steps": next_steps,
        "category_hints": category_hints,
        "summary": summary,
    }


def evaluate_work_permit_eligibility(
    intake: dict[str, Any] | None = None,
) -> dict[str, Any]:
    intake = intake or {}

    score = 0
    strengths: list[str] = []
    concerns: list[str] = []
    next_steps: list[str] = []
    category_hints: list[str] = []

    permit_type = str(intake.get("permit_type") or "").strip()
    lowered_permit_type = permit_type.lower()

    if permit_type:
        score += 12
        strengths.append("Permit type is identified.")
    else:
        concerns.append("Permit type is missing.")
        next_steps.append("Clarify whether the case is open or employer-specific.")

    if intake.get("job_title"):
        score += 10
        strengths.append("Job title is available.")
    else:
        concerns.append("Job title is missing.")
        next_steps.append("Confirm the job title.")

    if intake.get("current_status_in_canada"):
        score += 12
        strengths.append("Current immigration status is recorded.")
    else:
        concerns.append("Current status in Canada is not recorded.")
        next_steps.append("Confirm the applicant's current status in Canada.")

    if "employer" in lowered_permit_type:
        category_hints.append("Employer-specific work permit review may apply.")

        if intake.get("employer_name"):
            score += 10
            strengths.append("Employer name is available.")
        else:
            concerns.append("Employer name is missing.")
            next_steps.append("Confirm the employer name.")

        if intake.get("lmia_available"):
            score += 16
            strengths.append("LMIA information appears available.")
        else:
            concerns.append("LMIA or exemption evidence is not confirmed.")
            next_steps.append("Confirm whether LMIA or LMIA exemption applies.")

    if "open" in lowered_permit_type:
        category_hints.append("Open work permit review may apply.")

        if intake.get("open_work_permit_basis"):
            score += 16
            strengths.append("Open work permit basis is identified.")
        else:
            concerns.append("Open work permit basis is not recorded.")
            next_steps.append("Clarify the basis for the open work permit.")

    if intake.get("noc_code"):
        score += 8
        strengths.append("NOC code is recorded.")
    else:
        concerns.append("NOC code is missing.")
        next_steps.append("Identify the correct NOC code for the role.")

    if intake.get("province_of_work"):
        score += 6
        strengths.append("Province of work is identified.")
    else:
        concerns.append("Province of work is not recorded.")

    if intake.get("wage"):
        score += 6
        strengths.append("Wage details are available.")
    else:
        concerns.append("Wage details are missing.")

    if intake.get("expires_on"):
        score += 5
        strengths.append("Status expiry timing is recorded.")
    else:
        concerns.append("Expiry date is not recorded.")
        next_steps.append("Confirm status expiry timing.")

    if intake.get("accompanying_family"):
        score -= 2
        category_hints.append("Family accompaniment may add document complexity.")
        next_steps.append("Prepare family relationship and status documentation.")

    if score >= 65:
        readiness = "Strong"
    elif score >= 40:
        readiness = "Moderate"
    else:
        readiness = "Weak"

    if not next_steps:
        next_steps.append("Review work permit documents for consistency.")

    summary = {
        "Strong": "The work permit profile looks fairly organized from the current intake.",
        "Moderate": "The work permit file has a workable base but key confirmations are still needed.",
        "Weak": "The work permit file needs more preparation before it appears ready.",
    }[readiness]

    return {
        "matter_type": "work_permit",
        "score": max(score, 0),
        "readiness": readiness,
        "strengths": strengths,
        "concerns": concerns,
        "next_steps": next_steps,
        "category_hints": category_hints,
        "summary": summary,
    }


def evaluate_spousal_sponsorship_eligibility(
    intake: dict[str, Any] | None = None,
) -> dict[str, Any]:
    intake = intake or {}

    score = 0
    strengths: list[str] = []
    concerns: list[str] = []
    next_steps: list[str] = []
    category_hints: list[str] = []

    relationship_type = str(intake.get("relationship_type") or "").strip()
    lowered_relationship_type = relationship_type.lower()

    if intake.get("sponsor_status"):
        score += 15
        strengths.append("Sponsor status is recorded.")
    else:
        concerns.append("Sponsor status is missing.")
        next_steps.append("Confirm whether the sponsor is a citizen or permanent resident.")

    if relationship_type:
        score += 10
        strengths.append("Relationship type is identified.")
    else:
        concerns.append("Relationship type is missing.")
        next_steps.append("Clarify whether the relationship is spouse or common-law.")

    if intake.get("relationship_start_date"):
        score += 10
        strengths.append("Relationship start date is available.")
    else:
        concerns.append("Relationship start date is missing.")
        next_steps.append("Add the relationship start date.")

    if "spouse" in lowered_relationship_type:
        category_hints.append("Spousal sponsorship review may apply.")
        if intake.get("marriage_date"):
            score += 10
            strengths.append("Marriage date is recorded.")
        else:
            concerns.append("Marriage date is missing.")
            next_steps.append("Confirm the marriage date and marriage certificate.")

    if "common" in lowered_relationship_type:
        category_hints.append("Common-law sponsorship review may apply.")
        if intake.get("cohabiting"):
            score += 10
            strengths.append("Cohabitation is indicated.")
        else:
            concerns.append("Cohabitation is not clearly confirmed.")
            next_steps.append("Prepare strong evidence of cohabitation.")

    if intake.get("proof_of_relationship_notes"):
        score += 15
        strengths.append("Relationship evidence planning is already recorded.")
    else:
        concerns.append("Relationship evidence planning is missing.")
        next_steps.append("Prepare a relationship timeline and evidence plan.")

    if intake.get("police_certificates_ready"):
        score += 8
        strengths.append("Police certificate planning appears ready.")
    else:
        concerns.append("Police certificates are not yet ready.")
        next_steps.append("Plan police certificate collection early.")

    if intake.get("medicals_ready"):
        score += 8
        strengths.append("Medical readiness appears confirmed.")
    else:
        concerns.append("Medical planning is still needed.")
        next_steps.append("Plan the medical examination timeline.")

    if intake.get("dependent_children"):
        score -= 2
        category_hints.append("Dependent children may add document complexity.")
        next_steps.append("Prepare child-related identity and relationship documents.")

    if intake.get("previous_marriage_or_sponsorship"):
        score -= 5
        concerns.append("Previous marriage or sponsorship history may need closer review.")
        next_steps.append("Prepare prior marriage or sponsorship records.")

    if intake.get("principal_applicant_country"):
        score += 4
        strengths.append("Principal applicant country is recorded.")

    if score >= 65:
        readiness = "Strong"
    elif score >= 40:
        readiness = "Moderate"
    else:
        readiness = "Weak"

    if not next_steps:
        next_steps.append("Review relationship and identity documents for consistency.")

    summary = {
        "Strong": "The sponsorship profile looks fairly organized from the current intake.",
        "Moderate": "The sponsorship file has a workable base but more preparation is still needed.",
        "Weak": "The sponsorship file needs more preparation before it appears ready.",
    }[readiness]

    return {
        "matter_type": "spousal_sponsorship",
        "score": max(score, 0),
        "readiness": readiness,
        "strengths": strengths,
        "concerns": concerns,
        "next_steps": next_steps,
        "category_hints": category_hints,
        "summary": summary,
    }


def evaluate_matter_eligibility(
    matter_type: str | None,
    intake: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if matter_type == "study_permit":
        return evaluate_study_permit_eligibility(intake)

    if matter_type == "work_permit":
        return evaluate_work_permit_eligibility(intake)

    if matter_type == "spousal_sponsorship":
        return evaluate_spousal_sponsorship_eligibility(intake)

    return _build_default_result(matter_type)