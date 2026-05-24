import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import {
  getBillingStatus,
  getCurrentUserLocal,
  getMyProfile,
  getMyStrategy,
  getToken,
  getUserDisplayName,
  logoutUser,
  refreshCurrentUser,
} from "../api";

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "individual_pro" || value === "pro") return "pro";
  if (value === "individual_premium" || value === "premium") return "premium";
  if (value === "agent_pro" || value === "agent") return "agent";
  return "free";
}

function hasPaidPlan(user, billingPlan) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return ["pro", "premium", "agent"].includes(
    normalizePlan(billingPlan || user.plan)
  );
}

function hasAgentWorkspaceAccess(user, billingPlan) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.role === "agent" && normalizePlan(billingPlan || user.plan) === "agent";
}

function Panel({ children, className = "" }) {
  return (
    <section
      className={`rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_45px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </section>
  );
}

function Eyebrow({ children, tone = "default" }) {
  const color = tone === "light" ? "text-white/55" : "text-slate-400";
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${color}`}>
      {children}
    </p>
  );
}

function MetricTile({ label, value, detail, tone = "default" }) {
  const tones = {
    default: "border-slate-200 bg-slate-50",
    good: "border-emerald-200 bg-emerald-50/70",
    focus: "border-cyan-200 bg-cyan-50/70",
    warm: "border-amber-200 bg-amber-50/70",
  };

  return (
    <div className={`rounded-[22px] border p-4 ${tones[tone] || tones.default}`}>
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function ProgressBar({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-cyan-200 transition-all duration-300"
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-white/65">{safeValue}%</p>
    </div>
  );
}

function ActionButton({ title, body, onClick, locked = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-px hover:border-cyan-200 hover:shadow-[0_16px_42px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold tracking-tight text-slate-950">{title}</p>
        {locked ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
            Pro
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </button>
  );
}

function TimelineItem({ label, detail, active = false }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-3 w-3 rounded-full ${
            active ? "bg-cyan-500" : "bg-slate-300"
          }`}
        />
        <span className="mt-2 h-full w-px bg-slate-200 last:hidden" />
      </div>
      <div className="pb-5">
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
    </div>
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

  const language = i18n.language === "fr" ? "fr" : "en";
  const role = currentUser?.role || "individual";
  const normalizedPlan = normalizePlan(billing?.raw_plan || billing?.plan || currentUser?.plan);
  const currentPlan = billing?.raw_plan || billing?.plan || currentUser?.plan || "free";
  const subscriptionStatus =
    billing?.subscription_status ||
    currentUser?.subscription_status ||
    (language === "fr" ? "non actif" : "not active");
  const isAgent = role === "agent" || role === "admin";
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
          setCurrentUser(refreshedUser?.data || refreshedUser);
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
        } else if (profileRes.reason?.response?.status === 401) {
          logoutUser();
          navigate("/auth");
          return;
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
        } else if (billingRes.reason?.response?.status === 401) {
          logoutUser();
          navigate("/auth");
          return;
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

  const dashboardUser = useMemo(
    () => ({
      ...(currentUser || {}),
      profile: profile || currentUser?.profile,
      first_name: profile?.first_name || currentUser?.first_name,
      last_name: profile?.last_name || currentUser?.last_name,
    }),
    [currentUser, profile]
  );

  const displayName = getUserDisplayName(dashboardUser, "");
  const firstName = profile?.first_name?.trim?.() || displayName;

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;

    const fields = [
      profile.first_name,
      profile.last_name,
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

  const recommendedPrograms = Array.isArray(strategy?.recommended_programs)
    ? strategy.recommended_programs
    : [];

  const nextSteps = Array.isArray(strategy?.next_steps)
    ? strategy.next_steps
    : [];

  const bestPathway =
    strategy?.best_pathway?.name ||
    strategy?.best_pathway?.title ||
    recommendedPrograms[0] ||
    (language === "fr" ? "A determiner" : "To be determined");

  const crsScore = strategy?.crs_score ?? "--";
  const strategySummary =
    strategy?.advisor_summary ||
    strategy?.strategy_headline ||
    (language === "fr"
      ? "Completez votre profil pour obtenir une strategie plus precise."
      : "Complete your profile to generate a sharper strategy.");

  const planLabel =
    normalizedPlan === "premium"
      ? "Premium"
      : normalizedPlan === "pro"
      ? "Pro"
      : normalizedPlan === "agent"
      ? "Agent"
      : language === "fr"
      ? "Gratuit"
      : "Free";

  const primaryPath = !profile
    ? "/profile"
    : isAgent && hasAgentPlan
    ? "/clients"
    : "/strategy";

  const primaryLabel = !profile
    ? t("dashboard.createProfile", { defaultValue: "Create profile" })
    : isAgent && hasAgentPlan
    ? t("dashboard.openClientWorkspace", { defaultValue: "Open client workspace" })
    : t("dashboard.openStrategy", { defaultValue: "Open strategy" });

  const actions = [
    {
      title: t("dashboard.updateProfile", { defaultValue: "Update profile" }),
      body:
        language === "fr"
          ? "Affinez les donnees qui alimentent la strategie."
          : "Refine the data that powers your strategy.",
      path: "/profile",
      locked: false,
    },
    {
      title: t("dashboard.openStrategy", { defaultValue: "Open strategy" }),
      body:
        language === "fr"
          ? "Consultez les voies, scores et prochaines actions."
          : "Review pathways, scores, and next actions.",
      path: "/strategy",
      locked: false,
    },
    {
      title: language === "fr" ? "Studio formulaires" : "Forms Studio",
      body:
        language === "fr"
          ? "Preparez les formulaires lies au type de demande."
          : "Prepare forms tied to the application type.",
      path: paidAccess ? "/forms" : "/pricing?plan=pro&source=dashboard&intent=forms",
      locked: !paidAccess,
    },
    {
      title: language === "fr" ? "Documents" : "Documents",
      body:
        language === "fr"
          ? "Generez et revisez les documents du dossier."
          : "Generate and review application documents.",
      path: paidAccess ? "/documents" : "/pricing?plan=pro&source=dashboard&intent=documents",
      locked: !paidAccess,
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[55vh] items-center justify-center">
          <Panel className="max-w-sm text-center">
            <p className="text-sm font-medium text-slate-600">
              {t("common.loading", { defaultValue: "Loading..." })}
            </p>
          </Panel>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {message ? (
        <div className="mb-5 rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="rounded-[30px] border border-slate-900/10 bg-[#172033] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Eyebrow tone="light">
                {language === "fr" ? "Command center" : "Command center"}
              </Eyebrow>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                {language === "fr"
                  ? `Bon retour${firstName ? `, ${firstName}` : ""}`
                  : `Welcome back${firstName ? `, ${firstName}` : ""}`}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                {strategySummary}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="white" onClick={() => navigate(primaryPath)}>
                {primaryLabel}
              </Button>
              <Button
                variant="outlineLight"
                onClick={() => navigate("/pricing")}
              >
                {language === "fr" ? "Plan" : "Plan"}
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
              <Eyebrow tone="light">
                {t("dashboard.profileCompletion", {
                  defaultValue: "Profile completion",
                })}
              </Eyebrow>
              <div className="mt-4">
                <ProgressBar value={profileCompletion} />
              </div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
              <Eyebrow tone="light">
                {t("dashboard.currentCrsScore", {
                  defaultValue: "Current CRS score",
                })}
              </Eyebrow>
              <p className="mt-3 text-3xl font-semibold">{crsScore}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
              <Eyebrow tone="light">
                {t("dashboard.currentPlan", { defaultValue: "Current plan" })}
              </Eyebrow>
              <p className="mt-3 text-3xl font-semibold">{planLabel}</p>
            </div>
          </div>
        </div>

        <Panel className="flex flex-col justify-between gap-6">
          <div>
            <Eyebrow>{language === "fr" ? "Next best move" : "Next best move"}</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {!profile
                ? language === "fr"
                  ? "Completez votre profil"
                  : "Complete your profile"
                : !paidAccess
                ? language === "fr"
                  ? "Debloquez l'execution"
                  : "Unlock execution"
                : bestPathway}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {!profile
                ? language === "fr"
                  ? "Le profil alimente les scores, les voies et les formulaires."
                  : "Your profile powers scores, pathways, and forms."
                : !paidAccess
                ? language === "fr"
                  ? "Passez a Pro pour finaliser les outils d'execution."
                  : "Upgrade to Pro to unlock execution tools."
                : language === "fr"
                ? "Continuez vers la strategie et les documents prioritaires."
                : "Continue into strategy and priority documents."}
            </p>
          </div>
          <Button
            variant={!profile || paidAccess ? "primary" : "premium"}
            onClick={() =>
              navigate(
                !profile
                  ? "/profile"
                  : !paidAccess
                  ? "/pricing?plan=pro&source=dashboard&intent=execute"
                  : "/strategy"
              )
            }
          >
            {!profile
              ? t("dashboard.createProfile", { defaultValue: "Create profile" })
              : !paidAccess
              ? t("strategy.upgradeNow", { defaultValue: "Upgrade now" })
              : t("dashboard.openStrategy", { defaultValue: "Open strategy" })}
          </Button>
        </Panel>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label={t("dashboard.bestPathway", { defaultValue: "Best pathway" })}
          value={bestPathway}
          detail={
            recommendedPrograms.length
              ? `${recommendedPrograms.length} ${
                  language === "fr" ? "voies detectees" : "pathways detected"
                }`
              : language === "fr"
              ? "En attente de donnees"
              : "Waiting for more data"
          }
          tone="focus"
        />
        <MetricTile
          label={language === "fr" ? "Statut dossier" : "Case status"}
          value={strategy ? (language === "fr" ? "Actif" : "Active") : language === "fr" ? "Setup" : "Setup"}
          detail={profile ? (language === "fr" ? "Profil trouve" : "Profile found") : language === "fr" ? "Profil requis" : "Profile required"}
          tone={profile ? "good" : "warm"}
        />
        <MetricTile
          label={language === "fr" ? "Acces" : "Access"}
          value={planLabel}
          detail={subscriptionStatus}
          tone={paidAccess ? "good" : "warm"}
        />
        <MetricTile
          label={language === "fr" ? "Actions" : "Actions"}
          value={nextSteps.length || "--"}
          detail={
            nextSteps.length
              ? language === "fr"
                ? "Priorites disponibles"
                : "Priorities available"
              : language === "fr"
              ? "A generer"
              : "To generate"
          }
          tone="default"
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow>{language === "fr" ? "Execution" : "Execution"}</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {language === "fr" ? "Actions rapides" : "Quick actions"}
              </h2>
            </div>
            {isAgent ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(hasAgentPlan ? "/clients" : "/pricing")}
              >
                {language === "fr" ? "Clients" : "Clients"}
              </Button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {actions.map((item) => (
              <ActionButton
                key={item.title}
                title={item.title}
                body={item.body}
                locked={item.locked}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Eyebrow>{language === "fr" ? "Strategie" : "Strategy"}</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {language === "fr" ? "Snapshot du dossier" : "Case snapshot"}
              </h2>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate("/strategy")}>
              {language === "fr" ? "Ouvrir" : "Open"}
            </Button>
          </div>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm leading-7 text-slate-700">{strategySummary}</p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {(recommendedPrograms.length ? recommendedPrograms.slice(0, 4) : [bestPathway]).map(
              (program, index) => (
                <div
                  key={`${program}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
                >
                  {program}
                </div>
              )
            )}
          </div>
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <Eyebrow>{language === "fr" ? "Progression" : "Progression"}</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {language === "fr" ? "Parcours de preparation" : "Preparation path"}
          </h2>

          <div className="mt-6">
            <TimelineItem
              active={Boolean(profile)}
              label={language === "fr" ? "Profil" : "Profile"}
              detail={
                profile
                  ? language === "fr"
                    ? "Les donnees principales sont disponibles."
                    : "Core profile data is available."
                  : language === "fr"
                  ? "Completez votre profil pour commencer."
                  : "Complete your profile to begin."
              }
            />
            <TimelineItem
              active={Boolean(strategy)}
              label={language === "fr" ? "Strategie" : "Strategy"}
              detail={
                strategy
                  ? language === "fr"
                    ? "Une analyse est prete pour execution."
                    : "An analysis is ready for execution."
                  : language === "fr"
                  ? "Generez votre strategie apres le profil."
                  : "Generate your strategy after profile setup."
              }
            />
            <TimelineItem
              active={paidAccess}
              label={language === "fr" ? "Execution" : "Execution"}
              detail={
                paidAccess
                  ? language === "fr"
                    ? "Les outils premium sont actifs."
                    : "Premium execution tools are active."
                  : language === "fr"
                  ? "Passez a Pro pour les outils d'execution."
                  : "Upgrade to Pro for execution tools."
              }
            />
          </div>
        </Panel>

        <Panel>
          <Eyebrow>{language === "fr" ? "Compte" : "Account"}</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {language === "fr" ? "Resume" : "Summary"}
          </h2>

          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <Eyebrow>{language === "fr" ? "Nom" : "Name"}</Eyebrow>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {displayName || (language === "fr" ? "Utilisateur" : "User")}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <Eyebrow>{language === "fr" ? "Role" : "Role"}</Eyebrow>
              <p className="mt-2 text-sm font-semibold capitalize text-slate-950">
                {role}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <Eyebrow>{language === "fr" ? "Plan" : "Plan"}</Eyebrow>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {planLabel}
              </p>
            </div>
          </div>
        </Panel>
      </section>
    </Layout>
  );
}
