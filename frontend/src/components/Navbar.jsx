import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser, getUserDisplayName, logoutUser } from "../api";

export default function Navbar({ language = "en" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  const isFrench = String(language || "en").toLowerCase().startsWith("fr");

  const text = isFrench
    ? {
        dashboard: "Tableau de bord",
        profile: "Profil",
        strategy: "Stratégie",
        documents: "Documents",
        logout: "Se déconnecter",
      }
    : {
        dashboard: "Dashboard",
        profile: "Profile",
        strategy: "Strategy",
        documents: "Documents",
        logout: "Logout",
      };

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await getCurrentUser();
        setUser(res?.data || null);
      } catch {
        setUser(null);
      }
    }

    loadUser();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest(".navbar-dropdown")) {
        setOpen(false);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleLogout = () => {
    logoutUser();
    navigate("/auth");
  };

  const isActive = (path) =>
    location.pathname === path
      ? "text-blue-600 font-semibold"
      : "text-slate-700 hover:text-blue-600";

  const displayName = getUserDisplayName(
    user,
    isFrench ? "Utilisateur" : "User"
  );

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/dashboard" className="text-lg font-bold text-slate-900">
          NorthBridgeAI
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          <Link to="/dashboard" className={isActive("/dashboard")}>
            {text.dashboard}
          </Link>

          <Link to="/profile" className={isActive("/profile")}>
            {text.profile}
          </Link>

          <Link to="/strategy" className={isActive("/strategy")}>
            {text.strategy}
          </Link>

          <Link to="/documents" className={isActive("/documents")}>
            {text.documents}
          </Link>
        </div>

        <div className="relative navbar-dropdown">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {displayName.charAt(0).toUpperCase()}
            </div>

            <span className="hidden sm:block">{displayName}</span>
          </button>

          {open && (
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">
                  {displayName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {isFrench ? "Espace personnel" : "Personal workspace"}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              >
                {text.logout}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
