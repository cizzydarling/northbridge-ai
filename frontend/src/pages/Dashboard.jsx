// frontend/src/pages/Dashboard.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import UpgradeModal from "../components/UpgradeModal";
import {
  getBillingStatus,
  getMyProfile,
  getMyStrategy,
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
    const load = async () => {
      const token = getToken();
      if (!token) {
        navigate("/auth");
        return;
      }

      try {
        const refreshed = await refreshCurrentUser();
        setCurrentUser(refreshed?.data || refreshed);
      } catch {}

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
        try {
          setStrategyLoading(true);
          const strategyRes = await getMyStrategy();
          setStrategy(strategyRes.data);
        } catch (err) {
          console.error("Strategy auto-run failed:", err);
        } finally {
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
        label: "Complete Profile",
        path: "/profile",
      };
    }

    if (strategyLoading) {
      return {
        label: "Building Your Strategy...",
        path: "/dashboard",
      };
    }

    if (!strategy) {
      return {
        label: "View My Strategy",
        path: "/strategy",
      };
    }

    if (!paidAccess) {
      return {
        label: "Unlock Forms & Documents",
        path: "/pricing",
      };
    }

    if (paidAccess && !isPremium) {
      return {
        label: "Finalize with PDF Export",
        path: "/pricing",
      };
    }

    return {
      label: "Continue My Application",
      path: "/documents",
    };
  }, [profile, strategy, strategyLoading, paidAccess, isPremium]);

  const secondaryAction = useMemo(() => {
    if (!profile || !isProfileComplete(profile)) {
      return { label: "View Pricing", path: "/pricing" };
    }

    if (!strategy) {
      return { label: "Open Profile", path: "/profile" };
    }

    if (!paidAccess) {
      return { label: "View Strategy", path: "/strategy" };
    }

    return { label: "Open Forms Studio", path: "/forms" };
  }, [profile, strategy, paidAccess]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <p className="text-lg">Loading...</p>
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
                Your guided immigration workspace
              </h1>

              <p className="mt-4 text-sm text-blue-100">
                Move from uncertainty to action with a clearer profile, stronger
                strategy, and a more organized application workflow.
              </p>

              {strategyLoading && (
                <div className="mt-5 rounded-2xl border border-blue-300/40 bg-white/10 px-4 py-3 text-sm text-blue-50">
                  We’re building your personalized immigration strategy now...
                </div>
              )}

              {!strategyLoading && strategy && summary && (
                <div className="mt-5 rounded-2xl border border-blue-300/30 bg-white/10 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                    Strategy insight
                  </p>
                  <p className="mt-2 text-sm leading-7 text-blue-50">
                    {summary}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(nextAction.path)}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-900"
                  disabled={strategyLoading && nextAction.path === "/dashboard"}
                >
                  {strategyLoading ? "Building strategy..." : nextAction.label}
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
                    ? "Current estimated score"
                    : "Complete your profile to improve precision"}
                </p>
              </div>

              <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                  Profile status
                </p>
                <p className="mt-3 text-xl font-semibold">
                  {profile && isProfileComplete(profile)
                    ? "Ready"
                    : "Needs completion"}
                </p>
                <p className="mt-2 text-xs text-blue-100">
                  {profile && isProfileComplete(profile)
                    ? "Your strategy can be generated"
                    : "Finish setup to unlock stronger results"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {strategy && !paidAccess && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              Your strategy is ready — unlock the full breakdown
            </p>

            <p className="mt-2 text-sm text-amber-800">
              Get detailed pathway analysis, document guidance, and personalized
              action steps.
            </p>

            <button
              onClick={() => navigate("/pricing")}
              className="mt-4 rounded-xl bg-amber-600 px-5 py-2 text-sm text-white"
            >
              Unlock Full Strategy
            </button>
          </div>
        )}

        {paidAccess && !isPremium && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
            <p className="text-sm text-purple-800">
              You're one step away from finishing your application. Unlock PDF
              export and finalize everything cleanly.
            </p>

            <button
              onClick={() => navigate("/pricing")}
              className="mt-3 rounded-xl bg-purple-600 px-4 py-2 text-sm text-white"
            >
              Upgrade to Premium
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label="Profile"
            value={
              profile && isProfileComplete(profile) ? "Completed" : "Missing"
            }
          />
          <StatCard
            label="Strategy"
            value={
              strategy ? "Ready" : strategyLoading ? "Building..." : "Not started"
            }
          />
          <StatCard label="Plan" value={currentPlan} />
          <StatCard label="Access" value={paidAccess ? "Unlocked" : "Locked"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow">
            <h3 className="text-xl font-semibold">Your next step</h3>

            <p className="mt-2 text-sm text-slate-600">
              Follow the guided flow to move forward.
            </p>

            <button
              onClick={() => navigate(nextAction.path)}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-white"
              disabled={strategyLoading && nextAction.path === "/dashboard"}
            >
              {strategyLoading ? "Preparing your strategy..." : nextAction.label}
            </button>
          </div>

          {!paidAccess ? (
            <PremiumBlurCard
              title="Premium recommendations"
              body="Unlock your top pathways, tailored recommendations, and clearer next steps."
              onUpgrade={() => navigate("/pricing")}
            />
          ) : (
            <div className="rounded-2xl border bg-white p-6 shadow">
              <h3 className="text-xl font-semibold">Top recommendations</h3>

              {strategyLoading ? (
                <p className="mt-3 text-sm text-slate-600">
                  Strategy recommendations are being prepared...
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
                  Complete your profile to unlock recommendation insights.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {!paidAccess ? (
            <PremiumBlurCard
              title="Priority next steps"
              body="See the exact actions to take next based on your profile and strategy."
              buttonLabel="Unlock action plan"
              onUpgrade={() => navigate("/pricing")}
            />
          ) : (
            <div className="rounded-2xl border bg-white p-6 shadow">
              <h3 className="text-xl font-semibold">Priority next steps</h3>

              {strategyLoading ? (
                <p className="mt-3 text-sm text-slate-600">
                  We’re preparing action steps for you...
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
                  Your personalized next steps will appear here once your strategy
                  is ready.
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl border bg-white p-6 shadow">
            <h3 className="text-xl font-semibold">Fast actions</h3>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/profile")}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Open Profile
              </button>

              <button
                onClick={() => navigate("/strategy")}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                View Strategy
              </button>

              <button
                onClick={() =>
                  paidAccess ? navigate("/forms") : navigate("/pricing")
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                {paidAccess ? "Forms Studio" : "Unlock Forms"}
              </button>

              <button
                onClick={() =>
                  isPremium ? navigate("/documents") : navigate("/pricing")
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                {isPremium ? "My Documents" : "Export & Documents"}
              </button>

              <button
                onClick={() => navigate("/pricing")}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                View Pricing
              </button>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => navigate("/pricing")}
      />
    </Layout>
  );
}