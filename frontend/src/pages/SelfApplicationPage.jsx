import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
import {
  getMyProfile,
  getSavedSelfApplication,
  runSelfWorkspace,
} from "../api";

const MATTER_OPTIONS = [
  { value: "study_permit", labelKey: "programs.studyPermit" },
  { value: "work_permit", labelKey: "programs.workPermit" },
  { value: "spousal_sponsorship", labelKey: "programs.spousalSponsorship" },
  { value: "permanent_residence", labelKey: "programs.permanentResidence" },
];

export default function SelfApplicationPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [profile, setProfile] = useState(null);
  const [application, setApplication] = useState(null);
  const [matterType, setMatterType] = useState("study_permit");
  const [intake, setIntake] = useState({});
  const [workspace, setWorkspace] = useState(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setMessage("");

      const [profileRes, savedAppRes] = await Promise.allSettled([
        getMyProfile(),
        getSavedSelfApplication(),
      ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value.data);
      }

      if (savedAppRes.status === "fulfilled") {
        const saved = savedAppRes.value.data;
        setApplication(saved);
        setMatterType(saved?.matter_type || "study_permit");
        setIntake(saved?.intake_payload || {});
        setWorkspace({
          eligibility: saved?.eligibility_result || null,
          forms_assistant: saved?.forms_result || null,
          checklist: saved?.checklist_result || [],
          decision: saved?.decision || null,
          strategy: saved?.strategy || null,
          pathways: saved?.pathways || [],
          french_advantage: saved?.french_advantage || null,
        });
      }
    } catch (err) {
      console.error(err);
      setMessage(t("errors.server"));
    } finally {
      setLoading(false);
    }
  }

  function updateIntakeField(field, value) {
    setIntake((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function applyIntakePreset(entries) {
    setIntake((prev) => ({
      ...prev,
      ...entries,
    }));
  }

  async function handleGenerateWorkspace() {
    try {
      setRunning(true);
      setMessage("");

      const payload = {
        matter_type: matterType,
        intake,
      };

      const res = await runSelfWorkspace(payload, language);
      const data = res.data;

      setWorkspace(data);
      setApplication(data?.application || null);

      setMessage(
        t("selfApplication.messages.guidanceGenerated", {
          defaultValue: "Your application guidance is ready.",
        })
      );
    } catch (err) {
      console.error(err);
      setMessage(err?.response?.data?.detail || t("errors.server"));
    } finally {
      setRunning(false);
    }
  }

  const eligibility = workspace?.eligibility || {};
  const formsAssistant = workspace?.forms_assistant || {};
  const checklist = Array.isArray(workspace?.checklist) ? workspace.checklist : [];
  const strategy = workspace?.strategy || null;
  const decision = workspace?.decision || null;
  const pathways = Array.isArray(workspace?.pathways)
    ? workspace.pathways
    : Array.isArray(strategy?.recommended_programs)
    ? strategy.recommended_programs
    : [];
  const frenchAdvantage =
    workspace?.french_advantage ||
    strategy?.french_advantage ||
    decision?.french_advantage ||
    {};

  const readiness = eligibility?.readiness || t("selfApplication.notGenerated");
  const strengths = Array.isArray(eligibility?.strengths) ? eligibility.strengths : [];
  const concerns = Array.isArray(eligibility?.concerns) ? eligibility.concerns : [];
  const nextSteps = Array.isArray(eligibility?.next_steps) ? eligibility.next_steps : [];
  const likelyForms = Array.isArray(formsAssistant?.recommended_forms)
    ? formsAssistant.recommended_forms
    : [];
  const missingFields = Array.isArray(formsAssistant?.missing_fields)
    ? formsAssistant.missing_fields
    : [];
  const preparationNotes = Array.isArray(formsAssistant?.preparation_notes)
    ? formsAssistant.preparation_notes
    : [];
  const checklistItems = checklist;

  const decisionActions = Array.isArray(decision?.recommended_actions)
    ? decision.recommended_actions
    : [];
  const decisionPathways = Array.isArray(decision?.top_pathways)
    ? decision.top_pathways
    : pathways;

  const frenchSignals = Array.isArray(frenchAdvantage?.signals)
    ? frenchAdvantage.signals
    : [];
  const frenchRecommendations = Array.isArray(frenchAdvantage?.recommendations)
    ? frenchAdvantage.recommendations
    : [];
  const frenchStrategicValue = frenchAdvantage?.strategic_value || "low";

  const matterLabel = useMemo(() => {
    const found = MATTER_OPTIONS.find((item) => item.value === matterType);
    return found ? t(found.labelKey) : matterType;
  }, [matterType, t]);

  const decisionLocked = Boolean(decision?.locked);
  const decisionUpgradeReason =
    decision?.upgrade_reason || t("decision.upgradeBody");
  const decisionIsPremium = Boolean(decision?.is_premium);

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        brand: t("app.name"),
        title: t("layout.myApplication"),
        subtitle: t("selfApplication.subtitle"),
        inputEyebrow: t("selfApplication.intakeTitle"),
        inputHelp: t("selfApplication.intakeHelp"),
        applicationType: t("selfApplication.applicationType"),
        quickFill: "Remplissage rapide",
        quickFillHelp:
          "Utilisez ces raccourcis pour préremplir quelques éléments courants, puis ajustez selon votre situation réelle.",
        guidanceTitle: "Conseils pratiques",
        guidanceBody:
          "Générez votre guidance après avoir ajouté les informations les plus importantes. Ensuite, utilisez la stratégie, les documents et le générateur pour avancer plus vite.",
        openStrategy: "Voir ma stratégie",
        openDocuments: "Voir mes documents",
        openGenerator: "Ouvrir le générateur",
        decisionCopilotTitle: "Copilote IA de décision",
        decisionCopilotDesc:
          "Comprenez clairement votre meilleure prochaine action à partir de votre guidance actuelle.",
        decisionCopilotButton: "Expliquer ma prochaine action",
        intakeCopilotTitle: "Copilote IA de demande",
        intakeCopilotDesc:
          "Comprenez ce qu’il manque, ce qu’il faut clarifier, et comment renforcer votre dossier.",
        intakeCopilotButton: "Que dois-je compléter ?",
      };
    }

    return {
      brand: t("app.name"),
      title: t("layout.myApplication"),
      subtitle: t("selfApplication.subtitle"),
      inputEyebrow: t("selfApplication.intakeTitle"),
      inputHelp: t("selfApplication.intakeHelp"),
      applicationType: t("selfApplication.applicationType"),
      quickFill: "Quick fill",
      quickFillHelp:
        "Use these shortcuts to prefill a few common details, then adjust them to match your real situation.",
      guidanceTitle: "Practical guidance",
      guidanceBody:
        "Generate your guidance after adding the most important details. Then use strategy, documents, and the generator to move faster.",
      openStrategy: "View my strategy",
      openDocuments: "View my documents",
      openGenerator: "Open generator",
      decisionCopilotTitle: "Decision AI Copilot",
      decisionCopilotDesc:
        "Understand your clearest next action based on your current guidance.",
      decisionCopilotButton: "Explain my next action",
      intakeCopilotTitle: "Application AI Copilot",
      intakeCopilotDesc:
        "Understand what is missing, what needs clarification, and how to strengthen your file.",
      intakeCopilotButton: "What should I complete?",
    };
  }, [language, t]);

  const quickFillPresets = useMemo(() => {
    if (matterType === "study_permit") {
      return language === "fr"
        ? [
            {
              label: "Cas solide d’études",
              values: {
                proof_of_funds_available: true,
                sds_eligible: true,
                previous_refusal: false,
                accompanying_family: false,
                passport_valid: true,
              },
            },
            {
              label: "Avec famille accompagnante",
              values: {
                accompanying_family: true,
                proof_of_funds_available: true,
                passport_valid: true,
              },
            },
          ]
        : [
            {
              label: "Strong study case",
              values: {
                proof_of_funds_available: true,
                sds_eligible: true,
                previous_refusal: false,
                accompanying_family: false,
                passport_valid: true,
              },
            },
            {
              label: "With accompanying family",
              values: {
                accompanying_family: true,
                proof_of_funds_available: true,
                passport_valid: true,
              },
            },
          ];
    }

    if (matterType === "work_permit") {
      return language === "fr"
        ? [
            {
              label: "Permis avec employeur",
              values: {
                lmia_available: true,
                accompanying_family: false,
              },
            },
            {
              label: "Permis avec famille",
              values: {
                accompanying_family: true,
              },
            },
          ]
        : [
            {
              label: "Employer-backed permit",
              values: {
                lmia_available: true,
                accompanying_family: false,
              },
            },
            {
              label: "Permit with family",
              values: {
                accompanying_family: true,
              },
            },
          ];
    }

    if (matterType === "spousal_sponsorship") {
      return language === "fr"
        ? [
            {
              label: "Dossier relation stable",
              values: {
                cohabiting: true,
                dependent_children: false,
                previous_marriage_or_sponsorship: false,
                police_certificates_ready: true,
                medicals_ready: true,
              },
            },
            {
              label: "Avec enfants à charge",
              values: {
                dependent_children: true,
                police_certificates_ready: true,
                medicals_ready: true,
              },
            },
          ]
        : [
            {
              label: "Stable relationship case",
              values: {
                cohabiting: true,
                dependent_children: false,
                previous_marriage_or_sponsorship: false,
                police_certificates_ready: true,
                medicals_ready: true,
              },
            },
            {
              label: "With dependent children",
              values: {
                dependent_children: true,
                police_certificates_ready: true,
                medicals_ready: true,
              },
            },
          ];
    }

    return [];
  }, [language, matterType]);

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
      {message && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">{pageText.brand}</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          {pageText.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {pageText.subtitle}
        </p>
      </div>

      <AICopilotCard
        title={pageText.intakeCopilotTitle}
        description={pageText.intakeCopilotDesc}
        buttonLabel={pageText.intakeCopilotButton}
        language={language}
        prompt={
          language === "fr"
            ? `Agis comme un copilote de demande d’immigration.

Je prépare actuellement ce type de demande: ${matterLabel}.

Explique:
1. les informations les plus importantes à compléter
2. les risques ou zones floues les plus fréquents
3. les documents ou preuves à préparer tôt
4. retourne 3 suggested_next_actions courtes et concrètes`
            : `Act as an immigration application copilot.

I am currently preparing this application type: ${matterLabel}.

Explain:
1. the most important information I should complete
2. the most common risks or unclear areas
3. the documents or evidence I should prepare early
4. return 3 short concrete suggested_next_actions`
        }
        className="mb-6"
      />

      {!profile && (
        <Card className="mb-6 border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-semibold text-amber-900">
            {t("dashboard.cards.profile.title")}
          </p>
          <p className="mt-2 text-sm text-amber-800">
            {t("selfApplication.profileHelp")}
          </p>
        </Card>
      )}

      {decision && (
        <>
          <Card className="mb-6 border border-blue-200 bg-blue-50 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                    {t("decision.title")}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      decisionIsPremium
                        ? "border border-green-200 bg-green-50 text-green-700"
                        : "border border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {decisionIsPremium
                      ? t("decision.premiumBadge")
                      : t("decision.previewBadge")}
                  </span>
                </div>

                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {decision.priority_label || t("decision.nextBestMove")}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                  {decision.priority_reason}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {decision.readiness && (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {t("selfApplication.readinessLabel")}: {decision.readiness}
                  </span>
                )}
                {decision.confidence_label && (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {t("decision.confidence")}: {decision.confidence_label}
                  </span>
                )}
              </div>
            </div>

            {decision.primary_recommendation && (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {t("decision.primaryRecommendation")}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {decision.primary_recommendation}
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t("decision.recommendedActions")}
                </p>
                {decisionActions.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {decisionActions.map((item, index) => (
                      <li
                        key={index}
                        className={`rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 ${
                          decisionLocked && index > 0 ? "blur-[2px] select-none" : ""
                        }`}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    {t("decision.noActions")}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t("decision.topPathways")}
                </p>
                {decisionPathways.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {decisionPathways.map((item, index) => (
                      <li
                        key={index}
                        className={`rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 ${
                          decisionLocked && index > 0 ? "blur-[2px] select-none" : ""
                        }`}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    {t("decision.noPathways")}
                  </p>
                )}
              </div>
            </div>

            {(decision.missing_fields_count > 0 ||
              decision.remaining_required_documents > 0) && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("decision.missingFields")}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {decision.missing_fields_count ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("decision.remainingDocuments")}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {decision.remaining_required_documents ?? 0}
                  </p>
                </div>
              </div>
            )}

            {decisionLocked && (
              <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-900">
                  {t("decision.upgradeTitle")}
                </p>
                <p className="mt-2 text-sm text-amber-800">
                  {decisionUpgradeReason}
                </p>
                <div className="mt-4">
                  <Button onClick={() => navigate("/pricing")}>
                    {t("decision.upgradeButton")}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <AICopilotCard
            title={pageText.decisionCopilotTitle}
            description={pageText.decisionCopilotDesc}
            buttonLabel={pageText.decisionCopilotButton}
            language={language}
            prompt={
              language === "fr"
                ? `À partir de ma guidance actuelle pour ${matterLabel}, explique clairement:

1. pourquoi cette action est prioritaire
2. ce qui bloque le plus mon dossier
3. ce que je devrais faire ensuite
4. retourne 3 suggested_next_actions courtes liées à des actions concrètes`
                : `Based on my current guidance for ${matterLabel}, clearly explain:

1. why this action is prioritized
2. what is blocking my file the most
3. what I should do next
4. return 3 short suggested_next_actions tied to concrete actions`
            }
            className="mb-6"
          />
        </>
      )}

      {frenchStrategicValue !== "low" && (
        <Card className="mb-6 border border-green-200 bg-green-50 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
                {t("decision.francophoneSignal")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {frenchStrategicValue === "high"
                  ? t("decision.frenchPriorityDetected")
                  : t("decision.frenchOpportunityDetected")}
              </h2>
            </div>

            <span className="rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-700">
              {frenchStrategicValue}
            </span>
          </div>

          {frenchSignals.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">
                {t("decision.signals")}
              </p>
              <ul className="mt-3 space-y-2">
                {frenchSignals.map((item, index) => (
                  <li
                    key={index}
                    className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {frenchRecommendations.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">
                {t("decision.recommendations")}
              </p>
              <ul className="mt-3 space-y-2">
                {frenchRecommendations.map((item, index) => (
                  <li
                    key={index}
                    className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.inputEyebrow}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {matterLabel}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {pageText.inputHelp}
            </p>

            {quickFillPresets.length > 0 && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {pageText.quickFill}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {pageText.quickFillHelp}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {quickFillPresets.map((preset, index) => (
                    <button
                      key={`${preset.label}-${index}`}
                      type="button"
                      onClick={() => applyIntakePreset(preset.values)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.applicationType}
                </label>
                <select
                  value={matterType}
                  onChange={(e) => setMatterType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  {MATTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              {matterType === "study_permit" && (
                <>
                  <InputField
                    label={t("selfApplication.fields.schoolName")}
                    value={intake.school_name || ""}
                    onChange={(value) => updateIntakeField("school_name", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.dliName")}
                    value={intake.dli_name || ""}
                    onChange={(value) => updateIntakeField("dli_name", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.programName")}
                    value={intake.program_name || ""}
                    onChange={(value) => updateIntakeField("program_name", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.intakeTerm")}
                    value={intake.intake_term || ""}
                    onChange={(value) => updateIntakeField("intake_term", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.tuitionAmount")}
                    value={intake.tuition_amount || ""}
                    onChange={(value) => updateIntakeField("tuition_amount", value)}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.proofOfFunds")}
                    value={Boolean(intake.proof_of_funds_available)}
                    onChange={(value) =>
                      updateIntakeField("proof_of_funds_available", value)
                    }
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.sdsEligible")}
                    value={Boolean(intake.sds_eligible)}
                    onChange={(value) => updateIntakeField("sds_eligible", value)}
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.previousRefusal")}
                    value={Boolean(intake.previous_refusal)}
                    onChange={(value) => updateIntakeField("previous_refusal", value)}
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.accompanyingFamily")}
                    value={Boolean(intake.accompanying_family)}
                    onChange={(value) =>
                      updateIntakeField("accompanying_family", value)
                    }
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.passportValid")}
                    value={Boolean(intake.passport_valid)}
                    onChange={(value) => updateIntakeField("passport_valid", value)}
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <TextAreaField
                    label={t("selfApplication.fields.gapExplanation")}
                    value={intake.gap_in_studies_explanation || ""}
                    onChange={(value) =>
                      updateIntakeField("gap_in_studies_explanation", value)
                    }
                  />
                </>
              )}

              {matterType === "work_permit" && (
                <>
                  <InputField
                    label={t("selfApplication.fields.permitType")}
                    value={intake.permit_type || ""}
                    onChange={(value) => updateIntakeField("permit_type", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.employerName")}
                    value={intake.employer_name || ""}
                    onChange={(value) => updateIntakeField("employer_name", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.jobTitle")}
                    value={intake.job_title || ""}
                    onChange={(value) => updateIntakeField("job_title", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.nocCode")}
                    value={intake.noc_code || ""}
                    onChange={(value) => updateIntakeField("noc_code", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.wage")}
                    value={intake.wage || ""}
                    onChange={(value) => updateIntakeField("wage", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.provinceOfWork")}
                    value={intake.province_of_work || ""}
                    onChange={(value) =>
                      updateIntakeField("province_of_work", value)
                    }
                  />
                  <InputField
                    label={t("selfApplication.fields.openWorkPermitBasis")}
                    value={intake.open_work_permit_basis || ""}
                    onChange={(value) =>
                      updateIntakeField("open_work_permit_basis", value)
                    }
                  />
                  <InputField
                    label={t("selfApplication.fields.currentStatusInCanada")}
                    value={intake.current_status_in_canada || ""}
                    onChange={(value) =>
                      updateIntakeField("current_status_in_canada", value)
                    }
                  />
                  <InputField
                    label={t("selfApplication.fields.expiresOn")}
                    value={intake.expires_on || ""}
                    onChange={(value) => updateIntakeField("expires_on", value)}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.lmiaAvailable")}
                    value={Boolean(intake.lmia_available)}
                    onChange={(value) => updateIntakeField("lmia_available", value)}
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.accompanyingFamily")}
                    value={Boolean(intake.accompanying_family)}
                    onChange={(value) =>
                      updateIntakeField("accompanying_family", value)
                    }
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                </>
              )}

              {matterType === "spousal_sponsorship" && (
                <>
                  <InputField
                    label={t("selfApplication.fields.sponsorStatus")}
                    value={intake.sponsor_status || ""}
                    onChange={(value) => updateIntakeField("sponsor_status", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.relationshipType")}
                    value={intake.relationship_type || ""}
                    onChange={(value) =>
                      updateIntakeField("relationship_type", value)
                    }
                  />
                  <InputField
                    label={t("selfApplication.fields.relationshipStartDate")}
                    value={intake.relationship_start_date || ""}
                    onChange={(value) =>
                      updateIntakeField("relationship_start_date", value)
                    }
                  />
                  <InputField
                    label={t("selfApplication.fields.marriageDate")}
                    value={intake.marriage_date || ""}
                    onChange={(value) => updateIntakeField("marriage_date", value)}
                  />
                  <InputField
                    label={t("selfApplication.fields.principalApplicantCountry")}
                    value={intake.principal_applicant_country || ""}
                    onChange={(value) =>
                      updateIntakeField("principal_applicant_country", value)
                    }
                  />
                  <TextAreaField
                    label={t("selfApplication.fields.proofOfRelationshipNotes")}
                    value={intake.proof_of_relationship_notes || ""}
                    onChange={(value) =>
                      updateIntakeField("proof_of_relationship_notes", value)
                    }
                  />
                  <ToggleField
                    label={t("selfApplication.fields.cohabiting")}
                    value={Boolean(intake.cohabiting)}
                    onChange={(value) => updateIntakeField("cohabiting", value)}
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.dependentChildren")}
                    value={Boolean(intake.dependent_children)}
                    onChange={(value) =>
                      updateIntakeField("dependent_children", value)
                    }
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.previousMarriageOrSponsorship")}
                    value={Boolean(intake.previous_marriage_or_sponsorship)}
                    onChange={(value) =>
                      updateIntakeField("previous_marriage_or_sponsorship", value)
                    }
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.policeCertificatesReady")}
                    value={Boolean(intake.police_certificates_ready)}
                    onChange={(value) =>
                      updateIntakeField("police_certificates_ready", value)
                    }
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                  <ToggleField
                    label={t("selfApplication.fields.medicalsReady")}
                    value={Boolean(intake.medicals_ready)}
                    onChange={(value) => updateIntakeField("medicals_ready", value)}
                    yesLabel={t("common.yes")}
                    noLabel={t("common.no")}
                  />
                </>
              )}

              {matterType === "permanent_residence" && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    {t("selfApplication.prNoticeTitle")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-blue-800">
                    {t("selfApplication.prNoticeBody")}
                  </p>
                </div>
              )}

              <div className="pt-2">
                <Button onClick={handleGenerateWorkspace} disabled={running}>
                  {running ? t("common.loading") : t("selfApplication.generateGuidance")}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.guidanceTitle}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {matterLabel}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {pageText.guidanceBody}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate("/strategy")}>
                {pageText.openStrategy}
              </Button>
              <Button variant="secondary" onClick={() => navigate("/self/documents")}>
                {pageText.openDocuments}
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/documents/generator")}
              >
                {pageText.openGenerator}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t("selfApplication.readinessTitle")}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {t("selfApplication.readinessLabel")}: {readiness}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {eligibility?.summary || t("selfApplication.emptyGuidance")}
            </p>

            {strengths.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">
                  {t("selfApplication.strengths")}
                </p>
                <ul className="mt-3 space-y-2">
                  {strengths.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {concerns.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">
                  {t("selfApplication.concerns")}
                </p>
                <ul className="mt-3 space-y-2">
                  {concerns.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {nextSteps.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">
                  {t("selfApplication.nextSteps")}
                </p>
                <ul className="mt-3 space-y-2">
                  {nextSteps.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t("selfApplication.documentsTitle")}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {t("selfApplication.likelyForms")}
            </h2>

            {likelyForms.length > 0 ? (
              <div className="mt-4 space-y-3">
                {likelyForms.map((form, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-medium text-slate-900">{form.form_name}</p>
                    {form.status && (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {form.status}
                      </p>
                    )}
                    {form.notes && (
                      <p className="mt-2 text-sm text-slate-700">{form.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                {t("selfApplication.emptyDocuments")}
              </p>
            )}

            {missingFields.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">
                  {t("selfApplication.missingDetails")}
                </p>
                <ul className="mt-3 space-y-2">
                  {missingFields.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preparationNotes.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900">
                  {t("selfApplication.preparationNotes")}
                </p>
                <ul className="mt-3 space-y-2">
                  {preparationNotes.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t("selfApplication.checklistTitle")}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {t("layout.myDocuments")}
            </h2>

            {checklistItems.length > 0 ? (
              <div className="mt-4 space-y-3">
                {checklistItems.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.status}
                      </span>
                    </div>
                    {item.reason && (
                      <p className="mt-2 text-sm text-slate-700">{item.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                {t("selfApplication.emptyChecklist")}
              </p>
            )}
          </Card>

          {pathways.length > 0 && (
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t("selfApplication.pathwaysTitle")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {t("selfApplication.pathwaysListTitle")}
              </h2>

              <div className="mt-4 space-y-3">
                {pathways.map((item, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl border p-4 ${
                      index === 0
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        index === 0 ? "text-blue-700" : "text-slate-500"
                      }`}
                    >
                      {index === 0
                        ? t("chat.primaryPathway")
                        : t("common.option", { index: index + 1 })}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}

function InputField({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
      />
    </div>
  );
}

function ToggleField({ label, value, onChange, yesLabel, noLabel }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          value
            ? "bg-blue-600 text-white"
            : "border border-slate-300 bg-white text-slate-600"
        }`}
      >
        {value ? yesLabel : noLabel}
      </button>
    </div>
  );
}