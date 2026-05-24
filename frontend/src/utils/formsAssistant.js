function normalizeFormsLanguage(language) {
  return String(language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

const formsAssistantFr = {
  Yes: "Oui",
  No: "Non",
  Primary: "Principal",
  Supporting: "Appui",
  Conditional: "Conditionnel",
  "Study Permit Forms Assistant": "Assistant formulaires - permis d'etudes",
  "Work Permit Forms Assistant": "Assistant formulaires - permis de travail",
  "Spousal Sponsorship Forms Assistant": "Assistant formulaires - parrainage d'epoux/conjoint",
  "Forms Assistant": "Assistant formulaires",
  "Study permit application package": "Dossier de demande de permis d'etudes",
  "Family information form": "Formulaire de renseignements sur la famille",
  "Accompanying family support package": "Dossier d'appui pour la famille accompagnante",
  "Work permit application package": "Dossier de demande de permis de travail",
  "Spousal sponsorship application package": "Dossier de parrainage d'epoux/conjoint",
  "Relationship history and evidence package": "Dossier d'historique de relation et de preuves",
  "Dependent children support package": "Dossier d'appui pour enfants a charge",
  "Main study permit application workflow for the applicant.":
    "Flux principal de demande de permis d'etudes pour le demandeur.",
  "Usually needed where family/background details are required.":
    "Habituellement requis lorsque des renseignements familiaux ou personnels sont demandes.",
  "Family-related forms and supporting information may be required.":
    "Des formulaires et renseignements d'appui lies a la famille peuvent etre requis.",
  "Main work permit workflow for the applicant.":
    "Flux principal de demande de permis de travail pour le demandeur.",
  "Main sponsorship workflow for sponsor and principal applicant.":
    "Flux principal de parrainage pour le repondant et le demandeur principal.",
  "Relationship timeline and supporting evidence planning.":
    "Planification de la chronologie de relation et des preuves d'appui.",
  "Additional child-related supporting information may be required.":
    "Des renseignements d'appui supplementaires lies aux enfants peuvent etre requis.",
  "School or DLI name": "Nom de l'ecole ou de l'EED",
  "Program name": "Nom du programme",
  "Intake term": "Session d'admission",
  "Tuition amount": "Montant des frais de scolarite",
  "Proof of funds strategy": "Strategie de preuve de fonds",
  "Passport validity confirmation": "Confirmation de validite du passeport",
  "Permit type": "Type de permis",
  "Job title": "Titre du poste",
  "Current status in Canada": "Statut actuel au Canada",
  "Employer name": "Nom de l'employeur",
  "LMIA or exemption confirmation": "Confirmation d'EIMT ou d'exemption",
  "Open work permit basis": "Base du permis de travail ouvert",
  "Sponsor status": "Statut du repondant",
  "Relationship type": "Type de relation",
  "Relationship start date": "Date de debut de la relation",
  "Marriage date": "Date du mariage",
  "Relationship evidence notes": "Notes sur les preuves de relation",
  "Police certificate planning": "Planification des certificats de police",
  "Medical exam planning": "Planification de l'examen medical",
  "Review all identity, travel, and education details for consistency.":
    "Verifier la coherence de l'identite, des voyages et des etudes.",
  "Make sure the study plan clearly explains school choice, program relevance, and future plans.":
    "S'assurer que le plan d'etudes explique clairement le choix de l'ecole, la pertinence du programme et les projets futurs.",
  "Match proof of funds with tuition and living cost expectations.":
    "Faire correspondre la preuve de fonds aux frais de scolarite et aux couts de subsistance prevus.",
  "Prepare a clear refusal-response explanation addressing prior concerns.":
    "Preparer une reponse claire aux refus precedents et aux preoccupations soulevees.",
  "Confirm job, employer, and NOC details are consistent across documents.":
    "Confirmer la coherence de l'emploi, de l'employeur et du NOC dans tous les documents.",
  "Review the applicant's current immigration status and expiry timeline carefully.":
    "Verifier attentivement le statut d'immigration actuel et les dates d'expiration.",
  "Confirm whether this case is LMIA-based or LMIA-exempt where relevant.":
    "Confirmer si le dossier repose sur une EIMT ou sur une exemption, le cas echeant.",
  "Ensure relationship history is consistent across all forms and evidence.":
    "S'assurer que l'historique de la relation est coherent dans les formulaires et les preuves.",
  "Prepare a clean timeline of communication, visits, cohabitation, and major milestones.":
    "Preparer une chronologie claire des communications, visites, cohabitation et evenements importants.",
  "Review prior marriages, sponsorships, or dependent child issues carefully.":
    "Verifier attentivement les mariages anterieurs, parrainages precedents et questions liees aux enfants a charge.",
  "The study permit forms package looks reasonably prepared from current intake.":
    "Le dossier de permis d'etudes semble raisonnablement prepare selon les renseignements actuels.",
  "Some key study permit form fields still need to be completed or reviewed.":
    "Certains champs importants du permis d'etudes doivent encore etre completes ou verifies.",
  "The work permit forms package looks reasonably prepared from current intake.":
    "Le dossier de permis de travail semble raisonnablement prepare selon les renseignements actuels.",
  "Some key work permit form fields still need to be completed or reviewed.":
    "Certains champs importants du permis de travail doivent encore etre completes ou verifies.",
  "The sponsorship forms package looks reasonably prepared from current intake.":
    "Le dossier de parrainage semble raisonnablement prepare selon les renseignements actuels.",
  "Some key sponsorship form fields still need to be completed or reviewed.":
    "Certains champs importants du parrainage doivent encore etre completes ou verifies.",
  "Forms assistant has not been built for this matter type yet.":
    "L'assistant formulaires n'est pas encore disponible pour ce type de dossier.",
  "No forms assistant is available for this matter type yet.":
    "Aucun assistant formulaires n'est encore disponible pour ce type de dossier.",
};

function translateFormsAssistantValue(value, language) {
  if (normalizeFormsLanguage(language) !== "fr") return value;

  if (typeof value === "string") {
    return formsAssistantFr[value] || value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => translateFormsAssistantValue(item, language));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        translateFormsAssistantValue(item, language),
      ])
    );
  }

  return value;
}

function buildStudyPermitFormsAssistant(intake = {}) {
  const missing_fields = [];
  const recommended_forms = [
    {
      form_key: "study_permit_main",
      form_name: "Study permit application package",
      status: "Primary",
      notes: "Main study permit application workflow for the applicant.",
    },
    {
      form_key: "family_information",
      form_name: "Family information form",
      status: "Supporting",
      notes: "Usually needed where family/background details are required.",
    },
  ];

  const draft_answers = {
    school_or_dli: intake.dli_name || intake.school_name || "",
    program_name: intake.program_name || "",
    intake_term: intake.intake_term || "",
    tuition_amount: intake.tuition_amount || "",
    proof_of_funds_available: intake.proof_of_funds_available ? "Yes" : "No",
    previous_refusal: intake.previous_refusal ? "Yes" : "No",
    accompanying_family: intake.accompanying_family ? "Yes" : "No",
    passport_valid: intake.passport_valid ? "Yes" : "No",
    study_gap_explanation: intake.gap_in_studies_explanation || "",
  };

  if (!draft_answers.school_or_dli) missing_fields.push("School or DLI name");
  if (!draft_answers.program_name) missing_fields.push("Program name");
  if (!draft_answers.intake_term) missing_fields.push("Intake term");
  if (!draft_answers.tuition_amount) missing_fields.push("Tuition amount");
  if (draft_answers.proof_of_funds_available === "No") {
    missing_fields.push("Proof of funds strategy");
  }
  if (draft_answers.passport_valid === "No") {
    missing_fields.push("Passport validity confirmation");
  }

  const preparation_notes = [
    "Review all identity, travel, and education details for consistency.",
    "Make sure the study plan clearly explains school choice, program relevance, and future plans.",
    "Match proof of funds with tuition and living cost expectations.",
  ];

  if (intake.previous_refusal) {
    preparation_notes.push(
      "Prepare a clear refusal-response explanation addressing prior concerns."
    );
  }

  if (intake.accompanying_family) {
    recommended_forms.push({
      form_key: "family_member_support",
      form_name: "Accompanying family support package",
      status: "Conditional",
      notes: "Family-related forms and supporting information may be required.",
    });
  }

  return {
    matter_type: "study_permit",
    package_title: "Study Permit Forms Assistant",
    recommended_forms,
    draft_answers,
    missing_fields,
    preparation_notes,
    summary:
      missing_fields.length === 0
        ? "The study permit forms package looks reasonably prepared from current intake."
        : "Some key study permit form fields still need to be completed or reviewed.",
  };
}

function buildWorkPermitFormsAssistant(intake = {}) {
  const missing_fields = [];
  const recommended_forms = [
    {
      form_key: "work_permit_main",
      form_name: "Work permit application package",
      status: "Primary",
      notes: "Main work permit workflow for the applicant.",
    },
    {
      form_key: "family_information",
      form_name: "Family information form",
      status: "Supporting",
      notes: "Usually needed where family/background details are required.",
    },
  ];

  const draft_answers = {
    permit_type: intake.permit_type || "",
    employer_name: intake.employer_name || "",
    job_title: intake.job_title || "",
    noc_code: intake.noc_code || "",
    province_of_work: intake.province_of_work || "",
    wage: intake.wage || "",
    current_status_in_canada: intake.current_status_in_canada || "",
    expires_on: intake.expires_on || "",
    lmia_available: intake.lmia_available ? "Yes" : "No",
    open_work_permit_basis: intake.open_work_permit_basis || "",
    accompanying_family: intake.accompanying_family ? "Yes" : "No",
  };

  if (!draft_answers.permit_type) missing_fields.push("Permit type");
  if (!draft_answers.job_title) missing_fields.push("Job title");
  if (!draft_answers.current_status_in_canada) {
    missing_fields.push("Current status in Canada");
  }

  if (
    draft_answers.permit_type.toLowerCase().includes("employer") &&
    !draft_answers.employer_name
  ) {
    missing_fields.push("Employer name");
  }

  if (
    draft_answers.permit_type.toLowerCase().includes("employer") &&
    draft_answers.lmia_available === "No"
  ) {
    missing_fields.push("LMIA or exemption confirmation");
  }

  if (
    draft_answers.permit_type.toLowerCase().includes("open") &&
    !draft_answers.open_work_permit_basis
  ) {
    missing_fields.push("Open work permit basis");
  }

  const preparation_notes = [
    "Confirm job, employer, and NOC details are consistent across documents.",
    "Review the applicant's current immigration status and expiry timeline carefully.",
    "Confirm whether this case is LMIA-based or LMIA-exempt where relevant.",
  ];

  if (intake.accompanying_family) {
    recommended_forms.push({
      form_key: "family_member_support",
      form_name: "Accompanying family support package",
      status: "Conditional",
      notes: "Family-related forms and supporting information may be required.",
    });
  }

  return {
    matter_type: "work_permit",
    package_title: "Work Permit Forms Assistant",
    recommended_forms,
    draft_answers,
    missing_fields,
    preparation_notes,
    summary:
      missing_fields.length === 0
        ? "The work permit forms package looks reasonably prepared from current intake."
        : "Some key work permit form fields still need to be completed or reviewed.",
  };
}

function buildSpousalSponsorshipFormsAssistant(intake = {}) {
  const missing_fields = [];
  const recommended_forms = [
    {
      form_key: "sponsorship_package_main",
      form_name: "Spousal sponsorship application package",
      status: "Primary",
      notes: "Main sponsorship workflow for sponsor and principal applicant.",
    },
    {
      form_key: "relationship_history",
      form_name: "Relationship history and evidence package",
      status: "Supporting",
      notes: "Relationship timeline and supporting evidence planning.",
    },
  ];

  const draft_answers = {
    sponsor_status: intake.sponsor_status || "",
    relationship_type: intake.relationship_type || "",
    relationship_start_date: intake.relationship_start_date || "",
    marriage_date: intake.marriage_date || "",
    cohabiting: intake.cohabiting ? "Yes" : "No",
    principal_applicant_country: intake.principal_applicant_country || "",
    dependent_children: intake.dependent_children ? "Yes" : "No",
    previous_marriage_or_sponsorship: intake.previous_marriage_or_sponsorship
      ? "Yes"
      : "No",
    police_certificates_ready: intake.police_certificates_ready ? "Yes" : "No",
    medicals_ready: intake.medicals_ready ? "Yes" : "No",
    proof_of_relationship_notes: intake.proof_of_relationship_notes || "",
  };

  if (!draft_answers.sponsor_status) missing_fields.push("Sponsor status");
  if (!draft_answers.relationship_type) missing_fields.push("Relationship type");
  if (!draft_answers.relationship_start_date) {
    missing_fields.push("Relationship start date");
  }
  if (
    draft_answers.relationship_type.toLowerCase().includes("spouse") &&
    !draft_answers.marriage_date
  ) {
    missing_fields.push("Marriage date");
  }
  if (!draft_answers.proof_of_relationship_notes) {
    missing_fields.push("Relationship evidence notes");
  }
  if (draft_answers.police_certificates_ready === "No") {
    missing_fields.push("Police certificate planning");
  }
  if (draft_answers.medicals_ready === "No") {
    missing_fields.push("Medical exam planning");
  }

  const preparation_notes = [
    "Ensure relationship history is consistent across all forms and evidence.",
    "Prepare a clean timeline of communication, visits, cohabitation, and major milestones.",
    "Review prior marriages, sponsorships, or dependent child issues carefully.",
  ];

  if (intake.dependent_children) {
    recommended_forms.push({
      form_key: "dependent_children_support",
      form_name: "Dependent children support package",
      status: "Conditional",
      notes: "Additional child-related supporting information may be required.",
    });
  }

  return {
    matter_type: "spousal_sponsorship",
    package_title: "Spousal Sponsorship Forms Assistant",
    recommended_forms,
    draft_answers,
    missing_fields,
    preparation_notes,
    summary:
      missing_fields.length === 0
        ? "The sponsorship forms package looks reasonably prepared from current intake."
        : "Some key sponsorship form fields still need to be completed or reviewed.",
  };
}

export function buildFormsAssistant(matterType, intake = {}, language = "en") {
  let result;

  if (matterType === "study_permit") {
    result = buildStudyPermitFormsAssistant(intake);
    return translateFormsAssistantValue(result, language);
  }

  if (matterType === "work_permit") {
    result = buildWorkPermitFormsAssistant(intake);
    return translateFormsAssistantValue(result, language);
  }

  if (matterType === "spousal_sponsorship") {
    result = buildSpousalSponsorshipFormsAssistant(intake);
    return translateFormsAssistantValue(result, language);
  }

  result = {
    matter_type: matterType || "unknown",
    package_title: "Forms Assistant",
    recommended_forms: [],
    draft_answers: {},
    missing_fields: ["Forms assistant has not been built for this matter type yet."],
    preparation_notes: [],
    summary: "No forms assistant is available for this matter type yet.",
  };

  return translateFormsAssistantValue(result, language);
}
