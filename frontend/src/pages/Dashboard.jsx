import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import UpgradeModal from "../components/UpgradeModal";
import {
  getBillingStatus,
  getMyProfile,
  getMyStrategy,
  getMyStrategyLite,
  getToken,
  getCurrentUserLocal,
  refreshCurrentUser,
} from "../api";

function hasPaidPlan(user, billingPlan) {
  if (!user) return false;
  if (user.role === "admin") return true;

  const effectivePlan = billingPlan || user.plan;
  return ["individual_pro", "agent_pro", "individual_premium"].includes(
    effectivePlan
  );
}

function isPremiumPlan(plan) {
  return plan === "individual_premium";
}

function isProfileComplete(profile) {
  if (!profile) return false;

  return Boolean(
    profile.first_name &&
      profile.occupation &&
      profile.noc_code &&
      profile.preferred_province
  );
}

function extractStrategySummary(strategy) {
  if (!strategy) {
    return {
      crsScore: null,
      recommendations: [],
      nextSteps: [],
      summary: "",
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

  return {
    crsScore,
    recommendations: Array.isArray(recommendations) ? recommendations : [],
    nextSteps: Array.isArray(nextSteps) ? nextSteps : [],
    summary,
  };
}

function PremiumBlurCard({
  title,
  body,
  buttonLabel = "Unlock full strategy",
  onUpgrade,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-6 shadow">
      <div className="pointer-events-none select-none blur-[3px]">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Skilled pathway recommendation
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Province-specific option unlocked
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Recommended next legal and document steps
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
        <div className="mx-6 max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm">
          <p className="text-base font-semibold text-amber-900">{title}</p>
          <p className="mt-2 text-sm text-amber-800">{body}</p>
          <button
            onClick={onUpgrade}
            className="mt-4 rounded-xl bg-amber-600 px-5 py-2 text-sm text-white"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
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

  const currentPlan = billing?.plan || currentUser?.plan || "free";
  const paidAccess = hasPaidPlan(currentUser, currentPlan);
  const isPremium = isPremiumPlan(currentPlan);

  const { crsScore, recommendations, nextSteps, summary } = useMemo(
    () => extractStrategySummary(strategy),
    [strategy]
  );

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

      if (isProfileComplete(loadedProfile)) {
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

      setLoading(false);
    };

    load();
  }, [navigate]);

  useEffect(() => {
    if (strategy && !paidAccess) {
      const timer = setTimeout(() => {
        setShowUpgrade(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [strategy, paidAccess]);

  const nextAction = useMemo(() => {
    if (!profile || !isProfileComplete(profile)) {
      return {
        label: language === "fr" ? "Compléter le profil" : "Complete Profile",
        path: "/profile",
      };
    }

    if (strategyLoading) {
      return {
        label:
          language === "fr"
            ? "Construction de votre stratégie..."
            : "Building Your Strategy...",
        path: "/dashboard",
      };
    }

    if (!strategy) {
      return {
        label:
          language === "fr" ? "Voir ma stratégie" : "View My Strategy",
        path: "/strategy",
      };
    }

    if (!paidAccess) {
      return {
        label:
          language === "fr"
            ? "Débloquer formulaires et documents"
            : "Unlock Forms & Documents",
        path: "/pricing",
      };
    }

    if (paidAccess && !isPremium) {
      return {
        label:
          language === "fr"
            ? "Finaliser avec export PDF"
            : "Finalize with PDF Export",
        path: "/pricing",
      };
    }

    return {
      label:
        language === "fr"
          ? "Continuer ma demande"
          : "Continue My Application",
      path: "/documents",
    };
  }, [profile, strategy, strategyLoading, paidAccess, isPremium, language]);

  const secondaryAction = useMemo(() => {
    if (!profile || !isProfileComplete(profile)) {
      return {
        label: language === "fr" ? "Voir les tarifs" : "View Pricing",
        path: "/pricing",
      };
    }

    if (!strategy) {
      return {
        label: language === "fr" ? "Ouvrir le profil" : "Open Profile",
        path: "/profile",
      };
    }

    if (!paidAccess) {
      return {
        label: language === "fr" ? "Voir la stratégie" : "View Strategy",
        path: "/strategy",
      };
    }

    return {
      label: language === "fr" ? "Ouvrir Forms Studio" : "Open Forms Studio",
      path: "/forms",
    };
  }, [profile, strategy, paidAccess, language]);

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
      <div className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-600 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold">
                {language === "fr"
                  ? "Votre espace d’immigration guidé"
                  : "Your guided immigration workspace"}
              </h1>

              <p className="mt-4 text-sm text-blue-100">
                {language === "fr"
                  ? "Passez de l’incertitude à l’action avec un profil plus clair, une stratégie plus forte et un flux de préparation mieux organisé."
                  : "Move from uncertainty to action with a clearer profile, stronger strategy, and a more organized application workflow."}
              </p>

              {strategyLoading && (
                <div className="mt-5 rounded-2xl border border-blue-300/40 bg-white/10 px-4 py-3 text-sm text-blue-50">
                  {language === "fr"
                    ? "Nous construisons votre stratégie personnalisée..."
                    : "We’re building your personalized immigration strategy now..."}
                </div>
              )}

              {!strategyLoading && strategy && summary && (
                <div className="mt-5 rounded-2xl border border-blue-300/30 bg-white/10 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                    {language === "fr" ? "Aperçu stratégie" : "Strategy insight"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-blue-50">{summary}</p>
                </div>
              )}

              {!strategyLoading && strategy && (
                <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                    {language === "fr" ? "Simulateur de score" : "Score simulator"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-blue-50">
                    {paidAccess
                      ? language === "fr"
                        ? "Testez des scénarios d’amélioration et comparez les changements les plus susceptibles de faire évoluer votre résultat."
                        : "Test score-improvement scenarios and compare which change is most likely to move your result."
                      : language === "fr"
                      ? "Débloquez le simulateur pour tester des scénarios d’amélioration avant d’investir du temps dans la mauvaise étape."
                      : "Unlock the score simulator to test improvement scenarios before you spend time on the wrong next step."}
                  </p>
                  <button
                    onClick={() =>
                      navigate(paidAccess ? "/strategy/simulator" : "/pricing")
                    }
                    className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-900"
                  >
                    {paidAccess
                      ? language === "fr"
                        ? "Essayer le simulateur"
                        : "Try Score Simulator"
                      : language === "fr"
                      ? "Débloquer le simulateur"
                      : "Unlock Simulator"}
                  </button>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(nextAction.path)}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-900"
                  disabled={strategyLoading && nextAction.path === "/dashboard"}
                >
                  {strategyLoading
                    ? language === "fr"
                      ? "Construction..."
                      : "Building strategy..."
                    : nextAction.label}
                </button>

                <button
                  onClick={() => navigate(secondaryAction.path)}
                  className="rounded-xl border border-white px-5 py-3 text-sm"
                >
                  {secondaryAction.label}
                </button>
              </div>
            </div>

            <div className="grid min-w-[260px] gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                  CRS score
                </p>
                <p className="mt-3 text-4xl font-bold">
                  {crsScore ?? (strategyLoading ? "..." : "—")}
                </p>
                <p className="mt-2 text-xs text-blue-100">
                  {crsScore
                    ? language === "fr"
                      ? "Score estimé actuel"
                      : "Current estimated score"
                    : language === "fr"
                    ? "Complétez votre profil pour améliorer la précision"
                    : "Complete your profile to improve precision"}
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                  {language === "fr" ? "Statut du profil" : "Profile status"}
                </p>
                <p className="mt-3 text-xl font-semibold">
                  {profile && isProfileComplete(profile)
                    ? language === "fr"
                      ? "Prêt"
                      : "Ready"
                    : language === "fr"
                    ? "À compléter"
                    : "Needs completion"}
                </p>
                <p className="mt-2 text-xs text-blue-100">
                  {profile && isProfileComplete(profile)
                    ? language === "fr"
                      ? "Votre stratégie peut être générée"
                      : "Your strategy can be generated"
                    : language === "fr"
                    ? "Terminez la configuration pour de meilleurs résultats"
                    : "Finish setup to unlock stronger results"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {strategy && !paidAccess && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              {language === "fr"
                ? "Votre stratégie est prête — débloquez l’analyse complète"
                : "Your strategy is ready — unlock the full breakdown"}
            </p>

            <p className="mt-2 text-sm text-amber-800">
              {language === "fr"
                ? "Obtenez l’analyse détaillée des voies, la guidance documentaire, les actions personnalisées et le simulateur de score."
                : "Get detailed pathway analysis, document guidance, personalized action steps, and the score simulator."}
            </p>

            <button
              onClick={() => navigate("/pricing")}
              className="mt-4 rounded-xl bg-amber-600 px-5 py-2 text-sm text-white"
            >
              {language === "fr" ? "Débloquer la stratégie" : "Unlock Full Strategy"}
            </button>
          </div>
        )}

        {paidAccess && !isPremium && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
            <p className="text-sm text-purple-800">
              {language === "fr"
                ? "Vous êtes à une étape de la finition. Débloquez l’export PDF pour finaliser proprement."
                : "You're one step away from finishing your application. Unlock PDF export and finalize everything cleanly."}
            </p>

            <button
              onClick={() => navigate("/pricing")}
              className="mt-3 rounded-xl bg-purple-600 px-4 py-2 text-sm text-white"
            >
              {language === "fr" ? "Passer à Premium" : "Upgrade to Premium"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label={language === "fr" ? "Profil" : "Profile"}
            value={
              profile && isProfileComplete(profile)
                ? language === "fr"
                  ? "Complété"
                  : "Completed"
                : language === "fr"
                ? "Manquant"
                : "Missing"
            }
          />
          <StatCard
            label={language === "fr" ? "Stratégie" : "Strategy"}
            value={
              strategy
                ? language === "fr"
                  ? "Prête"
                  : "Ready"
                : strategyLoading
                ? language === "fr"
                  ? "En cours..."
                  : "Building..."
                : language === "fr"
                ? "Non démarrée"
                : "Not started"
            }
          />
          <StatCard label={language === "fr" ? "Plan" : "Plan"} value={currentPlan} />
          <StatCard
            label={language === "fr" ? "Accès" : "Access"}
            value={
              paidAccess
                ? language === "fr"
                  ? "Débloqué"
                  : "Unlocked"
                : language === "fr"
                ? "Verrouillé"
                : "Locked"
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow">
            <h3 className="text-xl font-semibold">
              {language === "fr" ? "Votre prochaine étape" : "Your next step"}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              {language === "fr"
                ? "Suivez le flux guidé pour avancer."
                : "Follow the guided flow to move forward."}
            </p>

            <button
              onClick={() => navigate(nextAction.path)}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-white"
              disabled={strategyLoading && nextAction.path === "/dashboard"}
            >
              {strategyLoading
                ? language === "fr"
                  ? "Préparation de votre stratégie..."
                  : "Preparing your strategy..."
                : nextAction.label}
            </button>
          </div>

          {!paidAccess ? (
            <PremiumBlurCard
              title={
                language === "fr"
                  ? "Recommandations premium"
                  : "Premium recommendations"
              }
              body={
                language === "fr"
                  ? "Débloquez vos meilleures voies, des recommandations adaptées et des prochaines étapes plus claires."
                  : "Unlock your top pathways, tailored recommendations, and clearer next steps."
              }
              onUpgrade={() => navigate("/pricing")}
            />
          ) : (
            <div className="rounded-2xl border bg-white p-6 shadow">
              <h3 className="text-xl font-semibold">
                {language === "fr" ? "Principales recommandations" : "Top recommendations"}
              </h3>

              {strategyLoading ? (
                <p className="mt-3 text-sm text-slate-600">
                  {language === "fr"
                    ? "Les recommandations sont en préparation..."
                    : "Strategy recommendations are being prepared..."}
                </p>
              ) : recommendations.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {recommendations.slice(0, 3).map((item, index) => {
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
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  {language === "fr"
                    ? "Complétez votre profil pour voir les recommandations."
                    : "Complete your profile to unlock recommendation insights."}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {!paidAccess ? (
            <PremiumBlurCard
              title={language === "fr" ? "Prochaines étapes prioritaires" : "Priority next steps"}
              body={
                language === "fr"
                  ? "Voyez les actions exactes à prendre ensuite selon votre profil et votre stratégie."
                  : "See the exact actions to take next based on your profile and strategy."
              }
              buttonLabel={language === "fr" ? "Débloquer le plan d’action" : "Unlock action plan"}
              onUpgrade={() => navigate("/pricing")}
            />
          ) : (
            <div className="rounded-2xl border bg-white p-6 shadow">
              <h3 className="text-xl font-semibold">
                {language === "fr" ? "Prochaines étapes prioritaires" : "Priority next steps"}
              </h3>

              {strategyLoading ? (
                <p className="mt-3 text-sm text-slate-600">
                  {language === "fr"
                    ? "Nous préparons vos actions..."
                    : "We’re preparing action steps for you..."}
                </p>
              ) : nextSteps.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {nextSteps.slice(0, 4).map((step, index) => {
                    const label =
                      typeof step === "string"
                        ? step
                        : step?.label || step?.title || step?.action || "Next step";

                    return (
                      <div
                        key={`${label}-${index}`}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {index + 1}
                        </div>
                        <p className="text-sm text-slate-700">{label}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  {language === "fr"
                    ? "Vos prochaines étapes personnalisées apparaîtront ici."
                    : "Your personalized next steps will appear here once your strategy is ready."}
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border bg-white p-6 shadow">
            <h3 className="text-xl font-semibold">
              {language === "fr" ? "Actions rapides" : "Fast actions"}
            </h3>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/profile")}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                {language === "fr" ? "Ouvrir le profil" : "Open Profile"}
              </button>

              <button
                onClick={() => navigate("/strategy")}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                {language === "fr" ? "Voir la stratégie" : "View Strategy"}
              </button>

              <button
                onClick={() =>
                  navigate(paidAccess ? "/strategy/simulator" : "/pricing")
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                {paidAccess
                  ? language === "fr"
                    ? "Simulateur de score"
                    : "Score Simulator"
                  : language === "fr"
                  ? "Débloquer le simulateur"
                  : "Unlock Simulator"}
              </button>

              <button
                onClick={() =>
                  paidAccess ? navigate("/forms") : navigate("/pricing")
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                {paidAccess
                  ? language === "fr"
                    ? "Forms Studio"
                    : "Forms Studio"
                  : language === "fr"
                  ? "Débloquer les formulaires"
                  : "Unlock Forms"}
              </button>

              <button
                onClick={() =>
                  isPremium ? navigate("/documents") : navigate("/pricing")
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                {isPremium
                  ? language === "fr"
                    ? "Mes documents"
                    : "My Documents"
                  : language === "fr"
                  ? "Export et documents"
                  : "Export & Documents"}
              </button>

              <button
                onClick={() => navigate("/pricing")}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                {language === "fr" ? "Voir les tarifs" : "View Pricing"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => navigate("/pricing")}
        language={language}
      />
    </Layout>
  );
}