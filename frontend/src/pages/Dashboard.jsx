import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import {
  getBillingStatus,
  getMyProfile,
  getMyStrategy,
  getToken,
  logoutUser,
  getCurrentUserLocal,
  refreshCurrentUser,
} from "../api";

function hasPaidPlan(user, billingPlan) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const effectivePlan = billingPlan || user.plan;
  return ["individual_pro", "agent_pro"].includes(effectivePlan);
}

function hasAgentWorkspaceAccess(user, billingPlan) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "agent" && billingPlan === "agent_pro";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [profile, setProfile] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [billing, setBilling] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(getCurrentUserLocal());

  const role = currentUser?.role || "individual";
  const isAgent = role === "agent" || role === "admin";
  const currentPlan = billing?.plan || currentUser?.plan || "free";
  const subscriptionStatus = billing?.subscription_status || currentUser?.subscription_status || "not subscribed";
  const paidAccess = hasPaidPlan(currentUser, currentPlan);
  const hasAgentPlan = hasAgentWorkspaceAccess(currentUser, currentPlan);

  useEffect(() => {
    const loadDashboard = async () => {
      const token = getToken();

      if (!token) {
        navigate("/auth");
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        try {
          const refreshedUser = await refreshCurrentUser();
          setCurrentUser(refreshedUser);
        } catch (err) {
          console.error(err);
        }

        const [profileRes, strategyRes, billingRes] = await Promise.allSettled([
          getMyProfile(),
          getMyStrategy(),
          getBillingStatus(),
        ]);

        if (profileRes.status === "fulfilled") {
          setProfile(profileRes.value.data);
        } else {
          const status = profileRes.reason?.response?.status;
          if (status === 401) {
            logoutUser();
            navigate("/auth");
            return;
          }
        }

        if (strategyRes.status === "fulfilled") {
          setStrategy(strategyRes.value.data);
        } else {
          const status = strategyRes.reason?.response?.status;
          if (status === 401) {
            logoutUser();
            navigate("/auth");
            return;
          }
          if (status !== 403 && status !== 404) {
            console.error(strategyRes.reason);
          }
        }

        if (billingRes.status === "fulfilled") {
          setBilling(billingRes.value.data);
        } else {
          const status = billingRes.reason?.response?.status;
          if (status === 401) {
            logoutUser();
            navigate("/auth");
            return;
          }
        }
      } catch (err) {
        console.error(err);
        setMessage("Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate]);

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;

    const fields = [
      profile.age,
      profile.education,
      profile.language_score,
      profile.experience_years,
      profile.occupation,
      profile.noc_code,
      profile.preferred_province,
    ];

    const filled = fields.filter(
      (value) => value !== null && value !== undefined && value !== ""
    ).length;

    return Math.round((filled / fields.length) * 100);
  }, [profile]);

  const topProgram =
    strategy?.recommended_programs?.[0] || t("strategy.noStrategyAvailable");

  const crsScore = strategy?.crs_score ?? "--";

  const topScenario =
    strategy?.improvement_scenarios?.[0]?.change || t("dashboard.noStrategyYet");

  const premiumStatusLabel = paidAccess
    ? t("strategy.unlocked")
    : t("strategy.locked");

  const planDisplay = useMemo(() => {
    if (currentPlan === "individual_pro") return "Individual Pro";
    if (currentPlan === "agent_pro") return "Agent Pro";
    if (currentPlan === "free") return "Free";
    return currentPlan;
  }, [currentPlan]);

  const statusDisplay = useMemo(() => {
    if (subscriptionStatus === "active") return "Active";
    if (subscriptionStatus === "trialing") return "Trialing";
    if (subscriptionStatus === "canceled") return "Canceled";
    if (subscriptionStatus === "past_due") return "Past Due";
    return subscriptionStatus;
  }, [subscriptionStatus]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-medium text-slate-700">{t("common.loading")}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t("dashboard.title")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("dashboard.subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/billing")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("common.pricing")}
          </button>

          {isAgent && hasAgentPlan && (
            <button
              onClick={() => navigate("/clients")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t("dashboard.openClientWorkspace")}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {message}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
          <p className="text-sm font-medium text-slate-500">{t("dashboard.currentPlan")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{planDisplay}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
          <p className="text-sm font-medium text-slate-500">{t("dashboard.subscriptionStatus")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{statusDisplay}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
          <p className="text-sm font-medium text-slate-500">{t("strategy.premiumAccess")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{premiumStatusLabel}</p>
        </div>
      </div>

      {!profile && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-blue-800">
          {t("dashboard.startProfile")}
        </div>
      )}

      {role === "individual" && currentPlan === "free" && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p>{t("dashboard.freePlanNotice")}</p>
            <button
              onClick={() => navigate("/billing")}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              {t("strategy.upgradeNow")}
            </button>
          </div>
        </div>
      )}

      {isAgent && !hasAgentPlan && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p>{t("dashboard.agentPlanNotice")}</p>
            <button
              onClick={() => navigate("/billing")}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              {t("strategy.upgradeNow")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.profileCompletion")}
          value={`${profileCompletion}%`}
          description={t("dashboard.completeProfiles")}
          valueClassName="text-4xl"
        />

        <StatCard
          label={t("dashboard.currentCrsScore")}
          value={crsScore}
          description={t("dashboard.latestStrategy")}
          valueClassName="text-4xl"
        />

        <StatCard
          label={t("dashboard.bestPathway")}
          value={topProgram}
          description={t("dashboard.bestImmigrationOption")}
          valueClassName="text-2xl"
        />

        <StatCard
          label={t("dashboard.topImprovement")}
          value={topScenario}
          description={t("dashboard.improvementDescription")}
          valueClassName="text-xl"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-slate-900">{t("dashboard.nextSteps")}</h3>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <button
              onClick={() => navigate("/profile")}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
            >
              {profile ? t("dashboard.updateProfile") : t("dashboard.createProfile")}
            </button>

            <button
              onClick={() => navigate("/strategy")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
            >
              {t("dashboard.openStrategy")}
            </button>

            <button
              onClick={() => navigate("/billing")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
            >
              {t("dashboard.managePlan")}
            </button>

            {isAgent ? (
              <button
                onClick={() => navigate("/clients")}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
              >
                {t("dashboard.openClientWorkspace")}
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-slate-900">
            {t("dashboard.strategySnapshot")}
          </h3>

          {strategy ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("dashboard.recommendedPrograms")}
                </p>
                <p className="mt-1 text-slate-900">
                  {strategy.recommended_programs?.length
                    ? strategy.recommended_programs.join(", ")
                    : t("dashboard.noProgramsAvailable")}
                </p>
              </div>

              {strategy.advisor_summary ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {t("strategy.strategySummary")}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {strategy.advisor_summary}
                  </p>
                </div>
              ) : null}

              <button
                onClick={() => navigate("/strategy")}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                {t("dashboard.openStrategy")}
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">{t("dashboard.noStrategyYet")}</p>
              {!paidAccess ? (
                <button
                  onClick={() => navigate("/billing")}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  {t("strategy.upgradeNow")}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-slate-900">Account Summary</h3>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </p>
              <p className="mt-1 text-slate-900">{currentUser?.email || "--"}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </p>
              <p className="mt-1 text-slate-900">{role}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Access
              </p>
              <p className="mt-1 text-slate-900">
                {paidAccess ? "Premium features enabled" : "Free access only"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-slate-900">Recommended Action</h3>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            {!profile ? (
              <>
                <p className="text-sm text-slate-700">
                  Complete your profile to unlock more personalized recommendations.
                </p>
                <button
                  onClick={() => navigate("/profile")}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  {t("dashboard.createProfile")}
                </button>
              </>
            ) : !paidAccess ? (
              <>
                <p className="text-sm text-slate-700">
                  Upgrade your plan to unlock premium strategy insights, reports, and advanced tools.
                </p>
                <button
                  onClick={() => navigate("/billing")}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  {t("strategy.upgradeNow")}
                </button>
              </>
            ) : isAgent && !hasAgentPlan ? (
              <>
                <p className="text-sm text-slate-700">
                  Upgrade to Agent Pro to access the client workspace and premium client tools.
                </p>
                <button
                  onClick={() => navigate("/billing")}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  {t("strategy.upgradeNow")}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-700">
                  Your account is set up. Continue building your strategy and using premium tools.
                </p>
                <button
                  onClick={() => navigate(isAgent && hasAgentPlan ? "/clients" : "/strategy")}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  {isAgent && hasAgentPlan
                    ? t("dashboard.openClientWorkspace")
                    : t("dashboard.openStrategy")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}