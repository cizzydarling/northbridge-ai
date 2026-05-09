import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getBillingAccess,
  getCurrentUserLocal,
  getMyProfile,
  getUserDisplayName,
  logoutUser,
} from "../api";
import Button from "../components/ui/Button";
import OnboardingModal from "../components/OnboardingModal";
import DevPlanSwitcher from "../components/DevPlanSwitcher";

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
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[11px] font-semibold ${
          active
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-white/10 bg-white/6 text-white/70 group-hover:border-white/20 group-hover:text-white"
        }`}
      >
        {item.icon}
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
    currentUser?.role === "agent" || currentUser?.role === "admin";

  const identityUser = useMemo(
    () => ({
      ...(currentUser || {}),
      profile: profileIdentity || currentUser?.profile,
      first_name: profileIdentity?.first_name || currentUser?.first_name,
      last_name: profileIdentity?.last_name || currentUser?.last_name,
    }),
    [currentUser, profileIdentity]
  );

  const displayName = useMemo(
    () =>
      getUserDisplayName(
        identityUser,
        language === "fr" ? "Utilisateur" : "User"
      ),
    [identityUser, language]
  );

  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean);
    return (parts[0]?.[0] || "N") + (parts[1]?.[0] || "B");
  }, [displayName]);

  const primaryNavItems = isAgentWorkspace
    ? [
        { label: t("nav.dashboard"), path: "/dashboard", icon: "DB" },
        { label: t("nav.clients"), path: "/clients", icon: "CL" },
        { label: t("nav.matters"), path: "/matters", icon: "MT" },
        { label: t("nav.strategy"), path: "/strategy", icon: "ST" },
      ]
    : [
        { label: t("nav.dashboard"), path: "/dashboard", icon: "DB" },
        { label: t("nav.strategy"), path: "/strategy", icon: "ST" },
        { label: language === "fr" ? "Documents" : "Documents", path: "/documents", icon: "DC" },
        { label: t("layout.myApplication"), path: "/self/application", icon: "AP" },
      ];

  const toolsItems = isAgentWorkspace
    ? [
        { label: t("nav.profile"), path: "/profile", icon: "PF" },
        {
          label: language === "fr" ? "Tarifs" : "Pricing",
          path: "/pricing",
          icon: "PR",
        },
      ]
    : [
        {
          label: language === "fr" ? "Generateur" : "Generator",
          path: "/documents/generator",
          icon: "GN",
        },
        {
          label: language === "fr" ? "Review IA" : "AI Review",
          path: "/documents/review",
          icon: "RV",
        },
        { label: "Forms Studio", path: "/forms", icon: "FM" },
        { label: language === "fr" ? "Famille" : "Household", path: "/household", icon: "HH" },
        { label: language === "fr" ? "Demandes" : "Applications", path: "/applications", icon: "CA" },
        { label: t("nav.profile"), path: "/profile", icon: "PF" },
      ];

  function handleLogout() {
    logoutUser();
    navigate("/auth");
  }

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  }

  function isActive(path) {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/";
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
                    {currentUser?.role || t("common.unknown")}
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
                  {language === "fr" ? "Workspace" : "Workspace"}
                </SectionLabel>
                <div className="mt-2 space-y-1.5">
                  {primaryNavItems.map((item) => (
                    <SidebarLink
                      key={item.path}
                      item={item}
                      active={isActive(item.path)}
                      onClick={() => goTo(item.path)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-7 space-y-2">
                <SectionLabel dark>
                  {language === "fr" ? "Execution" : "Execution"}
                </SectionLabel>
                <div className="mt-2 space-y-1.5">
                  {toolsItems.map((item) => (
                    <SidebarLink
                      key={item.path}
                      item={item}
                      active={isActive(item.path)}
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
                  {language === "fr" ? "Case workspace" : "Case workspace"}
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
                            {currentUser?.role || t("common.unknown")}
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
                    {currentUser?.role || t("common.unknown")}
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
                <SectionLabel>{language === "fr" ? "Workspace" : "Workspace"}</SectionLabel>
                <div className="mt-2 space-y-2">
                  {primaryNavItems.map((item) => (
                    <MobileNavButton
                      key={item.path}
                      active={isActive(item.path)}
                      onClick={() => goTo(item.path)}
                    >
                      {item.label}
                    </MobileNavButton>
                  ))}
                </div>
              </div>

              <div className="mb-6 space-y-2">
                <SectionLabel>{language === "fr" ? "Execution" : "Execution"}</SectionLabel>
                <div className="mt-2 space-y-2">
                  {toolsItems.map((item) => (
                    <MobileNavButton
                      key={item.path}
                      active={isActive(item.path)}
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
