import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
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

function SurfaceCard({ children, className = "" }) {
  return (
    <Card padding="lg" className={className}>
      {children}
    </Card>
  );
}

export default function SelfDashboardPage() {
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
  const subscriptionStatus =
    billing?.subscription_status ||
    currentUser?.subscription_status ||
    "not subscribed";
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
        setMessage(
          t("dashboard.loadError", {
            defaultValue: "Could not load dashboard data.",
          })
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate, t]);

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
    strategy?.recommended_programs?.[0] ||
    t("strategy.noStrategyAvailable", { defaultValue: "No strategy available" });

  const crsScore = strategy?.crs_score ?? "--";

  const topScenario =
    strategy?.improvement_scenarios?.[0]?.change ||
    t("dashboard.noStrategyYet", { defaultValue: "No strategy available yet." });

  const premiumStatusLabel = paidAccess
    ? t("strategy.unlocked", { defaultValue: "Unlocked" })
    : t("strategy.locked", { defaultValue: "Locked" });

  const planDisplay = useMemo(() => {
    if (currentPlan === "individual_pro") {
      return t("dashboard.plans.individualPro", {
        defaultValue: "Individual Pro",
      });
    }
    if (currentPlan === "agent_pro") {
      return t("dashboard.plans.agentPro", { defaultValue: "Agent Pro" });
    }
    if (currentPlan === "free") {
      return t("dashboard.plans.free", { defaultValue: "Free" });
    }
    return currentPlan;
  }, [currentPlan, t]);

  const statusDisplay = useMemo(() => {
    if (subscriptionStatus === "active") {
      return t("billing.active", { defaultValue: "Active" });
    }
    if (subscriptionStatus === "trialing") {
      return t("billing.trialing", { defaultValue: "Trialing" });
    }
    if (subscriptionStatus === "canceled") {
      return t("billing.canceled", { defaultValue: "Canceled" });
    }
    if (subscriptionStatus === "past_due") {
      return t("billing.pastDue", { defaultValue: "Past Due" });
    }
    return subscriptionStatus;
  }, [subscriptionStatus, t]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="rounded-[28px] border border-slate-200 bg-white px-10 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-medium text-slate-700">
              {t("common.loading", { defaultValue: "Loading..." })}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            {t("dashboard.title", { defaultValue: "Dashboard" })}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            {t("dashboard.title", { defaultValue: "Dashboard" })}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            {t("dashboard.subtitle", {
              defaultValue: "Track your progress and move forward with clarity",
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate("/pricing")}
          >
            {t("common.pricing", { defaultValue: "Pricing" })}
          </Button>

          {isAgent && hasAgentPlan && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => navigate("/clients")}
            >
              {t("dashboard.openClientWorkspace", {
                defaultValue: "Open client workspace",
              })}
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {message}
        </div>
      )}

      {!profile && (
        <div className="mb-6 rounded-[24px] border border-blue-200 bg-blue-50 px-5 py-4 text-blue-800">
          {t("dashboard.startProfile", {
            defaultValue: "Start by completing your profile.",
          })}
        </div>
      )}

      {role === "individual" && currentPlan === "free" && (
        <Card variant="premium" padding="lg" className="mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="max-w-3xl text-sm leading-7 text-slate-700">
              {t("dashboard.freePlanNotice", {
                defaultValue:
                  "You are currently on the free plan. Upgrade to unlock premium tools.",
              })}
            </p>
            <Button type="button" variant="premium" onClick={() => navigate("/pricing")}>
              {t("strategy.upgradeNow", { defaultValue: "Upgrade now" })}
            </Button>
          </div>
        </Card>
      )}

      {isAgent && !hasAgentPlan && (
        <Card variant="premium" padding="lg" className="mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="max-w-3xl text-sm leading-7 text-slate-700">
              {t("dashboard.agentPlanNotice", {
                defaultValue:
                  "Upgrade to the agent plan to unlock the full client workspace.",
              })}
            </p>
            <Button type="button" variant="premium" onClick={() => navigate("/pricing")}>
              {t("strategy.upgradeNow", { defaultValue: "Upgrade now" })}
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label={t("dashboard.currentPlan", { defaultValue: "Current plan" })}
          value={planDisplay}
          valueClassName="text-3xl"
        />
        <StatCard
          label={t("dashboard.subscriptionStatus", {
            defaultValue: "Subscription status",
          })}
          value={statusDisplay}
          valueClassName="text-3xl"
        />
        <StatCard
          label={t("strategy.premiumAccess", { defaultValue: "Premium access" })}
          value={premiumStatusLabel}
          valueClassName="text-3xl"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.profileCompletion", {
            defaultValue: "Profile completion",
          })}
          value={`${profileCompletion}%`}
          description={t("dashboard.completeProfiles", {
            defaultValue: "Complete your profile to improve your results",
          })}
          valueClassName="text-5xl"
        />

        <StatCard
          label={t("dashboard.currentCrsScore", {
            defaultValue: "Current CRS score",
          })}
          value={crsScore}
          description={t("dashboard.latestStrategy", {
            defaultValue: "Latest strategy",
          })}
          valueClassName="text-5xl"
        />

        <StatCard
          label={t("dashboard.bestPathway", {
            defaultValue: "Best pathway",
          })}
          value={topProgram}
          description={t("dashboard.bestImmigrationOption", {
            defaultValue: "Best immigration option",
          })}
          valueClassName="text-[30px]"
        />

        <StatCard
          label={t("dashboard.topImprovement", {
            defaultValue: "Top improvement",
          })}
          value={topScenario}
          description={t("dashboard.improvementDescription", {
            defaultValue: "Best next optimization opportunity",
          })}
          valueClassName="text-[26px]"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("dashboard.nextSteps", { defaultValue: "Next steps" })}
          </h3>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate("/profile")}
            >
              {profile
                ? t("dashboard.updateProfile", { defaultValue: "Update profile" })
                : t("dashboard.createProfile", { defaultValue: "Create profile" })}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/strategy")}
            >
              {t("dashboard.openStrategy", { defaultValue: "Open strategy" })}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/pricing")}
            >
              {t("dashboard.managePlan", { defaultValue: "Manage plan" })}
            </Button>

            {isAgent ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/clients")}
              >
                {t("dashboard.openClientWorkspace", {
                  defaultValue: "Open client workspace",
                })}
              </Button>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("dashboard.strategySnapshot", {
              defaultValue: "Strategy snapshot",
            })}
          </h3>

          {strategy ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {t("dashboard.recommendedPrograms", {
                    defaultValue: "Recommended programs",
                  })}
                </p>
                <p className="mt-2 text-base leading-7 text-slate-900">
                  {strategy.recommended_programs?.length
                    ? strategy.recommended_programs.join(", ")
                    : t("dashboard.noProgramsAvailable", {
                        defaultValue: "No programs available.",
                      })}
                </p>
              </div>

              {strategy.advisor_summary ? (
                <div className="rounded-3xl border border-blue-100 bg-blue-50/80 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                    {t("strategy.strategySummary", {
                      defaultValue: "Strategy summary",
                    })}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {strategy.advisor_summary}
                  </p>
                </div>
              ) : null}

              <Button
                type="button"
                variant="primary"
                onClick={() => navigate("/strategy")}
              >
                {t("dashboard.openStrategy", { defaultValue: "Open strategy" })}
              </Button>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm leading-7 text-slate-600">
                {t("dashboard.noStrategyYet", {
                  defaultValue: "No strategy available yet.",
                })}
              </p>
              {!paidAccess ? (
                <Button
                  type="button"
                  variant="premium"
                  className="mt-4"
                  onClick={() => navigate("/pricing")}
                >
                  {t("strategy.upgradeNow", { defaultValue: "Upgrade now" })}
                </Button>
              ) : null}
            </div>
          )}
        </SurfaceCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("dashboard.accountSummary", {
              defaultValue: "Account Summary",
            })}
          </h3>

          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("dashboard.email", { defaultValue: "Email" })}
              </p>
              <p className="mt-2 text-base text-slate-900">
                {currentUser?.email || "--"}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("dashboard.role", { defaultValue: "Role" })}
              </p>
              <p className="mt-2 text-base text-slate-900">{role}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("dashboard.access", { defaultValue: "Access" })}
              </p>
              <p className="mt-2 text-base text-slate-900">
                {paidAccess
                  ? t("dashboard.premiumEnabled", {
                      defaultValue: "Premium enabled",
                    })
                  : t("dashboard.freeOnly", {
                      defaultValue: "Free features only",
                    })}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("dashboard.recommendedAction", {
              defaultValue: "Recommended Action",
            })}
          </h3>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            {!profile ? (
              <>
                <p className="text-sm leading-7 text-slate-700">
                  {t("dashboard.actionCompleteProfile", {
                    defaultValue: "Complete your profile to unlock better results.",
                  })}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-5"
                  onClick={() => navigate("/profile")}
                >
                  {t("dashboard.createProfile", {
                    defaultValue: "Create profile",
                  })}
                </Button>
              </>
            ) : !paidAccess ? (
              <>
                <p className="text-sm leading-7 text-slate-700">
                  {t("dashboard.actionUpgrade", {
                    defaultValue:
                      "Upgrade your plan to unlock your full strategy and premium tools.",
                  })}
                </p>
                <Button
                  type="button"
                  variant="premium"
                  className="mt-5"
                  onClick={() => navigate("/pricing")}
                >
                  {t("strategy.upgradeNow", { defaultValue: "Upgrade now" })}
                </Button>
              </>
            ) : isAgent && !hasAgentPlan ? (
              <>
                <p className="text-sm leading-7 text-slate-700">
                  {t("dashboard.actionUpgradeAgent", {
                    defaultValue:
                      "Upgrade to the agent plan to access the full client workspace.",
                  })}
                </p>
                <Button
                  type="button"
                  variant="premium"
                  className="mt-5"
                  onClick={() => navigate("/pricing")}
                >
                  {t("strategy.upgradeNow", { defaultValue: "Upgrade now" })}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm leading-7 text-slate-700">
                  {t("dashboard.actionContinue", {
                    defaultValue:
                      "Your account is set up. Continue building your strategy and using premium tools.",
                  })}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-5"
                  onClick={() =>
                    navigate(isAgent && hasAgentPlan ? "/clients" : "/strategy")
                  }
                >
                  {isAgent && hasAgentPlan
                    ? t("dashboard.openClientWorkspace", {
                        defaultValue: "Open client workspace",
                      })
                    : t("dashboard.openStrategy", {
                        defaultValue: "Open strategy",
                      })}
                </Button>
              </>
            )}
          </div>
        </SurfaceCard>
      </div>
    </Layout>
  );
}