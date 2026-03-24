import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import {
  downloadStrategyReport,
  getBillingStatus,
  getMyStrategy,
  getToken,
  logoutUser,
  refreshStrategy,
  getCurrentUserLocal,
  refreshCurrentUser,
} from "../api";

function canAccessStrategy(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return ["individual_pro", "agent_pro"].includes(user.plan);
}

function canAccessReports(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return ["individual_pro", "agent_pro"].includes(user.plan);
}

export default function StrategyPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [data, setData] = useState(null);
  const [billing, setBilling] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [currentUser, setCurrentUser] = useState(getCurrentUserLocal());

  const pricingPath = "/pricing";

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
    window.location.reload();
  }

  useEffect(() => {
    const loadUserAccess = async () => {
      try {
        setLoadingAccess(true);

        const token = getToken();
        if (!token) {
          navigate("/auth");
          return;
        }

        const localUser = getCurrentUserLocal();
        if (localUser) {
          setCurrentUser(localUser);
        }

        const refreshedUser = await refreshCurrentUser();
        setCurrentUser(refreshedUser);
      } catch (err) {
        console.error(err);

        if (err.response?.status === 401) {
          logoutUser();
          navigate("/auth");
          return;
        }
      } finally {
        setLoadingAccess(false);
      }
    };

    loadUserAccess();
  }, [navigate]);

  const fetchStrategy = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        navigate("/auth");
        return;
      }

      const [strategyRes, billingRes] = await Promise.all([
        isRefresh ? refreshStrategy(i18n.language) : getMyStrategy(i18n.language),
        getBillingStatus(),
      ]);

      setData(strategyRes.data);
      setBilling(billingRes.data);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      if (err.response?.status === 403) {
        setData(null);
        setMessage(
          err.response?.data?.detail || t("strategy.accessDenied")
        );
        return;
      }

      if (err.response?.status === 404) {
        setData(null);
        setMessage(t("strategy.completeProfileFirst"));
      } else {
        setMessage(
          err.response?.data?.detail || t("strategy.loadError")
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (loadingAccess) return;

    if (!canAccessStrategy(currentUser)) {
      setLoading(false);
      return;
    }

    fetchStrategy();
  }, [loadingAccess, currentUser]);

  const handleExportReport = async () => {
    if (!canAccessReports(currentUser)) {
      setMessage(t("strategy.exportRequiresPaidPlan"));
      return;
    }

    try {
      setMessage("");

      const response = await downloadStrategyReport();
      const blob = response?.data;

      if (!(blob instanceof Blob)) {
        throw new Error(t("strategy.exportError"));
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "northbridge_strategy_report.html";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 403) {
        setMessage(
          err.response?.data?.detail || t("strategy.exportRequiresPaidPlan")
        );
      } else {
        setMessage(
          err.response?.data?.detail || err.message || t("strategy.exportError")
        );
      }
    }
  };

  const isPremium = data?.is_premium === true || canAccessStrategy(currentUser);
  const recommendedPrograms = data?.recommended_programs || [];
  const improvementScenarios = data?.improvement_scenarios || [];
  const roadmap = data?.roadmap || [];
  const provinceRecommendations = data?.province_recommendations || [];
  const timelineEstimate = data?.timeline_estimate || {};
  const timelineSteps = timelineEstimate?.timeline_steps || [];
  const probabilityEstimate = data?.probability_estimate || {};
  const drawPrediction = data?.draw_prediction || {};
  const drawHints = drawPrediction?.category_hints || [];
  const strengths = data?.strengths || [];
  const weaknesses = data?.weaknesses || [];
  const strategyNextSteps = data?.next_steps || [];
  const advisorSummary = data?.advisor_summary || "";
  const crsScore = data?.crs_score ?? "--";
  const aiStrategy = data?.ai_strategy || t("strategy.noAiStrategy");

  const scoreLabel = useMemo(() => {
    if (typeof crsScore !== "number") {
      return t("strategy.scoreLabels.unavailable");
    }
    if (crsScore >= 500) {
      return t("strategy.scoreLabels.veryStrong");
    }
    if (crsScore >= 470) {
      return t("strategy.scoreLabels.strong");
    }
    if (crsScore >= 430) {
      return t("strategy.scoreLabels.competitive");
    }
    return t("strategy.scoreLabels.needsImprovement");
  }, [crsScore, t]);

  const topProgram = recommendedPrograms[0] || t("common.notAvailable");

  const timelineSummary = useMemo(() => {
    const minMonths = timelineEstimate?.estimated_pr_timeline_min_months;
    const maxMonths = timelineEstimate?.estimated_pr_timeline_max_months;

    if (typeof minMonths === "number" && typeof maxMonths === "number") {
      return `${minMonths}-${maxMonths} ${t("strategy.months")}`;
    }

    return t("common.notAvailable");
  }, [timelineEstimate, t]);

  const drawSummary = useMemo(() => {
    const min = drawPrediction?.predicted_cutoff_min;
    const max = drawPrediction?.predicted_cutoff_max;

    if (typeof min === "number" && typeof max === "number") {
      return `${min}-${max}`;
    }

    return t("common.notAvailable");
  }, [drawPrediction, t]);

  const dashboardNextSteps = useMemo(() => {
    if (strategyNextSteps.length > 0) {
      return strategyNextSteps.slice(0, 4);
    }

    const steps = [];

    if (recommendedPrograms.length > 0) {
      steps.push(
        t("strategy.fallbackNextStepPrioritize", {
          program: recommendedPrograms[0],
        })
      );
    }

    steps.push(t("strategy.fallbackNextStepDocuments"));

    return steps.slice(0, 4);
  }, [recommendedPrograms, strategyNextSteps, t]);

  if (loadingAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-medium text-slate-700">
              {t("strategy.loadingAccess")}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!canAccessStrategy(currentUser)) {
    return (
      <Layout>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">{t("app.name")}</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {t("strategy.upgradeRequired")}
              </h1>
              <p className="mt-3 text-slate-600">
                {t("strategy.upgradeRequiredBody")}
              </p>
            </div>

            <div className="w-full md:w-56">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("common.language")}
              </label>
              <select
                value={i18n.language}
                onChange={(e) => switchLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="en">{t("common.english")}</option>
                <option value="fr">{t("common.french")}</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => navigate(pricingPath)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              {t("strategy.upgradeNow")}
            </button>

            <button
              onClick={() => navigate("/profile")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              {t("strategy.goToProfile")}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-medium text-slate-700">
              {t("common.loading")}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {t("strategy.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("strategy.subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div className="w-full md:w-56">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {t("common.language")}
            </label>
            <select
              value={i18n.language}
              onChange={(e) => switchLanguage(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="en">{t("common.english")}</option>
              <option value="fr">{t("common.french")}</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(pricingPath)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              {t("common.pricing")}
            </button>

            <button
              onClick={handleExportReport}
              disabled={!canAccessReports(currentUser)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {t("strategy.exportStrategyReport")}
            </button>

            <button
              onClick={() => fetchStrategy(true)}
              disabled={refreshing}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              {refreshing ? t("common.loading") : t("strategy.refreshStrategy")}
            </button>
          </div>
        </div>
      </div>

      {billing?.plan === "free" && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
          {t("strategy.premiumNotice")}
        </div>
      )}

      {message && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {message}
        </div>
      )}

      {!message && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard
              label={t("strategy.currentCrsScore")}
              value={crsScore}
              badge={scoreLabel}
              description={t("strategy.strategySummary")}
              valueClassName="text-5xl"
            />

            <StatCard
              label={t("strategy.bestPathway")}
              value={topProgram}
              description={t("strategy.recommendedPrograms")}
              valueClassName="text-2xl"
            />

            <StatCard
              label={t("strategy.plan")}
              value={billing?.plan || currentUser?.plan || "free"}
              description={t("billing.currentPlan")}
              valueClassName="text-2xl"
            />

            <StatCard
              label={t("strategy.premiumAccess")}
              value={isPremium ? t("strategy.unlocked") : t("strategy.locked")}
              description={t("strategy.premiumFeatures")}
              valueClassName="text-2xl"
            />
          </div>

          {advisorSummary && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">
                {t("strategy.strategySummary")}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {advisorSummary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl xl:col-span-2">
              <h3 className="text-xl font-semibold text-slate-900">
                {t("strategy.recommendedPrograms")}
              </h3>

              {recommendedPrograms.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {recommendedPrograms.map((program, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="text-xs font-semibold uppercase text-blue-600">
                        {t("common.option", { index: index + 1 })}
                      </div>
                      <div className="mt-2 text-slate-800">{program}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {t("common.notAvailable")}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">
                {t("strategy.nextSteps")}
              </h3>

              <div className="mt-5 space-y-3">
                {dashboardNextSteps.map((step, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
                      {index + 1}
                    </div>
                    <p className="text-sm text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!isPremium && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">
                {t("strategy.premiumFeatures")}
              </h3>
              <ul className="mt-4 space-y-2 text-slate-700">
                <li>{t("strategy.premiumList.f1")}</li>
                <li>{t("strategy.premiumList.f2")}</li>
                <li>{t("strategy.premiumList.f3")}</li>
                <li>{t("strategy.premiumList.f4")}</li>
                <li>{t("strategy.premiumList.f5")}</li>
                <li>{t("strategy.premiumList.f6")}</li>
              </ul>
              <button
                onClick={() => navigate(pricingPath)}
                className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                {t("strategy.upgradeNow")}
              </button>
            </div>
          )}

          {isPremium && drawPrediction?.predicted_draw_type && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">
                {t("strategy.drawPredictor")}
              </h3>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                <DrawMetricCard
                  label={t("strategy.predictedDrawType")}
                  value={drawPrediction.predicted_draw_type}
                />
                <DrawMetricCard
                  label={t("strategy.predictedCutoff")}
                  value={drawSummary}
                />
                <DrawMetricCard
                  label={t("strategy.likelihood")}
                  value={drawPrediction.likelihood || t("common.notAvailable")}
                />
                <DrawMetricCard
                  label={t("strategy.timeWindow")}
                  value={
                    drawPrediction.estimated_time_window ||
                    t("common.notAvailable")
                  }
                />
              </div>

              {drawHints.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {drawHints.map((hint, index) => (
                    <li
                      key={index}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    >
                      {hint}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isPremium && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <h3 className="text-xl font-semibold text-slate-900">
                  {t("strategy.probabilityEngine")}
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <ProbabilityCard
                    label={t("strategy.probabilityCards.pr12Months")}
                    value={probabilityEstimate?.chance_of_pr_within_12_months}
                  />
                  <ProbabilityCard
                    label={t("strategy.probabilityCards.expressEntry")}
                    value={probabilityEstimate?.chance_via_express_entry}
                  />
                  <ProbabilityCard
                    label={t("strategy.probabilityCards.pnp")}
                    value={probabilityEstimate?.chance_via_pnp}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <h3 className="text-xl font-semibold text-slate-900">
                  {t("strategy.timelineEstimate")}
                </h3>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {timelineSummary}
                </p>

                {timelineSteps.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {timelineSteps.map((step, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="font-semibold text-slate-900">
                          {step.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {step.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {provinceRecommendations.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {t("strategy.provinceTargeting")}
                  </h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {provinceRecommendations.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-xs font-semibold uppercase text-blue-600">
                          {t("strategy.rankLabel", { index: index + 1 })}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {item.province}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          {item.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {roadmap.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {t("strategy.strategyRoadmap")}
                  </h3>
                  <div className="mt-4 space-y-4">
                    {roadmap.map((step, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="font-semibold text-slate-900">
                          {t("strategy.stepLabel", {
                            index: index + 1,
                            title: step.title,
                          })}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {step.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {improvementScenarios.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {t("strategy.improvementScenarios")}
                  </h3>
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {improvementScenarios.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="text-xs font-semibold uppercase text-blue-600">
                          {t("strategy.scenarioLabel", { index: index + 1 })}
                        </div>
                        <div className="mt-2 text-slate-800">{item.change}</div>
                        <div className="mt-4 text-sm text-slate-500">
                          {t("strategy.projectedCrs")}
                        </div>
                        <div className="mt-1 text-2xl font-bold text-slate-900">
                          {item.new_crs}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <h3 className="text-xl font-semibold text-slate-900">
                  {t("strategy.aiStrategy")}
                </h3>
                <div className="prose prose-slate mt-6 max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiStrategy}
                  </ReactMarkdown>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">
                {t("strategy.strengths")}
              </h3>
              {strengths.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {strengths.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {t("strategy.noStrengthsYet")}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">
                {t("strategy.weaknesses")}
              </h3>
              {weaknesses.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {weaknesses.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {t("strategy.noWeaknessesYet")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!message && !data && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mb-6 flex justify-end">
            <div className="w-full max-w-56">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("common.language")}
              </label>
              <select
                value={i18n.language}
                onChange={(e) => switchLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="en">{t("common.english")}</option>
                <option value="fr">{t("common.french")}</option>
              </select>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">
            {t("strategy.noStrategyAvailable")}
          </h2>
          <p className="mt-3 text-slate-600">
            {t("strategy.completeProfileFirst")}
          </p>
          <button
            onClick={() => navigate("/profile")}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white"
          >
            {t("strategy.goToProfile")}
          </button>
        </div>
      )}
    </Layout>
  );
}

function ProbabilityCard({ label, value }) {
  const numericValue = typeof value === "number" ? value : null;

  return (
    <div className="rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-bold text-slate-900">
        {numericValue !== null ? `${numericValue}%` : "--"}
      </p>
    </div>
  );
}

function DrawMetricCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value || "--"}</p>
    </div>
  );
}