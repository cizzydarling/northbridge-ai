// src/components/Layout.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCurrentUserLocal, logoutUser } from "../api";

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const currentUser = getCurrentUserLocal();
  const isAgentWorkspace =
    currentUser?.role === "agent" || currentUser?.role === "admin";

  const primaryNavItems = isAgentWorkspace
    ? [
        { label: t("nav.dashboard"), path: "/dashboard" },
        { label: t("nav.clients"), path: "/clients" },
        { label: t("nav.matters"), path: "/matters" },
        { label: t("nav.strategy"), path: "/strategy" },
        { label: t("nav.aiAssistant"), path: "/chat" },
        { label: t("nav.billing"), path: "/billing" },
      ]
    : [
        { label: t("nav.dashboard"), path: "/dashboard" },
        { label: t("layout.myApplication"), path: "/self/application" },
        { label: t("layout.myDocuments"), path: "/self/documents" },
        { label: t("nav.strategy"), path: "/strategy" },
        { label: t("nav.aiAssistant"), path: "/chat" },
        { label: t("nav.profile"), path: "/profile" },
      ];

  function handleLogout() {
    logoutUser();
    navigate("/auth");
  }

  function isActive(path) {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/dashboard" className="shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0B1F3A] text-sm font-bold text-white shadow-sm">
                  NB
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0B1F3A]">
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
                        ? item.path === "/chat"
                          ? "bg-red-600 text-white shadow-sm"
                          : "bg-[#0B1F3A] text-white shadow-sm"
                        : item.path === "/chat"
                        ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/chat"
              className="hidden rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 md:inline-flex"
            >
              {t("nav.aiAssistant")}
            </Link>

            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B1F3A] text-xs font-semibold text-white">
                {(currentUser?.email || "U").slice(0, 1).toUpperCase()}
              </div>
              <div className="max-w-[180px]">
                <p className="truncate text-sm font-medium text-slate-900">
                  {currentUser?.email || t("common.unknown")}
                </p>
                <p className="text-xs capitalize text-slate-500">
                  {currentUser?.role || t("common.unknown")}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t("nav.logout")}
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white lg:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 md:px-6">
            {primaryNavItems.map((item) => {
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? item.path === "/chat"
                        ? "bg-red-600 text-white"
                        : "bg-[#0B1F3A] text-white"
                      : item.path === "/chat"
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}