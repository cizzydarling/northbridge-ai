import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import AICopilotCard from "../components/AICopilotCard";
import {
  getMyStrategy,
  downloadStrategyReport,
  getToken,
  logoutUser,
} from "../api";

export default function StrategyPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const redirectToDisclosure = () => {
    navigate("/legal/disclosure?redirect=/strategy");
  };

  const loadStrategy = async ({ isRefresh = false } = {}) => {
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

      const response = await getMyStrategy();
      setData(response.data);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      if (
        err.response?.status === 403 &&
        typeof err.response?.data?.detail === "string" &&
        err.response.data.detail.toLowerCase().includes("disclosures")
      ) {
        redirectToDisclosure();
        return;
      }

      if (err.response?.status === 404) {
        setData(null);
        setMessage(t("strategy.completeProfilePrompt"));
      } else {
        setMessage(err.response?.data?.detail || t("errors.server"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStrategy();
  }, []);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setMessage("");

      const response = await downloadStrategyReport();
      const blob = response?.data;

      if (!(blob instanceof Blob)) {
        throw new Error("Invalid download response.");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "northbridge_strategy_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);

      if (
        err.response?.status === 403 &&
        typeof err.response?.data?.detail === "string" &&
        err.response.data.detail.toLowerCase().includes("disclosures")
      ) {
        redirectToDisclosure();
        return;
      }

      setMessage(
        err.response?.data?.detail || err.message || t("errors.server")
      );
    } finally {
      setDownloading(false);
    }
  };

  const recommendedPrograms = Array.isArray(data?.recommended_programs)
    ? data.recommended_programs
    : [];
  const strengths = Array.isArray(data?.strengths) ? data.strengths : [];
  const weaknesses = Array.isArray(data?.weaknesses) ? data.weaknesses : [];
  const nextSteps = Array.isArray(data?.next_steps) ? data.next_steps : [];
  const roadmap = Array.isArray(data?.roadmap) ? data.roadmap : [];
  const improvementScenarios = Array.isArray(data?.improvement_scenarios)
    ? data.improvement_scenarios
    : [];
  const provinceRecommendations = Array.isArray(data?.province_recommendations)
    ? data.province_recommendations
    : [];
  const aiStrategy = data?.ai_strategy || "";
  const advisorSummary = data?.advisor_summary || "";
  const timelineEstimate = data?.timeline_estimate || {};
  const probabilityEstimate = data?.probability_estimate || {};
  const drawPrediction = data?.draw_prediction || {};
  const frenchAdvantage = data?.french_advantage || {};
  const crsScore = data?.crs_score ?? "--";
  const isPremium = Boolean(data?.is_premium);

  const frenchSignals = Array.isArray(frenchAdvantage?.signals)
    ? frenchAdvantage.signals
    : [];
  const frenchRecommendations = Array.isArray(frenchAdvantage?.recommendations)
    ? frenchAdvantage.recommendations
    : [];
  const frenchStrategicValue = frenchAdvantage?.strategic_value || "low";
  const hasFrenchAdvantage =
    frenchSignals.length > 0 || frenchRecommendations.length > 0;

  const frenchPriorityTitle = useMemo(() => {
    if (frenchStrategicValue === "high") {
      return t("strategy.frenchPriorityDetected");
    }
    if (frenchStrategicValue === "medium") {
      return t("strategy.frenchOpportunityDetected");
    }
    return t("strategy.frenchLanguageReview");
  }, [frenchStrategicValue, t]);

  const frenchPriorityDescription = useMemo(() => {
    if (frenchStrategicValue === "high") {
      return t("strategy.frenchPriorityHighBody");
    }
    if (frenchStrategicValue === "medium") {
      return t("strategy.frenchPriorityMediumBody");
    }
    return t("strategy.frenchPriorityLowBody");
  }, [frenchStrategicValue, t]);

  const scoreLabel = useMemo(() => {
    if (typeof crsScore !== "number") return t("strategy.scoreUnavailable");
    if (crsScore >= 500) return t("strategy.scoreVeryStrong");
    if (crsScore >= 470) return t("strategy.scoreStrong");
    if (crsScore >= 430) return t("strategy.scoreCompetitive");
    return t("strategy.scoreNeedsImprovement");
  }, [crsScore, t]);

  const timelineLabel = useMemo(() => {
    const min = timelineEstimate?.estimated_pr_timeline_min_months;
    const max = timelineEstimate?.estimated_pr_timeline_max_months;

    if (typeof min === "number" && typeof max === "number") {
      return `${min}-${max} ${t("strategy.monthsSuffix")}`;
    }

    return t("strategy.notAvailable");
  }, [timelineEstimate, t]);

  const expressEntryChance =
    typeof probabilityEstimate?.chance_via_express_entry === "number"
      ? `${probabilityEstimate.chance_via_express_entry}%`
      : "—";

  const pnpChance =
    typeof probabilityEstimate?.chance_via_pnp === "number"
      ? `${probabilityEstimate.chance_via_pnp}%`
      : "—";

  const twelveMonthChance =
    typeof probabilityEstimate?.chance_of_pr_within_12_months === "number"
      ? `${probabilityEstimate.chance_of_pr_within_12_months}%`
      : "—";

  const topProgram = recommendedPrograms[0] || t("strategy.notAvailable");

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <p className="text-slate-600">{t("strategy.loadingStrategy")}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {message && (
        <div
          className={`mb-6 rounded-2xl px-4 py-3 ${
            message.toLowerCase().includes("success")
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">{t("app.name")}</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            {t("strategy.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {t("strategy.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => navigate("/profile")}>
            {t("strategy.editProfile")}
          </Button>

          <Button
            variant="secondary"
            onClick={() => loadStrategy({ isRefresh: true })}
            disabled={refreshing}
          >
            {refreshing ? t("strategy.refreshing") : t("strategy.refresh")}
          </Button>

          {!isPremium && (
            <Button onClick={() => navigate("/pricing")}>
              {t("strategy.upgradeNow")}
            </Button>
          )}

          <Button onClick={handleDownload} disabled={!isPremium || downloading}>
            {downloading
              ? t("strategy.downloading")
              : t("strategy.downloadReport")}
          </Button>
        </div>
      </div>

      {!data && !message && (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            {t("strategy.noStrategyAvailable")}
          </h2>
          <p className="mt-3 text-slate-600">
            {t("strategy.completeProfilePrompt")}
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate("/profile")}>
              {t("dashboard.hero.primaryCta")}
            </Button>
          </div>
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <section className="rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-6 py-8 text-white shadow-xl md:px-8 md:py-10">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
                  {t("strategy.snapshotEyebrow")}
                </p>
                <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                  {isPremium
                    ? t("strategy.premiumStrategy")
                    : t("strategy.freeStrategy")}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">
                  {advisorSummary || t("strategy.noStrategicSummary")}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => navigate("/chat")}>
                    {t("nav.aiAssistant")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/profile")}
                  >
                    {t("strategy.editProfile")}
                  </Button>
                  {!isPremium && (
                    <Button onClick={() => navigate("/pricing")}>
                      {t("strategy.upgradeNow")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                    {t("strategy.metricCrs")}
                  </p>
                  <p className="mt-2 text-3xl font-bold">{crsScore}</p>
                  <p className="mt-2 text-sm text-blue-100">{scoreLabel}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                    {t("strategy.metricTimeline")}
                  </p>
                  <p className="mt-2 text-3xl font-bold">{timelineLabel}</p>
                  <p className="mt-2 text-sm text-blue-100">
                    {t("strategy.estimatedPrWindow")}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <AICopilotCard
            title={
              language === "fr"
                ? "Copilote IA de stratégie"
                : "Strategy AI Copilot"
            }
            description={
              language === "fr"
                ? "Obtenez une lecture claire de votre stratégie actuelle, de votre plus grand blocage, et de votre prochaine priorité."
                : "Get a clear reading of your current strategy, biggest blocker, and next priority."
            }
            buttonLabel={
              language === "fr"
                ? "Analyser ma stratégie"
                : "Analyze my strategy"
            }
            language={language}
            prompt={
              language === "fr"
                ? `Agis comme un copilote stratégique en immigration.

Analyse ma stratégie actuelle.

1. Résume ma situation en 2 phrases maximum
2. Explique pourquoi mon programme principal est prioritaire
3. Identifie mon plus grand point faible
4. Donne UNE action prioritaire immédiate
5. Retourne 3 suggested_next_actions très courtes avec verbes d’action`
                : `Act as an immigration strategy copilot.

Analyze my current strategy.

1. Summarize my situation in 2 sentences max
2. Explain why my top pathway is prioritized
3. Identify my biggest weakness
4. Give ONE immediate priority action
5. Return 3 very short suggested_next_actions with action verbs`
            }
          />

          {!isPremium && (
            <Card className="border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {t("strategy.unlockPremiumTitle")}
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    {t("strategy.unlockPremiumBody")}
                  </p>
                </div>

                <Button onClick={() => navigate("/pricing")}>
                  {t("strategy.upgradeNow")}
                </Button>
              </div>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={t("strategy.metricCrs")}
              value={crsScore}
              description={scoreLabel}
            />
            <MetricCard
              label={t("strategy.metricTopProgram")}
              value={topProgram}
              description={t("strategy.bestFitPathway")}
            />
            <MetricCard
              label={t("strategy.metricTimeline")}
              value={timelineLabel}
              description={t("strategy.estimatedPrWindow")}
            />
            <MetricCard
              label={t("strategy.metricTwelveMonthChance")}
              value={isPremium ? twelveMonthChance : t("strategy.locked")}
              description={
                isPremium
                  ? t("strategy.probabilityTitle")
                  : t("strategy.premiumInsight")
              }
              locked={!isPremium}
            />
          </div>

          {hasFrenchAdvantage && (
            <Card className="border border-blue-200 bg-blue-50 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                    {t("strategy.frenchPrioritySignal")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {frenchPriorityTitle}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                    {frenchPriorityDescription}
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    frenchStrategicValue === "high"
                      ? "bg-green-100 text-green-700"
                      : frenchStrategicValue === "medium"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t("strategy.strategicValueLabel", {
                    value: frenchStrategicValue,
                  })}
                </span>
              </div>

              {frenchRecommendations.length > 0 && (
                <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {t("strategy.whyThisMattersNow")}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {frenchRecommendations.slice(0, 3).map((item, index) => (
                      <li
                        key={index}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => navigate("/chat")}>
                  {t("strategy.askWhyFrenchPrioritized")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/profile")}
                >
                  {t("strategy.updateLanguageProfile")}
                </Button>
              </div>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="p-6 xl:col-span-2">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("strategy.pathwaysEyebrow")}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {t("strategy.recommendedProgramsTitle")}
                </h2>
              </div>

              {recommendedPrograms.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {recommendedPrograms.map((program, index) => (
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
                          ? t("strategy.primaryOption")
                          : t("common.option", { index: index + 1 })}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {program}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {t("strategy.noRecommendationsYet")}
                </p>
              )}
            </Card>

            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t("strategy.actionPlanEyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {t("strategy.nextStepsTitle")}
              </h2>

              {nextSteps.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {nextSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 ${
                        !isPremium ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {t("strategy.noNextStepsYet")}
                </p>
              )}

              {!isPremium && (
                <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    {t("strategy.unlockFullActionPlanTitle")}
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    {t("strategy.unlockFullActionPlanBody")}
                  </p>
                  <div className="mt-3">
                    <Button onClick={() => navigate("/pricing")}>
                      {t("strategy.upgradeNow")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <AICopilotCard
            title={
              language === "fr"
                ? "Que dois-je faire ensuite ?"
                : "What should I do next?"
            }
            description={
              language === "fr"
                ? "Obtenez une recommandation claire basée sur vos prochaines étapes et votre programme principal."
                : "Get a clear recommendation based on your next steps and top pathway."
            }
            buttonLabel={
              language === "fr"
                ? "Prioriser mes actions"
                : "Prioritize my actions"
            }
            language={language}
            prompt={
              language === "fr"
                ? `À partir de ma stratégie actuelle, de mon programme principal et de mes prochaines étapes, dis-moi ce que je dois prioriser maintenant.

Retourne:
1. une recommandation principale claire
2. la raison en 2 phrases maximum
3. 3 suggested_next_actions courtes liées à des actions concrètes`
                : `Based on my current strategy, top pathway, and next steps, tell me what I should prioritize now.

Return:
1. one clear main recommendation
2. the reason in 2 sentences max
3. 3 short suggested_next_actions tied to concrete actions`
            }
          />

          {hasFrenchAdvantage && (
            <Card className="p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("strategy.frenchAdvantageEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {t("strategy.frenchAdvantageTitle")}
                  </h2>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    frenchStrategicValue === "high"
                      ? "bg-green-100 text-green-700"
                      : frenchStrategicValue === "medium"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t("strategy.strategicValueLabel", {
                    value: frenchStrategicValue,
                  })}
                </span>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t("strategy.whatStrategySees")}
                  </h3>

                  {frenchSignals.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {frenchSignals.map((item, index) => (
                        <li
                          key={index}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      {t("strategy.noFrenchSignalsYet")}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t("strategy.recommendedNextMoves")}
                  </h3>

                  {frenchRecommendations.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {frenchRecommendations.map((item, index) => (
                        <li
                          key={index}
                          className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 ${
                            !isPremium ? "opacity-80" : ""
                          }`}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      {t("strategy.noFrenchRecommendationsYet")}
                    </p>
                  )}
                </div>
              </div>

              {!isPremium && (
                <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    {t("strategy.premiumGoDeeperTitle")}
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    {t("strategy.premiumGoDeeperBody")}
                  </p>
                  <div className="mt-3">
                    <Button onClick={() => navigate("/pricing")}>
                      {t("strategy.upgradeNow")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t("strategy.strengthEyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {t("strategy.strengthsTitle")}
              </h2>

              {strengths.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {strengths.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
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
            </Card>

            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t("strategy.weaknessEyebrow")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {t("strategy.weaknessesTitle")}
              </h2>

              {weaknesses.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {weaknesses.map((item, index) => (
                    <li
                      key={index}
                      className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 ${
                        !isPremium ? "blur-[2px] select-none" : ""
                      }`}
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

              {!isPremium && (
                <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    {t("strategy.weaknessPremiumTitle")}
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    {t("strategy.weaknessPremiumBody")}
                  </p>
                  <div className="mt-3">
                    <Button onClick={() => navigate("/pricing")}>
                      {t("strategy.upgradeNow")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t("strategy.advisorEyebrow")}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {t("strategy.strategicOverviewTitle")}
            </h2>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p
                className={`text-sm leading-7 text-slate-700 ${
                  !isPremium ? "blur-[2px] select-none" : ""
                }`}
              >
                {advisorSummary || t("strategy.noStrategicSummary")}
              </p>
            </div>

            {!isPremium && (
              <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  {t("strategy.advisorPremiumTitle")}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {t("strategy.advisorPremiumBody")}
                </p>
                <div className="mt-3">
                  <Button onClick={() => navigate("/pricing")}>
                    {t("strategy.upgradeNow")}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <PremiumSection
            isPremium={isPremium}
            buttonText={t("strategy.upgradeNow")}
            title={t("strategy.unlockFullInsightsTitle")}
            body={t("strategy.unlockFullInsightsBody")}
          >
            <>
              <AICopilotCard
                title={
                  language === "fr"
                    ? "Copilote IA des insights avancés"
                    : "Advanced Insights AI Copilot"
                }
                description={
                  language === "fr"
                    ? "Interprétez vos probabilités, votre feuille de route et vos scénarios d’amélioration."
                    : "Interpret your probabilities, roadmap, and improvement scenarios."
                }
                buttonLabel={
                  language === "fr"
                    ? "Interpréter mes insights"
                    : "Interpret my insights"
                }
                language={language}
                prompt={
                  language === "fr"
                    ? `À partir de mes insights avancés, explique:

1. ce que mes probabilités disent vraiment
2. ce que ma feuille de route suggère
3. quel scénario d’amélioration semble le plus utile
4. retourne 3 suggested_next_actions courtes et concrètes`
                    : `Based on my advanced insights, explain:

1. what my probabilities really mean
2. what my roadmap suggests
3. which improvement scenario seems most useful
4. return 3 short concrete suggested_next_actions`
                }
                className="mb-6"
              />

              <div className="grid gap-6 xl:grid-cols-3">
                <Card className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("strategy.forecastEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {t("strategy.probabilityTitle")}
                  </h2>

                  <div className="mt-5 space-y-4">
                    <MiniMetric
                      label={t("strategy.expressEntry")}
                      value={expressEntryChance}
                    />
                    <MiniMetric label={t("strategy.pnp")} value={pnpChance} />
                    <MiniMetric
                      label={t("strategy.twelveMonths")}
                      value={twelveMonthChance}
                    />
                  </div>
                </Card>

                <Card className="p-6 xl:col-span-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("strategy.advancedPlanningEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {t("strategy.roadmapTitle")}
                  </h2>

                  {roadmap.length > 0 ? (
                    <div className="mt-5 space-y-4">
                      {roadmap.map((step, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="font-semibold text-slate-900">
                            {t("strategy.stepLabel", { index: index + 1 })}:{" "}
                            {step.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {step.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      {t("strategy.noRoadmapAvailable")}
                    </p>
                  )}
                </Card>
              </div>

              {provinceRecommendations.length > 0 && (
                <Card className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("strategy.regionalFitEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {t("strategy.provinceRecommendationsTitle")}
                  </h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {provinceRecommendations.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("strategy.rankLabel", { index: index + 1 })}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {item.province}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          {item.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {improvementScenarios.length > 0 && (
                <Card className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("strategy.opportunityModelingEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {t("strategy.improvementScenariosTitle")}
                  </h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {improvementScenarios.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("strategy.scenarioLabel", { index: index + 1 })}
                        </p>
                        <p className="mt-2 text-sm text-slate-900">
                          {item.change}
                        </p>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t("strategy.projectedCrs")}
                        </p>
                        <p className="mt-1 text-2xl font-bold text-blue-900">
                          {item.new_crs}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {drawPrediction?.predicted_draw_type && (
                <Card className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("strategy.marketOutlookEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {t("strategy.drawOutlookTitle")}
                  </h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                    <MiniMetric
                      label={t("strategy.drawType")}
                      value={drawPrediction.predicted_draw_type || "—"}
                    />
                    <MiniMetric
                      label={t("strategy.likelihood")}
                      value={drawPrediction.likelihood || "—"}
                    />
                    <MiniMetric
                      label={t("strategy.timeWindow")}
                      value={drawPrediction.estimated_time_window || "—"}
                    />
                    <MiniMetric
                      label={t("strategy.cutoffRange")}
                      value={
                        typeof drawPrediction.predicted_cutoff_min ===
                          "number" &&
                        typeof drawPrediction.predicted_cutoff_max === "number"
                          ? `${drawPrediction.predicted_cutoff_min}-${drawPrediction.predicted_cutoff_max}`
                          : "—"
                      }
                    />
                  </div>
                </Card>
              )}

              {aiStrategy && (
                <Card className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("strategy.aiAdvisorEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {t("strategy.aiStrategyTitle")}
                  </h2>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                    <div className="prose prose-slate max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {aiStrategy}
                      </ReactMarkdown>
                    </div>
                  </div>
                </Card>
              )}
            </>
          </PremiumSection>

          {!isPremium && (
            <Card className="border border-blue-200 bg-blue-50 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {t("strategy.readyUnlockTitle")}
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    {t("strategy.readyUnlockBody")}
                  </p>
                </div>
                <Button onClick={() => navigate("/pricing")}>
                  {t("pricing.pageLabel")}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}

function PremiumSection({ isPremium, children, title, body, buttonText }) {
  if (isPremium) return children;

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className="pointer-events-none opacity-40 blur-[2px]">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/40 p-6 backdrop-blur-[1px]">
        <div className="max-w-md rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-xl">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-2 text-sm text-slate-600">{body}</p>
          <div className="mt-4">
            <Button onClick={() => (window.location.href = "/pricing")}>
              {buttonText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, description, locked = false }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold ${
          locked ? "text-slate-400" : "text-blue-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Card>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}