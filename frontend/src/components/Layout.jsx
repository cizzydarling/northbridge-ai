import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMemo, useState, useEffect } from "react";
import { getCurrentUserLocal, logoutUser } from "../api";
import Button from "../components/ui/Button";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [currentUser, setCurrentUser] = useState(getCurrentUserLocal());

  useEffect(() => {
  const handleUserUpdate = () => {
    setCurrentUser(getCurrentUserLocal());
  };

  // Trigger when localStorage changes (cross-tab)
  window.addEventListener("storage", handleUserUpdate);

  // 🔥 ALSO trigger manually (same tab)
  window.addEventListener("userUpdated", handleUserUpdate);

  return () => {
    window.removeEventListener("storage", handleUserUpdate);
    window.removeEventListener("userUpdated", handleUserUpdate);
  };
}, []);
  const [toolsOpen, setToolsOpen] = useState(false);

  const isAgentWorkspace =
    currentUser?.role === "agent" || currentUser?.role === "admin";

  const language = i18n.language === "fr" ? "fr" : "en";

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
        { label: t("layout.myApplication"), path: "/self/application" },
        { label: t("nav.strategy"), path: "/strategy" },
        { label: t("layout.myDocuments"), path: "/self/documents" },
      ];

  const toolItems = isAgentWorkspace
    ? [
        { label: t("nav.profile"), path: "/profile" },
        { label: t("nav.billing"), path: "/billing" },
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
        { label: t("nav.profile"), path: "/profile" },
        { label: t("nav.billing"), path: "/billing" },
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
      location.pathname === path ||
      location.pathname.startsWith(path + "/")
    );
  }

  function goTo(path) {
    setToolsOpen(false);
    navigate(path);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link to="/dashboard" className="shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-900 text-sm font-bold text-white shadow-sm">
                  NB
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-blue-900">
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

            <nav className="hidden items-center gap-2 lg:flex">
              {primaryNavItems.map((item) => {
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-blue-100 text-blue-900 ring-1 ring-blue-200"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setToolsOpen((prev) => !prev)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    toolItems.some((item) => isActive(item.path))
                      ? "bg-blue-100 text-blue-900 ring-1 ring-blue-200"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {language === "fr" ? "Outils" : "Tools"} ▾
                </button>

                {toolsOpen && (
                  <div className="absolute left-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                    {toolItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => goTo(item.path)}
                        className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                          isActive(item.path)
                            ? "bg-blue-50 text-blue-900"
                            : "text-slate-700 hover:bg-slate-100"
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
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => switchLanguage("en")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  i18n.language === "en"
                    ? "bg-blue-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => switchLanguage("fr")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  i18n.language === "fr"
                    ? "bg-blue-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                FR
              </button>
            </div>

            <Button
              variant="primary"
              className="hidden h-10 px-4 md:inline-flex"
              onClick={() => navigate("/chat")}
            >
              {t("nav.aiAssistant")}
            </Button>

            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-900 text-xs font-semibold text-white">
                {displayName?.slice(0, 1).toUpperCase()}
              </div>
              <div className="max-w-[160px]">
                <p className="truncate text-sm font-medium text-slate-900">
                  {displayName}
                </p>
                <p className="truncate text-xs capitalize text-slate-500">
                  {currentUser?.role || t("common.unknown")}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              className="h-10 px-4"
              onClick={handleLogout}
            >
              {t("nav.logout")}
            </Button>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white lg:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3">
            {primaryNavItems.map((item) => {
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                    active
                      ? "bg-blue-100 text-blue-900 ring-1 ring-blue-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {toolItems.map((item) => {
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                    active
                      ? "bg-blue-100 text-blue-900 ring-1 ring-blue-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <Link
              to="/chat"
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                isActive("/chat")
                  ? "bg-blue-100 text-blue-900 ring-1 ring-blue-200"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {t("nav.aiAssistant")}
            </Link>
          </div>

          <div className="flex items-center gap-2 px-4 pb-3 sm:hidden">
            <button
              type="button"
              onClick={() => switchLanguage("en")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                i18n.language === "en"
                  ? "bg-blue-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => switchLanguage("fr")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                i18n.language === "fr"
                  ? "bg-blue-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              FR
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}