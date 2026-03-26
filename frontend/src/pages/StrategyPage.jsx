import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  getMyStrategy,
  downloadStrategyReport,
  getToken,
  logoutUser,
} from "../api";

export default function StrategyPage() {
  const navigate = useNavigate();

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
        setMessage("Complete your profile first to generate your strategy.");
      } else {
        setMessage(err.response?.data?.detail || "Failed to load strategy.");
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
        err.response?.data?.detail ||
          err.message ||
          "Failed to download report."
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

  const scoreLabel = useMemo(() => {
    if (typeof crsScore !== "number") return "Unavailable";
    if (crsScore >= 500) return "Very strong";
    if (crsScore >= 470) return "Strong";
    if (crsScore >= 430) return "Competitive";
    return "Needs improvement";
  }, [crsScore]);

  const timelineLabel = useMemo(() => {
    const min = timelineEstimate?.estimated_pr_timeline_min_months;
    const max = timelineEstimate?.estimated_pr_timeline_max_months;

    if (typeof min === "number" && typeof max === "number") {
      return `${min}-${max} months`;
    }

    return "Not available";
  }, [timelineEstimate]);

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

  const topProgram = recommendedPrograms[0] || "Not available";

  const topThreePrograms = recommendedPrograms.slice(0, 3);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <p className="text-slate-600">Loading your strategy...</p>
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
          <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Your Immigration Strategy
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Understand your position, prioritize the right actions, and increase
            your chances with a structured plan.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => navigate("/profile")}>
            Edit Profile
          </Button>

          <Button
            variant="secondary"
            onClick={() => loadStrategy({ isRefresh: true })}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>

          {!isPremium && (
            <Button onClick={() => navigate("/pricing")}>Upgrade</Button>
          )}

          <Button onClick={handleDownload} disabled={!isPremium || downloading}>
            {downloading ? "Downloading..." : "Download Report"}
          </Button>
        </div>
      </div>

      {!data && !message && (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            No strategy available yet
          </h2>
          <p className="mt-3 text-slate-600">
            Complete your profile to generate your first strategy.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate("/profile")}>
              Complete Profile
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
                  Strategy Snapshot
                </p>
                <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                  {isPremium ? "Premium Strategy" : "Free Strategy"}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">
                  {advisorSummary ||
                    "Your strategy is based on your current profile information."}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => navigate("/chat")}>
                    Ask AI Assistant
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/profile")}
                  >
                    Update Profile
                  </Button>
                  {!isPremium && (
                    <Button onClick={() => navigate("/pricing")}>
                      Unlock Premium
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                    CRS Score
                  </p>
                  <p className="mt-2 text-3xl font-bold">{crsScore}</p>
                  <p className="mt-2 text-sm text-blue-100">{scoreLabel}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                    Estimated Timeline
                  </p>
                  <p className="mt-2 text-3xl font-bold">{timelineLabel}</p>
                  <p className="mt-2 text-sm text-blue-100">
                    Expected PR window
                  </p>
                </div>
              </div>
            </div>
          </section>

          {!isPremium && (
            <Card className="border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Unlock premium strategy insights
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Get roadmap details, probability estimates, advanced
                    scenarios, draw outlook, province analysis, AI guidance, and
                    full report export.
                  </p>
                </div>

                <Button onClick={() => navigate("/pricing")}>
                  Upgrade to Premium
                </Button>
              </div>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="CRS Score"
              value={crsScore}
              description={scoreLabel}
            />
            <MetricCard
              label="Top Program"
              value={topProgram}
              description="Best-fit pathway"
            />
            <MetricCard
              label="Timeline"
              value={timelineLabel}
              description="Estimated PR window"
            />
            <MetricCard
              label="12-Month Chance"
              value={isPremium ? twelveMonthChance : "Locked"}
              description={
                isPremium ? "Estimated probability" : "Premium insight"
              }
              locked={!isPremium}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="p-6 xl:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Pathways
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Recommended Programs
                  </h2>
                </div>
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
                        {index === 0 ? "Primary option" : `Option ${index + 1}`}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {program}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No recommendations available yet.
                </p>
              )}
            </Card>

            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Action plan
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Next Steps
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
                  No next steps available yet.
                </p>
              )}

              {!isPremium && (
                <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Unlock the full action plan
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Premium gives you deeper sequencing, advanced action items,
                    and a stronger execution roadmap.
                  </p>
                  <div className="mt-3">
                    <Button onClick={() => navigate("/pricing")}>
                      See Premium
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {hasFrenchAdvantage && (
            <Card className="p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Francophone advantage
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    French-speaking pathway potential
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
                  {frenchStrategicValue} strategic value
                </span>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    What the strategy sees
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
                      No French-language signals available yet.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Recommended next moves
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
                      No French-language recommendations available yet.
                    </p>
                  )}
                </div>
              </div>

              {!isPremium && (
                <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Premium can go deeper here
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Unlock deeper strategy interpretation, province targeting,
                    and advanced planning tied to your broader immigration
                    profile.
                  </p>
                  <div className="mt-3">
                    <Button onClick={() => navigate("/pricing")}>
                      Upgrade to Premium
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Strength analysis
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Strengths
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
                <p className="mt-4 text-sm text-slate-500">No strengths yet.</p>
              )}
            </Card>

            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Improvement areas
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Weaknesses
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
                  No weaknesses yet.
                </p>
              )}

              {!isPremium && (
                <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Weakness analysis is premium
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Unlock the blockers that may reduce your score or delay your
                    pathway.
                  </p>
                  <div className="mt-3">
                    <Button onClick={() => navigate("/pricing")}>
                      Upgrade to Unlock
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Advisor summary
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Strategic Overview
            </h2>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p
                className={`text-sm leading-7 text-slate-700 ${
                  !isPremium ? "blur-[2px] select-none" : ""
                }`}
              >
                {advisorSummary || "No strategic summary available yet."}
              </p>
            </div>

            {!isPremium && (
              <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Full advisor summary available on Premium
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Unlock the complete AI-generated guidance tailored to your
                  profile.
                </p>
                <div className="mt-3">
                  <Button onClick={() => navigate("/pricing")}>
                    View Pricing
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <PremiumSection isPremium={isPremium}>
            <>
              <div className="grid gap-6 xl:grid-cols-3">
                <Card className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Forecast
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Probability
                  </h2>

                  <div className="mt-5 space-y-4">
                    <MiniMetric
                      label="Express Entry"
                      value={expressEntryChance}
                    />
                    <MiniMetric label="PNP" value={pnpChance} />
                    <MiniMetric label="12 Months" value={twelveMonthChance} />
                  </div>
                </Card>

                <Card className="p-6 xl:col-span-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Advanced planning
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Roadmap
                  </h2>

                  {roadmap.length > 0 ? (
                    <div className="mt-5 space-y-4">
                      {roadmap.map((step, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="font-semibold text-slate-900">
                            Step {index + 1}: {step.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {step.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      No roadmap available.
                    </p>
                  )}
                </Card>
              </div>

              {provinceRecommendations.length > 0 && (
                <Card className="p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Regional fit
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Province Recommendations
                  </h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {provinceRecommendations.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rank {index + 1}
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
                    Opportunity modeling
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Improvement Scenarios
                  </h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {improvementScenarios.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Scenario {index + 1}
                        </p>
                        <p className="mt-2 text-sm text-slate-900">
                          {item.change}
                        </p>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Projected CRS
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
                    Market outlook
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Draw Outlook
                  </h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                    <MiniMetric
                      label="Draw Type"
                      value={drawPrediction.predicted_draw_type || "—"}
                    />
                    <MiniMetric
                      label="Likelihood"
                      value={drawPrediction.likelihood || "—"}
                    />
                    <MiniMetric
                      label="Time Window"
                      value={drawPrediction.estimated_time_window || "—"}
                    />
                    <MiniMetric
                      label="Cutoff Range"
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
                    AI advisor
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    AI Strategy
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
                    Ready to unlock your full strategy?
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    Upgrade to Premium to access forecasts, province analysis,
                    improvement scenarios, AI strategy, and report export.
                  </p>
                </div>
                <Button onClick={() => navigate("/pricing")}>
                  Go to Pricing
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </Layout>
  );
}

function PremiumSection({ isPremium, children }) {
  if (isPremium) return children;

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className="pointer-events-none opacity-40 blur-[2px]">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/40 p-6 backdrop-blur-[1px]">
        <div className="max-w-md rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-xl">
          <p className="text-sm font-semibold text-slate-900">
            Unlock full strategy insights
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Access roadmap, predictions, advanced scenarios, province analysis,
            and AI-powered guidance.
          </p>
          <div className="mt-4">
            <Button onClick={() => navigateToPricing()}>
              Upgrade to Premium
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function navigateToPricing() {
  window.location.href = "/pricing";
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