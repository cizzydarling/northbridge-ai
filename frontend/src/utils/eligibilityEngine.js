export function evaluateStudyPermitEligibility(intake = {}) {
  const strengths = [];
  const concerns = [];
  const next_steps = [];
  const category_hints = [];

  let score = 0;

  if (intake.dli_name || intake.school_name) {
    strengths.push("A school or DLI has been identified.");
    score += 15;
  } else {
    concerns.push("School or DLI information is missing.");
    next_steps.push("Confirm the school and designated learning institution details.");
  }

  if (intake.program_name) {
    strengths.push("Program information is available.");
    score += 10;
  } else {
    concerns.push("Program details are incomplete.");
    next_steps.push("Add the exact program name and level of study.");
  }

  if (intake.intake_term) {
    strengths.push("Intake timing is defined.");
    score += 5;
  } else {
    concerns.push("Intake term is not specified.");
    next_steps.push("Add the intended intake term.");
  }

  if (intake.tuition_amount) {
    strengths.push("Tuition amount has been recorded.");
    score += 10;
  } else {
    concerns.push("Tuition amount is missing.");
    next_steps.push("Confirm tuition costs and upload supporting fee documents.");
  }

  if (intake.proof_of_funds_available) {
    strengths.push("Proof of funds is marked as available.");
    score += 20;
  } else {
    concerns.push("Proof of funds is not yet confirmed.");
    next_steps.push("Gather bank statements, GIC evidence, sponsor support, or other proof of funds.");
  }

  if (intake.passport_valid) {
    strengths.push("Passport validity is confirmed.");
    score += 10;
  } else {
    concerns.push("Passport validity is not confirmed.");
    next_steps.push("Review passport validity before submission.");
  }

  if (intake.sds_eligible) {
    strengths.push("The case may qualify for SDS processing requirements.");
    category_hints.push("SDS review recommended");
    score += 10;
  }

  if (intake.previous_refusal) {
    concerns.push("Previous refusal history may increase scrutiny.");
    next_steps.push("Prepare refusal analysis and a stronger response strategy.");
    category_hints.push("Refusal-response strategy needed");
    score -= 15;
  }

  if (intake.gap_in_studies_explanation?.trim()) {
    strengths.push("A study gap explanation has been provided.");
    score += 5;
  } else {
    concerns.push("No study gap explanation is recorded.");
    next_steps.push("Review study and work timeline for unexplained gaps.");
  }

  if (intake.accompanying_family) {
    concerns.push("Accompanying family adds supporting document complexity.");
    next_steps.push("Prepare dependent identity, relationship, and status documents.");
    category_hints.push("Family-document review needed");
    score -= 5;
  }

  let readiness = "Weak";
  if (score >= 60) readiness = "Strong";
  else if (score >= 40) readiness = "Moderate";

  return {
    pathway: "Study Permit",
    score,
    readiness,
    strengths,
    concerns,
    next_steps,
    category_hints,
    summary:
      readiness === "Strong"
        ? "The file shows a solid early study permit profile, with some final document and narrative checks still needed."
        : readiness === "Moderate"
        ? "The file has a workable study permit foundation but needs supporting evidence and narrative improvements before submission."
        : "The file currently shows important gaps that should be resolved before moving forward.",
  };
}

export function evaluateWorkPermitEligibility(intake = {}) {
  const strengths = [];
  const concerns = [];
  const next_steps = [];
  const category_hints = [];

  let score = 0;

  if (intake.permit_type?.trim()) {
    strengths.push("Work permit type is identified.");
    score += 10;
  } else {
    concerns.push("Permit type is not specified.");
    next_steps.push("Confirm whether the case is open work permit or employer-specific.");
  }

  if (intake.employer_name?.trim()) {
    strengths.push("Employer information is available.");
    score += 10;
  } else {
    concerns.push("Employer details are missing.");
    next_steps.push("Add employer details if this is an employer-specific work permit.");
  }

  if (intake.job_title?.trim()) {
    strengths.push("Job title has been recorded.");
    score += 10;
  } else {
    concerns.push("Job title is missing.");
    next_steps.push("Add the proposed or current job title.");
  }

  if (intake.noc_code?.trim()) {
    strengths.push("NOC code is available.");
    score += 8;
  } else {
    concerns.push("NOC code is not confirmed.");
    next_steps.push("Confirm the NOC code for the position.");
  }

  if (intake.province_of_work?.trim()) {
    strengths.push("Province of work is defined.");
    score += 5;
  } else {
    concerns.push("Province of work is not specified.");
    next_steps.push("Add the intended province of employment.");
  }

  if (intake.current_status_in_canada?.trim()) {
    strengths.push("Current status in Canada is recorded.");
    score += 12;
  } else {
    concerns.push("Current status in Canada is missing.");
    next_steps.push("Confirm the applicant's current immigration status.");
  }

  if (intake.expires_on?.trim()) {
    strengths.push("Current status expiry date is available.");
    score += 8;
  } else {
    concerns.push("Status expiry date is not recorded.");
    next_steps.push("Add the current permit or status expiry date.");
  }

  if (intake.lmia_available) {
    strengths.push("LMIA availability is confirmed.");
    category_hints.push("LMIA-backed case");
    score += 18;
  } else if (intake.permit_type?.toLowerCase().includes("employer")) {
    concerns.push("Employer-specific work permit may need LMIA review.");
    next_steps.push("Confirm whether an LMIA is required or whether an exemption applies.");
    category_hints.push("LMIA requirement review");
    score -= 8;
  }

  if (intake.open_work_permit_basis?.trim()) {
    strengths.push("Open work permit basis is identified.");
    category_hints.push("Open work permit basis recorded");
    score += 12;
  } else if (intake.permit_type?.toLowerCase().includes("open")) {
    concerns.push("Open work permit basis is not specified.");
    next_steps.push("Confirm the legal basis for the open work permit request.");
    score -= 8;
  }

  if (intake.wage?.trim()) {
    strengths.push("Wage information is available.");
    score += 5;
  } else {
    concerns.push("Wage information is missing.");
    next_steps.push("Confirm compensation details for the job offer.");
  }

  if (intake.accompanying_family) {
    concerns.push("Accompanying family may add supporting document requirements.");
    next_steps.push("Prepare dependent identity, relationship, and status documents.");
    category_hints.push("Family-document review needed");
    score -= 4;
  }

  let readiness = "Weak";
  if (score >= 60) readiness = "Strong";
  else if (score >= 40) readiness = "Moderate";

  return {
    pathway: "Work Permit",
    score,
    readiness,
    strengths,
    concerns,
    next_steps,
    category_hints,
    summary:
      readiness === "Strong"
        ? "The file shows a solid early work permit profile, with core job and status details mostly in place."
        : readiness === "Moderate"
        ? "The file has a workable work permit foundation but needs additional job, status, or eligibility clarification."
        : "The file currently has important work permit gaps that should be resolved before proceeding.",
  };
}

export function evaluateSpousalSponsorshipEligibility(intake = {}) {
  const strengths = [];
  const concerns = [];
  const next_steps = [];
  const category_hints = [];

  let score = 0;

  if (intake.sponsor_status?.trim()) {
    strengths.push("Sponsor status has been identified.");
    score += 15;
  } else {
    concerns.push("Sponsor status is missing.");
    next_steps.push("Confirm whether the sponsor is a Canadian citizen or permanent resident.");
  }

  if (intake.relationship_type?.trim()) {
    strengths.push("Relationship type is recorded.");
    score += 12;
  } else {
    concerns.push("Relationship type is not specified.");
    next_steps.push("Confirm whether the relationship is spouse or common-law.");
  }

  if (intake.relationship_start_date?.trim()) {
    strengths.push("Relationship timeline has started to be documented.");
    score += 8;
  } else {
    concerns.push("Relationship start date is missing.");
    next_steps.push("Add the relationship start date and timeline details.");
  }

  if (intake.marriage_date?.trim()) {
    strengths.push("Marriage date is recorded.");
    score += 8;
  } else if (
    intake.relationship_type?.toLowerCase().includes("spouse")
  ) {
    concerns.push("Marriage date is not recorded for a spousal matter.");
    next_steps.push("Confirm the marriage date and collect marriage certificate evidence.");
  }

  if (intake.cohabiting) {
    strengths.push("Cohabitation is indicated.");
    category_hints.push("Cohabitation evidence review");
    score += 8;
  } else if (
    intake.relationship_type?.toLowerCase().includes("common")
  ) {
    concerns.push("Common-law cases need strong cohabitation evidence review.");
    next_steps.push("Collect documents that support continuous cohabitation.");
    score -= 10;
  }

  if (intake.police_certificates_ready) {
    strengths.push("Police certificate readiness is confirmed.");
    score += 10;
  } else {
    concerns.push("Police certificates are not yet confirmed.");
    next_steps.push("Prepare police certificate planning based on residence history.");
  }

  if (intake.medicals_ready) {
    strengths.push("Medical readiness is confirmed.");
    score += 10;
  } else {
    concerns.push("Medical readiness is not confirmed.");
    next_steps.push("Plan medical exam timing and requirements.");
  }

  if (intake.proof_of_relationship_notes?.trim()) {
    strengths.push("Relationship evidence notes have been entered.");
    score += 10;
  } else {
    concerns.push("Relationship proof strategy is not documented.");
    next_steps.push("Add notes on photos, communication history, visits, joint documents, and other relationship evidence.");
  }

  if (intake.previous_marriage_or_sponsorship) {
    concerns.push("Previous marriage or sponsorship history may need careful review.");
    next_steps.push("Review previous relationships or sponsorship history and prepare supporting explanations.");
    category_hints.push("Previous relationship review needed");
    score -= 8;
  }

  if (intake.dependent_children) {
    concerns.push("Dependent children add extra documentation requirements.");
    next_steps.push("Prepare dependent child identity, custody, and relationship documents where applicable.");
    category_hints.push("Dependent child document review");
    score -= 4;
  }

  if (intake.principal_applicant_country?.trim()) {
    strengths.push("Principal applicant country information is available.");
    score += 5;
  } else {
    concerns.push("Principal applicant country is missing.");
    next_steps.push("Add the principal applicant's country of residence or nationality context.");
  }

  let readiness = "Weak";
  if (score >= 60) readiness = "Strong";
  else if (score >= 40) readiness = "Moderate";

  return {
    pathway: "Spousal Sponsorship",
    score,
    readiness,
    strengths,
    concerns,
    next_steps,
    category_hints,
    summary:
      readiness === "Strong"
        ? "The file shows a solid early sponsorship profile, with key relationship and admissibility elements largely identified."
        : readiness === "Moderate"
        ? "The file has a workable sponsorship foundation but needs stronger documentation planning or relationship evidence strategy."
        : "The file currently has important sponsorship gaps that should be addressed before proceeding.",
  };
}

export function evaluateMatterEligibility(matterType, intake = {}) {
  if (matterType === "study_permit") {
    return evaluateStudyPermitEligibility(intake);
  }

  if (matterType === "work_permit") {
    return evaluateWorkPermitEligibility(intake);
  }

  if (matterType === "spousal_sponsorship") {
    return evaluateSpousalSponsorshipEligibility(intake);
  }

  return {
    pathway: matterType || "Unknown",
    score: null,
    readiness: "Not Built",
    strengths: [],
    concerns: [],
    next_steps: ["Eligibility engine for this matter type has not been built yet."],
    category_hints: [],
    summary: "No rule-based eligibility engine is available for this matter type yet.",
  };
}