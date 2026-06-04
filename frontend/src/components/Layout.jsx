import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getBillingAccess,
  getCurrentUserLocal,
  getMyProfile,
  getUserDisplayName,
  logoutUser,
  requestEmailConfirmation,
  refreshCurrentUser,
} from "../api";
import Button from "../components/ui/Button";
import OnboardingModal from "../components/OnboardingModal";
import DevPlanSwitcher from "../components/DevPlanSwitcher";
import { translateRoleLabel } from "../utils/frenchLocalization";

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "individual_pro") return "pro";
  if (value === "individual_premium") return "premium";
  if (value === "agent_pro") return "premium";
  if (value === "premium") return "premium";
  if (value === "pro") return "pro";
  return "free";
}

function PlanPill({ plan, language, dark = false }) {
  const label =
    plan === "premium"
      ? "Premium"
      : plan === "pro"
      ? "Pro"
      : language === "fr"
      ? "Gratuit"
      : "Free";

  const palette =
    plan === "premium"
      ? dark
        ? "border-amber-300/30 bg-amber-200/15 text-amber-100"
        : "border-amber-200 bg-amber-50 text-amber-700"
      : plan === "pro"
      ? dark
        ? "border-emerald-300/30 bg-emerald-200/15 text-emerald-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700"
      : dark
      ? "border-amber-300/30 bg-amber-200/15 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${palette}`}
    >
      {label}
    </span>
  );
}

function MenuGlyph() {
  return (
    <span className="flex flex-col gap-1" aria-hidden="true">
      <span className="h-0.5 w-4 rounded-full bg-current" />
      <span className="h-0.5 w-4 rounded-full bg-current" />
      <span className="h-0.5 w-4 rounded-full bg-current" />
    </span>
  );
}

function MenuChevron({ open = false }) {
  return (
    <span
      aria-hidden="true"
      className="mt-[-2px] h-1.5 w-1.5 border-b border-r border-current transition-transform duration-200"
      style={{ transform: open ? "rotate(225deg)" : "rotate(45deg)" }}
    />
  );
}

function SectionLabel({ children, dark = false }) {
  return (
    <p
      className={`px-3 text-[10px] font-semibold uppercase tracking-[0.18em] ${
        dark ? "text-white/45" : "text-slate-400"
      }`}
    >
      {children}
    </p>
  );
}

function NavIcon({ name }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const icons = {
    dashboard: (
      <svg {...commonProps}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    ),
    clients: (
      <svg {...commonProps}>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
        <circle cx="9.5" cy="7.5" r="3.5" />
        <path d="M21 20v-1.2a3.4 3.4 0 0 0-2.8-3.4" />
        <path d="M16.5 4.4a3.2 3.2 0 0 1 0 6.2" />
      </svg>
    ),
    matters: (
      <svg {...commonProps}>
        <path d="M4 7.5h16" />
        <path d="M6 4.5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </svg>
    ),
    strategy: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3.5V6" />
        <path d="M12 18v2.5" />
        <path d="M3.5 12H6" />
        <path d="M18 12h2.5" />
      </svg>
    ),
    documents: (
      <svg {...commonProps}>
        <path d="M7 3.5h7l3.5 3.5v13.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
        <path d="M14 3.5V8h4" />
        <path d="M8.5 12h7" />
        <path d="M8.5 16h5" />
      </svg>
    ),
    application: (
      <svg {...commonProps}>
        <path d="M6.5 4.5h8.2L18 7.8v11.7H6.5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
        <path d="M14.5 4.5V8H18" />
        <path d="m8.5 13 2 2 4.5-5" />
      </svg>
    ),
    profile: (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
    ),
    pricing: (
      <svg {...commonProps}>
        <path d="M4.5 7.5h15v12h-15z" />
        <path d="M4.5 10.5h15" />
        <path d="M8 15.5h3" />
      </svg>
    ),
    generator: (
      <svg {...commonProps}>
        <path d="M12 3.5 13.4 8l4.1 1.5-4.1 1.5L12 15.5 10.6 11l-4.1-1.5L10.6 8 12 3.5Z" />
        <path d="M18 14.5 18.8 17l2.2.8-2.2.8L18 21l-.8-2.4-2.2-.8 2.2-.8.8-2.5Z" />
        <path d="M5.5 15.5 6 17l1.5.5L6 18l-.5 1.5L5 18l-1.5-.5L5 17l.5-1.5Z" />
      </svg>
    ),
    review: (
      <svg {...commonProps}>
        <path d="M5.5 4.5h13v15h-13z" />
        <path d="m8.5 12 2 2 4.5-5" />
        <path d="M8.5 17h7" />
      </svg>
    ),
    forms: (
      <svg {...commonProps}>
        <path d="M6.5 3.5h11v17h-11z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h3.5" />
      </svg>
    ),
    household: (
      <svg {...commonProps}>
        <path d="m3.5 11 8.5-7 8.5 7" />
        <path d="M6 10v10h12V10" />
        <path d="M9 20v-5a3 3 0 0 1 6 0v5" />
      </svg>
    ),
    citizenship: (
      <svg {...commonProps}>
        <path d="M5 5.5h14" />
        <path d="M7 3.5h10v17H7z" />
        <path d="M9.5 9h5" />
        <path d="M9.5 12.5h5" />
        <path d="M9.5 16h3" />
      </svg>
    ),
    career: (
      <svg {...commonProps}>
        <path d="M4.5 8.5h15v10h-15z" />
        <path d="M9 8.5v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <path d="M4.5 12.5h15" />
        <path d="M12 12.5v2" />
      </svg>
    ),
  };

  return icons[name] || icons.dashboard;
}

function SidebarLink({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${
        active
          ? "bg-white text-slate-950 shadow-[0_18px_40px_rgba(2,6,23,0.16)]"
          : "text-white/70 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
          active
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-white/10 bg-white/6 text-white/70 group-hover:border-white/20 group-hover:text-white"
        }`}
      >
        <NavIcon name={item.icon} />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </button>
  );
}

function MobileNavButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
        active
          ? "bg-slate-950 text-white"
          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [currentUser, setCurrentUser] = useState(getCurrentUserLocal());
  const [profileIdentity, setProfileIdentity] = useState(null);
  const [effectivePlan, setEffectivePlan] = useState(
    normalizePlan(currentUser?.plan)
  );
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmationSending, setConfirmationSending] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const accountRef = useRef(null);
  const mobileMenuPanelRef = useRef(null);

  const language = i18n.language === "fr" ? "fr" : "en";
  const isDevEnvironment =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    import.meta.env.DEV;

  useEffect(() => {
    const handleUserUpdate = () => {
      const nextUser = getCurrentUserLocal();
      setCurrentUser(nextUser);
      setEffectivePlan(normalizePlan(nextUser?.plan));
    };

    window.addEventListener("storage", handleUserUpdate);
    window.addEventListener("userUpdated", handleUserUpdate);

    return () => {
      window.removeEventListener("storage", handleUserUpdate);
      window.removeEventListener("userUpdated", handleUserUpdate);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function refreshUserOnReturn() {
      if (!getCurrentUserLocal()) return;
      try {
        const res = await refreshCurrentUser();
        if (mounted) {
          const nextUser = res?.data || getCurrentUserLocal();
          setCurrentUser(nextUser);
          setEffectivePlan(normalizePlan(nextUser?.plan));
        }
      } catch {
        if (mounted) {
          setCurrentUser(getCurrentUserLocal());
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshUserOnReturn();
      }
    }

    window.addEventListener("focus", refreshUserOnReturn);
    window.addEventListener("nbai-auth-state-refresh", refreshUserOnReturn);
    window.addEventListener("nbai-bootstrap-refresh", refreshUserOnReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("focus", refreshUserOnReturn);
      window.removeEventListener("nbai-auth-state-refresh", refreshUserOnReturn);
      window.removeEventListener("nbai-bootstrap-refresh", refreshUserOnReturn);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadProfileIdentity() {
      if (!currentUser) {
        setProfileIdentity(null);
        return;
      }

      try {
        const res = await getMyProfile();
        if (mounted) {
          setProfileIdentity(res?.data || null);
        }
      } catch {
        if (mounted) {
          setProfileIdentity(null);
        }
      }
    }

    loadProfileIdentity();

    window.addEventListener("storage", loadProfileIdentity);
    window.addEventListener("userUpdated", loadProfileIdentity);

    return () => {
      mounted = false;
      window.removeEventListener("storage", loadProfileIdentity);
      window.removeEventListener("userUpdated", loadProfileIdentity);
    };
  }, [currentUser]);

  useEffect(() => {
    let mounted = true;

    async function loadPlan() {
      try {
        setLoadingPlan(true);
        const res = await getBillingAccess();
        if (mounted) {
          setEffectivePlan(normalizePlan(res?.data?.plan || currentUser?.plan));
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setEffectivePlan(normalizePlan(currentUser?.plan));
        }
      } finally {
        if (mounted) {
          setLoadingPlan(false);
        }
      }
    }

    loadPlan();

    window.addEventListener("storage", loadPlan);
    window.addEventListener("userUpdated", loadPlan);

    return () => {
      mounted = false;
      window.removeEventListener("storage", loadPlan);
      window.removeEventListener("userUpdated", loadPlan);
    };
  }, [currentUser?.plan]);

  useEffect(() => {
    function handlePointerDown(event) {
      const clickedInsideAccount =
        accountRef.current && accountRef.current.contains(event.target);
      const clickedInsideMobileMenu =
        mobileMenuPanelRef.current &&
        mobileMenuPanelRef.current.contains(event.target);

      if (!clickedInsideAccount) setAccountOpen(false);
      if (mobileMenuOpen && !clickedInsideMobileMenu) setMobileMenuOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setAccountOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const isAgentWorkspace =
    currentUser?.role === "agent" || currentUser?.plan === "agent_pro";
  const isAdmin = currentUser?.role === "admin";
  const emailConfirmed = Boolean(currentUser?.email_confirmed_at);
  const showEmailConfirmationBanner = Boolean(currentUser && !emailConfirmed);

  const identityUser = useMemo(
    () => ({
      ...(currentUser || {}),
      profile: profileIdentity || currentUser?.profile,
      first_name: profileIdentity?.first_name || currentUser?.first_name,
      last_name: profileIdentity?.last_name || currentUser?.last_name,
      email:
        profileIdentity?.email ||
        currentUser?.email ||
        currentUser?.username ||
        currentUser?.preferred_username ||
        currentUser?.profile?.email ||
        currentUser?.profile?.username,
      display_name:
        profileIdentity?.display_name ||
        profileIdentity?.full_name ||
        profileIdentity?.name ||
        currentUser?.display_name ||
        currentUser?.full_name ||
        currentUser?.name,
    }),
    [currentUser, profileIdentity]
  );

  const displayName = useMemo(
    () => getUserDisplayName(identityUser, ""),
    [identityUser]
  );

  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean);
    return (parts[0]?.[0] || "N") + (parts[1]?.[0] || "B");
  }, [displayName]);

  const roleLabel = translateRoleLabel(currentUser?.role, language);

  const primaryNavItems = isAgentWorkspace
    ? [
        { label: t("nav.dashboard"), path: "/dashboard", icon: "dashboard" },
        { label: t("nav.clients"), path: "/clients", icon: "clients" },
        { label: t("nav.matters"), path: "/matters", icon: "matters" },
        { label: t("nav.strategy"), path: "/strategy", icon: "strategy" },
      ]
    : [
        { label: t("nav.dashboard"), path: "/dashboard", icon: "dashboard" },
        { label: t("nav.strategy"), path: "/strategy", icon: "strategy" },
        {
          label: language === "fr" ? "Documents" : "Documents",
          path: "/documents",
          icon: "documents",
          exact: true,
        },
        { label: t("layout.myApplication"), path: "/self/application", icon: "application" },
      ];

  const toolsItems = isAgentWorkspace
    ? [
        { label: t("nav.profile"), path: "/profile", icon: "profile" },
        {
          label: language === "fr" ? "Tarifs" : "Pricing",
          path: "/pricing",
          icon: "pricing",
        },
      ]
    : [
        {
          label: language === "fr" ? "Générateur" : "Generator",
          path: "/documents/generator",
          icon: "generator",
        },
        {
          label: language === "fr" ? "Révision IA" : "AI Review",
          path: "/documents/review",
          icon: "review",
        },
        { label: language === "fr" ? "Studio formulaires" : "Forms Studio", path: "/forms", icon: "forms" },
        { label: language === "fr" ? "Carrière" : "Career Match", path: "/career-match", icon: "career" },
        { label: language === "fr" ? "Citoyenneté" : "Citizenship", path: "/citizenship", icon: "citizenship" },
        { label: language === "fr" ? "Famille" : "Household", path: "/household", icon: "household" },
        { label: language === "fr" ? "Demandes" : "Applications", path: "/applications", icon: "application" },
        { label: t("nav.profile"), path: "/profile", icon: "profile" },
        ...(isAdmin
          ? [
              {
                label: language === "fr" ? "Codes promo" : "Promo Codes",
                path: "/admin/promo-codes",
                icon: "pricing",
              },
            ]
          : []),
      ];

  function handleLogout() {
    logoutUser();
    navigate("/auth");
  }

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  }

  async function handleResendConfirmation() {
    if (!currentUser?.email) return;

    try {
      setConfirmationSending(true);
      setConfirmationMessage("");
      const res = await requestEmailConfirmation(currentUser.email);
      setConfirmationMessage(
        res?.data?.message ||
          (language === "fr"
            ? "Si ce compte existe, un courriel de confirmation a été envoyé."
            : "If that account exists, a confirmation email has been sent.")
      );
    } catch (err) {
      console.error(err);
      setConfirmationMessage(
        language === "fr"
          ? "Impossible d'envoyer le courriel de confirmation."
          : "Unable to send confirmation email."
      );
    } finally {
      setConfirmationSending(false);
    }
  }

  function isActive(path, exact = false) {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/";
    }
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  }

  function goTo(path) {
    setAccountOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  }

  function handleUpgradeClick() {
    if (effectivePlan === "free") {
      navigate("/pricing?plan=pro&source=shell&intent=execute");
      return;
    }

    if (effectivePlan === "pro") {
      navigate("/pricing?plan=premium&source=shell&intent=export");
      return;
    }

    navigate("/chat");
  }

  const upgradeLabel =
    effectivePlan === "premium"
      ? t("nav.aiAssistant")
      : effectivePlan === "pro"
      ? language === "fr"
        ? "Premium"
        : "Go Premium"
      : language === "fr"
      ? "Passer Pro"
      : "Upgrade";

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="min-h-screen lg:flex">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/10 bg-[#172033] text-white lg:flex">
          <div className="flex h-full flex-col p-5">
            <Link
              to="/dashboard"
              className="group rounded-3xl border border-white/10 bg-white/[0.06] p-4 transition hover:bg-white/[0.09]"
              aria-label="NorthBridgeAI dashboard"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-sm">
                  NB
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    NorthBridgeAI
                  </p>
                  <p className="truncate text-xs text-white/55">
                    {isAgentWorkspace
                      ? t("layout.agentWorkspace")
                      : t("layout.personalWorkspace")}
                  </p>
                </div>
              </div>
            </Link>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-xs font-semibold text-slate-950">
                  {initials.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="truncate text-xs text-white/50">
                    {roleLabel || t("common.unknown")}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                {!loadingPlan && (
                  <PlanPill plan={effectivePlan} language={language} dark />
                )}
              </div>
            </div>

            <nav className="mt-7 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-2">
                <SectionLabel dark>
                  {language === "fr" ? "Espace de travail" : "Workspace"}
                </SectionLabel>
                <div className="mt-2 space-y-1.5">
                  {primaryNavItems.map((item) => (
                    <SidebarLink
                      key={item.path}
                      item={item}
                      active={isActive(item.path, item.exact)}
                      onClick={() => goTo(item.path)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-7 space-y-2">
                <SectionLabel dark>
                  {language === "fr" ? "Exécution" : "Execution"}
                </SectionLabel>
                <div className="mt-2 space-y-1.5">
                  {toolsItems.map((item) => (
                    <SidebarLink
                      key={item.path}
                      item={item}
                      active={isActive(item.path, item.exact)}
                      onClick={() => goTo(item.path)}
                    />
                  ))}
                </div>
              </div>
            </nav>

            <div className="mt-6 space-y-3">
              <Button
                variant="white"
                className="w-full rounded-2xl"
                onClick={handleUpgradeClick}
              >
                {upgradeLabel}
              </Button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-2xl border border-white/10 px-4 py-3 text-left text-sm font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white"
              >
                {t("nav.logout")}
              </button>
            </div>
          </div>
        </aside>

        <div className="min-h-screen flex-1 lg:pl-72">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f5f7fb]/88 backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-4 md:px-6">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
                aria-label={language === "fr" ? "Ouvrir le menu" : "Open menu"}
              >
                <MenuGlyph />
              </button>

              <div className="hidden min-w-0 lg:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {language === "fr" ? "Espace dossier" : "Case workspace"}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                  {location.pathname === "/dashboard"
                    ? language === "fr"
                      ? "Tableau de bord"
                      : "Dashboard"
                    : location.pathname}
                </p>
              </div>

              <Link to="/dashboard" className="min-w-0 lg:hidden">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-xs font-bold text-white">
                    NB
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-950">
                    NorthBridgeAI
                  </p>
                </div>
              </Link>

              <div className="ml-auto flex items-center gap-3">
                <Button
                  variant={effectivePlan === "premium" ? "secondary" : "primary"}
                  size="sm"
                  className="hidden rounded-2xl md:inline-flex"
                  onClick={handleUpgradeClick}
                >
                  {upgradeLabel}
                </Button>

                <div className="relative hidden md:block" ref={accountRef}>
                  <button
                    type="button"
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    onClick={() => setAccountOpen((prev) => !prev)}
                    className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-950 text-[10px] font-semibold text-white">
                      {initials.toUpperCase()}
                    </span>
                    <span className="hidden max-w-[130px] truncate text-sm font-semibold text-slate-900 xl:block">
                      {displayName}
                    </span>
                    <MenuChevron open={accountOpen} />
                  </button>

                  {accountOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-12 z-50 w-80 rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_22px_70px_rgba(15,23,42,0.14)]"
                    >
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {displayName}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {isAgentWorkspace
                            ? t("layout.agentWorkspace")
                            : t("layout.personalWorkspace")}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          {!loadingPlan && (
                            <PlanPill plan={effectivePlan} language={language} />
                          )}
                          <span className="text-xs capitalize text-slate-500">
                            {roleLabel || t("common.unknown")}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 grid gap-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => goTo("/pricing")}
                          className="rounded-2xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          {language === "fr" ? "Tarifs" : "Pricing & Billing"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => goTo("/profile")}
                          className="rounded-2xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          {t("nav.profile")}
                        </button>
                      </div>

                      <div className="mt-2 border-t border-slate-100 pt-3">
                        <SectionLabel>{language === "fr" ? "Langue" : "Language"}</SectionLabel>
                        <div className="mt-2 flex gap-2 px-3">
                          {["en", "fr"].map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => switchLanguage(lang)}
                              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                                i18n.language === lang
                                  ? "bg-slate-950 text-white"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {lang.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {isDevEnvironment && (
                        <div className="mt-3 border-t border-slate-100 px-3 pt-3">
                          <DevPlanSwitcher />
                        </div>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="mt-2 w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {t("nav.logout")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <OnboardingModal />

          <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:py-8">
            {showEmailConfirmationBanner && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm sm:px-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {language === "fr"
                        ? "Confirmez votre adresse courriel"
                        : "Confirm your email address"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-amber-900/80">
                      {language === "fr"
                        ? "Vous pouvez continuer a explorer NorthBridgeAI. La facturation et les telechargements seront disponibles apres confirmation."
                        : "You can keep exploring NorthBridgeAI. Billing and downloads unlock after confirmation."}
                    </p>
                    {confirmationMessage && (
                      <p className="mt-2 text-sm font-medium text-amber-950">
                        {confirmationMessage}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 rounded-2xl border-amber-300 bg-white"
                    onClick={handleResendConfirmation}
                    disabled={confirmationSending}
                    loading={confirmationSending}
                  >
                    {confirmationSending
                      ? language === "fr"
                        ? "Envoi..."
                        : "Sending..."
                      : language === "fr"
                      ? "Renvoyer le courriel"
                      : "Resend email"}
                  </Button>
                </div>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
          <div
            ref={mobileMenuPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label={language === "fr" ? "Menu principal" : "Main menu"}
            className="absolute right-0 top-0 flex h-full w-[84vw] max-w-sm flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {displayName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {isAgentWorkspace
                    ? t("layout.agentWorkspace")
                    : t("layout.personalWorkspace")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                aria-label={language === "fr" ? "Fermer le menu" : "Close menu"}
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="mb-6 rounded-3xl bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  {!loadingPlan && (
                    <PlanPill plan={effectivePlan} language={language} />
                  )}
                  <span className="text-xs capitalize text-slate-500">
                    {roleLabel || t("common.unknown")}
                  </span>
                </div>
                <Button
                  variant="primary"
                  className="w-full rounded-2xl"
                  onClick={handleUpgradeClick}
                >
                  {upgradeLabel}
                </Button>
              </div>

              <div className="mb-6 space-y-2">
                <SectionLabel>{language === "fr" ? "Espace de travail" : "Workspace"}</SectionLabel>
                <div className="mt-2 space-y-2">
                  {primaryNavItems.map((item) => (
                    <MobileNavButton
                      key={item.path}
                      active={isActive(item.path, item.exact)}
                      onClick={() => goTo(item.path)}
                    >
                      {item.label}
                    </MobileNavButton>
                  ))}
                </div>
              </div>

              <div className="mb-6 space-y-2">
                <SectionLabel>{language === "fr" ? "Exécution" : "Execution"}</SectionLabel>
                <div className="mt-2 space-y-2">
                  {toolsItems.map((item) => (
                    <MobileNavButton
                      key={item.path}
                      active={isActive(item.path, item.exact)}
                      onClick={() => goTo(item.path)}
                    >
                      {item.label}
                    </MobileNavButton>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <SectionLabel>{language === "fr" ? "Langue" : "Language"}</SectionLabel>
                <div className="mt-2 flex gap-2 px-3">
                  {["en", "fr"].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => switchLanguage(lang)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        i18n.language === lang
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-5 space-y-4">
              {isDevEnvironment && <DevPlanSwitcher />}
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t("nav.logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
