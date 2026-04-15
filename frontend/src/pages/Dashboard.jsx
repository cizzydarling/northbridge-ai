import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import UpgradeModal from "../components/UpgradeModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  getBillingStatus,
  getMyProfile,
  getMyStrategy,
  getMyStrategyLite,
  getToken,
  getCurrentUserLocal,
  refreshCurrentUser,
} from "../api";

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();

  if (value === "individual_pro") return "pro";
  if (value === "individual_premium") return "premium";
  if (value === "premium") return "premium";
  if (value === "pro") return "pro";
  return "free";
}

function hasPaidPlan(user, billingPlan) {
  if (!user) return false;
  if (user.role === "admin") return true;

  const effectivePlan = billingPlan || user.plan;
  return ["individual_pro", "agent_pro", "individual_premium"].includes(
    effectivePlan
  );
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
    profile.language_score,
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

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 text-right">{value}</p>
    </div>
  );
}

function QuickActionButton({ label, onClick, variant = "secondary" }) {
  return (
    <Button variant={variant} onClick={onClick} className="justify-center">
      {label}
    </Button>
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

  useEffect(() => {
    const forceRefresh = localStorage.getItem("nbai_force_refresh");

    if (forceRefresh === "true") {
      localStorage.removeItem("nbai_force_refresh");
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    const load = async () => {
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
            const liteRes = await getMyStrategyLite();
            strategyData = liteRes.data;
          } catch {
            try {
              const fullRes = await getMyStrategy();
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
    };

    load();
  }, [navigate]);

  useEffect(() => {
    if (hasStrategy && !paidAccess) {
      const timer = setTimeout(() => {
        setShowUpgrade(true);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [hasStrategy, paidAccess]);

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        dashboard: "Tableau de bord",
        subtitle:
          "Suivez votre progression et avancez avec plus de clarté.",
        overviewLabel: "Vue d’ensemble",
        overviewTitleReady: "Votre dossier prend forme",
        overviewTitlePending: "Préparez votre stratégie personnalisée",
        overviewBodyReady:
          "Retrouvez ici vos indicateurs clés, votre meilleure voie actuelle et les prochaines actions recommandées.",
        overviewBodyPending:
          "Complétez davantage votre profil pour débloquer une stratégie plus précise et des recommandations plus utiles.",
        accountSummary: "Résumé du compte",
        currentPlan: "Plan actuel",
        billingStatus: "Statut d’abonnement",
        premiumAccess: "Accès Premium",
        email: "Email",
        accountName: "Nom",
        active: "Actif",
        inactive: "Inactif",
        unlocked: "Débloqué",
        locked: "Verrouillé",
        yes: "Oui",
        no: "Non",
        profileCompletion: "Complétion du profil",
        currentCrsScore: "Score CRS",
        bestPathway: "Meilleur parcours",
        topImprovement: "Priorité d’amélioration",
        noStrategy: "Stratégie non disponible",
        noImprovement: "Aucune recommandation pour le moment",
        noPathway: "Aucun parcours détecté",
        latestStrategy: "Dernier résultat stratégique",
        bestImmigrationOption: "Meilleure option actuelle",
        nextOptimization: "Meilleure prochaine optimisation",
        nextSteps: "Actions rapides",
        strategySnapshot: "Aperçu stratégique",
        recommendedPrograms: "Programmes recommandés",
        noPrograms: "Aucun programme disponible pour le moment.",
        openStrategy: "Ouvrir la stratégie",
        updateProfile: "Mettre à jour le profil",
        managePlan: "Gérer le plan",
        openDocuments: "Mes documents",
        openForms: "Forms Studio",
        generateDocument: "Générateur de documents",
        reviewDocument: "Révision IA",
        strategySummary: "Résumé stratégique",
        profileNeedsWork:
          "Complétez davantage votre profil pour améliorer la qualité des résultats.",
        strategyLoading: "Chargement de votre stratégie personnalisée...",
        noStrategyYet:
          "Votre stratégie n’est pas encore prête. Ajoutez plus d’informations dans votre profil pour générer un résultat exploitable.",
        unlockTitle: "Débloquez l’exécution complète",
        unlockBody:
          "Passez à Pro pour utiliser les outils documents, formulaires, révision IA et avancer plus vite.",
        upgrade: "Voir les tarifs",
        premiumTitle: "Passez à Premium pour finaliser",
        premiumBody:
          "Débloquez l’export PDF et une couche de finition plus forte pour votre dossier.",
        goPremium: "Passer à Premium",
        focusCard: "Focus principal",
        strategyAvailable: "Stratégie disponible",
        profileInProgress: "Profil en progression",
        nextRecommendedAction: "Action recommandée",
        completeProfile: "Compléter le profil",
      };
    }

    return {
      dashboard: "Dashboard",
      subtitle: "Track your progress and move forward with more clarity.",
      overviewLabel: "Overview",
      overviewTitleReady: "Your case is taking shape",
      overviewTitlePending: "Prepare your personalized strategy",
      overviewBodyReady:
        "See your key metrics, strongest current pathway, and recommended next actions at a glance.",
      overviewBodyPending:
        "Complete more of your profile to unlock a more precise strategy and stronger recommendations.",
      accountSummary: "Account summary",
      currentPlan: "Current plan",
      billingStatus: "Subscription status",
      premiumAccess: "Premium access",
      email: "Email",
      accountName: "Name",
      active: "Active",
      inactive: "Inactive",
      unlocked: "Unlocked",
      locked: "Locked",
      yes: "Yes",
      no: "No",
      profileCompletion: "Profile completion",
      currentCrsScore: "CRS score",
      bestPathway: "Best pathway",
      topImprovement: "Top improvement",
      noStrategy: "No strategy available",
      noImprovement: "No recommendation available yet",
      noPathway: "No pathway detected",
      latestStrategy: "Latest strategy result",
      bestImmigrationOption: "Best immigration option",
      nextOptimization: "Best next optimization opportunity",
      nextSteps: "Quick actions",
      strategySnapshot: "Strategy snapshot",
      recommendedPrograms: "Recommended programs",
      noPrograms: "No programs available.",
      openStrategy: "Open strategy",
      updateProfile: "Update profile",
      managePlan: "Manage plan",
      openDocuments: "My documents",
      openForms: "Forms Studio",
      generateDocument: "Document generator",
      reviewDocument: "AI review",
      strategySummary: "Strategy summary",
      profileNeedsWork:
        "Complete more of your profile to improve strategy quality.",
      strategyLoading: "Loading your personalized strategy...",
      noStrategyYet:
        "Your strategy is not ready yet. Add more profile information to generate a useful result.",
      unlockTitle: "Unlock full execution",
      unlockBody:
        "Upgrade to Pro to use documents, forms, AI review, and move faster.",
      upgrade: "View pricing",
      premiumTitle: "Upgrade to Premium to finalize",
      premiumBody:
        "Unlock PDF export and a stronger finishing layer for your case.",
      goPremium: "Go Premium",
      focusCard: "Main focus",
      strategyAvailable: "Strategy available",
      profileInProgress: "Profile in progress",
      nextRecommendedAction: "Recommended action",
      completeProfile: "Complete profile",
    };
  }, [language]);

  const heroSummary = strategyHeadline || summary || "";

  const subscriptionStatusLabel = billing?.subscription_status
    ? billing.subscription_status
    : paidAccess
    ? pageText.active
    : pageText.inactive;

  const accountDisplayName =
    currentUser?.first_name && currentUser?.last_name
      ? `${currentUser.first_name} ${currentUser.last_name}`
      : currentUser?.first_name || currentUser?.email || "—";

  const quickActions = [
    {
      label: pageText.updateProfile,
      path: "/profile",
      variant: "primary",
    },
    {
      label: pageText.openStrategy,
      path: "/strategy",
      variant: "secondary",
    },
    {
      label: pageText.openDocuments,
      path: "/documents",
      variant: "secondary",
    },
    {
      label: pageText.generateDocument,
      path: paidAccess
        ? "/documents/generator?source=dashboard&intent=execute"
        : "/pricing?plan=pro&source=dashboard&intent=execute",
      variant: "secondary",
    },
    {
      label: pageText.reviewDocument,
      path: paidAccess
        ? "/documents/review?source=dashboard&intent=improve"
        : "/pricing?plan=pro&source=dashboard&intent=improve",
      variant: "secondary",
    },
    {
      label: pageText.openForms,
      path: paidAccess
        ? "/forms"
        : "/pricing?plan=pro&source=dashboard&intent=execute",
      variant: "secondary",
    },
  ];

  const recommendedAction = !profile
    ? {
        label: pageText.completeProfile,
        onClick: () => navigate("/profile"),
      }
    : hasStrategy
    ? {
        label: pageText.openStrategy,
        onClick: () => navigate("/strategy"),
      }
    : {
        label: pageText.updateProfile,
        onClick: () => navigate("/profile"),
      };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <p className="text-lg">{language === "fr" ? "Chargement..." : "Loading..."}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              {pageText.dashboard}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {pageText.dashboard}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              {pageText.subtitle}
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={() =>
              navigate(
                isPremium
                  ? "/pricing"
                  : "/pricing?plan=pro&source=dashboard&intent=execute"
              )
            }
            className="hidden md:inline-flex"
          >
            {pageText.upgrade}
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-8">
            <Card variant="default" padding="lg" className="overflow-hidden">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {pageText.overviewLabel}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-[30px]">
                    {hasStrategy
                      ? bestPathway || pageText.overviewTitleReady
                      : pageText.overviewTitlePending}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
                    {heroSummary ||
                      (hasStrategy
                        ? pageText.overviewBodyReady
                        : pageText.overviewBodyPending)}
                  </p>
                </div>

                <div className="grid min-w-full grid-cols-1 gap-3 sm:min-w-[320px] sm:grid-cols-2 lg:max-w-[360px]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {pageText.currentCrsScore}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                      {hasStrategy ? crsScore ?? "—" : "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {pageText.nextRecommendedAction}
                    </p>
                    <div className="mt-3">
                      <Button
                        variant="primary"
                        onClick={recommendedAction.onClick}
                        className="w-full justify-center"
                      >
                        {recommendedAction.label}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={pageText.profileCompletion}
                value={`${profileCompletion}%`}
                description={pageText.profileNeedsWork}
                valueClassName="text-2xl"
                tone={profileCompletion >= 85 ? "success" : "warning"}
              />

              <StatCard
                label={pageText.currentCrsScore}
                value={hasStrategy ? crsScore ?? "—" : "—"}
                description={pageText.latestStrategy}
                valueClassName="text-4xl font-bold"
                tone={hasStrategy ? "info" : "default"}
              />

              <StatCard
                label={pageText.bestPathway}
                value={
                  hasStrategy ? bestPathway || pageText.noPathway : pageText.noStrategy
                }
                description={pageText.bestImmigrationOption}
                valueClassName="text-base md:text-lg"
                tone={hasStrategy ? "success" : "default"}
              />

              <StatCard
                label={pageText.topImprovement}
                value={
                  hasStrategy
                    ? topImprovement || pageText.noImprovement
                    : pageText.noStrategy
                }
                description={pageText.nextOptimization}
                valueClassName="text-sm md:text-base"
                tone={hasStrategy ? "warning" : "default"}
              />
            </div>

            <Card variant="default" padding="lg">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">
                  {pageText.nextSteps}
                </h2>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {quickActions.map((item) => (
                  <QuickActionButton
                    key={item.label}
                    label={item.label}
                    variant={item.variant}
                    onClick={() => navigate(item.path)}
                  />
                ))}
              </div>
            </Card>

            <Card variant="default" padding="lg">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">
                  {pageText.strategySnapshot}
                </h2>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                  {hasStrategy
                    ? pageText.strategyAvailable
                    : pageText.profileInProgress}
                </span>
              </div>

              {strategyLoading ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                  {pageText.strategyLoading}
                </div>
              ) : hasStrategy ? (
                <>
                  {heroSummary ? (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {pageText.strategySummary}
                      </p>
                      <p className="mt-2">{heroSummary}</p>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {pageText.recommendedPrograms}
                    </p>

                    {recommendations.length > 0 ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {recommendations.slice(0, 4).map((item, index) => {
                          const label =
                            typeof item === "string"
                              ? item
                              : item?.name ||
                                item?.title ||
                                item?.program ||
                                "Recommendation";

                          return (
                            <div
                              key={`${label}-${index}`}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                            >
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">
                        {pageText.noPrograms}
                      </p>
                    )}
                  </div>

                  {nextSteps.length > 0 ? (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {pageText.nextSteps}
                      </p>

                      <div className="mt-3 space-y-2">
                        {nextSteps.slice(0, 3).map((item, index) => {
                          const label =
                            typeof item === "string"
                              ? item
                              : item?.label ||
                                item?.title ||
                                item?.action ||
                                "Next step";

                          return (
                            <div
                              key={`${label}-${index}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                            >
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <Button onClick={() => navigate("/strategy")}>
                      {pageText.openStrategy}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                  {pageText.noStrategyYet}
                </div>
              )}
            </Card>

            {!paidAccess && hasStrategy && (
              <Card variant="warning" padding="lg">
                <h3 className="text-lg font-semibold text-slate-900">
                  {pageText.unlockTitle}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {pageText.unlockBody}
                </p>
                <div className="mt-4">
                  <Button
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
                <h3 className="text-lg font-semibold text-slate-900">
                  {pageText.premiumTitle}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {pageText.premiumBody}
                </p>
                <div className="mt-4">
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
            <Card variant="default" padding="lg" className="xl:sticky xl:top-6">
              <h2 className="text-xl font-semibold text-slate-900">
                {pageText.accountSummary}
              </h2>

              <div className="mt-4">
                <InfoRow label={pageText.accountName} value={accountDisplayName} />
                <InfoRow label={pageText.email} value={currentUser?.email || "—"} />
                <InfoRow label={pageText.currentPlan} value={currentPlan} />
                <InfoRow
                  label={pageText.billingStatus}
                  value={subscriptionStatusLabel}
                />
                <InfoRow
                  label={pageText.premiumAccess}
                  value={isPremium ? pageText.unlocked : pageText.locked}
                />
              </div>

              <div className="mt-5">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => navigate("/pricing")}
                >
                  {pageText.managePlan}
                </Button>
              </div>
            </Card>
          </div>
        </div>
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