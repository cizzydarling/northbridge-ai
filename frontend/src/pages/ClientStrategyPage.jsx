import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  downloadClientStrategyReport,
  getClientById,
  getClientStrategy,
  getToken,
  logoutUser,
} from "../api";

export default function ClientStrategyPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadPage = useCallback(async ({ isRefresh = false } = {}) => {
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

      const [clientRes, strategyRes] = await Promise.all([
        getClientById(clientId),
        getClientStrategy(clientId),
      ]);

      setClient(clientRes.data);
      setStrategy(strategyRes.data);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      if (err.response?.status === 404) {
        setStrategy(null);
        setMessage(
          err.response?.data?.detail ||
            "Client strategy not available yet. Complete the client profile first."
        );
      } else {
        setMessage(
          err.response?.data?.detail || "Failed to load client strategy."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId, navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const handleExport = async () => {
    try {
      setExporting(true);
      setMessage("");

      const response = await downloadClientStrategyReport(clientId);
      const blob = response?.data;

      if (!(blob instanceof Blob)) {
        throw new Error("Invalid export response.");
      }

      const contentType =
        response?.headers?.["content-type"] || "application/octet-stream";

      let extension = "html";
      if (contentType.includes("pdf")) extension = "pdf";
      else if (contentType.includes("json")) extension = "json";
      else if (contentType.includes("text/plain")) extension = "txt";

      const safeName =
        client?.full_name?.trim().replace(/\s+/g, "_").toLowerCase() || "client";

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}_strategy_report.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail ||
          err.message ||
          "Failed to export strategy report."
      );
    } finally {
      setExporting(false);
    }
  };

  const recommendedPrograms = strategy?.recommended_programs || [];
  const strengths = strategy?.strengths || [];
  const weaknesses = strategy?.weaknesses || [];
  const nextSteps = strategy?.next_steps || [];
  const provinceRecommendations = strategy?.province_recommendations || [];
  const roadmap = strategy?.roadmap || [];
  const improvementScenarios = strategy?.improvement_scenarios || [];
  const probabilityEstimate = strategy?.probability_estimate || {};
  const timelineEstimate = useMemo(
    () => strategy?.timeline_estimate || {},
    [strategy?.timeline_estimate]
  );
  const drawPrediction = useMemo(
    () => strategy?.draw_prediction || {},
    [strategy?.draw_prediction]
  );
  const advisorSummary = strategy?.advisor_summary || "";
  const aiStrategy = strategy?.ai_strategy || "";
  const crsScore = strategy?.crs_score ?? "--";

  const timelineSummary = useMemo(() => {
    const minMonths = timelineEstimate?.estimated_pr_timeline_min_months;
    const maxMonths = timelineEstimate?.estimated_pr_timeline_max_months;

    if (typeof minMonths === "number" && typeof maxMonths === "number") {
      return `${minMonths}-${maxMonths} months`;
    }

    return "Not available";
  }, [timelineEstimate]);

  const drawSummary = useMemo(() => {
    const min = drawPrediction?.predicted_cutoff_min;
    const max = drawPrediction?.predicted_cutoff_max;

    if (typeof min === "number" && typeof max === "number") {
      return `${min}-${max}`;
    }

    return "Not available";
  }, [drawPrediction]);

  const scoreLabel = useMemo(() => {
    if (typeof crsScore !== "number") return "Unavailable";
    if (crsScore >= 500) return "Very strong";
    if (crsScore >= 470) return "Strong";
    if (crsScore >= 430) return "Competitive";
    return "Needs improvement";
  }, [crsScore]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
            <p className="text-lg font-medium text-slate-700">
              Loading client strategy...
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Preparing profile-based recommendations and strategy guidance.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {message && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {message}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            {client?.full_name || "Client"} Strategy
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Review this client’s immigration position, strongest pathways, and
            the most effective next actions.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(`/clients/${clientId}`)}
          >
            Back to Overview
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate(`/clients/${clientId}/profile`)}
          >
            Edit Profile
          </Button>

          <Button
            variant="secondary"
            onClick={() => loadPage({ isRefresh: true })}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>

          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Export Strategy Report"}
          </Button>
        </div>
      </div>

      {!message && !strategy && (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            No strategy available yet
          </h2>
          <p className="mt-3 text-slate-600">
            Complete the client profile to generate a strategy.
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate(`/clients/${clientId}/profile`)}>
              Open Client Profile
            </Button>
          </div>
        </Card>
      )}

      {!message && strategy && (
        <div className="space-y-6">
          <section className="rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-6 py-8 text-white shadow-xl md:px-8 md:py-10">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
                  Client strategy snapshot
                </p>
                <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                  {client?.full_name || "Client"}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">
                  {advisorSummary ||
                    "This strategy is based on the client profile, current CRS factors, and pathway recommendations."}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => navigate(`/clients/${clientId}/profile`)}>
                    Update Client Profile
                  </Button>
                  <Button onClick={handleExport} disabled={exporting}>
                    {exporting ? "Exporting..." : "Export Report"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                    Current CRS
                  </p>
                  <p className="mt-2 text-3xl font-bold">{crsScore}</p>
                  <p className="mt-2 text-sm text-blue-100">{scoreLabel}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                    Estimated Timeline
                  </p>
                  <p className="mt-2 text-3xl font-bold">{timelineSummary}</p>
                  <p className="mt-2 text-sm text-blue-100">
                    Expected PR window
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Current CRS"
              value={crsScore}
              description={scoreLabel}
            />
            <MetricCard
              label="Best Pathway"
              value={recommendedPrograms[0] || "Not available"}
              description="Top recommended program"
            />
            <MetricCard
              label="Top Province"
              value={provinceRecommendations?.[0]?.province || "Not available"}
              description="Highest-fit province target"
            />
            <MetricCard
              label="Timeline"
              value={timelineSummary}
              description="Estimated PR window"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="p-6 xl:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Pathways
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Recommended Programs
              </h2>

              {recommendedPrograms.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {recommendedPrograms.map((program, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Option {index + 1}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {program}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Not available.</p>
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
                      className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No next steps yet.</p>
              )}
            </Card>
          </div>

          {drawPrediction?.predicted_draw_type && (
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Market outlook
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Draw Predictor
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SmallMetricCard
                  label="Predicted Draw Type"
                  value={drawPrediction.predicted_draw_type}
                />
                <SmallMetricCard
                  label="Predicted Cutoff"
                  value={drawSummary}
                />
                <SmallMetricCard
                  label="Likelihood"
                  value={drawPrediction.likelihood || "Not available"}
                />
                <SmallMetricCard
                  label="Time Window"
                  value={drawPrediction.estimated_time_window || "Not available"}
                />
              </div>

              {Array.isArray(drawPrediction?.category_hints) &&
                drawPrediction.category_hints.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {drawPrediction.category_hints.map((hint, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        {hint}
                      </div>
                    ))}
                  </div>
                )}
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Forecast
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Probability Estimate
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <ProbabilityCard
                  label="PR within 12 months"
                  value={probabilityEstimate?.chance_of_pr_within_12_months}
                />
                <ProbabilityCard
                  label="Express Entry"
                  value={probabilityEstimate?.chance_via_express_entry}
                />
                <ProbabilityCard
                  label="PNP"
                  value={probabilityEstimate?.chance_via_pnp}
                />
              </div>
            </Card>

            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Timing
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Timeline Estimate
              </h2>

              <p className="mt-3 text-3xl font-bold text-blue-900">
                {timelineSummary}
              </p>

              {Array.isArray(timelineEstimate?.timeline_steps) &&
                timelineEstimate.timeline_steps.length > 0 && (
                  <div className="mt-5 space-y-4">
                    {timelineEstimate.timeline_steps.map((step, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
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
            </Card>
          </div>

          {provinceRecommendations.length > 0 && (
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Regional fit
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Province Targeting
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
                    <p className="mt-2 text-sm text-slate-700">{item.reason}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {roadmap.length > 0 && (
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Advanced planning
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Strategy Roadmap
              </h2>

              <div className="mt-5 space-y-4">
                {roadmap.map((step, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-semibold text-slate-900">
                      Step {index + 1}: {step.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{step.reason}</p>
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
                    <p className="mt-2 text-sm text-slate-900">{item.change}</p>
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
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
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
            </Card>
          </div>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              AI advisor
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              AI Strategy
            </h2>

            {aiStrategy ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiStrategy}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No AI strategy generated yet.
              </p>
            )}
          </Card>
        </div>
      )}
    </Layout>
  );
}

function MetricCard({ label, value, description }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-blue-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Card>
  );
}

function SmallMetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value || "--"}</p>
    </div>
  );
}

function ProbabilityCard({ label, value }) {
  const numericValue = typeof value === "number" ? value : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {numericValue !== null ? `${numericValue}%` : "--"}
      </p>
    </div>
  );
}
