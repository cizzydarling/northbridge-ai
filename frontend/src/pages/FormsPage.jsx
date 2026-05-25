import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import LockBadge from "../components/ui/LockBadge";
import UpgradePrompt from "../components/UpgradePrompt";
import { getActiveCaseId } from "../utils/activeCase";
import { getApplicationCase } from "../api";
import api, {
  getBillingAccess,
  getFormsApplicationTypes,
  getMyProfile,
  getSavedSelfApplication,
  runSelfWorkspace,
} from "../api";

const LOCAL_FORMS_DRAFT_KEY = "nbai_forms_studio_draft_v1";
const PROFILE_SYNC_FIELDS = [
  "first_name",
  "last_name",
  "nationality",
  "current_country",
  "current_city",
  "marital_status",
  "preferred_language",
  "age",
  "education",
  "language_score",
  "experience_years",
  "occupation",
  "noc_code",
  "preferred_province",
];

function buildProPricingPath(source = "forms", intent = "execute") {
  return `/pricing?plan=pro&source=${source}&intent=${intent}`;
}

function buildPremiumPricingPath(source = "forms", intent = "export") {
  return `/pricing?plan=premium&source=${source}&intent=${intent}`;
}

function PageHeader({ brand, title, subtitle }) {
  return (
    <div className="mb-6 border-b border-slate-200 pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {brand}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
            {subtitle}
          </p>
        </div>

        <div className="hidden h-px min-w-[180px] bg-slate-300 lg:block" />
      </div>
    </div>
  );
}

function SectionIntro({ eyebrow, title, body }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      {body ? (
        <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
      ) : null}
    </div>
  );
}

function StepHeader({ step, title, body }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
          {step}
        </span>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      {body ? <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p> : null}
    </div>
  );
}

function ProgressBadge({ score }) {
  let className = "border-red-200 bg-red-50 text-red-700";

  if (score >= 85) {
    className = "border-emerald-200 bg-emerald-50 text-emerald-700";
  } else if (score >= 65) {
    className = "border-blue-200 bg-blue-50 text-blue-700";
  } else if (score >= 45) {
    className = "border-amber-200 bg-amber-50 text-amber-700";
  }

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {score}%
    </span>
  );
}

function readLocalDraft() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FORMS_DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalDraft(value) {
  localStorage.setItem(LOCAL_FORMS_DRAFT_KEY, JSON.stringify(value || {}));
}

function getProfileApplicationData(profile) {
  return PROFILE_SYNC_FIELDS.reduce((acc, key) => {
    const value = profile?.[key];
    if (value === null || typeof value === "undefined") return acc;
    if (typeof value === "string" && !value.trim()) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function FieldInput({ field, value, onChange }) {
  const commonClassName =
    "w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

  if (field.type === "textarea") {
    return (
      <textarea
        rows={4}
        value={value || ""}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={commonClassName}
        placeholder={field.placeholder || ""}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.name, e.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  return (
    <input
      type={field.type || "text"}
      value={value || ""}
      onChange={(e) => onChange(field.name, e.target.value)}
      className={commonClassName}
      placeholder={field.placeholder || ""}
    />
  );
}

function PlanPill({ active = false, children }) {
  return (
    <span
      className={`inline-flex rounded-lg border px-3 py-1 text-xs font-semibold ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function StudioTabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function ApplicationTypeButton({ active, disabled, label, onClick, statusLabel }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[64px] rounded-lg border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)]"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="block font-semibold">{label}</span>
      <span
        className={`mt-1 block text-xs ${
          active ? "text-stone-300" : "text-slate-500"
        }`}
      >
        {statusLabel}
      </span>
    </button>
  );
}

function MonetizationCard({ title, subtitle, items, accent = "default" }) {
  const accentClass =
    accent === "featured"
      ? "border-amber-200 bg-stone-50"
      : "border-slate-200 bg-white";

  return (
    <div className={`rounded-lg border p-5 ${accentClass}`}>
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-2 text-sm leading-7 text-slate-600">{subtitle}</p>
      ) : null}

      <div className="mt-4 space-y-2">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, accent = "default" }) {
  const accentClass =
    accent === "good"
      ? "bg-emerald-50 border-emerald-200"
      : accent === "focus"
      ? "bg-blue-50 border-blue-200"
      : "bg-slate-50/80 border-slate-200";

  return (
    <div className={`rounded-lg border p-4 ${accentClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function CompletionBar({ score }) {
  return (
    <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
      <div
        className="h-2 rounded-full bg-blue-600 transition-all duration-300"
        style={{ width: `${score || 0}%` }}
      />
    </div>
  );
}

function StudioMetric({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function FormsStudioHero({
  pageText,
  activeCase,
  selectedApplicationLabel,
  applicationTypesCount,
  preview,
  canDownloadForms,
  previewLoading,
  selectedApplicationType,
  onPreview,
  onPricing,
}) {
  const activeCaseLabel =
    activeCase?.case_title ||
    activeCase?.pathway ||
    activeCase?.application_type ||
    pageText.noActiveCase;
  const previewScore = preview?.summary?.completeness_score ?? 0;
  const previewLabel = preview
    ? `${previewScore}%`
    : pageText.previewNotGenerated;
  const downloadLabel = (
    <LockBadge
      locked={!canDownloadForms}
      label={canDownloadForms ? pageText.downloadUnlocked : pageText.downloadLocked}
    />
  );

  return (
    <section className="mb-6 rounded-lg border border-stone-200 bg-stone-50 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            {pageText.heroEyebrow}
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {pageText.heroTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
            {pageText.heroBody}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={onPreview}
              disabled={previewLoading || !selectedApplicationType}
              loading={previewLoading}
            >
              {previewLoading ? pageText.previewing : pageText.preview}
            </Button>
            <Button variant="secondary" onClick={onPricing}>
              {pageText.viewPricing}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <StudioMetric
            label={pageText.formsAvailable}
            value={applicationTypesCount}
            detail={pageText.everyTypeReady}
          />
          <StudioMetric
            label={pageText.activeApplication}
            value={selectedApplicationLabel}
            detail={activeCaseLabel}
          />
          <StudioMetric
            label={pageText.previewStatus}
            value={previewLabel}
            detail={pageText.completeness}
          />
          <StudioMetric
            label={pageText.downloadAccess}
            value={downloadLabel}
            detail={pageText.accessLabel}
          />
        </div>
      </div>
    </section>
  );
}

function getFallbackApplicationTypes(language) {
  if (language === "fr") {
    return [
      { value: "study_permit", label: "Permis d’études" },
      { value: "work_permit", label: "Permis de travail" },
      { value: "visitor_visa", label: "Visa visiteur" },
      { value: "spousal_sponsorship", label: "Parrainage d’époux / conjoint" },
      { value: "express_entry", label: "Entrée express" },
      { value: "pr_pathway", label: "Voie de résidence permanente" },
    ];
  }

  return [
    { value: "study_permit", label: "Study Permit" },
    { value: "work_permit", label: "Work Permit" },
    { value: "visitor_visa", label: "Visitor Visa" },
    { value: "spousal_sponsorship", label: "Spousal Sponsorship" },
    { value: "express_entry", label: "Express Entry" },
    { value: "pr_pathway", label: "Permanent Residence Pathway" },
  ];
}

function normalizeApplicationTypesPayload(data, language) {
  const fallback = getFallbackApplicationTypes(language);

  const candidateLists = [
    data?.application_types,
    data?.items,
    data?.results,
    Array.isArray(data) ? data : null,
  ];

  const rawList = candidateLists.find((item) => Array.isArray(item)) || [];

  const normalized = rawList
    .map((item) => {
      if (typeof item === "string") {
        return {
          value: item,
          label: item
            .replaceAll("_", " ")
            .replace(/\b\w/g, (char) => char.toUpperCase()),
        };
      }

      if (!item || typeof item !== "object") return null;

      const value =
        item.value ||
        item.key ||
        item.id ||
        item.code ||
        item.slug ||
        item.name;

      const label =
        item.label ||
        item.title ||
        item.name ||
        item.display_name ||
        item.displayName ||
        value;

      if (!value) return null;

      return {
        value: String(value),
        label: String(label),
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function buildApplicationFields(language) {
  const t = {
    school_name: language === "fr" ? "Établissement / école" : "School / Institution",
    dli_number: language === "fr" ? "Numéro DLI" : "DLI Number",
    program_name: language === "fr" ? "Programme d’études" : "Program Name",
    level_of_study: language === "fr" ? "Niveau d’études" : "Level of Study",
    study_start_date: language === "fr" ? "Date de début des études" : "Study Start Date",
    study_end_date: language === "fr" ? "Date de fin des études" : "Study End Date",
    tuition_amount: language === "fr" ? "Montant des frais de scolarité" : "Tuition Amount",
    available_funds: language === "fr" ? "Fonds disponibles" : "Available Funds",

    employer_name: language === "fr" ? "Nom de l’employeur" : "Employer Name",
    job_title: language === "fr" ? "Titre du poste" : "Job Title",
    job_location: language === "fr" ? "Lieu de travail" : "Job Location",
    work_start_date: language === "fr" ? "Date de début prévue" : "Expected Start Date",
    work_duration: language === "fr" ? "Durée prévue" : "Expected Duration",
    lmia_status: language === "fr" ? "Statut EIMT / dispense" : "LMIA / Exemption Status",

    purpose_of_travel: language === "fr" ? "Objet du voyage" : "Purpose of Travel",
    arrival_date: language === "fr" ? "Date d’arrivée prévue" : "Intended Arrival Date",
    departure_date: language === "fr" ? "Date de départ prévue" : "Intended Departure Date",
    host_name: language === "fr" ? "Nom de l’hôte / contact" : "Host / Contact Name",
    host_address: language === "fr" ? "Adresse de l’hôte / contact" : "Host / Contact Address",

    sponsor_name: language === "fr" ? "Nom du répondant" : "Sponsor Name",
    relationship_type: language === "fr" ? "Type de relation" : "Relationship Type",
    relationship_start_date: language === "fr" ? "Début de la relation" : "Relationship Start Date",
    marriage_date: language === "fr" ? "Date du mariage" : "Marriage Date",
    cohabitation_status: language === "fr" ? "Statut de cohabitation" : "Cohabitation Status",
    sponsor_status_in_canada:
      language === "fr" ? "Statut du répondant au Canada" : "Sponsor Status in Canada",

    preferred_province: language === "fr" ? "Province visée" : "Target Province",
    occupation: language === "fr" ? "Profession" : "Occupation",
    noc_code: language === "fr" ? "Code CNP" : "NOC Code",
    experience_years: language === "fr" ? "Années d’expérience" : "Years of Experience",
    language_score: language === "fr" ? "Score linguistique" : "Language Score",
  };

  return {
    study_permit: [
      { name: "school_name", label: t.school_name, type: "text" },
      { name: "dli_number", label: t.dli_number, type: "text" },
      { name: "program_name", label: t.program_name, type: "text" },
      { name: "level_of_study", label: t.level_of_study, type: "text" },
      { name: "study_start_date", label: t.study_start_date, type: "date" },
      { name: "study_end_date", label: t.study_end_date, type: "date" },
      { name: "tuition_amount", label: t.tuition_amount, type: "text" },
      { name: "available_funds", label: t.available_funds, type: "text" },
    ],
    work_permit: [
      { name: "employer_name", label: t.employer_name, type: "text" },
      { name: "job_title", label: t.job_title, type: "text" },
      { name: "job_location", label: t.job_location, type: "text" },
      { name: "work_start_date", label: t.work_start_date, type: "date" },
      { name: "work_duration", label: t.work_duration, type: "text" },
      { name: "lmia_status", label: t.lmia_status, type: "text" },
    ],
    visitor_visa: [
      { name: "purpose_of_travel", label: t.purpose_of_travel, type: "textarea" },
      { name: "arrival_date", label: t.arrival_date, type: "date" },
      { name: "departure_date", label: t.departure_date, type: "date" },
      { name: "host_name", label: t.host_name, type: "text" },
      { name: "host_address", label: t.host_address, type: "textarea" },
      { name: "available_funds", label: t.available_funds, type: "text" },
    ],
    spousal_sponsorship: [
      { name: "sponsor_name", label: t.sponsor_name, type: "text" },
      { name: "relationship_type", label: t.relationship_type, type: "text" },
      { name: "relationship_start_date", label: t.relationship_start_date, type: "date" },
      { name: "marriage_date", label: t.marriage_date, type: "date" },
      { name: "cohabitation_status", label: t.cohabitation_status, type: "text" },
      { name: "sponsor_status_in_canada", label: t.sponsor_status_in_canada, type: "text" },
    ],
    express_entry: [
      { name: "occupation", label: t.occupation, type: "text" },
      { name: "noc_code", label: t.noc_code, type: "text" },
      { name: "experience_years", label: t.experience_years, type: "number" },
      { name: "language_score", label: t.language_score, type: "number" },
      { name: "preferred_province", label: t.preferred_province, type: "text" },
    ],
    pr_pathway: [
      { name: "occupation", label: t.occupation, type: "text" },
      { name: "noc_code", label: t.noc_code, type: "text" },
      { name: "experience_years", label: t.experience_years, type: "number" },
      { name: "language_score", label: t.language_score, type: "number" },
      { name: "preferred_province", label: t.preferred_province, type: "text" },
      { name: "available_funds", label: t.available_funds, type: "text" },
    ],
  };
}

function mapMatterTypeToApplicationType(savedApplication) {
  const intake = savedApplication?.intake_payload || {};
  if (intake?.application_type) return intake.application_type;

  const matterType = savedApplication?.matter_type || "";

  if (matterType === "permanent_residence") {
    return "pr_pathway";
  }

  return matterType || "";
}

function mapApplicationTypeToMatterType(applicationType) {
  if (applicationType === "express_entry" || applicationType === "pr_pathway") {
    return "permanent_residence";
  }
  return applicationType || "permanent_residence";
}

export default function FormsPage() {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const navigate = useNavigate();

  const [applicationTypes, setApplicationTypes] = useState([]);
  const [selectedApplicationType, setSelectedApplicationType] = useState("");
  const [representativeUsed, setRepresentativeUsed] = useState(false);

  const [savedApplicationData, setSavedApplicationData] = useState({});
  const [inlineApplicationData, setInlineApplicationData] = useState({});

  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingSavedApp, setLoadingSavedApp] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [savingInline, setSavingInline] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [access, setAccess] = useState(null);
  const [activeCaseId, setActiveCaseId] = useState(getActiveCaseId());
  const [activeCase, setActiveCase] = useState(null);
  const [activeStudioTab, setActiveStudioTab] = useState("setup");
  const [activeResultTab, setActiveResultTab] = useState("summary");

  const saveTimerRef = useRef(null);

  const fieldMap = useMemo(() => buildApplicationFields(language), [language]);
  const activeFields = fieldMap[selectedApplicationType] || [];

  const mergedApplicationData = useMemo(() => {
    return {
      ...(savedApplicationData || {}),
      ...(inlineApplicationData || {}),
      application_type: selectedApplicationType,
      representative_used: representativeUsed,
    };
  }, [
    savedApplicationData,
    inlineApplicationData,
    selectedApplicationType,
    representativeUsed,
  ]);

  useEffect(() => {
    loadApplicationTypes();
    loadSavedSelfApplication();
    loadAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    if (preview) {
      setActiveStudioTab("results");
      setActiveResultTab("summary");
    }
  }, [preview]);

  useEffect(() => {
    if (!selectedApplicationType) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      handleAutoSave();
    }, 900);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inlineApplicationData, representativeUsed, selectedApplicationType]);

  useEffect(() => {
    async function loadActiveCase() {
      if (!activeCaseId) return;

      try {
        const res = await getApplicationCase(activeCaseId);
        const caseData = res?.data || null;
        setActiveCase(caseData);

        const mappedType =
          caseData?.application_type === "permanent_residence"
            ? caseData?.pathway?.toLowerCase().includes("express")
              ? "express_entry"
              : "pr_pathway"
            : caseData?.application_type;

        if (mappedType) {
          setSelectedApplicationType(mappedType);
        }
      } catch (err) {
        console.error(err);
        setActiveCase(null);
      }
    }

    loadActiveCase();
  }, [activeCaseId]);

  useEffect(() => {
    function handleActiveCaseUpdate() {
      setActiveCaseId(getActiveCaseId());
    }

    window.addEventListener("nbai-active-case-updated", handleActiveCaseUpdate);

    return () => {
      window.removeEventListener("nbai-active-case-updated", handleActiveCaseUpdate);
    };
  }, []);

  async function loadAccess() {
    try {
      setAccessLoading(true);
      const res = await getBillingAccess();
      setAccess(res?.data || null);
    } catch (err) {
      console.error(err);
      setAccess(null);
    } finally {
      setAccessLoading(false);
    }
  }

  async function loadApplicationTypes() {
    try {
      setLoadingTypes(true);
      setMessage("");

      const res = await getFormsApplicationTypes(language);
      const normalized = normalizeApplicationTypesPayload(res?.data, language);

      setApplicationTypes(normalized);

      setSelectedApplicationType((current) => {
        if (current && normalized.some((item) => item.value === current)) {
          return current;
        }
        return normalized[0]?.value || "";
      });
    } catch (err) {
      console.error(err);

      const fallback = getFallbackApplicationTypes(language);
      setApplicationTypes(fallback);
      setSelectedApplicationType((current) => {
        if (current && fallback.some((item) => item.value === current)) {
          return current;
        }
        return fallback[0]?.value || "";
      });

      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible de charger les types de demande depuis le serveur. Les options par défaut ont été utilisées."
            : "Unable to load application types from the server. Default options were used.")
      );
    } finally {
      setLoadingTypes(false);
    }
  }

  async function loadSavedSelfApplication() {
    try {
      setLoadingSavedApp(true);

      const localDraft = readLocalDraft();
      let profileApplicationData = {};

      try {
        const profileRes = await getMyProfile();
        profileApplicationData = getProfileApplicationData(profileRes?.data || {});
      } catch {
        profileApplicationData = {};
      }

      try {
        const res = await getSavedSelfApplication();
        const savedApplication = res?.data || {};
        const intake = savedApplication?.intake_payload || {};
        const mergedDraft = {
          ...intake,
          ...localDraft,
          ...profileApplicationData,
          application_type:
            localDraft?.application_type ||
            intake?.application_type ||
            profileApplicationData?.application_type,
        };

        setSavedApplicationData(intake);
        setInlineApplicationData(mergedDraft);

        const inferredApplicationType =
          mergedDraft.application_type || mapMatterTypeToApplicationType(savedApplication);
        if (inferredApplicationType) {
          setSelectedApplicationType(inferredApplicationType);
        }

        setRepresentativeUsed(
          Boolean(
            intake?.representative_used ||
              intake?.uses_representative ||
              intake?.has_representative ||
              localDraft?.representative_used
          )
        );
      } catch {
        const mergedDraft = {
          ...(localDraft || {}),
          ...profileApplicationData,
          application_type: localDraft?.application_type,
        };
        setSavedApplicationData(mergedDraft || {});
        setInlineApplicationData(mergedDraft || {});
        setRepresentativeUsed(
          Boolean(
            localDraft?.representative_used ||
              localDraft?.uses_representative ||
              localDraft?.has_representative
          )
        );
      }
    } catch (err) {
      console.error(err);
      const localDraft = readLocalDraft();
      setSavedApplicationData(localDraft || {});
      setInlineApplicationData(localDraft || {});
    } finally {
      setLoadingSavedApp(false);
    }
  }

  async function handleAutoSave() {
    try {
      setSavingInline(true);

      const intakePayload = {
        ...(savedApplicationData || {}),
        ...(inlineApplicationData || {}),
        application_type: selectedApplicationType,
        representative_used: representativeUsed,
      };

      writeLocalDraft(intakePayload);

      try {
        await runSelfWorkspace(
          {
            matter_type: mapApplicationTypeToMatterType(selectedApplicationType),
            intake: intakePayload,
          },
          language
        );

        setSavedApplicationData(intakePayload);
      } catch {
        // keep local draft even if backend sync fails
      }
    } finally {
      setSavingInline(false);
    }
  }

  function handleInlineFieldChange(name, value) {
    setInlineApplicationData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handlePreviewPackage() {
    if (!selectedApplicationType) return;

    try {
      setPreviewLoading(true);
      setMessage("");
      setPreview(null);

      const res = await api.post("/forms/package/preview", {
        application_type: selectedApplicationType,
        language,
        representative_used: representativeUsed,
        application_data: mergedApplicationData,
      });

      setPreview(res.data);

      localStorage.setItem(
        "nbai_forms_preview_v1",
        JSON.stringify(res.data || null)
      );
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible de générer l'aperçu du dossier."
            : "Unable to generate the package preview.")
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownloadPackage() {
    if (!selectedApplicationType) return;

    try {
      setDownloadLoading(true);
      setMessage("");

      const res = await api.post(
        "/forms/package/download",
        {
          application_type: selectedApplicationType,
          language,
          representative_used: representativeUsed,
          application_data: mergedApplicationData,
          download_format: access?.is_premium ? "pdf" : "json",
        },
        {
          responseType: "blob",
        }
      );

      const isPdf = access?.is_premium;
      const blob = new Blob([res.data], {
        type: isPdf ? "application/pdf" : "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = isPdf
        ? `${
            language === "fr" ? "dossier_formulaires" : "forms_package"
          }_${selectedApplicationType}.pdf`
        : `forms_package_${selectedApplicationType}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible de télécharger le dossier."
            : "Unable to download the package.")
      );
    } finally {
      setDownloadLoading(false);
    }
  }

  const currentPlanLabel = useMemo(() => {
    if (!access) return "";

    if (access?.is_premium || access?.plan === "premium") {
      return "Premium";
    }

    if (access?.is_pro || access?.plan === "pro") {
      return "Pro";
    }

    return language === "fr" ? "Gratuit" : "Free";
  }, [access, language]);

  const canDownloadForms = Boolean(access?.can_download_forms);
  const canUseFormsAI = Boolean(access?.can_use_forms_ai_assistant);
  const previewAllowsDownload = Boolean(preview?.download_enabled);
  const showDownloadButton =
    Boolean(preview && canDownloadForms && previewAllowsDownload);
  const shouldShowUpgradePrompt = Boolean(preview && !showDownloadButton);

  const aiMissingCount = Array.isArray(preview?.missing_fields)
    ? preview.missing_fields.length
    : 0;

  const proPath = buildProPricingPath("forms", "execute");
  const premiumPath = buildPremiumPricingPath("forms", "export");

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Studio formulaires IA",
        subtitle:
          "Prévisualisez gratuitement votre dossier de formulaires, identifiez les éléments manquants, puis débloquez le téléchargement quand vous êtes prêt à avancer.",
        heroEyebrow: "Centre de commande formulaires",
        heroTitle: "Générez le bon dossier pour chaque type de demande",
        heroBody:
          "Sélectionnez un type de demande, complétez les champs utiles et générez un aperçu clair des formulaires requis, conditionnels et manquants.",
        formsAvailable: "Types disponibles",
        everyTypeReady: "Chaque type peut générer un dossier",
        activeApplication: "Demande active",
        noActiveCase: "Aucun dossier actif",
        previewStatus: "Statut aperçu",
        previewNotGenerated: "Non généré",
        downloadAccess: "Accès téléchargement",
        downloadUnlocked: "Téléchargement disponible",
        downloadLocked: "Accès requis",
        generatorReady: "Générateur prêt",
        setupEyebrow: "Configuration",
        setupTitle: "Construire un dossier de formulaires",
        setupBody:
          "Sélectionnez votre type de demande, puis laissez la plateforme repérer les formulaires pertinents et les renseignements à compléter.",
        applicationType: "Type de demande",
        selectApplicationType: "Sélectionnez un type de demande",
        representative: "J'utilise un représentant",
        preview: "Prévisualiser le dossier",
        previewing: "Prévisualisation...",
        download: "Télécharger le dossier",
        downloadPdf: "Télécharger le PDF",
        downloading: "Téléchargement...",
        inlineEyebrow: "Complétion",
        inlineTitle: "Compléter les champs utiles",
        inlineBody:
          "Ajoutez les renseignements manquants pour améliorer la complétude du dossier et la qualité du préremplissage.",
        autosave: "Synchronisé avec votre espace personnel",
        autosaving: "Synchronisation...",
        summaryEyebrow: "Résumé",
        summaryTitle: "Aperçu du dossier",
        formsCount: "Nombre de formulaires",
        completeness: "Complétude",
        formsTitle: "Formulaires requis et conditionnels",
        mappedFields: "Champs préremplis",
        missingFields: "Champs manquants",
        noMissingFields: "Aucun champ manquant détecté.",
        noMappedFields: "Aucun champ mappé pour le moment.",
        notReady: "À compléter",
        ready: "Prêt",
        required: "Obligatoire",
        conditional: "Conditionnel",
        missingTitle: "Points à compléter avant téléchargement",
        noMissingItems: "Aucun point critique manquant pour le moment.",
        upgradeTitle: "Votre dossier est prêt à être débloqué",
        upgradeBody:
          "Prévisualisez gratuitement, puis débloquez le téléchargement avec Pro (30 jours) ou choisissez Premium (90 jours) pour une préparation plus complète et plus confortable.",
        emptyTitle: "Aucun aperçu généré",
        emptyBody:
          "Choisissez un type de demande, complétez les champs utiles, puis générez un aperçu pour voir les formulaires requis.",
        noInlineFields:
          "Aucun champ supplémentaire recommandé pour ce type de demande pour le moment.",
        disclaimer:
          "NorthBridgeAI vous aide à préparer vos formulaires selon les informations que vous fournissez. Vous demeurez responsable de la vérification finale et de toute soumission à IRCC.",
        launchEyebrow: "Forfaits",
        launchTitle: "Choisissez le bon niveau d’accompagnement",
        launchBody:
          "Le mode Gratuit est idéal pour explorer. Pro est conçu pour finaliser rapidement. Premium offre plus de temps et plus d’outils pour préparer un dossier complet.",
        freeTitle: "Gratuit",
        freeSubtitle: "Explorer et repérer les éléments manquants",
        freeItems: [
          "Prévisualisation du dossier de formulaires",
          "Sauvegarde de la progression",
          "Détection des champs manquants",
        ],
        proTitle: "Pro — 39 $ / 30 jours",
        proSubtitle: "Pour les utilisateurs prêts à avancer maintenant",
        proItems: [
          "Téléchargement du dossier de formulaires",
          "Accès aux outils avancés de préparation",
          "Idéal pour finaliser rapidement",
        ],
        premiumTitle: "Premium — 99 $ / 90 jours",
        premiumSubtitle:
          "Pour une préparation plus complète sur une plus longue période",
        premiumItems: [
          "Tout ce qui est inclus dans Pro",
          "Fenêtre de travail plus longue",
          "Meilleur choix pour préparer un dossier complet",
        ],
        accessEyebrow: "Accès actuel",
        accessLabel: "Votre plan actuel",
        aiEyebrow: "Insight IA",
        aiSummarySingle:
          "L’IA a détecté 1 élément manquant qui pourrait affecter la complétude du dossier.",
        aiSummaryMulti: (count) =>
          `L’IA a détecté ${count} éléments manquants qui pourraient affecter la complétude du dossier.`,
        aiPromptLocked:
          "Passez à Pro ou Premium pour débloquer le téléchargement du dossier prérempli.",
        aiPromptEnabled:
          "Vous pouvez maintenant télécharger votre dossier prérempli lorsque les éléments requis sont prêts.",
        previewHintLocked:
          "Le mode Gratuit permet de voir ce qui manque avant de débloquer le téléchargement.",
        previewHintEnabled:
          "Votre accès actuel permet de télécharger le dossier dès que l’aperçu est prêt.",
        workspaceValue:
          "Ce studio vous aide à passer de l’information brute à un dossier plus structuré et plus prêt à l’action.",
        loadingAccess: "Chargement de votre accès...",
        loadingSaved: "Chargement...",
        viewPricing: "Voir les tarifs",
        unlockDownloadTitle: "Débloquez le téléchargement",
        unlockDownloadBody:
          "Passez à Pro pour télécharger votre dossier de formulaires.",
        upgradeToPro: "Passer à Pro",
        packageReadyTitle: "Votre dossier est prêt",
        packageReadyBody:
          "Passez à la génération de documents pour compléter votre dossier.",
        continueToDocuments: "Continuer vers les documents",
        unlockPdfPremium: "Débloquer PDF (Premium)",
        finalStepTitle: "Étape finale : générer votre dossier",
        aiStrong: "Votre dossier est solide",
        aiGaps: (count) => `Vous avez ${count} écarts critiques`,
        docsShort: "dossiers",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "AI Forms Studio",
      subtitle:
        "Preview your forms package for free, identify missing information, then unlock download when you are ready to move forward.",
      heroEyebrow: "Forms command center",
      heroTitle: "Generate the right package for every application type",
      heroBody:
        "Select an application type, complete useful fields, and generate a clear preview of required, conditional, and missing forms.",
      formsAvailable: "Types available",
      everyTypeReady: "Every type can generate a package",
      activeApplication: "Active application",
      noActiveCase: "No active case",
      previewStatus: "Preview status",
      previewNotGenerated: "Not generated",
      downloadAccess: "Download access",
      downloadUnlocked: "Download available",
      downloadLocked: "Access required",
      generatorReady: "Generator ready",
      setupEyebrow: "Setup",
      setupTitle: "Build a forms package",
      setupBody:
        "Choose your application type, then let the platform identify the relevant forms and the information still missing.",
      applicationType: "Application type",
      selectApplicationType: "Select an application type",
      representative: "I use a representative",
      preview: "Preview package",
      previewing: "Previewing...",
      download: "Download package",
      downloadPdf: "Download PDF",
      downloading: "Downloading...",
      inlineEyebrow: "Completion",
      inlineTitle: "Complete useful fields",
      inlineBody:
        "Add missing details here to improve package completeness and the quality of prefilled fields.",
      autosave: "Synced with your workspace",
      autosaving: "Syncing...",
      summaryEyebrow: "Summary",
      summaryTitle: "Package preview",
      formsCount: "Forms count",
      completeness: "Completeness",
      formsTitle: "Required and conditional forms",
      mappedFields: "Mapped fields",
      missingFields: "Missing fields",
      noMissingFields: "No missing fields detected.",
      noMappedFields: "No mapped fields yet.",
      notReady: "Needs completion",
      ready: "Ready",
      required: "Required",
      conditional: "Conditional",
      missingTitle: "Items to complete before download",
      noMissingItems: "No critical missing items at the moment.",
      upgradeTitle: "Your package is ready to unlock",
      upgradeBody:
        "Preview for free, then unlock download with Pro (30 days) or choose Premium (90 days) for a longer and more complete preparation workspace.",
      emptyTitle: "No preview yet",
      emptyBody:
        "Choose an application type, complete useful fields, then generate a preview to see the required forms.",
      noInlineFields:
        "No additional recommended fields for this application type yet.",
      disclaimer:
        "NorthBridgeAI helps you prepare forms based on the information you provide. You remain responsible for final review and any submission to IRCC.",
      launchEyebrow: "Packages",
      launchTitle: "Choose the right level of support",
      launchBody:
        "Free is ideal for exploring. Pro is built for users ready to finish quickly. Premium gives you more time and more tools for a fuller application process.",
      freeTitle: "Free",
      freeSubtitle: "Explore and identify missing items",
      freeItems: [
        "Forms package preview",
        "Saved progress",
        "Missing field detection",
      ],
      proTitle: "Pro — $39 / 30 days",
      proSubtitle: "For users ready to move now",
      proItems: [
        "Forms package download",
        "Access to more advanced preparation tools",
        "Best for finishing quickly",
      ],
      premiumTitle: "Premium — $99 / 90 days",
      premiumSubtitle: "For fuller preparation over a longer period",
      premiumItems: [
        "Everything in Pro",
        "Longer working window",
        "Best choice for building a complete case",
      ],
      accessEyebrow: "Current access",
      accessLabel: "Your current plan",
      aiEyebrow: "AI insight",
      aiSummarySingle:
        "AI detected 1 missing item that could affect package completeness.",
      aiSummaryMulti: (count) =>
        `AI detected ${count} missing items that could affect package completeness.`,
      aiPromptLocked:
        "Upgrade to Pro or Premium to unlock download of your prefilled package.",
      aiPromptEnabled:
        "You can now download your prefilled package when the required items are ready.",
      previewHintLocked:
        "Free mode lets you see what is missing before you unlock download.",
      previewHintEnabled:
        "Your current access lets you download the package once the preview is ready.",
      workspaceValue:
        "This studio helps you move from raw information to a more structured, action-ready application package.",
      loadingAccess: "Loading your access...",
      loadingSaved: "Loading...",
      viewPricing: "View pricing",
      unlockDownloadTitle: "Unlock download",
      unlockDownloadBody:
        "Upgrade to Pro to download your forms package.",
      upgradeToPro: "Upgrade to Pro",
      packageReadyTitle: "Your forms package is ready",
      packageReadyBody:
        "Move to document generation to complete your application.",
      continueToDocuments: "Continue to Document Generator",
      unlockPdfPremium: "Unlock PDF (Premium)",
      finalStepTitle: "Final step: generate your package",
      aiStrong: "Your package is strong",
      aiGaps: (count) => `You have ${count} critical gaps`,
      docsShort: "docs",
    };
  }, [language]);

  const selectedApplicationLabel =
    applicationTypes.find((item) => item.value === selectedApplicationType)
      ?.label ||
    selectedApplicationType ||
    pageText.selectApplicationType;

  return (
    <Layout>
      {message && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
          {message}
        </div>
      )}

      <PageHeader
        brand={pageText.brand}
        title={pageText.title}
        subtitle={pageText.subtitle}
      />
      <FormsStudioHero
        pageText={pageText}
        activeCase={activeCase}
        selectedApplicationLabel={selectedApplicationLabel}
        applicationTypesCount={applicationTypes.length}
        preview={preview}
        canDownloadForms={canDownloadForms}
        previewLoading={previewLoading}
        selectedApplicationType={selectedApplicationType}
        onPreview={handlePreviewPackage}
        onPricing={() => navigate(proPath)}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <StudioTabButton
          active={activeStudioTab === "setup"}
          onClick={() => setActiveStudioTab("setup")}
        >
          {pageText.setupTitle}
        </StudioTabButton>
        <StudioTabButton
          active={activeStudioTab === "results"}
          onClick={() => setActiveStudioTab("results")}
        >
          {pageText.summaryTitle}
        </StudioTabButton>
        <StudioTabButton
          active={activeStudioTab === "plans"}
          onClick={() => setActiveStudioTab("plans")}
        >
          {pageText.launchEyebrow}
        </StudioTabButton>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6 xl:sticky xl:top-24 self-start">
          {activeStudioTab === "setup" && (
          <Card variant="premium" padding="lg" className="rounded-lg">
            <StepHeader
              step="STEP 1"
              title={pageText.setupTitle}
              body={pageText.setupBody}
            />

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.applicationType}
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {applicationTypes.map((item) => (
                    <ApplicationTypeButton
                      key={item.value}
                      label={item.label}
                      active={selectedApplicationType === item.value}
                      disabled={loadingTypes}
                      statusLabel={pageText.generatorReady}
                      onClick={() => setSelectedApplicationType(item.value)}
                    />
                  ))}
                </div>
                {loadingTypes ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {pageText.loadingSaved}
                  </p>
                ) : null}
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={representativeUsed}
                  onChange={(e) => setRepresentativeUsed(e.target.checked)}
                />
                {pageText.representative}
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {pageText.accessEyebrow}
                </p>

                {accessLoading ? (
                  <p className="mt-3 text-sm text-slate-600">
                    {pageText.loadingAccess}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                      {pageText.accessLabel}: {currentPlanLabel}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {canDownloadForms
                        ? pageText.previewHintEnabled
                        : pageText.previewHintLocked}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <LockBadge
                        locked={!canDownloadForms}
                        label={
                          canDownloadForms
                            ? language === "fr"
                              ? "Téléchargement disponible"
                              : "Download available"
                            : language === "fr"
                            ? "Téléchargement indisponible"
                            : "Download unavailable"
                        }
                      />
                      <PlanPill active={canUseFormsAI}>
                        {canUseFormsAI
                          ? language === "fr"
                            ? "Aide IA avancée"
                            : "Advanced AI help"
                          : language === "fr"
                          ? "Aide IA limitée"
                          : "Limited AI help"}
                      </PlanPill>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
          )}

          {activeStudioTab === "setup" && (
          <Card padding="lg" className="rounded-lg">
            <StepHeader
              step="STEP 2"
              title={pageText.inlineTitle}
              body={pageText.inlineBody}
            />

            {loadingSavedApp ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
                {pageText.loadingSaved}
              </div>
            ) : activeFields.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {activeFields.map((field) => (
                  <div
                    key={field.name}
                    className={field.type === "textarea" ? "md:col-span-2" : ""}
                  >
                    {field.type !== "checkbox" && (
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {field.label}
                      </label>
                    )}
                    <FieldInput
                      field={field}
                      value={mergedApplicationData[field.name]}
                      onChange={handleInlineFieldChange}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                {pageText.noInlineFields}
              </div>
            )}

            <div className="mt-5 rounded-lg border border-amber-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-slate-800">
                {pageText.finalStepTitle}
              </p>

              <div className="mt-3">
                <Button
                  onClick={handlePreviewPackage}
                  disabled={previewLoading || !selectedApplicationType}
                  className="w-full"
                >
                  {previewLoading ? pageText.previewing : pageText.preview}
                </Button>
              </div>

              <p className="mt-3 text-xs text-amber-700">
                {savingInline ? pageText.autosaving : pageText.autosave}
              </p>
            </div>
          </Card>
          )}

          {activeStudioTab === "plans" && (
          <Card padding="lg" className="rounded-lg">
            <SectionIntro
              eyebrow={pageText.launchEyebrow}
              title={pageText.launchTitle}
              body={pageText.launchBody}
            />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <PlanPill active={!access?.is_pro && !access?.is_premium}>
                {pageText.freeTitle}
              </PlanPill>
              <PlanPill active={access?.is_pro && !access?.is_premium}>
                Pro
              </PlanPill>
              <PlanPill active={access?.is_premium}>Premium</PlanPill>
            </div>

            <div className="mt-5 space-y-4">
              <MonetizationCard
                title={pageText.freeTitle}
                subtitle={pageText.freeSubtitle}
                items={pageText.freeItems}
              />
              <MonetizationCard
                title={pageText.proTitle}
                subtitle={pageText.proSubtitle}
                items={pageText.proItems}
                accent="featured"
              />
              <MonetizationCard
                title={pageText.premiumTitle}
                subtitle={pageText.premiumSubtitle}
                items={pageText.premiumItems}
              />
            </div>
          </Card>
          )}

          <div className="text-xs leading-6 text-slate-500">
            {pageText.disclaimer}
          </div>
        </div>

        <div className="space-y-6">
          {preview ? (
            <>
              <Card padding="lg" className="rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                      {pageText.summaryEyebrow}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      {preview?.summary?.application_label || pageText.summaryTitle}
                    </h2>
                  </div>
                  <ProgressBadge score={preview?.summary?.completeness_score ?? 0} />
                </div>

                <CompletionBar score={preview?.summary?.completeness_score ?? 0} />

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <SummaryMetric
                    label={pageText.formsCount}
                    value={preview?.summary?.forms_count ?? 0}
                    accent="focus"
                  />
                  <SummaryMetric
                    label={pageText.completeness}
                    value={`${preview?.summary?.completeness_score ?? 0}%`}
                    accent={
                      (preview?.summary?.completeness_score ?? 0) >= 85
                        ? "good"
                        : "default"
                    }
                  />
                </div>

                {preview?.summary?.download_note ? (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                    {preview.summary.download_note}
                  </div>
                ) : null}
              </Card>

              {shouldShowUpgradePrompt && (
                <UpgradePrompt
                  title={pageText.upgradeTitle}
                  body={pageText.upgradeBody}
                  buttonLabel={pageText.viewPricing}
                />
              )}

              {preview && !canDownloadForms && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-lg font-semibold text-amber-900">
                    {pageText.unlockDownloadTitle}
                  </h3>

                  <p className="mt-2 text-sm text-amber-800">
                    {pageText.unlockDownloadBody}
                  </p>

                  <div className="mt-4">
                    <Button onClick={() => navigate(proPath)}>
                      {pageText.upgradeToPro}
                    </Button>
                  </div>
                </div>
              )}

              {canDownloadForms && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                  <h3 className="text-lg font-semibold text-emerald-900">
                    {pageText.packageReadyTitle}
                  </h3>

                  <p className="mt-2 text-sm text-emerald-800">
                    {pageText.packageReadyBody}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {showDownloadButton && (
                      <Button
                        onClick={handleDownloadPackage}
                        loading={downloadLoading}
                      >
                        {downloadLoading
                          ? pageText.downloading
                          : access?.is_premium
                          ? pageText.downloadPdf
                          : pageText.download}
                      </Button>
                    )}

                    <Button
                      onClick={() =>
                        navigate("/documents/generator?source=forms&intent=execute")
                      }
                    >
                      {pageText.continueToDocuments}
                    </Button>

                    {!access?.is_premium && (
                      <Button
                        variant="secondary"
                        onClick={() => navigate(premiumPath)}
                      >
                        {pageText.unlockPdfPremium}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <StudioTabButton
                  active={activeResultTab === "summary"}
                  onClick={() => setActiveResultTab("summary")}
                >
                  {pageText.aiEyebrow}
                </StudioTabButton>
                <StudioTabButton
                  active={activeResultTab === "forms"}
                  onClick={() => setActiveResultTab("forms")}
                >
                  {pageText.formsTitle}
                </StudioTabButton>
                <StudioTabButton
                  active={activeResultTab === "missing"}
                  onClick={() => setActiveResultTab("missing")}
                >
                  {pageText.missingTitle}
                </StudioTabButton>
              </div>

              {activeResultTab === "summary" && (
              <Card variant="soft" padding="lg" className="rounded-lg">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                      {pageText.aiEyebrow}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                      {language === "fr"
                        ? "Ce que l’IA voit dans votre dossier"
                        : "What AI sees in your package"}
                    </h2>
                  </div>
                  <ProgressBadge score={preview?.summary?.completeness_score ?? 0} />
                </div>

                <div className="mt-5 rounded-lg border border-amber-200 bg-stone-50 px-5 py-4">
                  <p className="text-lg font-semibold text-slate-900">
                    {aiMissingCount === 0
                      ? pageText.aiStrong
                      : pageText.aiGaps(aiMissingCount)}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {aiMissingCount === 1
                      ? pageText.aiSummarySingle
                      : pageText.aiSummaryMulti(aiMissingCount)}
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
                  {canDownloadForms
                    ? pageText.aiPromptEnabled
                    : pageText.aiPromptLocked}
                </div>
              </Card>
              )}

              {activeResultTab === "forms" && (
              <Card padding="lg" className="rounded-lg">
                <SectionIntro
                  eyebrow={pageText.formsTitle}
                  title={pageText.formsTitle}
                />

                <div className="mt-5 space-y-4">
                  {(preview?.forms || []).map((form) => (
                    <details
                      key={form.code}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {form.code}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              form.ready
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {form.ready ? pageText.ready : pageText.notReady}
                          </span>

                          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            {form.required
                              ? pageText.required
                              : pageText.conditional}
                          </span>
                        </div>

                        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
                          {form.title}
                        </h3>

                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {form.description}
                        </p>
                      </summary>

                      <div className="mt-5 grid gap-5 xl:grid-cols-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {pageText.mappedFields}
                          </p>

                          <div className="mt-3 space-y-2">
                            {Object.entries(form.mapped_fields || {}).length > 0 ? (
                              Object.entries(form.mapped_fields || {}).map(
                                ([key, value]) => (
                                  <div
                                    key={key}
                                    className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700"
                                  >
                                    <span className="font-semibold text-slate-900">
                                      {key}
                                    </span>
                                    : {String(value || "—")}
                                  </div>
                                )
                              )
                            ) : (
                              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                                {pageText.noMappedFields}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {pageText.missingFields}
                          </p>

                          <div className="mt-3 space-y-2">
                            {(form.missing_fields || []).length > 0 ? (
                              (form.missing_fields || []).map((field) => (
                                <div
                                  key={field}
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                                >
                                  {field}
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                {pageText.noMissingFields}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </Card>
              )}

              {activeResultTab === "missing" && (
              <Card variant="soft" padding="lg" className="rounded-lg">
                <SectionIntro
                  eyebrow={pageText.missingTitle}
                  title={pageText.missingTitle}
                />

                <div className="mt-5 space-y-2">
                  {(preview?.missing_fields || []).length > 0 ? (
                    (preview?.missing_fields || []).map((item, index) => (
                      <div
                        key={`${item.form_code}-${item.field}-${index}`}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                      >
                        <span className="font-semibold">{item.form_code}</span> —{" "}
                        {item.field}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      {pageText.noMissingItems}
                    </div>
                  )}
                </div>
              </Card>
              )}
            </>
          ) : (
            <Card variant="soft" padding="lg" className="rounded-lg">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {pageText.emptyTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {pageText.emptyBody}
              </p>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
