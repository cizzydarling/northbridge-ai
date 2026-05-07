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
  getUserDisplayName,
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
  const { t, i18n } = useTranslation();

  const [profile, setProfile] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [billing, setBilling] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(getCurrentUserLocal());

  const role = currentUser?.role || "individual";
  const isAgent = role === "agent" || role === "admin";
  const currentPlan = billing?.plan || currentUser?.plan || "free";
  const language = i18n.language === "fr" ? "fr" : "en";
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

  const firstName =
    profile?.first_name ||
    getUserDisplayName(currentUser, "");

  const primaryAction = useMemo(() => {
    if (!profile) {
      return {
        label: t("dashboard.createProfile", { defaultValue: "Create profile" }),
        path: "/profile",
      };
    }

    if (isAgent && hasAgentPlan) {
      return {
        label: t("dashboard.openClientWorkspace", {
          defaultValue: "Open client workspace",
        }),
        path: "/clients",
      };
    }

    return {
      label: strategy
        ? t("dashboard.resumeStrategy", { defaultValue: "Resume strategy" })
        : t("dashboard.openStrategy", { defaultValue: "Open strategy" }),
      path: "/strategy",
    };
  }, [hasAgentPlan, isAgent, profile, strategy, t]);

  const readinessCards = [
    {
      label: t("dashboard.profileCompletion", {
        defaultValue: "Profile completion",
      }),
      value: profile ? `${profileCompletion}%` : "--",
      detail: profile
        ? t("dashboard.profileReady", { defaultValue: "Profile ready" })
        : t("dashboard.profileNeedsSetup", {
            defaultValue: "Profile needs setup",
          }),
    },
    {
      label: t("dashboard.strategySnapshot", {
        defaultValue: "Strategy snapshot",
      }),
      value: strategy
        ? t("dashboard.ready", { defaultValue: "Ready" })
        : t("dashboard.pending", { defaultValue: "Pending" }),
      detail: topProgram,
    },
    {
      label: t("dashboard.currentPlan", { defaultValue: "Current plan" }),
      value: planDisplay,
      detail: statusDisplay,
    },
  ];

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
      <Card variant="premium" padding="lg" className="mb-8 overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              {t("dashboard.title", { defaultValue: "Dashboard" })}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              {language === "fr"
                ? `Bon retour${firstName ? `, ${firstName}` : ""}`
                : `Welcome back${firstName ? `, ${firstName}` : ""}`}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {language === "fr"
                ? "Votre espace rassemble les priorités, le statut du dossier et les prochaines actions importantes."
                : "Your workspace brings priorities, case status, and the next important actions into one place."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate(primaryAction.path)}
            >
              {primaryAction.label}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/pricing")}
            >
              {t("common.pricing", { defaultValue: "Pricing" })}
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {readinessCards.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/70 bg-white/75 px-4 py-4 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 truncate text-xl font-semibold tracking-tight text-slate-950">
                {item.value}
              </p>
              <p className="mt-1 truncate text-sm text-slate-500">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </Card>

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.profileCompletion", {
            defaultValue: "Profile completion",
          })}
          value={`${profileCompletion}%`}
          tone={profileCompletion >= 80 ? "success" : profile ? "info" : "warning"}
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
          tone={typeof crsScore === "number" ? "info" : "default"}
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
          tone={strategy ? "premium" : "default"}
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
          tone={strategy ? "success" : "default"}
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
                {t("dashboard.accountName", { defaultValue: "Name" })}
              </p>
              <p className="mt-2 text-base text-slate-900">
                {getUserDisplayName(
                  currentUser,
                  language === "fr" ? "Utilisateur" : "User"
                )}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("dashboard.role", { defaultValue: "Role" })}
              </p>
              <p className="mt-2 text-base text-slate-900">{role}</p>
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
