import { useEffect, useMemo, useState } from "react";
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

export default function SelfApplicationPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [profile, setProfile] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  async function loadPage() {
    try {
      setLoading(true);

      const [profileRes, savedAppRes, accessRes] = await Promise.allSettled([
        getMyProfile(),
        getSavedSelfApplication(),
        getMyAccess(),
      ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value.data);
      }

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
  }

  const hasDecisionEngine = Boolean(access?.features?.decision_engine);
  const hasAdvancedCopilot = Boolean(access?.features?.advanced_ai_copilot);

  const primaryRecommendation =
    workspace?.decision?.primary_recommendation ||
    workspace?.decision?.priority_label ||
    workspace?.strategy?.advisor_summary ||
    workspace?.eligibility?.summary ||
    null;

  const nextSteps =
    workspace?.strategy?.next_steps ||
    workspace?.eligibility?.next_steps ||
    workspace?.decision?.suggested_next_actions ||
    [];

  const pathways =
    workspace?.pathways ||
    workspace?.strategy?.recommended_programs ||
    [];

  const checklist = workspace?.checklist || [];

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        title: "Votre parcours d’application",
        subtitle:
          "Suivez votre progression et exécutez votre stratégie étape par étape.",
        priority: "Priorité actuelle",
        nextActions: "Prochaines actions",
        pathways: "Voies recommandées",
        checklist: "Checklist active",
        noData: "Aucune donnée disponible.",
        openDocs: "Gérer mes documents",
        openForms: "Ouvrir Forms Studio",
        openStrategy: "Voir ma stratégie",
        upgradeDecisionTitle: "Débloquez le moteur de décision",
        upgradeDecisionBody:
          "Passez à Pro pour obtenir des priorités intelligentes et des recommandations avancées.",
      };
    }

    return {
      title: "Your Application Journey",
      subtitle:
        "Track your progress and execute your strategy step by step.",
      priority: "Current priority",
      nextActions: "Next actions",
      pathways: "Recommended pathways",
      checklist: "Active checklist",
      noData: "No data available.",
      openDocs: "Manage my documents",
      openForms: "Open Forms Studio",
      openStrategy: "View my strategy",
      upgradeDecisionTitle: "Unlock decision engine",
      upgradeDecisionBody:
        "Upgrade to Pro to unlock smart prioritization and advanced execution guidance.",
    };
  }, [language]);

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
          title={text.upgradeDecisionTitle}
          body={text.upgradeDecisionBody}
          buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
        />
      )}

      <AICopilotCard
        title={
          language === "fr"
            ? "Copilote IA d’application"
            : "Application AI Copilot"
        }
        description={
          language === "fr"
            ? "Obtenez des recommandations sur vos prochaines actions."
            : "Get guidance on your next best actions."
        }
        buttonLabel={
          language === "fr"
            ? "Optimiser mon parcours"
            : "Optimize my journey"
        }
        language={language}
        prompt={
          language === "fr"
            ? "Analyse mon parcours d’immigration et dis-moi quelle est la prochaine meilleure action."
            : "Analyze my immigration journey and tell me the next best action."
        }
        premiumLocked={!hasAdvancedCopilot}
        premiumTitle={
          language === "fr"
            ? "Débloquez le copilote avancé"
            : "Unlock advanced AI copilot"
        }
        premiumBody={
          language === "fr"
            ? "Passez à Pro pour des recommandations plus profondes."
            : "Upgrade to Pro for deeper recommendations."
        }
        className="mb-6"
      />

      {workspace ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card variant="premium" padding="lg">
            <h2 className="text-lg font-semibold text-slate-900">
              {text.priority}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-700">
              {primaryRecommendation || text.noData}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => navigate("/strategy")}>
                {text.openStrategy}
              </Button>
              <Button variant="secondary" onClick={() => navigate("/forms")}>
                {text.openForms}
              </Button>
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="text-lg font-semibold text-slate-900">
              {text.nextActions}
            </h2>

            <div className="mt-3 space-y-2">
              {nextSteps.length > 0 ? (
                nextSteps.map((step, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700"
                  >
                    {step}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">{text.noData}</p>
              )}
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="text-lg font-semibold text-slate-900">
              {text.pathways}
            </h2>

            <div className="mt-3 space-y-2">
              {pathways.length > 0 ? (
                pathways.map((pathway, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700"
                  >
                    {pathway}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">{text.noData}</p>
              )}
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="text-lg font-semibold text-slate-900">
              {text.checklist}
            </h2>

            <div className="mt-3 space-y-2">
              {checklist.length > 0 ? (
                checklist.slice(0, 5).map((item, i) => (
                  <div
                    key={item.id || i}
                    className="rounded-lg border border-slate-200 p-3 text-sm"
                  >
                    <div className="font-medium text-slate-900">
                      {item.name}
                    </div>
                    {item.reason ? (
                      <div className="mt-1 text-slate-600">{item.reason}</div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">{text.noData}</p>
              )}
            </div>

            <div className="mt-5">
              <Button onClick={() => navigate("/self/documents")}>
                {text.openDocs}
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="text-sm text-slate-500">{text.noData}</div>
      )}
    </Layout>
  );
}