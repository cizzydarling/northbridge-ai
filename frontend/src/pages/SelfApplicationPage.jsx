import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
import UpgradePrompt from "../components/UpgradePrompt";
import {
  getMyAccess,
  getMyProfile,
  getSavedSelfApplication,
  runSelfWorkspace,
} from "../api";

function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-8 max-w-3xl">
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{subtitle}</p>
    </div>
  );
}

function SideNav({ items, active, setActive }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => setActive(item.key)}
          className={`text-left rounded-xl px-4 py-3 text-sm font-medium transition ${
            active === item.key
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const APPLICATION_TYPES = [
  {
    value: "permanent_residence",
    en: "Permanent residence",
    fr: "Residence permanente",
  },
  { value: "study_permit", en: "Study permit", fr: "Permis d'etudes" },
  { value: "work_permit", en: "Work permit", fr: "Permis de travail" },
  { value: "visitor_visa", en: "Visitor visa", fr: "Visa visiteur" },
  {
    value: "spousal_sponsorship",
    en: "Spousal sponsorship",
    fr: "Parrainage d'epoux / conjoint",
  },
];

function getProfileIntake(profile) {
  if (!profile) return {};

  return {
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    nationality: profile.nationality || "",
    current_country: profile.current_country || "",
    current_city: profile.current_city || "",
    marital_status: profile.marital_status || "",
    preferred_language: profile.preferred_language || "",
    age: profile.age ?? "",
    education: profile.education || "",
    language_score: profile.language_score ?? "",
    experience_years: profile.experience_years ?? "",
    occupation: profile.occupation || "",
    noc_code: profile.noc_code || "",
    preferred_province: profile.preferred_province || "",
  };
}

export default function SelfApplicationPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [workspace, setWorkspace] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("priority");
  const [selectedApplicationType, setSelectedApplicationType] = useState(
    "permanent_residence"
  );
  const userSelectedApplicationTypeRef = useRef(false);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);

      const [profileRes, savedAppRes, accessRes] = await Promise.allSettled([
        getMyProfile(),
        getSavedSelfApplication(),
        getMyAccess(),
      ]);

      if (accessRes.status === "fulfilled") {
        setAccess(accessRes.value.data);
      }

      const savedApplication =
        savedAppRes.status === "fulfilled" ? savedAppRes.value.data : null;
      const profile =
        profileRes.status === "fulfilled" ? profileRes.value.data : null;

      const intakePayload = savedApplication?.intake_payload || {};
      const applicationType = userSelectedApplicationTypeRef.current
        ? selectedApplicationType
        : intakePayload.application_type ||
          savedApplication?.matter_type ||
          selectedApplicationType;
      const nextIntakePayload = {
        ...intakePayload,
        ...getProfileIntake(profile),
        application_type: applicationType,
      };

      setSelectedApplicationType(applicationType);

      const workspaceRes = await runSelfWorkspace(
        {
          matter_type: applicationType,
          intake: nextIntakePayload,
        },
        language
      );

      setWorkspace(workspaceRes.data);
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de charger votre application."
          : "Failed to load your application."
      );
    } finally {
      setLoading(false);
    }
  }, [language, selectedApplicationType]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const hasDecisionEngine = Boolean(access?.features?.decision_engine);
  const hasAdvancedCopilot = Boolean(access?.features?.advanced_ai_copilot);

  const primaryRecommendation =
    workspace?.decision?.primary_recommendation ||
    workspace?.strategy?.advisor_summary ||
    workspace?.eligibility?.summary ||
    null;

  const nextSteps =
    workspace?.strategy?.next_steps ||
    workspace?.decision?.suggested_next_actions ||
    [];

  const pathways =
    workspace?.pathways ||
    workspace?.strategy?.recommended_programs ||
    [];

  const checklist = workspace?.checklist || [];

  const text = useMemo(() => {
    return language === "fr"
      ? {
          title: "Votre parcours d’application",
          subtitle: "Exécutez votre stratégie étape par étape.",
          priority: "Priorité",
          nextActions: "Actions",
          pathways: "Voies",
          checklist: "Checklist",
          noData: "Aucune donnée",
        }
      : {
          title: "Your Application Journey",
          subtitle: "Execute your strategy step by step.",
          priority: "Priority",
          nextActions: "Actions",
          pathways: "Pathways",
          checklist: "Checklist",
          noData: "No data",
        };
  }, [language]);

  const navItems = [
    { key: "priority", label: text.priority },
    { key: "actions", label: text.nextActions },
    { key: "pathways", label: text.pathways },
    { key: "checklist", label: text.checklist },
  ];

  async function handleApplicationTypeChange(value) {
    userSelectedApplicationTypeRef.current = true;
    setSelectedApplicationType(value);
    setMessage("");
  }

  if (loading) {
    return (
      <Layout>
        <div className="py-20 text-center text-slate-500">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      {message && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      )}

      <PageHeader title={text.title} subtitle={text.subtitle} />

      <Card padding="lg" className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {language === "fr" ? "Type de demande" : "Application type"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {language === "fr"
                ? "Choisissez le dossier a traiter"
                : "Choose what you want to process"}
            </h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[520px]">
            {APPLICATION_TYPES.map((item) => {
              const label = language === "fr" ? item.fr : item.en;
              const active = selectedApplicationType === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleApplicationTypeChange(item.value)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold transition ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {!hasDecisionEngine && (
        <UpgradePrompt
          className="mb-6"
          title="Unlock decision engine"
          body="Upgrade to Pro for full execution guidance."
          buttonLabel="View pricing"
        />
      )}

      <AICopilotCard
        title="AI Copilot"
        description="Get your next best action."
        buttonLabel="Optimize"
        language={language}
        prompt="Analyze my immigration journey and tell me next best step."
        premiumLocked={!hasAdvancedCopilot}
        className="mb-6"
      />

      {workspace && (
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* SIDE NAV */}
          <Card className="h-fit p-4">
            <SideNav
              items={navItems}
              active={activeTab}
              setActive={setActiveTab}
            />
          </Card>

          {/* CONTENT PANEL */}
          <Card padding="lg">
            {activeTab === "priority" && (
              <>
                <h2 className="text-xl font-semibold mb-4">
                  {text.priority}
                </h2>
                <p className="text-slate-700">
                  {primaryRecommendation || text.noData}
                </p>

                <div className="mt-6 flex gap-3">
                  <Button onClick={() => navigate("/strategy")}>
                    Strategy
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/forms")}>
                    Forms
                  </Button>
                </div>
              </>
            )}

            {activeTab === "actions" && (
              <>
                <h2 className="text-xl font-semibold mb-4">
                  {text.nextActions}
                </h2>
                <div className="space-y-2">
                  {nextSteps.length > 0 ? (
                    nextSteps.map((s, i) => (
                      <div
                        key={i}
                        className="p-3 border rounded-lg text-sm"
                      >
                        {s}
                      </div>
                    ))
                  ) : (
                    <p>{text.noData}</p>
                  )}
                </div>
              </>
            )}

            {activeTab === "pathways" && (
              <>
                <h2 className="text-xl font-semibold mb-4">
                  {text.pathways}
                </h2>
                <div className="space-y-2">
                  {pathways.length > 0 ? (
                    pathways.map((p, i) => (
                      <div
                        key={i}
                        className="p-3 border rounded-lg text-sm"
                      >
                        {p}
                      </div>
                    ))
                  ) : (
                    <p>{text.noData}</p>
                  )}
                </div>
              </>
            )}

            {activeTab === "checklist" && (
              <>
                <h2 className="text-xl font-semibold mb-4">
                  {text.checklist}
                </h2>
                <div className="space-y-2">
                  {checklist.length > 0 ? (
                    checklist.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 border rounded-lg text-sm"
                      >
                        <div className="font-medium">{c.name}</div>
                        <div className="text-slate-500 text-xs">
                          {c.reason}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>{text.noData}</p>
                  )}
                </div>

                <div className="mt-6">
                  <Button onClick={() => navigate("/self/documents")}>
                    Documents
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </Layout>
  );
}
