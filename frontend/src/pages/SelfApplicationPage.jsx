import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function SelfApplicationPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [workspace, setWorkspace] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("priority");

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);

      const [, savedAppRes, accessRes] = await Promise.allSettled([
        getMyProfile(),
        getSavedSelfApplication(),
        getMyAccess(),
      ]);

      if (accessRes.status === "fulfilled") {
        setAccess(accessRes.value.data);
      }

      const savedApplication =
        savedAppRes.status === "fulfilled" ? savedAppRes.value.data : null;

      const intakePayload = savedApplication?.intake_payload || {};

      const workspaceRes = await runSelfWorkspace(
        {
          matter_type: "permanent_residence",
          intake: intakePayload,
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
  }, [language]);

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
