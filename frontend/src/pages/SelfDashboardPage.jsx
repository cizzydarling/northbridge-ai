import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import { getCurrentUserLocal, getMyJourney } from "../api";

const PROGRAM_KEY_MAP = {
  study_permit: "studyPermit",
  work_permit: "workPermit",
  spousal_sponsorship: "spousalSponsorship",
};

export default function SelfDashboardPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const currentUser = getCurrentUserLocal();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [journey, setJourney] = useState(null);

  useEffect(() => {
    loadDashboard(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  async function loadDashboard(initialLoad = false) {
    try {
      if (initialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");
      const res = await getMyJourney(i18n.language);
      setJourney(res.data);
    } catch (err) {
      console.error(err);
      setError(t("selfDashboard.loadError"));
      setJourney(null);
    } finally {
      if (initialLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  }

  const applicationLabel = useMemo(() => {
    const key = PROGRAM_KEY_MAP[journey?.matter_type];
    if (!key) return t("selfDashboard.notStarted");
    return t(`programs.${key}`);
  }, [journey, t]);

  const readinessRaw = journey?.readiness?.label || null;
  const readinessScore = journey?.readiness?.score ?? null;

  const readinessLabel = useMemo(() => {
    if (!readinessRaw) return t("selfDashboard.readinessStates.default");
    if (readinessRaw === "Strong") return t("selfDashboard.readinessStates.Strong");
    if (readinessRaw === "Moderate") return t("selfDashboard.readinessStates.Moderate");
    if (readinessRaw === "Weak") return t("selfDashboard.readinessStates.Weak");
    return readinessRaw;
  }, [readinessRaw, t]);

  const documentStats = journey?.documents || {
    total: 0,
    required: 0,
    completed_required: 0,
    remaining_required: 0,
    progress_percent: 0,
  };

  const recommendedRoute = journey?.recommended_route || "/self/application";

  const recommendedRouteLabel = useMemo(() => {
    if (recommendedRoute === "/profile") {
      return t("selfDashboard.routeLabels.profile");
    }
    if (recommendedRoute === "/strategy") {
      return t("selfDashboard.routeLabels.strategy");
    }
    if (recommendedRoute === "/self/documents") {
      return t("selfDashboard.routeLabels.documents");
    }
    if (recommendedRoute === "/chat") {
      return t("selfDashboard.routeLabels.chat");
    }
    if (recommendedRoute === "/dashboard") {
      return t("selfDashboard.routeLabels.dashboard");
    }
    return t("selfDashboard.routeLabels.application");
  }, [recommendedRoute, t]);

  const dashboardStatus = useMemo(() => {
    if (!journey?.application_started) {
      return t("selfDashboard.status.startApplication");
    }

    if (documentStats.required > 0 && documentStats.remaining_required > 0) {
      return t("selfDashboard.status.documentsRemaining", {
        percent: documentStats.progress_percent,
        count: documentStats.remaining_required,
      });
    }

    if (readinessRaw) {
      return t("selfDashboard.status.readiness", {
        readiness: readinessLabel,
        score:
          readinessScore !== null
            ? t("selfDashboard.status.readinessWithScore", {
                score: readinessScore,
              })
            : "",
      });
    }

    return t("selfDashboard.status.continueApplication");
  }, [
    journey,
    documentStats,
    readinessRaw,
    readinessLabel,
    readinessScore,
    t,
  ]);

  const heroTitle = useMemo(() => {
    if (!journey?.application_started) return t("selfDashboard.hero.startTitle");
    if (documentStats.remaining_required > 0) {
      return t("selfDashboard.hero.buildingTitle");
    }
    if (readinessRaw === "Strong") return t("selfDashboard.hero.strongTitle");
    if (readinessRaw === "Moderate") return t("selfDashboard.hero.moderateTitle");
    if (readinessRaw === "Weak") return t("selfDashboard.hero.weakTitle");
    return t("selfDashboard.hero.continueTitle");
  }, [journey, documentStats.remaining_required, readinessRaw, t]);

  const heroCtaLabel = useMemo(() => {
    if (!journey?.application_started) return t("selfDashboard.cta.startApplication");
    if (documentStats.remaining_required > 0) {
      return t("selfDashboard.cta.completeDocuments");
    }
    return t("selfDashboard.cta.reviewApplication");
  }, [journey, documentStats.remaining_required, t]);

  const nextBestActionText =
    journey?.next_best_action || t("selfDashboard.nextStep.review.body");

  function handleHeroContinue() {
    navigate(recommendedRoute);
  }

  function handlePrimaryAIAction() {
    navigate("/chat");
  }

  function handleCheckEligibility() {
    navigate("/strategy");
  }

  function handleOpenRecommendedStep() {
    navigate(recommendedRoute);
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-slate-700">{t("selfDashboard.loading")}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-600">{t("app.name")}</p>
              <h1 className="text-3xl font-bold text-[#0B1F3A]">
                {t("selfDashboard.welcome", {
                  email: currentUser?.email ? `, ${currentUser.email}` : "",
                })}
              </h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                {t("selfDashboard.subtitle")}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-64">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t("common.language")}
                </label>
                <select
                  value={i18n.language}
                  onChange={(e) => switchLanguage(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-red-500"
                >
                  <option value="en">{t("common.english")}</option>
                  <option value="fr">{t("common.french")}</option>
                </select>
              </div>

              <button
                onClick={() => loadDashboard(false)}
                disabled={refreshing}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {refreshing
                  ? i18n.language === "fr"
                    ? "Actualisation..."
                    : "Refreshing..."
                  : i18n.language === "fr"
                  ? "Actualiser le parcours"
                  : "Refresh journey"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mb-6 rounded-3xl bg-[#0B1F3A] p-6 text-white shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr] lg:items-center">
              <div>
                <p className="text-sm font-medium text-slate-300">
                  {journey?.application_started
                    ? applicationLabel
                    : t("selfDashboard.workspaceLabel")}
                </p>
                <h2 className="mt-2 text-3xl font-bold">{heroTitle}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  {dashboardStatus}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <button
                    onClick={handleCheckEligibility}
                    className="rounded-2xl border border-white/10 bg-white px-4 py-4 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      01
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {t("selfDashboard.actions.viewStrategy")}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {t("selfDashboard.routeLabels.strategy")}
                    </p>
                  </button>

                  <button
                    onClick={handleHeroContinue}
                    className="rounded-2xl border border-white/10 bg-white px-4 py-4 text-left text-slate-900 transition hover:bg-slate-100"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      02
                    </p>
                    <p className="mt-2 text-sm font-semibold">{heroCtaLabel}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {recommendedRouteLabel}
                    </p>
                  </button>

                  <button
                    onClick={handlePrimaryAIAction}
                    className="rounded-2xl border border-red-400/30 bg-red-600 px-4 py-4 text-left text-white transition hover:bg-red-700"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-100">
                      03
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {t("selfDashboard.actions.askAssistant")}
                    </p>
                    <p className="mt-1 text-xs text-red-100">
                      {t("selfDashboard.aiHelper")}
                    </p>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <HeroMetric
                    label={t("selfDashboard.metrics.readiness")}
                    value={readinessLabel}
                    helper={
                      readinessScore !== null
                        ? t("selfDashboard.metrics.scoreHelper", {
                            score: readinessScore,
                          })
                        : t("selfDashboard.metrics.noScore")
                    }
                  />
                  <HeroMetric
                    label={t("selfDashboard.metrics.documents")}
                    value={`${documentStats.progress_percent}%`}
                    helper={t("selfDashboard.metrics.requiredComplete", {
                      completed: documentStats.completed_required,
                      required: documentStats.required,
                    })}
                  />
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                    <span>{t("selfDashboard.documentReadiness")}</span>
                    <span>{documentStats.progress_percent}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10">
                    <div
                      className="h-3 rounded-full bg-red-500 transition-all"
                      style={{ width: `${documentStats.progress_percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
                    {t("selfDashboard.nextStep.title")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white">
                    {nextBestActionText}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={handleOpenRecommendedStep}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0B1F3A] transition hover:bg-slate-100"
                    >
                      {i18n.language === "fr"
                        ? "Aller à l’étape suivante"
                        : "Go to next step"}
                    </button>

                    <button
                      onClick={() => loadDashboard(false)}
                      disabled={refreshing}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
                    >
                      {refreshing
                        ? i18n.language === "fr"
                          ? "Actualisation..."
                          : "Refreshing..."
                        : i18n.language === "fr"
                        ? "Actualiser"
                        : "Refresh"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <SummaryCard
              label={t("selfDashboard.snapshot.readinessScore")}
              value={readinessScore !== null ? readinessScore : "—"}
            />
            <SummaryCard
              label={t("selfDashboard.snapshot.requiredRemaining")}
              value={documentStats.remaining_required}
            />
            <SummaryCard
              label={t("selfDashboard.snapshot.strategy")}
              value={
                journey?.strategy_ready
                  ? t("selfDashboard.available")
                  : t("selfDashboard.pending")
              }
              compact
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

function HeroMetric({ label, value, helper }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{helper}</p>
    </div>
  );
}

function SummaryCard({ label, value, compact = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`mt-2 font-bold text-slate-900 ${
          compact ? "text-sm" : "text-xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}