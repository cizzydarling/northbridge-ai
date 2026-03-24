import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { evaluateMatterEligibility } from "../utils/eligibilityEngine";
import { buildFormsAssistant } from "../utils/formsAssistant";
import {
  getClientById,
  getClientMatterById,
  getClientDocuments,
  updateClientMatter,
  updateClientDocument,
  generateMatterDocuments,
  uploadClientDocumentFile,
} from "../api";

const MATTER_TYPE_OPTIONS = [
  { value: "express_entry", label: "Express Entry" },
  { value: "pnp", label: "Provincial Nominee Program" },
  { value: "study_permit", label: "Study Permit" },
  { value: "work_permit", label: "Work Permit" },
  { value: "visitor_record", label: "Visitor Record" },
  { value: "spousal_sponsorship", label: "Spousal Sponsorship" },
  { value: "family_sponsorship_other", label: "Other Family Sponsorship" },
  { value: "refugee_claim", label: "Refugee Claim" },
  {
    value: "private_sponsorship_refugee",
    label: "Private Sponsorship of Refugee",
  },
  { value: "extension_restoration", label: "Extension / Restoration" },
];

const STATUS_OPTIONS = [
  "Open",
  "In Progress",
  "Waiting on Client",
  "Submitted",
  "Closed",
];

const DEFAULT_STUDY_PERMIT_INTAKE = {
  dli_name: "",
  school_name: "",
  program_name: "",
  intake_term: "",
  tuition_amount: "",
  proof_of_funds_available: false,
  sds_eligible: false,
  previous_refusal: false,
  gap_in_studies_explanation: "",
  accompanying_family: false,
  passport_valid: false,
};

const DEFAULT_WORK_PERMIT_INTAKE = {
  permit_type: "",
  employer_name: "",
  lmia_available: false,
  noc_code: "",
  job_title: "",
  wage: "",
  province_of_work: "",
  open_work_permit_basis: "",
  current_status_in_canada: "",
  expires_on: "",
  accompanying_family: false,
};

const DEFAULT_SPOUSAL_SPONSORSHIP_INTAKE = {
  sponsor_status: "",
  principal_applicant_country: "",
  relationship_type: "",
  cohabiting: false,
  relationship_start_date: "",
  marriage_date: "",
  dependent_children: false,
  previous_marriage_or_sponsorship: false,
  police_certificates_ready: false,
  medicals_ready: false,
  proof_of_relationship_notes: "",
};

function getDefaultIntakeByType(type) {
  if (type === "study_permit") return { ...DEFAULT_STUDY_PERMIT_INTAKE };
  if (type === "work_permit") return { ...DEFAULT_WORK_PERMIT_INTAKE };
  if (type === "spousal_sponsorship") {
    return { ...DEFAULT_SPOUSAL_SPONSORSHIP_INTAKE };
  }
  return {};
}

function mergeIntakeWithDefaults(type, existingPayload) {
  const defaults = getDefaultIntakeByType(type);
  return {
    ...defaults,
    ...(existingPayload || {}),
  };
}

function buildStudyPermitChecklist(values) {
  const items = [];

  items.push({
    id: "passport",
    name: "Passport / travel document",
    status: values.passport_valid ? "Required" : "Review",
    reason: values.passport_valid
      ? "Passport validity was marked as available."
      : "Passport validity is not confirmed yet and must be reviewed.",
  });

  items.push({
    id: "loa",
    name: "Letter of Acceptance",
    status: values.dli_name || values.school_name ? "Required" : "Review",
    reason:
      values.dli_name || values.school_name
        ? "A school or DLI was identified in intake."
        : "School/DLI information is incomplete. Acceptance documents should be confirmed.",
  });

  items.push({
    id: "tuition",
    name: "Tuition payment receipt or school fee statement",
    status: values.tuition_amount ? "Required" : "Recommended",
    reason: values.tuition_amount
      ? "Tuition amount was entered in intake."
      : "Tuition amount is not yet recorded, but fee evidence is normally important.",
  });

  items.push({
    id: "funds",
    name: "Proof of funds",
    status: values.proof_of_funds_available ? "Required" : "Review",
    reason: values.proof_of_funds_available
      ? "Funds were marked as available."
      : "Proof of funds has not been confirmed and needs review.",
  });

  items.push({
    id: "purpose_letter",
    name: "Study plan / letter of explanation",
    status: "Required",
    reason:
      "A study permit file usually needs a clear explanation of study purpose, school choice, and future plans.",
  });

  items.push({
    id: "education_docs",
    name: "Educational transcripts and certificates",
    status: "Required",
    reason:
      "Academic records support admissibility, program relevance, and prior study history.",
  });

  items.push({
    id: "language_docs",
    name: "Language test results (if applicable)",
    status: values.sds_eligible ? "Required" : "Recommended",
    reason: values.sds_eligible
      ? "SDS eligibility was marked, so language evidence becomes more important."
      : "Language evidence may still strengthen the file depending on program and school requirements.",
  });

  if (values.previous_refusal) {
    items.push({
      id: "refusal_docs",
      name: "Previous refusal letters and response strategy",
      status: "Required",
      reason:
        "Previous refusal was marked in intake, so prior refusal documents and a response strategy are needed.",
    });
  }

  if (values.gap_in_studies_explanation) {
    items.push({
      id: "gap_docs",
      name: "Gap explanation supporting documents",
      status: "Required",
      reason:
        "A study gap explanation was entered, so supporting proof should be collected.",
    });
  } else {
    items.push({
      id: "gap_review",
      name: "Study/work history continuity review",
      status: "Recommended",
      reason:
        "No study gap explanation is recorded yet. Review timeline continuity for possible concerns.",
    });
  }

  if (values.accompanying_family) {
    items.push({
      id: "family_docs",
      name: "Accompanying family documents",
      status: "Required",
      reason:
        "Accompanying family was marked in intake, so identity and relationship documents are needed.",
    });
  }

  if (values.sds_eligible) {
    items.push({
      id: "sds_package",
      name: "SDS-specific supporting package review",
      status: "Required",
      reason:
        "SDS eligibility was marked in intake and should be verified with supporting evidence.",
    });
  }

  return items;
}

function buildWorkPermitChecklist(values) {
  const items = [];

  items.push({
    id: "passport",
    name: "Passport / travel document",
    status: "Required",
    reason: "A valid passport is required for all work permit applications.",
  });

  if (values.permit_type?.toLowerCase().includes("employer")) {
    items.push({
      id: "job_offer",
      name: "Job offer letter",
      status: "Required",
      reason: "Employer-specific work permits require a formal job offer.",
    });

    items.push({
      id: "lmia",
      name: "LMIA or LMIA exemption proof",
      status: values.lmia_available ? "Required" : "Review",
      reason: values.lmia_available
        ? "LMIA was marked as available."
        : "LMIA status is unclear and must be confirmed.",
    });
  }

  if (values.permit_type?.toLowerCase().includes("open")) {
    items.push({
      id: "open_basis",
      name: "Open work permit eligibility proof",
      status: values.open_work_permit_basis ? "Required" : "Review",
      reason: values.open_work_permit_basis
        ? "Open work permit basis is defined."
        : "Open work permit basis must be confirmed.",
    });
  }

  items.push({
    id: "employment_docs",
    name: "Employment and experience documents",
    status: "Required",
    reason: "Work history and qualifications support the application.",
  });

  items.push({
    id: "resume",
    name: "Resume / CV",
    status: "Recommended",
    reason: "Provides a clear overview of work history.",
  });

  if (values.wage) {
    items.push({
      id: "wage_docs",
      name: "Wage and compensation documents",
      status: "Required",
      reason: "Wage details were provided and should be supported.",
    });
  }

  if (values.accompanying_family) {
    items.push({
      id: "family_docs",
      name: "Family member documents",
      status: "Required",
      reason:
        "Accompanying family requires identity and relationship proof.",
    });
  }

  items.push({
    id: "status_docs",
    name: "Current status documents (if inside Canada)",
    status: values.current_status_in_canada ? "Required" : "Review",
    reason: values.current_status_in_canada
      ? "Current status is recorded."
      : "Status in Canada must be verified.",
  });

  return items;
}

function buildSpousalSponsorshipChecklist(values) {
  const items = [];

  items.push({
    id: "passport",
    name: "Passport (applicant and sponsor)",
    status: "Required",
    reason: "Identity documents are required for both parties.",
  });

  items.push({
    id: "relationship_proof",
    name: "Proof of relationship",
    status: values.proof_of_relationship_notes ? "Required" : "Review",
    reason: values.proof_of_relationship_notes
      ? "Relationship proof strategy is noted."
      : "Relationship evidence must be clearly documented.",
  });

  if (values.relationship_type?.toLowerCase().includes("spouse")) {
    items.push({
      id: "marriage_certificate",
      name: "Marriage certificate",
      status: values.marriage_date ? "Required" : "Review",
      reason: values.marriage_date
        ? "Marriage date is recorded."
        : "Marriage certificate must be confirmed.",
    });
  }

  if (values.relationship_type?.toLowerCase().includes("common")) {
    items.push({
      id: "cohabitation_proof",
      name: "Proof of cohabitation",
      status: values.cohabiting ? "Required" : "Review",
      reason: values.cohabiting
        ? "Cohabitation is indicated."
        : "Common-law cases require strong cohabitation proof.",
    });
  }

  items.push({
    id: "police_certificates",
    name: "Police certificates",
    status: values.police_certificates_ready ? "Required" : "Review",
    reason: values.police_certificates_ready
      ? "Police certificates marked ready."
      : "Police certificates must be prepared.",
  });

  items.push({
    id: "medical_exam",
    name: "Medical examination",
    status: values.medicals_ready ? "Required" : "Review",
    reason: values.medicals_ready
      ? "Medical readiness confirmed."
      : "Medical exam must be scheduled.",
  });

  if (values.dependent_children) {
    items.push({
      id: "children_docs",
      name: "Dependent children documents",
      status: "Required",
      reason:
        "Children require identity and relationship proof.",
    });
  }

  if (values.previous_marriage_or_sponsorship) {
    items.push({
      id: "previous_relationship_docs",
      name: "Previous marriage/sponsorship documents",
      status: "Required",
      reason:
        "Previous relationships must be disclosed and documented.",
    });
  }

  items.push({
    id: "forms",
    name: "IRCC sponsorship forms",
    status: "Required",
    reason:
      "All sponsorship applications require official IRCC forms.",
  });

  return items;
}

export default function ClientMatterDetailPage() {
  const navigate = useNavigate();
  const { clientId, matterId } = useParams();
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const [client, setClient] = useState(null);
  const [matter, setMatter] = useState(null);
  const [matterDocuments, setMatterDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [runningEligibility, setRunningEligibility] = useState(false);
  const [runningFormsAssistant, setRunningFormsAssistant] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [verifyingDocId, setVerifyingDocId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    matter_type: "",
    title: "",
    status: "Open",
    target_program: "",
    country_of_residence: "",
    inside_canada: false,
    notes: "",
  });

  const [intakePayload, setIntakePayload] = useState({});
  const [eligibilityResult, setEligibilityResult] = useState({});
  const [formsAssistantResult, setFormsAssistantResult] = useState({});

  useEffect(() => {
    if (!clientId || !matterId) return;
    loadPage();
  }, [clientId, matterId]);

  async function loadMatterDocuments() {
    const docsRes = await getClientDocuments(clientId);
    const filteredDocs = (docsRes.data || []).filter(
      (doc) => Number(doc.matter_id) === Number(matterId)
    );
    setMatterDocuments(filteredDocs);
  }

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const [clientRes, matterRes] = await Promise.all([
        getClientById(clientId),
        getClientMatterById(clientId, matterId),
      ]);

      const matterData = matterRes.data;

      setClient(clientRes.data);
      setMatter(matterData);

      setForm({
        matter_type: matterData.matter_type || "study_permit",
        title: matterData.title || "",
        status: matterData.status || "Open",
        target_program: matterData.target_program || "",
        country_of_residence: matterData.country_of_residence || "",
        inside_canada: Boolean(matterData.inside_canada),
        notes: matterData.notes || "",
      });

      setIntakePayload(
        mergeIntakeWithDefaults(
          matterData.matter_type,
          matterData.intake_payload || {}
        )
      );

      setEligibilityResult(matterData.eligibility_result || {});
      setFormsAssistantResult(
        matterData?.eligibility_result?.forms_assistant || {}
      );

      await loadMatterDocuments();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load matter details.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "matter_type") {
        setIntakePayload((prevIntake) =>
          mergeIntakeWithDefaults(value, prevIntake)
        );
        setEligibilityResult({});
        setFormsAssistantResult({});
      }

      return next;
    });
  }

  function handleIntakeChange(field, value) {
    setIntakePayload((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSave(customEligibility = eligibilityResult) {
    if (!form.title.trim()) {
      setError("Matter title is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        matter_type: form.matter_type,
        title: form.title.trim(),
        status: form.status,
        target_program: form.target_program.trim() || null,
        country_of_residence: form.country_of_residence.trim() || null,
        inside_canada: Boolean(form.inside_canada),
        notes: form.notes.trim() || null,
        intake_payload: intakePayload,
        eligibility_result: customEligibility,
      };

      const res = await updateClientMatter(clientId, matterId, payload);
      const updatedMatter = res.data;

      setMatter(updatedMatter);
      setIntakePayload(
        mergeIntakeWithDefaults(
          updatedMatter.matter_type,
          updatedMatter.intake_payload || {}
        )
      );
      setEligibilityResult(updatedMatter.eligibility_result || {});
      setFormsAssistantResult(
        updatedMatter?.eligibility_result?.forms_assistant || {}
      );
      setMessage("Matter updated successfully.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to update matter.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunEligibilityAssessment() {
    try {
      setRunningEligibility(true);
      setError("");
      setMessage("");

      const baseEligibility = evaluateMatterEligibility(
        form.matter_type,
        intakePayload
      );

      const mergedEligibility = {
        ...baseEligibility,
        ...(formsAssistantResult &&
        Object.keys(formsAssistantResult).length > 0
          ? { forms_assistant: formsAssistantResult }
          : {}),
      };

      setEligibilityResult(mergedEligibility);
      await handleSave(mergedEligibility);
      setMessage("Eligibility assessment generated and saved successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to generate eligibility assessment.");
    } finally {
      setRunningEligibility(false);
    }
  }

  async function handleRunFormsAssistant() {
    try {
      setRunningFormsAssistant(true);
      setError("");
      setMessage("");

      const result = buildFormsAssistant(form.matter_type, intakePayload);
      setFormsAssistantResult(result);

      const updatedEligibility = {
        ...eligibilityResult,
        forms_assistant: result,
      };

      setEligibilityResult(updatedEligibility);
      await handleSave(updatedEligibility);

      setMessage("Forms Assistant generated and saved successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to run forms assistant.");
    } finally {
      setRunningFormsAssistant(false);
    }
  }

  async function handleGenerateDocuments() {
    try {
      setGeneratingDocs(true);
      setError("");
      setMessage("");

      let checklist = [];

      if (form.matter_type === "study_permit") {
        checklist = buildStudyPermitChecklist(intakePayload);
      } else if (form.matter_type === "work_permit") {
        checklist = buildWorkPermitChecklist(intakePayload);
      } else if (form.matter_type === "spousal_sponsorship") {
        checklist = buildSpousalSponsorshipChecklist(intakePayload);
      } else {
        setError("Checklist generation not available for this matter type yet.");
        return;
      }

      const payload = {
        documents: checklist.map((item) => ({
          document_name: item.name,
          document_type: item.id,
          notes: item.reason,
          required: item.status === "Required",
        })),
      };

      await generateMatterDocuments(clientId, matterId, payload);
      await loadMatterDocuments();
      setMessage("Checklist saved to client documents successfully.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to generate document tasks.");
    } finally {
      setGeneratingDocs(false);
    }
  }

  async function handleUploadDocument(documentId, file) {
    if (!file) return;

    try {
      setUploadingDocId(documentId);
      setError("");
      setMessage("");

      await uploadClientDocumentFile(clientId, documentId, file);
      await loadMatterDocuments();
      setMessage("File uploaded successfully.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploadingDocId(null);
    }
  }

  async function handleVerifyMatterDocument(doc) {
    try {
      setVerifyingDocId(doc.id);
      setError("");
      setMessage("");

      await updateClientDocument(clientId, doc.id, {
        document_name: doc.document_name,
        document_type: doc.document_type || null,
        status: "Verified",
        notes: doc.notes || null,
        matter_id: doc.matter_id || null,
        required: Boolean(doc.required),
        generated_from_matter: Boolean(doc.generated_from_matter),
      });

      await loadMatterDocuments();
      setMessage("Document verified successfully.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to verify document.");
    } finally {
      setVerifyingDocId(null);
    }
  }

  async function handleUnverifyMatterDocument(doc) {
    try {
      setVerifyingDocId(doc.id);
      setError("");
      setMessage("");

      await updateClientDocument(clientId, doc.id, {
        document_name: doc.document_name,
        document_type: doc.document_type || null,
        status: doc.file_url ? "Uploaded" : "Required",
        notes: doc.notes || null,
        matter_id: doc.matter_id || null,
        required: Boolean(doc.required),
        generated_from_matter: Boolean(doc.generated_from_matter),
      });

      await loadMatterDocuments();
      setMessage("Document verification removed.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to remove verification.");
    } finally {
      setVerifyingDocId(null);
    }
  }

  const matterLabel = useMemo(() => {
    const match = MATTER_TYPE_OPTIONS.find(
      (item) => item.value === matter?.matter_type
    );
    return match ? match.label : matter?.matter_type || "-";
  }, [matter]);

  const intakeSummary = useMemo(() => {
    if (form.matter_type === "study_permit") {
      const checks = [
        intakePayload.dli_name,
        intakePayload.program_name,
        intakePayload.intake_term,
        intakePayload.tuition_amount,
        intakePayload.passport_valid,
      ];
      return `${checks.filter(Boolean).length}/5 key fields completed`;
    }

    if (form.matter_type === "work_permit") {
      const checks = [
        intakePayload.permit_type,
        intakePayload.employer_name,
        intakePayload.job_title,
        intakePayload.province_of_work,
        intakePayload.current_status_in_canada,
      ];
      return `${checks.filter(Boolean).length}/5 key fields completed`;
    }

    if (form.matter_type === "spousal_sponsorship") {
      const checks = [
        intakePayload.sponsor_status,
        intakePayload.relationship_type,
        intakePayload.relationship_start_date,
        intakePayload.police_certificates_ready,
        intakePayload.medicals_ready,
      ];
      return `${checks.filter(Boolean).length}/5 key fields completed`;
    }

    return "Generic matter setup";
  }, [form.matter_type, intakePayload]);

  const currentChecklist = useMemo(() => {
    if (form.matter_type === "study_permit") {
      return buildStudyPermitChecklist(intakePayload);
    }

    if (form.matter_type === "work_permit") {
      return buildWorkPermitChecklist(intakePayload);
    }

    if (form.matter_type === "spousal_sponsorship") {
      return buildSpousalSponsorshipChecklist(intakePayload);
    }

    return [];
  }, [form.matter_type, intakePayload]);

  const checklistTitle = useMemo(() => {
    if (form.matter_type === "study_permit") {
      return "Generated Study Permit Checklist";
    }
    if (form.matter_type === "work_permit") {
      return "Generated Work Permit Checklist";
    }
    if (form.matter_type === "spousal_sponsorship") {
      return "Generated Spousal Sponsorship Checklist";
    }
    return "Generated Checklist";
  }, [form.matter_type]);

  const matterDocumentStats = useMemo(() => {
    const total = matterDocuments.length;
    const required = matterDocuments.filter((doc) => doc.required).length;
    const uploaded = matterDocuments.filter(
      (doc) => normalizeDocumentStatus(doc.status, doc.required) === "Uploaded"
    ).length;
    const verified = matterDocuments.filter(
      (doc) => normalizeDocumentStatus(doc.status, doc.required) === "Verified"
    ).length;
    const verifiedRequired = matterDocuments.filter(
      (doc) =>
        doc.required &&
        normalizeDocumentStatus(doc.status, doc.required) === "Verified"
    ).length;
    const percent =
      required > 0 ? Math.round((verifiedRequired / required) * 100) : 0;

    return {
      total,
      required,
      uploaded,
      verified,
      verifiedRequired,
      percent,
    };
  }, [matterDocuments]);

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-slate-700">Loading matter details...</div>
      </Layout>
    );
  }

  if (!client || !matter) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-red-600">{error || "Matter not found."}</p>
          <button
            onClick={() => navigate(`/clients/${clientId}/matters`)}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Back to Matters
          </button>
        </div>
      </Layout>
    );
  }

  const readinessTone =
    eligibilityResult?.readiness === "Strong"
      ? "green"
      : eligibilityResult?.readiness === "Moderate"
      ? "amber"
      : "red";

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
              <h1 className="text-3xl font-bold text-slate-900">Matter Details</h1>
              <p className="mt-2 text-slate-600">
                Client:{" "}
                <span className="font-semibold">
                  {client.full_name || `Client #${client.id}`}
                </span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  navigate(
                    `/legal/acceptance?client_id=${clientId}&matter_id=${matterId}&redirect=/clients/${clientId}/matters/${matterId}`
                  )
                }
                className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Legal Acceptance
              </button>
              <button
                onClick={() => navigate(`/clients/${clientId}/matters`)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Back to Matters
              </button>
            </div>
          </div>

          {message ? (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <StatCard label="Matter Type" value={matterLabel} small />
            <StatCard label="Status" value={form.status || "-"} small />
            <StatCard
              label="Inside Canada"
              value={
                form.inside_canada === true
                  ? "Yes"
                  : form.inside_canada === false
                  ? "No"
                  : "-"
              }
              small
            />
            <StatCard label="Intake Progress" value={intakeSummary} small />
            <StatCard
              label="Docs Verified"
              value={`${matterDocumentStats.verifiedRequired}/${matterDocumentStats.required}`}
              small
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-2">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Matter Setup
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Matter Type
                  </label>
                  <select
                    value={form.matter_type}
                    onChange={(e) => handleChange("matter_type", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {MATTER_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Title
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Target Program
                  </label>
                  <input
                    type="text"
                    value={form.target_program}
                    onChange={(e) => handleChange("target_program", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Country of Residence
                  </label>
                  <input
                    type="text"
                    value={form.country_of_residence}
                    onChange={(e) =>
                      handleChange("country_of_residence", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <div className="flex items-center gap-3 pt-7">
                  <input
                    type="checkbox"
                    checked={form.inside_canada}
                    onChange={(e) => handleChange("inside_canada", e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">Inside Canada</span>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Matter Snapshot
              </h2>

              <div className="mt-4 space-y-3">
                <InfoBox label="Type" value={matterLabel} />
                <InfoBox label="Status" value={form.status || "-"} />
                <InfoBox label="Target Program" value={form.target_program || "-"} />
                <InfoBox
                  label="Updated"
                  value={
                    matter.updated_at
                      ? new Date(matter.updated_at).toLocaleString()
                      : "-"
                  }
                />
                <InfoBox
                  label="Document Completion"
                  value={`${matterDocumentStats.percent}%`}
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Matter"}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              Program-Specific Intake
            </h2>

            {form.matter_type === "study_permit" ? (
              <StudyPermitIntake
                values={intakePayload}
                onChange={handleIntakeChange}
              />
            ) : null}

            {form.matter_type === "work_permit" ? (
              <WorkPermitIntake
                values={intakePayload}
                onChange={handleIntakeChange}
              />
            ) : null}

            {form.matter_type === "spousal_sponsorship" ? (
              <SpousalSponsorshipIntake
                values={intakePayload}
                onChange={handleIntakeChange}
              />
            ) : null}

            {!["study_permit", "work_permit", "spousal_sponsorship"].includes(
              form.matter_type
            ) ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">
                  Dynamic intake for this matter type has not been built yet.
                  Start with the matter setup above, then add specific intake in the
                  next phase.
                </p>
              </div>
            ) : null}
          </div>

          {["study_permit", "work_permit", "spousal_sponsorship"].includes(
            form.matter_type
          ) ? (
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {checklistTitle}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    This checklist is generated from the current intake answers.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      navigate(`/clients/${clientId}/documents?matter_id=${matterId}`)
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open Matter Documents
                  </button>
                  <button
                    onClick={handleGenerateDocuments}
                    disabled={generatingDocs}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {generatingDocs ? "Saving..." : "Save Checklist to Documents"}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {currentChecklist.map((item) => (
                  <ChecklistItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Matter Documents
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Upload, verify, and manage documents linked to this matter.
                </p>
              </div>

              <button
                onClick={() =>
                  navigate(`/clients/${clientId}/documents?matter_id=${matterId}`)
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Open Full Documents Page
              </button>
            </div>

            <div className="mb-4 grid gap-4 md:grid-cols-5">
              <StatCard label="Total Docs" value={matterDocumentStats.total} small />
              <StatCard
                label="Required"
                value={matterDocumentStats.required}
                small
              />
              <StatCard
                label="Uploaded"
                value={matterDocumentStats.uploaded}
                small
              />
              <StatCard
                label="Verified"
                value={matterDocumentStats.verified}
                small
              />
              <StatCard
                label="Completion"
                value={`${matterDocumentStats.percent}%`}
                small
              />
            </div>

            {matterDocumentStats.required > 0 ? (
              <div className="mb-6 h-3 w-full rounded-full bg-slate-200">
                <div
                  className="h-3 rounded-full bg-slate-900 transition-all"
                  style={{ width: `${matterDocumentStats.percent}%` }}
                />
              </div>
            ) : null}

            {matterDocuments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No documents generated yet. Click “Save Checklist to Documents” above.
              </div>
            ) : (
              <div className="space-y-3">
                {matterDocuments.map((doc) => {
                  const normalizedStatus = normalizeDocumentStatus(
                    doc.status,
                    doc.required
                  );
                  const canVerify = Boolean(doc.file_url);

                  return (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-900">
                              {doc.document_name}
                            </p>
                            <DocumentStatusBadge status={normalizedStatus} />
                            {doc.required ? (
                              <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                                Required
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                Optional
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-slate-500">
                            Type: {doc.document_type || "-"}
                          </p>

                          <p className="mt-2 text-sm text-slate-700">
                            {doc.notes || "No notes added."}
                          </p>

                          {doc.file_name ? (
                            <div className="mt-3 space-y-1">
                              <p className="text-sm text-green-700">
                                Uploaded: {doc.file_name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {doc.uploaded_at
                                  ? `Uploaded ${new Date(doc.uploaded_at).toLocaleString()}`
                                  : ""}
                              </p>
                              {doc.file_url ? (
                                <a
                                  href={`${apiBaseUrl}${doc.file_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block text-sm font-medium text-blue-700 hover:underline"
                                >
                                  Open File
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-red-500">
                              No file uploaded
                            </p>
                          )}

                          {doc.verified_at ? (
                            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                              <p className="text-sm font-medium text-green-800">
                                Verified
                              </p>
                              <p className="mt-1 text-xs text-green-700">
                                Verified at:{" "}
                                {new Date(doc.verified_at).toLocaleString()}
                              </p>
                              <p className="mt-1 text-xs text-green-700">
                                Verified by user ID: {doc.verified_by || "-"}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex min-w-[240px] flex-col gap-2">
                          <input
                            type="file"
                            onChange={(e) =>
                              handleUploadDocument(doc.id, e.target.files?.[0])
                            }
                            className="text-xs"
                          />

                          {uploadingDocId === doc.id ? (
                            <span className="text-xs text-slate-500">
                              Uploading...
                            </span>
                          ) : null}

                          {normalizedStatus !== "Verified" ? (
                            <button
                              onClick={() => handleVerifyMatterDocument(doc)}
                              disabled={!canVerify || verifyingDocId === doc.id}
                              className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                            >
                              {verifyingDocId === doc.id
                                ? "Verifying..."
                                : "Verify"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnverifyMatterDocument(doc)}
                              disabled={verifyingDocId === doc.id}
                              className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              {verifyingDocId === doc.id
                                ? "Updating..."
                                : "Unverify"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Eligibility Workspace
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Generate a first-pass readiness assessment from intake answers.
                  </p>
                </div>

                <button
                  onClick={handleRunEligibilityAssessment}
                  disabled={runningEligibility}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {runningEligibility ? "Assessing..." : "Run Eligibility Assessment"}
                </button>
              </div>

              {!eligibilityResult || Object.keys(eligibilityResult).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm text-slate-600">
                    No eligibility result generated yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ResultMetric
                      label="Readiness Score"
                      value={eligibilityResult.score ?? "-"}
                    />
                    <ReadinessBadge
                      label="Overall Readiness"
                      value={eligibilityResult.readiness || "-"}
                      tone={readinessTone}
                    />
                  </div>

                  <ResultList
                    title="Strengths"
                    items={eligibilityResult.strengths || []}
                  />
                  <ResultList
                    title="Concerns"
                    items={eligibilityResult.concerns || []}
                  />
                  <ResultList
                    title="Recommended Next Steps"
                    items={eligibilityResult.next_steps || []}
                  />
                  <ResultList
                    title="Category Hints"
                    items={eligibilityResult.category_hints || []}
                  />
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Forms Assistant
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Generate forms guidance, draft answers, and preparation notes
                    from the current intake.
                  </p>
                </div>

                <button
                  onClick={handleRunFormsAssistant}
                  disabled={runningFormsAssistant}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {runningFormsAssistant ? "Running..." : "Run Forms Assistant"}
                </button>
              </div>

              {!formsAssistantResult ||
              Object.keys(formsAssistantResult).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm text-slate-600">
                    No forms assistant result generated yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formsAssistantResult.summary ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Summary
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {formsAssistantResult.summary}
                      </p>
                    </div>
                  ) : null}

                  <RecommendedFormsList
                    items={formsAssistantResult.recommended_forms || []}
                  />

                  <DraftAnswersCard
                    values={formsAssistantResult.draft_answers || {}}
                  />

                  <ResultList
                    title="Missing Fields"
                    items={formsAssistantResult.missing_fields || []}
                  />

                  <ResultList
                    title="Preparation Notes"
                    items={formsAssistantResult.preparation_notes || []}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Next Workflow Targets
            </h2>

            <div className="mt-4 space-y-3">
              <WorkflowCard
                title="Disclosure Gate"
                text="Require legal and AI disclaimer acceptance before advanced assistance."
              />
              <WorkflowCard
                title="Saved Document Workflow"
                text="Generated checklist items now become client document tasks linked to the matter."
              />
              <WorkflowCard
                title="Forms Assistant"
                text="Map intake answers to relevant IRCC forms and draft responses."
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StudyPermitIntake({ values, onChange }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField
        label="DLI Name"
        value={values.dli_name || ""}
        onChange={(value) => onChange("dli_name", value)}
      />
      <InputField
        label="School Name"
        value={values.school_name || ""}
        onChange={(value) => onChange("school_name", value)}
      />
      <InputField
        label="Program Name"
        value={values.program_name || ""}
        onChange={(value) => onChange("program_name", value)}
      />
      <InputField
        label="Intake Term"
        value={values.intake_term || ""}
        onChange={(value) => onChange("intake_term", value)}
        placeholder="Example: Fall 2026"
      />
      <InputField
        label="Tuition Amount"
        value={values.tuition_amount || ""}
        onChange={(value) => onChange("tuition_amount", value)}
      />
      <TextAreaField
        label="Gap in Studies Explanation"
        value={values.gap_in_studies_explanation || ""}
        onChange={(value) => onChange("gap_in_studies_explanation", value)}
      />

      <CheckboxField
        label="Proof of Funds Available"
        checked={Boolean(values.proof_of_funds_available)}
        onChange={(value) => onChange("proof_of_funds_available", value)}
      />
      <CheckboxField
        label="SDS Eligible"
        checked={Boolean(values.sds_eligible)}
        onChange={(value) => onChange("sds_eligible", value)}
      />
      <CheckboxField
        label="Previous Refusal"
        checked={Boolean(values.previous_refusal)}
        onChange={(value) => onChange("previous_refusal", value)}
      />
      <CheckboxField
        label="Accompanying Family"
        checked={Boolean(values.accompanying_family)}
        onChange={(value) => onChange("accompanying_family", value)}
      />
      <CheckboxField
        label="Passport Valid"
        checked={Boolean(values.passport_valid)}
        onChange={(value) => onChange("passport_valid", value)}
      />
    </div>
  );
}

function WorkPermitIntake({ values, onChange }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField
        label="Permit Type"
        value={values.permit_type || ""}
        onChange={(value) => onChange("permit_type", value)}
        placeholder="Employer-specific / Open"
      />
      <InputField
        label="Employer Name"
        value={values.employer_name || ""}
        onChange={(value) => onChange("employer_name", value)}
      />
      <InputField
        label="Job Title"
        value={values.job_title || ""}
        onChange={(value) => onChange("job_title", value)}
      />
      <InputField
        label="NOC Code"
        value={values.noc_code || ""}
        onChange={(value) => onChange("noc_code", value)}
      />
      <InputField
        label="Wage"
        value={values.wage || ""}
        onChange={(value) => onChange("wage", value)}
      />
      <InputField
        label="Province of Work"
        value={values.province_of_work || ""}
        onChange={(value) => onChange("province_of_work", value)}
      />
      <InputField
        label="Open Work Permit Basis"
        value={values.open_work_permit_basis || ""}
        onChange={(value) => onChange("open_work_permit_basis", value)}
      />
      <InputField
        label="Current Status in Canada"
        value={values.current_status_in_canada || ""}
        onChange={(value) => onChange("current_status_in_canada", value)}
      />
      <InputField
        label="Expires On"
        value={values.expires_on || ""}
        onChange={(value) => onChange("expires_on", value)}
        placeholder="YYYY-MM-DD"
      />

      <CheckboxField
        label="LMIA Available"
        checked={Boolean(values.lmia_available)}
        onChange={(value) => onChange("lmia_available", value)}
      />
      <CheckboxField
        label="Accompanying Family"
        checked={Boolean(values.accompanying_family)}
        onChange={(value) => onChange("accompanying_family", value)}
      />
    </div>
  );
}

function SpousalSponsorshipIntake({ values, onChange }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField
        label="Sponsor Status"
        value={values.sponsor_status || ""}
        onChange={(value) => onChange("sponsor_status", value)}
        placeholder="Citizen / PR"
      />
      <InputField
        label="Principal Applicant Country"
        value={values.principal_applicant_country || ""}
        onChange={(value) => onChange("principal_applicant_country", value)}
      />
      <InputField
        label="Relationship Type"
        value={values.relationship_type || ""}
        onChange={(value) => onChange("relationship_type", value)}
        placeholder="Spouse / Common-law"
      />
      <InputField
        label="Relationship Start Date"
        value={values.relationship_start_date || ""}
        onChange={(value) => onChange("relationship_start_date", value)}
        placeholder="YYYY-MM-DD"
      />
      <InputField
        label="Marriage Date"
        value={values.marriage_date || ""}
        onChange={(value) => onChange("marriage_date", value)}
        placeholder="YYYY-MM-DD"
      />
      <TextAreaField
        label="Proof of Relationship Notes"
        value={values.proof_of_relationship_notes || ""}
        onChange={(value) => onChange("proof_of_relationship_notes", value)}
      />

      <CheckboxField
        label="Cohabiting"
        checked={Boolean(values.cohabiting)}
        onChange={(value) => onChange("cohabiting", value)}
      />
      <CheckboxField
        label="Dependent Children"
        checked={Boolean(values.dependent_children)}
        onChange={(value) => onChange("dependent_children", value)}
      />
      <CheckboxField
        label="Previous Marriage or Sponsorship"
        checked={Boolean(values.previous_marriage_or_sponsorship)}
        onChange={(value) => onChange("previous_marriage_or_sponsorship", value)}
      />
      <CheckboxField
        label="Police Certificates Ready"
        checked={Boolean(values.police_certificates_ready)}
        onChange={(value) => onChange("police_certificates_ready", value)}
      />
      <CheckboxField
        label="Medicals Ready"
        checked={Boolean(values.medicals_ready)}
        onChange={(value) => onChange("medicals_ready", value)}
      />
    </div>
  );
}

function ChecklistItem({ item }) {
  const badgeClass =
    item.status === "Required"
      ? "bg-red-50 text-red-700 border-red-200"
      : item.status === "Recommended"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
        </div>

        <span
          className={`rounded-full border px-2 py-1 text-xs font-medium ${badgeClass}`}
        >
          {item.status}
        </span>
      </div>
    </div>
  );
}

function RecommendedFormsList({ items }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Recommended Forms</h3>

      {items.length > 0 ? (
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.form_key || item.form_name || "form"}-${index}`}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {item.form_name || item.form_key || "Form"}
                </p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                  {item.status || "Info"}
                </span>
              </div>

              {item.notes ? (
                <p className="mt-2 text-sm text-slate-600">{item.notes}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No forms listed.</p>
      )}
    </div>
  );
}

function DraftAnswersCard({ values }) {
  const entries = Object.entries(values || {});

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Draft Answers</h3>

      {entries.length > 0 ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {formatDraftAnswerLabel(key)}
              </p>
              <p className="mt-2 text-sm text-slate-900">
                {String(value || "-")}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No draft answers generated.</p>
      )}
    </div>
  );
}

function ResultMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ReadinessBadge({ label, value, tone = "red" }) {
  const toneClasses =
    tone === "green"
      ? "bg-green-50 text-green-700 border-green-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ResultList({ title, items }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <li
              key={index}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {item}
            </li>
          ))
        ) : (
          <li className="text-sm text-slate-500">None listed.</li>
        )}
      </ul>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = "" }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange }) {
  return (
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </div>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function StatCard({ label, value, small = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 font-bold text-slate-900 ${small ? "text-xl" : "text-3xl"}`}>
        {value}
      </p>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function WorkflowCard({ title, text }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function DocumentStatusBadge({ status }) {
  const normalized = status || "Required";
  const classes =
    normalized === "Verified"
      ? "bg-green-50 text-green-700 border-green-200"
      : normalized === "Uploaded"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>
      {normalized}
    </span>
  );
}

function normalizeDocumentStatus(status, required = true) {
  const value = String(status || "").trim();

  if (value === "Required" || value === "Uploaded" || value === "Verified") {
    return value;
  }

  if (value === "Completed" || value === "Reviewed") {
    return "Verified";
  }

  if (value === "Received" || value === "In Progress") {
    return "Uploaded";
  }

  if (value === "Requested" || value === "Not Started") {
    return required ? "Required" : "Uploaded";
  }

  return required ? "Required" : "Uploaded";
}

function formatDraftAnswerLabel(value) {
  return value.replace(/_/g, " ");
}