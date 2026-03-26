import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import DisclosureAcceptanceModal from "../components/DisclosureAcceptanceModal";

import {
  getMyProfile,
  createProfile,
  updateMyProfile,
  getMyStrategy,
  runSelfWorkspace,
  getSavedSelfApplication,
} from "../api";

const APPLICATION_TYPE_OPTIONS = [
  {
    value: "permanent_residence",
    labelKey: "programs.permanentResidence",
    defaultLabel: "Permanent Residence",
  },
  {
    value: "study_permit",
    labelKey: "programs.studyPermit",
    defaultLabel: "Study Permit",
  },
  {
    value: "work_permit",
    labelKey: "programs.workPermit",
    defaultLabel: "Work Permit",
  },
  {
    value: "spousal_sponsorship",
    labelKey: "programs.spousalSponsorship",
    defaultLabel: "Spousal Sponsorship",
  },
];

const READINESS_KEY_MAP = {
  Strong: "strong",
  Moderate: "moderate",
  Weak: "weak",
};

const DEFAULT_PROFILE_FORM = {
  age: "",
  education: "",
  language_score: "",
  experience_years: "",
  has_job_offer: false,
  has_canadian_experience: false,
  studied_in_canada: false,
  occupation: "",
  noc_code: "",
  preferred_province: "",
};

const DEFAULT_PERMANENT_RESIDENCE_INTAKE = {};

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
  if (type === "permanent_residence") {
    return { ...DEFAULT_PERMANENT_RESIDENCE_INTAKE };
  }
  if (type === "study_permit") return { ...DEFAULT_STUDY_PERMIT_INTAKE };
  if (type === "work_permit") return { ...DEFAULT_WORK_PERMIT_INTAKE };
  if (type === "spousal_sponsorship") {
    return { ...DEFAULT_SPOUSAL_SPONSORSHIP_INTAKE };
  }
  return {};
}

function mergeIntakeWithDefaults(type, payload) {
  return {
    ...getDefaultIntakeByType(type),
    ...(payload || {}),
  };
}

export default function SelfApplicationPage() {
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [runningWorkspace, setRunningWorkspace] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showDisclosure, setShowDisclosure] = useState(false);
  const [profileExists, setProfileExists] = useState(false);

  const [profileForm, setProfileForm] = useState(DEFAULT_PROFILE_FORM);
  const [applicationType, setApplicationType] = useState("permanent_residence");
  const [intakePayload, setIntakePayload] = useState(
    getDefaultIntakeByType("permanent_residence")
  );

  const [eligibilityResult, setEligibilityResult] = useState({});
  const [formsAssistantResult, setFormsAssistantResult] = useState({});
  const [checklist, setChecklist] = useState([]);
  const [strategyData, setStrategyData] = useState(null);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const [profileRes, strategyRes, savedAppRes] = await Promise.allSettled([
        getMyProfile(),
        getMyStrategy(),
        getSavedSelfApplication(),
      ]);

      if (profileRes.status === "fulfilled") {
        const profile = profileRes.value.data;
        setProfileExists(true);
        setProfileForm({
          age: profile.age ?? "",
          education: profile.education ?? "",
          language_score: profile.language_score ?? "",
          experience_years: profile.experience_years ?? "",
          has_job_offer: Boolean(profile.has_job_offer),
          has_canadian_experience: Boolean(profile.has_canadian_experience),
          studied_in_canada: Boolean(profile.studied_in_canada),
          occupation: profile.occupation ?? "",
          noc_code: profile.noc_code ?? "",
          preferred_province: profile.preferred_province ?? "",
        });
      }

      if (strategyRes.status === "fulfilled") {
        setStrategyData(strategyRes.value.data);
      }

      if (savedAppRes.status === "fulfilled") {
        const app = savedAppRes.value.data;
        const savedType = app.matter_type || "permanent_residence";
        setApplicationType(savedType);
        setIntakePayload(
          mergeIntakeWithDefaults(savedType, app.intake_payload || {})
        );

        const savedEligibility = app.eligibility_result || {};
        const savedPathways = Array.isArray(app.pathways_result)
          ? app.pathways_result
          : Array.isArray(savedEligibility.pathways)
          ? savedEligibility.pathways
          : [];

        setEligibilityResult({
          ...savedEligibility,
          pathways: savedPathways,
        });

        setFormsAssistantResult(app.forms_result || {});
        setChecklist(
          Array.isArray(app.checklist_result) ? app.checklist_result : []
        );
      }
    } catch (err) {
      console.error(err);
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  }

  function handleProfileChange(field, value) {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleApplicationTypeChange(nextType) {
    setApplicationType(nextType);
    setIntakePayload(getDefaultIntakeByType(nextType));
    setEligibilityResult({});
    setFormsAssistantResult({});
    setChecklist([]);
    setMessage("");
    setError("");
  }

  function handleIntakeChange(field, value) {
    setIntakePayload((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSaveProfile() {
    try {
      setSavingProfile(true);
      setMessage("");
      setError("");

      const payload = {
        age: profileForm.age === "" ? null : Number(profileForm.age),
        education: profileForm.education || null,
        language_score:
          profileForm.language_score === ""
            ? null
            : Number(profileForm.language_score),
        experience_years:
          profileForm.experience_years === ""
            ? null
            : Number(profileForm.experience_years),
        has_job_offer: Boolean(profileForm.has_job_offer),
        has_canadian_experience: Boolean(profileForm.has_canadian_experience),
        studied_in_canada: Boolean(profileForm.studied_in_canada),
        occupation: profileForm.occupation || null,
        noc_code: profileForm.noc_code || null,
        preferred_province: profileForm.preferred_province || null,
      };

      if (profileExists) {
        await updateMyProfile(payload);
      } else {
        await createProfile(payload);
        setProfileExists(true);
      }

      setMessage(t("profile.profileSaved"));
    } catch (err) {
      console.error(err);
      setError(t("errors.generic"));
    } finally {
      setSavingProfile(false);
    }
  }

  function handleRunWorkspace() {
    setShowDisclosure(true);
  }

  async function runWorkspaceAfterDisclosure() {
    try {
      setRunningWorkspace(true);
      setMessage("");
      setError("");

      const res = await runSelfWorkspace(
        {
          matter_type: applicationType,
          intake: intakePayload,
        },
        i18n.language
      );

      const responseData = res.data || {};
      const responseEligibility = responseData.eligibility || {};
      const responsePathways = Array.isArray(responseData.pathways)
        ? responseData.pathways
        : Array.isArray(responseEligibility.pathways)
        ? responseEligibility.pathways
        : [];

      setEligibilityResult({
        ...responseEligibility,
        pathways: responsePathways,
      });

      setFormsAssistantResult(responseData.forms_assistant || {});
      setChecklist(Array.isArray(responseData.checklist) ? responseData.checklist : []);

      setMessage(t("selfApplication.messages.guidanceGenerated"));
    } catch (err) {
      console.error(err);
      setError(t("errors.generic"));
    } finally {
      setRunningWorkspace(false);
    }
  }

  const readinessLabel = useMemo(() => {
    const raw = eligibilityResult?.readiness;
    if (!raw) return t("selfApplication.notGenerated");
    const key = READINESS_KEY_MAP[raw];
    return key ? t(`selfApplication.readinessValues.${key}`) : raw;
  }, [eligibilityResult, t]);

  const activePathways = useMemo(() => {
    const eligibilityPathways = Array.isArray(eligibilityResult?.pathways)
      ? eligibilityResult.pathways
      : [];

    if (eligibilityPathways.length > 0) {
      return eligibilityPathways;
    }

    if (applicationType === "permanent_residence") {
      return Array.isArray(strategyData?.recommended_programs)
        ? strategyData.recommended_programs
        : [];
    }

    return [];
  }, [eligibilityResult, strategyData, applicationType]);

  const summaryCards = useMemo(() => {
    const selectedType = APPLICATION_TYPE_OPTIONS.find(
      (item) => item.value === applicationType
    );

    return [
      {
        label: t("selfApplication.cards.applicationType"),
        value: selectedType
          ? t(selectedType.labelKey, { defaultValue: selectedType.defaultLabel })
          : "-",
      },
      {
        label: t("selfApplication.cards.guidanceStatus"),
        value:
          Object.keys(eligibilityResult || {}).length > 0
            ? t("selfApplication.ready")
            : t("selfApplication.notGenerated"),
      },
      {
        label: t("selfApplication.cards.documentsLikelyNeeded"),
        value: checklist.length,
      },
      {
        label: t("selfApplication.cards.strategy"),
        value: strategyData
          ? t("selfApplication.available")
          : t("selfApplication.pending"),
      },
    ];
  }, [applicationType, eligibilityResult, checklist.length, strategyData, t]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <p className="text-slate-600">{t("common.loading")}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-6 py-8 text-white shadow-xl md:px-8 md:py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-200">
                  {t("app.name")}
                </p>
                <h1 className="mt-2 text-3xl font-bold">
                  {t("layout.myApplication")}
                </h1>
                <p className="mt-2 max-w-xl text-sm text-blue-100">
                  {t("selfApplication.subtitle")}
                </p>
              </div>

              <div className="w-full md:w-56">
                <select
                  value={i18n.language}
                  onChange={(e) => switchLanguage(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white backdrop-blur-sm outline-none"
                >
                  <option value="en" className="text-slate-900">
                    {t("common.english")}
                  </option>
                  <option value="fr" className="text-slate-900">
                    {t("common.french")}
                  </option>
                </select>
              </div>
            </div>
          </section>

          {message ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-4">
            {summaryCards.map((card) => (
              <SummaryCard key={card.label} label={card.label} value={card.value} />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {t("profile.title")}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {t("selfApplication.profileHelp")}
                  </p>
                </div>

                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? t("common.saving") : t("profile.saveProfile")}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label={t("profile.age")}
                  value={profileForm.age}
                  onChange={(value) => handleProfileChange("age", value)}
                />
                <InputField
                  label={t("profile.education")}
                  value={profileForm.education}
                  onChange={(value) => handleProfileChange("education", value)}
                />
                <InputField
                  label={t("profile.languageScore")}
                  value={profileForm.language_score}
                  onChange={(value) => handleProfileChange("language_score", value)}
                />
                <InputField
                  label={t("profile.experienceYears")}
                  value={profileForm.experience_years}
                  onChange={(value) => handleProfileChange("experience_years", value)}
                />
                <InputField
                  label={t("profile.occupation")}
                  value={profileForm.occupation}
                  onChange={(value) => handleProfileChange("occupation", value)}
                />
                <InputField
                  label={t("profile.nocCode")}
                  value={profileForm.noc_code}
                  onChange={(value) => handleProfileChange("noc_code", value)}
                />
                <InputField
                  label={t("profile.province")}
                  value={profileForm.preferred_province}
                  onChange={(value) => handleProfileChange("preferred_province", value)}
                />

                <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
                  <CheckboxField
                    label={t("profile.hasJobOffer")}
                    checked={Boolean(profileForm.has_job_offer)}
                    onChange={(value) => handleProfileChange("has_job_offer", value)}
                  />
                  <CheckboxField
                    label={t("profile.hasCanadianExperience")}
                    checked={Boolean(profileForm.has_canadian_experience)}
                    onChange={(value) =>
                      handleProfileChange("has_canadian_experience", value)
                    }
                  />
                  <CheckboxField
                    label={t("profile.studiedInCanada")}
                    checked={Boolean(profileForm.studied_in_canada)}
                    onChange={(value) =>
                      handleProfileChange("studied_in_canada", value)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("selfApplication.overviewTitle")}
              </h2>

              <div className="mt-4 space-y-3">
                <InfoBox
                  label={t("selfApplication.overview.guidance")}
                  value={
                    Object.keys(eligibilityResult || {}).length > 0
                      ? t("selfApplication.ready")
                      : t("selfApplication.notGenerated")
                  }
                />
                <InfoBox
                  label={t("selfApplication.overview.readiness")}
                  value={readinessLabel}
                />
                <InfoBox
                  label={t("selfApplication.overview.documents")}
                  value={String(checklist.length)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("selfApplication.intakeTitle")}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {t("selfApplication.intakeHelp")}
                </p>
              </div>

              <Button onClick={handleRunWorkspace} disabled={runningWorkspace}>
                {runningWorkspace
                  ? t("common.loading")
                  : t("selfApplication.generateGuidance")}
              </Button>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("selfApplication.applicationType")}
              </label>
              <select
                value={applicationType}
                onChange={(e) => handleApplicationTypeChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 md:w-96"
              >
                {APPLICATION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey, { defaultValue: option.defaultLabel })}
                  </option>
                ))}
              </select>
            </div>

            {applicationType === "permanent_residence" ? (
              <PermanentResidenceIntake
                t={t}
                profileForm={profileForm}
                pathways={activePathways}
              />
            ) : null}

            {applicationType === "study_permit" ? (
              <StudyPermitIntake
                values={intakePayload}
                onChange={handleIntakeChange}
                t={t}
              />
            ) : null}

            {applicationType === "work_permit" ? (
              <WorkPermitIntake
                values={intakePayload}
                onChange={handleIntakeChange}
                t={t}
              />
            ) : null}

            {applicationType === "spousal_sponsorship" ? (
              <SpousalSponsorshipIntake
                values={intakePayload}
                onChange={handleIntakeChange}
                t={t}
              />
            ) : null}
          </div>

          {applicationType === "permanent_residence" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeading
                title={t("selfApplication.pathwaysTitle", {
                  defaultValue: "Top immigration pathways",
                })}
                subtitle={t("selfApplication.pathwaysHelp", {
                  defaultValue:
                    "For permanent residence, the AI should guide you toward the strongest programs based on your saved profile and strategy.",
                })}
              />

              {activePathways.length === 0 ? (
                <EmptyState
                  text={t("selfApplication.emptyPathways", {
                    defaultValue:
                      "Generate guidance to see the strongest permanent residence pathways for your profile.",
                  })}
                />
              ) : (
                <ResultList
                  title={t("selfApplication.pathwaysListTitle", {
                    defaultValue: "Recommended pathways",
                  })}
                  items={activePathways}
                  emptyText={t("selfApplication.noneListed")}
                />
              )}
            </div>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeading
                title={t("selfApplication.readinessTitle")}
                subtitle={t("selfApplication.readinessHelp")}
              />

              {!eligibilityResult || Object.keys(eligibilityResult).length === 0 ? (
                <EmptyState text={t("selfApplication.emptyGuidance")} />
              ) : (
                <div className="space-y-4">
                  <ResultMetric
                    label={t("selfApplication.readinessLabel")}
                    value={readinessLabel}
                  />

                  <ResultList
                    title={t("selfApplication.strengths")}
                    items={eligibilityResult.strengths || []}
                    emptyText={t("selfApplication.noneListed")}
                  />

                  <ResultList
                    title={t("selfApplication.concerns")}
                    items={eligibilityResult.concerns || []}
                    emptyText={t("selfApplication.noneListed")}
                  />

                  <ResultList
                    title={t("selfApplication.nextSteps")}
                    items={eligibilityResult.next_steps || []}
                    emptyText={t("selfApplication.noneListed")}
                  />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeading
                title={t("selfApplication.documentsTitle")}
                subtitle={t("selfApplication.documentsHelp")}
              />

              {!formsAssistantResult ||
              Object.keys(formsAssistantResult).length === 0 ? (
                <EmptyState text={t("selfApplication.emptyDocuments")} />
              ) : (
                <div className="space-y-4">
                  {formsAssistantResult.summary ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {t("selfApplication.summary")}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {formsAssistantResult.summary}
                      </p>
                    </div>
                  ) : null}

                  <ResultList
                    title={t("selfApplication.likelyForms")}
                    items={(formsAssistantResult.recommended_forms || []).map(
                      (item) => item.form_name || item.form_key || ""
                    )}
                    emptyText={t("selfApplication.noneListed")}
                  />

                  <ResultList
                    title={t("selfApplication.missingDetails")}
                    items={formsAssistantResult.missing_fields || []}
                    emptyText={t("selfApplication.noneListed")}
                  />

                  <ResultList
                    title={t("selfApplication.preparationNotes")}
                    items={formsAssistantResult.preparation_notes || []}
                    emptyText={t("selfApplication.noneListed")}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionHeading
              title={t("selfApplication.checklistTitle")}
              subtitle={t("selfApplication.checklistHelp")}
            />

            {checklist.length === 0 ? (
              <EmptyState text={t("selfApplication.emptyChecklist")} />
            ) : (
              <div className="space-y-3">
                {checklist.map((item, index) => (
                  <ChecklistItem
                    key={`${item.id || item.name}-${index}`}
                    item={item}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DisclosureAcceptanceModal
        isOpen={showDisclosure}
        onClose={() => setShowDisclosure(false)}
        onAccepted={runWorkspaceAfterDisclosure}
      />
    </Layout>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ResultMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ResultList({ title, items, emptyText }) {
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
          <li className="text-sm text-slate-500">{emptyText}</li>
        )}
      </ul>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  );
}

function ChecklistItem({ item, t }) {
  const badgeClass =
    item.status === "Required"
      ? "border-red-200 bg-red-50 text-red-700"
      : item.status === "Recommended"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

  const statusText =
    item.status === "Required"
      ? t("selfDocuments.priority.required")
      : item.status === "Recommended"
      ? t("selfDocuments.priority.recommended")
      : t("selfDocuments.priority.info");

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
          {statusText}
        </span>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function PermanentResidenceIntake({ t, profileForm, pathways }) {
  const hasProfileSignals =
    profileForm.age !== "" ||
    profileForm.education !== "" ||
    profileForm.language_score !== "" ||
    profileForm.experience_years !== "" ||
    profileForm.occupation !== "" ||
    profileForm.noc_code !== "" ||
    profileForm.preferred_province !== "";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <p className="text-sm font-semibold text-blue-900">
          {t("selfApplication.prNoticeTitle", {
            defaultValue: "Permanent residence guidance",
          })}
        </p>
        <p className="mt-2 text-sm leading-6 text-blue-800">
          {t("selfApplication.prNoticeBody", {
            defaultValue:
              "This flow uses your saved profile to guide you toward the strongest permanent residence pathways, such as Express Entry, Canadian Experience Class, Federal Skilled Worker, Provincial Nominee Program options, and other relevant opportunities.",
          })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoBox
          label={t("selfApplication.prSignals.profileReadyLabel", {
            defaultValue: "Profile signal",
          })}
          value={
            hasProfileSignals
              ? t("selfApplication.prSignals.profileReadyValue", {
                  defaultValue: "Profile data available",
                })
              : t("selfApplication.prSignals.profileMissingValue", {
                  defaultValue: "Complete your profile first",
                })
          }
        />

        <InfoBox
          label={t("selfApplication.prSignals.pathwaysLabel", {
            defaultValue: "Pathways currently visible",
          })}
          value={String(pathways.length)}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">
          {t("selfApplication.prFocusTitle", {
            defaultValue: "What the AI should consider",
          })}
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            {t("selfApplication.prFocusItems.0", {
              defaultValue:
                "Your age, education, language score, and work experience",
            })}
          </li>
          <li>
            {t("selfApplication.prFocusItems.1", {
              defaultValue:
                "Canadian study or work history and whether you have a job offer",
            })}
          </li>
          <li>
            {t("selfApplication.prFocusItems.2", {
              defaultValue:
                "Province preference and where your profile may be a stronger fit",
            })}
          </li>
          <li>
            {t("selfApplication.prFocusItems.3", {
              defaultValue:
                "French-speaking opportunities once your backend strategy engine includes them",
            })}
          </li>
        </ul>
      </div>
    </div>
  );
}

function StudyPermitIntake({ values, onChange, t }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField
        label={t("selfApplication.fields.dliName")}
        value={values.dli_name || ""}
        onChange={(value) => onChange("dli_name", value)}
      />
      <InputField
        label={t("selfApplication.fields.schoolName")}
        value={values.school_name || ""}
        onChange={(value) => onChange("school_name", value)}
      />
      <InputField
        label={t("selfApplication.fields.programName")}
        value={values.program_name || ""}
        onChange={(value) => onChange("program_name", value)}
      />
      <InputField
        label={t("selfApplication.fields.intakeTerm")}
        value={values.intake_term || ""}
        onChange={(value) => onChange("intake_term", value)}
      />
      <InputField
        label={t("selfApplication.fields.tuitionAmount")}
        value={values.tuition_amount || ""}
        onChange={(value) => onChange("tuition_amount", value)}
      />
      <TextAreaField
        label={t("selfApplication.fields.gapExplanation")}
        value={values.gap_in_studies_explanation || ""}
        onChange={(value) => onChange("gap_in_studies_explanation", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.proofOfFunds")}
        checked={Boolean(values.proof_of_funds_available)}
        onChange={(value) => onChange("proof_of_funds_available", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.sdsEligible")}
        checked={Boolean(values.sds_eligible)}
        onChange={(value) => onChange("sds_eligible", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.previousRefusal")}
        checked={Boolean(values.previous_refusal)}
        onChange={(value) => onChange("previous_refusal", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.accompanyingFamily")}
        checked={Boolean(values.accompanying_family)}
        onChange={(value) => onChange("accompanying_family", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.passportValid")}
        checked={Boolean(values.passport_valid)}
        onChange={(value) => onChange("passport_valid", value)}
      />
    </div>
  );
}

function WorkPermitIntake({ values, onChange, t }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField
        label={t("selfApplication.fields.permitType")}
        value={values.permit_type || ""}
        onChange={(value) => onChange("permit_type", value)}
      />
      <InputField
        label={t("selfApplication.fields.employerName")}
        value={values.employer_name || ""}
        onChange={(value) => onChange("employer_name", value)}
      />
      <InputField
        label={t("selfApplication.fields.jobTitle")}
        value={values.job_title || ""}
        onChange={(value) => onChange("job_title", value)}
      />
      <InputField
        label={t("selfApplication.fields.nocCode")}
        value={values.noc_code || ""}
        onChange={(value) => onChange("noc_code", value)}
      />
      <InputField
        label={t("selfApplication.fields.wage")}
        value={values.wage || ""}
        onChange={(value) => onChange("wage", value)}
      />
      <InputField
        label={t("selfApplication.fields.provinceOfWork")}
        value={values.province_of_work || ""}
        onChange={(value) => onChange("province_of_work", value)}
      />
      <InputField
        label={t("selfApplication.fields.openWorkPermitBasis")}
        value={values.open_work_permit_basis || ""}
        onChange={(value) => onChange("open_work_permit_basis", value)}
      />
      <InputField
        label={t("selfApplication.fields.currentStatusInCanada")}
        value={values.current_status_in_canada || ""}
        onChange={(value) => onChange("current_status_in_canada", value)}
      />
      <InputField
        label={t("selfApplication.fields.expiresOn")}
        value={values.expires_on || ""}
        onChange={(value) => onChange("expires_on", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.lmiaAvailable")}
        checked={Boolean(values.lmia_available)}
        onChange={(value) => onChange("lmia_available", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.accompanyingFamily")}
        checked={Boolean(values.accompanying_family)}
        onChange={(value) => onChange("accompanying_family", value)}
      />
    </div>
  );
}

function SpousalSponsorshipIntake({ values, onChange, t }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InputField
        label={t("selfApplication.fields.sponsorStatus")}
        value={values.sponsor_status || ""}
        onChange={(value) => onChange("sponsor_status", value)}
      />
      <InputField
        label={t("selfApplication.fields.principalApplicantCountry")}
        value={values.principal_applicant_country || ""}
        onChange={(value) => onChange("principal_applicant_country", value)}
      />
      <InputField
        label={t("selfApplication.fields.relationshipType")}
        value={values.relationship_type || ""}
        onChange={(value) => onChange("relationship_type", value)}
      />
      <InputField
        label={t("selfApplication.fields.relationshipStartDate")}
        value={values.relationship_start_date || ""}
        onChange={(value) => onChange("relationship_start_date", value)}
      />
      <InputField
        label={t("selfApplication.fields.marriageDate")}
        value={values.marriage_date || ""}
        onChange={(value) => onChange("marriage_date", value)}
      />
      <TextAreaField
        label={t("selfApplication.fields.proofOfRelationshipNotes")}
        value={values.proof_of_relationship_notes || ""}
        onChange={(value) => onChange("proof_of_relationship_notes", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.cohabiting")}
        checked={Boolean(values.cohabiting)}
        onChange={(value) => onChange("cohabiting", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.dependentChildren")}
        checked={Boolean(values.dependent_children)}
        onChange={(value) => onChange("dependent_children", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.previousMarriageOrSponsorship")}
        checked={Boolean(values.previous_marriage_or_sponsorship)}
        onChange={(value) =>
          onChange("previous_marriage_or_sponsorship", value)
        }
      />
      <CheckboxField
        label={t("selfApplication.fields.policeCertificatesReady")}
        checked={Boolean(values.police_certificates_ready)}
        onChange={(value) => onChange("police_certificates_ready", value)}
      />
      <CheckboxField
        label={t("selfApplication.fields.medicalsReady")}
        checked={Boolean(values.medicals_ready)}
        onChange={(value) => onChange("medicals_ready", value)}
      />
    </div>
  );
}