import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import UpgradeModal from "../components/UpgradeModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import LockBadge from "../components/ui/LockBadge";
import {
  getBillingStatus,
  getMyProfile,
  getMyStrategy,
  getMyStrategyLite,
  getToken,
  getCurrentUserLocal,
  getUserDisplayName,
  refreshCurrentUser,
} from "../api";
import {
  translateProgramLabel,
  translateStatusLabel,
  translateStrategySummary,
} from "../utils/frenchLocalization";

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "individual_pro") return "pro";
  if (value === "individual_premium") return "premium";
  if (value === "agent_pro") return "premium";
  if (value === "premium") return "premium";
  if (value === "pro") return "pro";
  return "free";
}

function hasPaidPlan(user, billingPlan) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return ["pro", "premium"].includes(normalizePlan(billingPlan || user.plan));
}

function isPremiumPlan(plan) {
  return normalizePlan(plan) === "premium";
}

function computeProfileCompletion(profile) {
  if (!profile) return 0;

  const fields = [
    profile.first_name,
    profile.last_name,
    profile.nationality,
    profile.current_country,
    profile.current_city,
    profile.marital_status,
    profile.preferred_language,
    profile.age,
    profile.education,
    profile.english_language_score || profile.language_score,
    profile.french_language_score,
    profile.experience_years,
    profile.occupation,
    profile.noc_code,
    profile.preferred_province,
  ];

  const completed = fields.filter((value) => {
    if (typeof value === "boolean") return true;
    if (typeof value === "number") return !Number.isNaN(value);
    return Boolean(String(value || "").trim());
  }).length;

  return Math.round((completed / fields.length) * 100);
}

function isStrategyUsable(strategy) {
  if (!strategy) return false;

  return Boolean(
    strategy?.crs_score ||
      strategy?.strategy?.crs_score ||
      strategy?.recommended_programs?.length ||
      strategy?.strategy?.recommended_programs?.length ||
      strategy?.next_steps?.length ||
      strategy?.strategy?.next_steps?.length ||
      strategy?.advisor_summary ||
      strategy?.strategy?.advisor_summary
  );
}

function extractStrategySummary(strategy) {
  if (!strategy) {
    return {
      crsScore: null,
      recommendations: [],
      nextSteps: [],
      summary: "",
      strategyHeadline: "",
      bestPathway: "",
      topImprovement: "",
    };
  }

  const crsScore =
    strategy?.crs_score ??
    strategy?.strategy?.crs_score ??
    strategy?.result?.crs_score ??
    strategy?.data?.crs_score ??
    null;

  const recommendations =
    strategy?.recommended_programs ||
    strategy?.strategy?.recommended_programs ||
    strategy?.result?.recommended_programs ||
    strategy?.pathways ||
    [];

  const nextSteps =
    strategy?.next_steps ||
    strategy?.strategy?.next_steps ||
    strategy?.result?.next_steps ||
    strategy?.suggested_next_actions ||
    [];

  const summary =
    strategy?.advisor_summary ||
    strategy?.strategy?.advisor_summary ||
    strategy?.result?.advisor_summary ||
    strategy?.overall_assessment ||
    "";

  const strategyHeadline =
    strategy?.strategy_headline ||
    strategy?.strategy?.strategy_headline ||
    strategy?.result?.strategy_headline ||
    "";

  const bestPathway =
    strategy?.best_pathway?.name ||
    strategy?.strategy?.best_pathway?.name ||
    strategy?.result?.best_pathway?.name ||
    (Array.isArray(recommendations) && recommendations.length > 0
      ? typeof recommendations[0] === "string"
        ? recommendations[0]
        : recommendations[0]?.name ||
          recommendations[0]?.title ||
          recommendations[0]?.program ||
          ""
      : "");

  const topImprovement =
    Array.isArray(nextSteps) && nextSteps.length > 0
      ? typeof nextSteps[0] === "string"
        ? nextSteps[0]
        : nextSteps[0]?.label ||
          nextSteps[0]?.title ||
          nextSteps[0]?.action ||
          ""
      : "";

  return {
    crsScore,
    recommendations: Array.isArray(recommendations) ? recommendations : [],
    nextSteps: Array.isArray(nextSteps) ? nextSteps : [],
    summary,
    strategyHeadline,
    bestPathway,
    topImprovement,
  };
}

function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
        {subtitle}
      </p>
    </div>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm shadow-sm transition-all duration-200 ${
        active
          ? "border-blue-200 bg-blue-50 font-semibold text-blue-700 shadow-[0_8px_24px_rgba(37,99,235,0.10)]"
          : "border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({ label, value, body, tone = "default" }) {
  const toneClass = {
    default: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
    emerald: "border-emerald-200 bg-emerald-50",
  };

  return (
    <div
      className={`rounded-[24px] border p-5 shadow-sm ${
        toneClass[tone] || toneClass.default
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-900">
        {value || "—"}
      </p>
      {body ? <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p> : null}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ProgressBar({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-900 transition-all duration-300"
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500">{safeValue}%</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-right text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title, action = null }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function ActionCard({ title, body, buttonLabel, onClick, locked = false, lockedLabel = "Access required" }) {
  return (
    <Card padding="md" hover className="rounded-[28px]">
      <div className="flex h-full flex-col justify-between gap-5">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
            {locked ? (
              <LockBadge locked label={lockedLabel} />
            ) : null}
          </div>
          <p className="text-sm leading-6 text-slate-600">{body}</p>
        </div>

        <Button variant={locked ? "premium" : "secondary"} fullWidth onClick={onClick}>
          {buttonLabel}
        </Button>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUserLocal());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const currentPlanRaw = billing?.plan || currentUser?.plan || "free";
  const currentPlan = normalizePlan(currentPlanRaw);
  const paidAccess = hasPaidPlan(currentUser, currentPlanRaw);
  const isPremium = isPremiumPlan(currentPlanRaw);

  const profileCompletion = useMemo(
    () => computeProfileCompletion(profile),
    [profile]
  );

  const {
    crsScore,
    recommendations,
    nextSteps,
    summary,
    strategyHeadline,
    bestPathway,
    topImprovement,
  } = useMemo(() => extractStrategySummary(strategy), [strategy]);

  const hasStrategy = useMemo(() => isStrategyUsable(strategy), [strategy]);

  const localizedRecommendations = useMemo(
    () =>
      recommendations.map((item) => {
        if (typeof item === "string") return translateProgramLabel(item, language);
        const label = item?.name || item?.title || item?.program || "";
        return {
          ...item,
          name: label ? translateProgramLabel(label, language) : item?.name,
          title: item?.title ? translateProgramLabel(item.title, language) : item?.title,
          program: item?.program
            ? translateProgramLabel(item.program, language)
            : item?.program,
        };
      }),
    [language, recommendations]
  );

  const localizedBestPathway = useMemo(
    () => translateProgramLabel(bestPathway, language),
    [bestPathway, language]
  );

  const localizedTopImprovement = useMemo(
    () => translateStrategySummary(topImprovement, language),
    [language, topImprovement]
  );

  useEffect(() => {
    const forceRefresh = localStorage.getItem("nbai_force_refresh");

    if (forceRefresh === "true") {
      localStorage.removeItem("nbai_force_refresh");
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    async function load() {
      const token = getToken();

      if (!token) {
        navigate("/auth");
        return;
      }

      try {
        const refreshed = await refreshCurrentUser();
        setCurrentUser(refreshed?.data || refreshed);
      } catch {
        // keep local state
      }

      try {
        const [profileRes, billingRes] = await Promise.allSettled([
          getMyProfile(),
          getBillingStatus(),
        ]);

        let loadedProfile = null;

        if (profileRes.status === "fulfilled") {
          loadedProfile = profileRes.value.data;
          setProfile(loadedProfile);
        }

        if (billingRes.status === "fulfilled") {
          setBilling(billingRes.value.data);
        }

        if (loadedProfile && computeProfileCompletion(loadedProfile) >= 65) {
          setStrategyLoading(true);

          let strategyData = null;

          try {
            const liteRes = await getMyStrategyLite(language);
            strategyData = liteRes.data;
          } catch {
            try {
              const fullRes = await getMyStrategy(language);
              strategyData = fullRes.data;
            } catch (err) {
              console.error("Strategy load failed:", err);
            }
          } finally {
            setStrategy(strategyData);
            setStrategyLoading(false);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [navigate, language]);

  useEffect(() => {
    function handleRefresh() {
      window.location.reload();
    }

    window.addEventListener("nbai-strategy-refresh", handleRefresh);
    return () => window.removeEventListener("nbai-strategy-refresh", handleRefresh);
  }, []);

  useEffect(() => {
    if (hasStrategy && !paidAccess) {
      const timer = setTimeout(() => setShowUpgrade(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [hasStrategy, paidAccess]);

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        dashboard: "Tableau de bord",
        subtitle: "Votre centre de contrôle pour suivre votre stratégie, vos documents et vos prochaines actions.",
        overview: "Aperçu",
        execution: "Exécution",
        account: "Compte",
        commandCenter: "Centre de commande",
        readyTitle: "Votre dossier prend forme",
        pendingTitle: "Préparez votre stratégie personnalisée",
        readyBody: "Votre tableau de bord regroupe vos signaux clés, votre meilleure voie et les actions les plus importantes.",
        pendingBody: "Complétez davantage votre profil pour débloquer une stratégie plus précise.",
        profileCompletion: "Profil",
        crsScore: "Score CRS",
        bestPathway: "Meilleur parcours",
        topImprovement: "Priorité",
        strategyAvailable: "Stratégie disponible",
        profileInProgress: "Profil en progression",
        currentPlan: "Plan actuel",
        recommendedAction: "Action recommandée",
        completeProfile: "Compléter le profil",
        openStrategy: "Ouvrir la stratégie",
        updateProfile: "Mettre à jour le profil",
        openDocuments: "Mes documents",
        generateDocument: "Générateur de documents",
        reviewDocument: "Révision IA",
        openForms: "Studio formulaires",
        strategySnapshot: "Aperçu stratégique",
        recommendedPrograms: "Programmes recommandés",
        noPrograms: "Aucun programme disponible pour le moment.",
        noStrategyYet: "Votre stratégie n’est pas encore prête. Ajoutez plus d’informations à votre profil.",
        strategyLoading: "Chargement de votre stratégie personnalisée...",
        noPathway: "Aucun parcours détecté",
        noImprovement: "Aucune recommandation pour le moment",
        noStrategy: "Aucune stratégie disponible",
        accountSummary: "Résumé du compte",
        accountName: "Nom",
        email: "Email",
        billingStatus: "Statut d’abonnement",
        premiumAccess: "Accès Premium",
        active: "Actif",
        inactive: "Accès gratuit",
        unlocked: "Débloqué",
        locked: "Accès requis",
        managePlan: "Gérer le plan",
        upgrade: "Mettre à niveau",
        goPremium: "Passer à Premium",
        unlockTitle: "Débloquez l’exécution complète",
        unlockBody: "Passez à Pro pour utiliser les documents, les formulaires et la révision IA.",
        premiumTitle: "Passez à Premium pour finaliser",
        premiumBody: "Débloquez l’export PDF et une finition plus forte pour votre dossier.",
        freePlan: "Plan gratuit",
        quickActions: "Actions rapides",
        nextSteps: "Prochaines actions",
        profileStatusReady: "Prêt à avancer",
        profileStatusPending: "À compléter",
      };
    }

    return {
      dashboard: "Dashboard",
      subtitle: "Your command center for tracking your strategy, documents, and next best actions.",
      overview: "Overview",
      execution: "Execution",
      account: "Account",
      commandCenter: "Command center",
      readyTitle: "Your case is taking shape",
      pendingTitle: "Prepare your personalized strategy",
      readyBody: "Your dashboard brings together your key signals, strongest pathway, and most important actions.",
      pendingBody: "Complete more of your profile to unlock a more precise strategy.",
      profileCompletion: "Profile",
      crsScore: "CRS score",
      bestPathway: "Best pathway",
      topImprovement: "Priority",
      strategyAvailable: "Strategy available",
      profileInProgress: "Profile in progress",
      currentPlan: "Current plan",
      recommendedAction: "Recommended action",
      completeProfile: "Complete profile",
      openStrategy: "Open strategy",
      updateProfile: "Update profile",
      openDocuments: "My documents",
      generateDocument: "Document generator",
      reviewDocument: "AI review",
      openForms: "Forms Studio",
      strategySnapshot: "Strategy snapshot",
      recommendedPrograms: "Recommended programs",
      noPrograms: "No programs available yet.",
      noStrategyYet: "Your strategy is not ready yet. Add more profile information.",
      strategyLoading: "Loading your personalized strategy...",
      noPathway: "No pathway detected",
      noImprovement: "No recommendation available yet",
      noStrategy: "No strategy available",
      accountSummary: "Account summary",
      accountName: "Name",
      email: "Email",
      billingStatus: "Subscription status",
      premiumAccess: "Premium access",
      active: "Active",
      inactive: "Free access",
      unlocked: "Unlocked",
      locked: "Access required",
      managePlan: "Manage plan",
      upgrade: "Upgrade",
      goPremium: "Go Premium",
      unlockTitle: "Unlock full execution",
      unlockBody: "Upgrade to Pro to use documents, forms, and AI review.",
      premiumTitle: "Upgrade to Premium to finalize",
      premiumBody: "Unlock PDF export and a stronger finishing layer for your case.",
      freePlan: "Free Plan",
      quickActions: "Quick actions",
      nextSteps: "Next actions",
      profileStatusReady: "Ready to move",
      profileStatusPending: "Needs work",
    };
  }, [language]);

  const heroSummary = hasStrategy ? pageText.readyBody : pageText.pendingBody;
  const snapshotSummary =
    translateStrategySummary(strategyHeadline || summary, language) ||
    (hasStrategy ? pageText.strategyAvailable : pageText.noStrategyYet);

  const displayPlanLabel =
    currentPlan === "free"
      ? pageText.freePlan
      : currentPlan === "premium"
      ? "Premium"
      : "Pro";

  const subscriptionStatusLabel = (() => {
    const status = String(billing?.subscription_status || "").toLowerCase();
    if (status && language === "fr") {
      return translateStatusLabel(status, language);
    }
    return billing?.subscription_status || (paidAccess ? pageText.active : pageText.inactive);
  })();

  const accountDisplayName = getUserDisplayName(
    {
      ...currentUser,
      first_name: profile?.first_name || currentUser?.first_name,
      last_name: profile?.last_name || currentUser?.last_name,
      email:
        profile?.email ||
        currentUser?.email ||
        currentUser?.username ||
        currentUser?.preferred_username ||
        currentUser?.profile?.email,
      display_name:
        profile?.display_name ||
        profile?.full_name ||
        profile?.name ||
        currentUser?.display_name ||
        currentUser?.full_name ||
        currentUser?.name,
    },
    "—"
  );

  const recommendedAction = !profile
    ? { label: pageText.completeProfile, onClick: () => navigate("/profile") }
    : hasStrategy
    ? { label: pageText.openStrategy, onClick: () => navigate("/strategy") }
    : { label: pageText.updateProfile, onClick: () => navigate("/profile") };

  const quickActions = [
    {
      title: pageText.updateProfile,
      body: language === "fr" ? "Améliorez la précision de votre stratégie." : "Improve your strategy accuracy.",
      button: pageText.updateProfile,
      path: "/profile",
      locked: false,
    },
    {
      title: pageText.openStrategy,
      body: language === "fr" ? "Consultez votre meilleure voie et votre plan." : "Review your strongest pathway and plan.",
      button: pageText.openStrategy,
      path: "/strategy",
      locked: false,
    },
    {
      title: pageText.openDocuments,
      body: language === "fr" ? "Préparez les documents clés de votre dossier." : "Prepare the key documents for your case.",
      button: pageText.openDocuments,
      path: "/documents",
      locked: false,
    },
    {
      title: pageText.generateDocument,
      body: language === "fr" ? "Générez des brouillons avec l’IA." : "Generate AI-assisted document drafts.",
      button: pageText.generateDocument,
      path: paidAccess
        ? "/documents/generator?source=dashboard&intent=execute"
        : "/pricing?plan=pro&source=dashboard&intent=execute",
      locked: !paidAccess,
    },
    {
      title: pageText.reviewDocument,
      body: language === "fr" ? "Analysez et améliorez vos documents." : "Review and improve your documents.",
      button: pageText.reviewDocument,
      path: paidAccess
        ? "/documents/review?source=dashboard&intent=improve"
        : "/pricing?plan=pro&source=dashboard&intent=improve",
      locked: !paidAccess,
    },
    {
      title: pageText.openForms,
      body: language === "fr" ? "Structurez vos formulaires et votre dossier." : "Organize forms and application details.",
      button: pageText.openForms,
      path: paidAccess
        ? "/forms"
        : "/pricing?plan=pro&source=dashboard&intent=execute",
      locked: !paidAccess,
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <Card padding="lg" className="rounded-[28px]">
            <p className="text-lg font-medium text-slate-700">
              {language === "fr" ? "Chargement..." : "Loading..."}
            </p>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="NorthBridgeAI"
          title={pageText.dashboard}
          subtitle={pageText.subtitle}
        />

        <Card
          variant="soft"
          padding="lg"
          className="overflow-hidden rounded-[32px] border-slate-200 bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 text-white shadow-xl"
        >
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200">
                {pageText.commandCenter}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                {hasStrategy
                  ? localizedBestPathway || pageText.readyTitle
                  : pageText.pendingTitle}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">
                {heroSummary}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">
                  {displayPlanLabel}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">
                  {hasStrategy ? pageText.strategyAvailable : pageText.profileInProgress}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-50">
                  {profileCompletion}% {pageText.profileCompletion}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="white" onClick={recommendedAction.onClick}>
                  {recommendedAction.label}
                </Button>
                <Button variant="outlineLight" onClick={() => navigate("/strategy")}>
                  {pageText.openStrategy}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100">
                  {pageText.crsScore}
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
                  {hasStrategy ? crsScore ?? "—" : "—"}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100">
                  {pageText.profileCompletion}
                </p>
                <div className="mt-4">
                  <ProgressBar value={profileCompletion} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <TabButton
            active={activeTab === "overview"}
            label={pageText.overview}
            onClick={() => setActiveTab("overview")}
          />
          <TabButton
            active={activeTab === "execution"}
            label={pageText.execution}
            onClick={() => setActiveTab("execution")}
          />
          <TabButton
            active={activeTab === "account"}
            label={pageText.account}
            onClick={() => setActiveTab("account")}
          />
        </div>

        {activeTab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={pageText.profileCompletion}
                  value={`${profileCompletion}%`}
                  body={profileCompletion >= 85 ? pageText.profileStatusReady : pageText.profileStatusPending}
                  tone={profileCompletion >= 85 ? "emerald" : "amber"}
                />
                <MetricCard
                  label={pageText.crsScore}
                  value={hasStrategy ? crsScore ?? "—" : "—"}
                  body={hasStrategy ? pageText.strategyAvailable : pageText.noStrategy}
                  tone={hasStrategy ? "blue" : "default"}
                />
                <MetricCard
                  label={pageText.bestPathway}
                  value={hasStrategy ? localizedBestPathway || pageText.noPathway : pageText.noStrategy}
                  body={pageText.bestPathway}
                  tone={hasStrategy ? "emerald" : "default"}
                />
                <MetricCard
                  label={pageText.topImprovement}
                  value={hasStrategy ? localizedTopImprovement || pageText.noImprovement : pageText.noStrategy}
                  body={pageText.recommendedAction}
                  tone={hasStrategy ? "amber" : "default"}
                />
              </div>

              <Card padding="lg" className="rounded-[28px]">
                <SectionTitle
                  eyebrow={pageText.overview}
                  title={pageText.strategySnapshot}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => navigate("/strategy")}>
                      {pageText.openStrategy}
                    </Button>
                  }
                />

                {strategyLoading ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    {pageText.strategyLoading}
                  </div>
                ) : hasStrategy ? (
                  <>
                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {pageText.strategySnapshot}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {snapshotSummary}
                      </p>
                    </div>

                    <div className="mt-5">
                      <p className="text-sm font-semibold text-slate-900">
                        {pageText.recommendedPrograms}
                      </p>

                      {localizedRecommendations.length > 0 ? (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {localizedRecommendations.slice(0, 4).map((item, index) => {
                            const label =
                              typeof item === "string"
                                ? item
                                : item?.name ||
                                  item?.title ||
                                  item?.program ||
                                  (language === "fr" ? "Recommandation" : "Recommendation");

                            return (
                              <div
                                key={`${label}-${index}`}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                              >
                                {label}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          {pageText.noPrograms}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                    {pageText.noStrategyYet}
                  </div>
                )}
              </Card>

              {!paidAccess && hasStrategy && (
                <Card variant="warning" padding="lg">
                  <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                    {pageText.unlockTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {pageText.unlockBody}
                  </p>
                  <div className="mt-5">
                    <Button
                      variant="premium"
                      onClick={() =>
                        navigate("/pricing?plan=pro&source=dashboard&intent=execute")
                      }
                    >
                      {pageText.upgrade}
                    </Button>
                  </div>
                </Card>
              )}

              {paidAccess && !isPremium && (
                <Card variant="premium" padding="lg">
                  <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                    {pageText.premiumTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {pageText.premiumBody}
                  </p>
                  <div className="mt-5">
                    <Button
                      variant="premium"
                      onClick={() =>
                        navigate("/pricing?plan=premium&source=dashboard&intent=export")
                      }
                    >
                      {pageText.goPremium}
                    </Button>
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card padding="md" className="rounded-[28px] xl:sticky xl:top-24">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {pageText.currentPlan}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {displayPlanLabel}
                </h3>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <MiniStat label={pageText.profileCompletion} value={`${profileCompletion}%`} />
                  <MiniStat label={pageText.crsScore} value={hasStrategy ? crsScore ?? "—" : "—"} />
                  <MiniStat label={pageText.recommendedPrograms} value={localizedRecommendations.length || 0} />
                </div>

                <div className="mt-5 grid gap-2">
                  <Button
                    variant="premium"
                    fullWidth
                    onClick={() =>
                      navigate(
                        isPremium
                          ? "/pricing"
                          : currentPlan === "pro"
                          ? "/pricing?plan=premium&source=dashboard&intent=export"
                          : "/pricing?plan=pro&source=dashboard&intent=execute"
                      )
                    }
                  >
                    {currentPlan === "pro" ? pageText.goPremium : pageText.upgrade}
                  </Button>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => navigate("/documents")}
                  >
                    {pageText.openDocuments}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "execution" && (
          <div className="space-y-6">
            <Card padding="lg" className="rounded-[28px]">
              <SectionTitle eyebrow={pageText.execution} title={pageText.quickActions} />

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {quickActions.map((item) => (
                  <ActionCard
                    key={item.title}
                    title={item.title}
                    body={item.body}
                    buttonLabel={item.button}
                    locked={item.locked}
                    lockedLabel={language === "fr" ? "Accès requis" : "Access required"}
                    onClick={() => navigate(item.path)}
                  />
                ))}
              </div>
            </Card>

            <Card padding="lg" className="rounded-[28px]">
              <SectionTitle eyebrow={pageText.execution} title={pageText.nextSteps} />

              {hasStrategy && nextSteps.length > 0 ? (
                <div className="mt-5 space-y-2.5">
                  {nextSteps.slice(0, 4).map((item, index) => {
                    const label =
                      typeof item === "string"
                        ? translateStrategySummary(item, language)
                        : translateStrategySummary(
                            item?.label ||
                              item?.title ||
                              item?.action ||
                              (language === "fr" ? "Prochaine étape" : "Next step"),
                            language
                          );

                    return (
                      <div
                        key={`${label}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  {pageText.noStrategyYet}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "account" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card padding="lg" className="rounded-[28px]">
              <SectionTitle eyebrow={pageText.account} title={pageText.accountSummary} />

              <div className="mt-4">
                <InfoRow label={pageText.accountName} value={accountDisplayName} />
                <InfoRow label={pageText.currentPlan} value={displayPlanLabel} />
                <InfoRow label={pageText.billingStatus} value={subscriptionStatusLabel} />
                <InfoRow
                  label={pageText.premiumAccess}
                  value={
                    <LockBadge
                      locked={!isPremium}
                      label={isPremium ? pageText.unlocked : pageText.locked}
                    />
                  }
                />
              </div>

              <div className="mt-5">
                <Button variant="secondary" onClick={() => navigate("/pricing")}>
                  {pageText.managePlan}
                </Button>
              </div>
            </Card>

            <Card padding="lg" className="rounded-[28px]">
              <SectionTitle eyebrow={pageText.account} title={pageText.profileCompletion} />

              <div className="mt-5">
                <ProgressBar value={profileCompletion} />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <MiniStat label={pageText.profileCompletion} value={`${profileCompletion}%`} />
                <MiniStat label={pageText.currentPlan} value={displayPlanLabel} />
                <MiniStat
                  label={pageText.premiumAccess}
                  value={
                    <LockBadge
                      locked={!isPremium}
                      label={isPremium ? pageText.unlocked : pageText.locked}
                    />
                  }
                />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm leading-7 text-slate-700">
                  {profileCompletion >= 85
                    ? pageText.profileStatusReady
                    : pageText.profileStatusPending}
                </p>
              </div>

              <div className="mt-5">
                <Button onClick={() => navigate("/profile")}>
                  {pageText.updateProfile}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() =>
          navigate("/pricing?plan=pro&source=dashboard&intent=execute")
        }
        language={language}
        variant="pro"
        source="dashboard"
        intent="execute"
      />
    </Layout>
  );
}
