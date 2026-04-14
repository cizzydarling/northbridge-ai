import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect, useRef } from "react";
import { getCurrentUserLocal, logoutUser, getBillingAccess } from "../api";
import Button from "../components/ui/Button";

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "individual_pro") return "pro";
  if (value === "individual_premium") return "premium";
  if (value === "agent_pro") return "premium";
  if (value === "premium") return "premium";
  if (value === "pro") return "pro";
  return "free";
}

function PlanPill({ plan, language }) {
  const label =
    plan === "premium"
      ? "Premium"
      : plan === "pro"
      ? "Pro"
      : language === "fr"
      ? "Gratuit"
      : "Free";

  const className =
    plan === "premium"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : plan === "pro"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

function MobileMenuSectionTitle({ children }) {
  return (
    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </p>
  );
}

function DesktopNavItem({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-blue-50 text-blue-900 ring-1 ring-blue-100"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
        active
          ? "bg-blue-50 text-blue-900 ring-1 ring-blue-100"
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
  const [effectivePlan, setEffectivePlan] = useState(
    normalizePlan(currentUser?.plan)
  );
  const [loadingPlan, setLoadingPlan] = useState(true);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toolsRef = useRef(null);
  const accountRef = useRef(null);
  const mobileMenuPanelRef = useRef(null);

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

    async function loadPlan() {
      try {
        setLoadingPlan(true);
        const res = await getBillingAccess();
        if (!mounted) return;
        setEffectivePlan(normalizePlan(res?.data?.plan || currentUser?.plan));
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

    function handleRefresh() {
      loadPlan();
    }

    window.addEventListener("storage", handleRefresh);
    window.addEventListener("userUpdated", handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener("storage", handleRefresh);
      window.removeEventListener("userUpdated", handleRefresh);
    };
  }, [currentUser?.plan]);

  useEffect(() => {
    function handlePointerDown(event) {
      const clickedInsideTools =
        toolsRef.current && toolsRef.current.contains(event.target);
      const clickedInsideAccount =
        accountRef.current && accountRef.current.contains(event.target);
      const clickedInsideMobileMenu =
        mobileMenuPanelRef.current &&
        mobileMenuPanelRef.current.contains(event.target);

      if (!clickedInsideTools) setToolsOpen(false);
      if (!clickedInsideAccount) setAccountOpen(false);
      if (mobileMenuOpen && !clickedInsideMobileMenu) setMobileMenuOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setToolsOpen(false);
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
    setToolsOpen(false);
    setAccountOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const language = i18n.language === "fr" ? "fr" : "en";

  const isAgentWorkspace =
    currentUser?.role === "agent" || currentUser?.role === "admin";

  const displayName = useMemo(() => {
    const firstName =
      currentUser?.first_name?.trim() ||
      currentUser?.profile?.first_name?.trim() ||
      "";

    const lastName =
      currentUser?.last_name?.trim() ||
      currentUser?.profile?.last_name?.trim() ||
      "";

    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    return currentUser?.email || t("common.unknown");
  }, [currentUser, t]);

  const primaryNavItems = isAgentWorkspace
    ? [
        { label: t("nav.dashboard"), path: "/dashboard" },
        { label: t("nav.clients"), path: "/clients" },
        { label: t("nav.matters"), path: "/matters" },
        { label: t("nav.strategy"), path: "/strategy" },
      ]
    : [
        { label: t("nav.dashboard"), path: "/dashboard" },
        { label: t("nav.strategy"), path: "/strategy" },
        {
          label: language === "fr" ? "Documents" : "Documents",
          path: "/documents",
        },
        { label: t("layout.myApplication"), path: "/self/application" },
      ];

  const toolsItems = isAgentWorkspace
    ? [
        { label: t("nav.profile"), path: "/profile" },
        {
          label: language === "fr" ? "Tarifs et facturation" : "Pricing & Billing",
          path: "/pricing",
        },
      ]
    : [
        {
          label:
            language === "fr"
              ? "Générateur de documents"
              : "Document Generator",
          path: "/documents/generator",
        },
        {
          label:
            language === "fr"
              ? "Révision de documents"
              : "Document Review",
          path: "/documents/review",
        },
        {
          label: language === "fr" ? "Forms Studio" : "Forms Studio",
          path: "/forms",
        },
        { label: t("nav.profile"), path: "/profile" },
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
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  }

  function goTo(path) {
    setToolsOpen(false);
    setAccountOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  }

  function handleUpgradeClick() {
    if (effectivePlan === "free") {
      navigate("/pricing?plan=pro&source=header&intent=execute");
      return;
    }

    if (effectivePlan === "pro") {
      navigate("/pricing?plan=premium&source=header&intent=export");
      return;
    }

    navigate("/pricing");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-8">
            <Link to="/dashboard" className="shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-900 text-sm font-bold text-white shadow-sm shadow-blue-900/10">
                  NB
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {t("app.name")}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {isAgentWorkspace
                      ? t("layout.agentWorkspace")
                      : t("layout.personalWorkspace")}
                  </p>
                </div>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 xl:flex">
              {primaryNavItems.map((item) => (
                <DesktopNavItem
                  key={item.path}
                  to={item.path}
                  active={isActive(item.path)}
                >
                  {item.label}
                </DesktopNavItem>
              ))}

              <div className="relative" ref={toolsRef}>
                <button
                  type="button"
                  onClick={() => {
                    setToolsOpen((prev) => !prev);
                    setAccountOpen(false);
                  }}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    toolsItems.some((item) => isActive(item.path))
                      ? "bg-blue-50 text-blue-900 ring-1 ring-blue-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span>{language === "fr" ? "Outils" : "Tools"}</span>
                  <span className="text-[10px]">▾</span>
                </button>

                {toolsOpen && (
                  <div className="absolute left-0 top-12 z-50 w-72 rounded-3xl border border-slate-200 bg-white p-2.5 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                    <div className="px-3 pb-2 pt-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {language === "fr" ? "Outils" : "Tools"}
                      </p>
                    </div>

                    {toolsItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => goTo(item.path)}
                        className={`block w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                          isActive(item.path)
                            ? "bg-blue-50 text-blue-900"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {effectivePlan === "free" && (
              <Button
                variant="primary"
                className="hidden h-11 rounded-2xl px-5 shadow-sm md:inline-flex"
                onClick={handleUpgradeClick}
              >
                {language === "fr" ? "Passer à Pro" : "Upgrade"}
              </Button>
            )}

            {effectivePlan === "pro" && (
              <Button
                variant="primary"
                className="hidden h-11 rounded-2xl px-5 shadow-sm md:inline-flex"
                onClick={handleUpgradeClick}
              >
                {language === "fr" ? "Passer à Premium" : "Go Premium"}
              </Button>
            )}

            {effectivePlan === "premium" && (
              <Button
                variant="primary"
                className="hidden h-11 rounded-2xl px-5 shadow-sm md:inline-flex"
                onClick={() => navigate("/chat")}
              >
                {t("nav.aiAssistant")}
              </Button>
            )}

            <div className="relative hidden xl:block" ref={accountRef}>
              <button
                type="button"
                onClick={() => {
                  setAccountOpen((prev) => !prev);
                  setToolsOpen(false);
                }}
                className={`flex h-11 items-center gap-3 rounded-2xl border px-3.5 transition-all duration-200 ${
                  accountOpen
                    ? "border-blue-100 bg-blue-50/80 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-900 text-xs font-semibold text-white">
                  {displayName?.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden max-w-[170px] min-w-0 2xl:block">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {displayName}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500">▾</span>
              </button>

              {accountOpen && (
                <div className="absolute right-0 top-14 z-50 w-80 rounded-3xl border border-slate-200 bg-white p-2.5 shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
                  <div className="rounded-2xl bg-slate-50/80 px-4 py-4">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {displayName}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {currentUser?.email || t("common.unknown")}
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

                  <div className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => goTo("/pricing")}
                      className={`block w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                        isActive("/pricing") || isActive("/billing")
                          ? "bg-blue-50 text-blue-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {language === "fr"
                        ? "Tarifs et facturation"
                        : "Pricing & Billing"}
                    </button>
                  </div>

                  <div className="border-t border-slate-100 px-4 py-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {language === "fr" ? "Langue" : "Language"}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => switchLanguage("en")}
                        className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                          i18n.language === "en"
                            ? "bg-blue-900 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => switchLanguage("fr")}
                        className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                          i18n.language === "fr"
                            ? "bg-blue-900 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        FR
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-2 pt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full rounded-2xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      {t("nav.logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(true);
                setToolsOpen(false);
                setAccountOpen(false);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 xl:hidden"
              aria-label={language === "fr" ? "Ouvrir le menu" : "Open menu"}
            >
              <span className="text-lg leading-none">☰</span>
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />

          <div
            ref={mobileMenuPanelRef}
            className="absolute right-0 top-0 flex h-full w-[88vw] max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {currentUser?.email || t("common.unknown")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                aria-label={language === "fr" ? "Fermer le menu" : "Close menu"}
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="mb-7 rounded-3xl bg-slate-50 p-4">
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
                  className="h-11 w-full justify-center rounded-2xl"
                  onClick={() =>
                    goTo(
                      effectivePlan === "premium"
                        ? "/chat"
                        : effectivePlan === "pro"
                        ? "/pricing?plan=premium&source=mobile_menu&intent=export"
                        : "/pricing?plan=pro&source=mobile_menu&intent=execute"
                    )
                  }
                >
                  {effectivePlan === "premium"
                    ? t("nav.aiAssistant")
                    : effectivePlan === "pro"
                    ? language === "fr"
                      ? "Passer à Premium"
                      : "Go Premium"
                    : language === "fr"
                    ? "Passer à Pro"
                    : "Upgrade"}
                </Button>
              </div>

              <div className="mb-7">
                <MobileMenuSectionTitle>
                  {language === "fr" ? "Navigation" : "Navigation"}
                </MobileMenuSectionTitle>

                <div className="space-y-2">
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

              <div className="mb-7">
                <MobileMenuSectionTitle>
                  {language === "fr" ? "Outils" : "Tools"}
                </MobileMenuSectionTitle>

                <div className="space-y-2">
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

              <div className="mb-7">
                <MobileMenuSectionTitle>
                  {language === "fr" ? "Compte" : "Account"}
                </MobileMenuSectionTitle>

                <div className="space-y-2">
                  <MobileNavButton
                    active={isActive("/pricing") || isActive("/billing")}
                    onClick={() => goTo("/pricing")}
                  >
                    {language === "fr"
                      ? "Tarifs et facturation"
                      : "Pricing & Billing"}
                  </MobileNavButton>
                </div>
              </div>

              <div className="mb-7">
                <MobileMenuSectionTitle>
                  {language === "fr" ? "Langue" : "Language"}
                </MobileMenuSectionTitle>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => switchLanguage("en")}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      i18n.language === "en"
                        ? "bg-blue-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => switchLanguage("fr")}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      i18n.language === "fr"
                        ? "bg-blue-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    FR
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-5">
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

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}