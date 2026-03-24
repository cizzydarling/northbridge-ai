import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUserLocal, logoutUser } from "../api";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUserLocal();

  const isAgent =
    currentUser?.plan === "agent" || currentUser?.role === "agent";

  function handleLogout() {
    logoutUser();
    navigate("/auth");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
            <p className="text-xs text-slate-500">
              {isAgent ? "Agent Workspace" : "Personal Workspace"}
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {isAgent ? (
              <NavButton
                to="/clients"
                label="Clients"
                active={location.pathname.startsWith("/clients")}
              />
            ) : (
              <>
                <NavButton
                  to="/self/dashboard"
                  label="Dashboard"
                  active={location.pathname.startsWith("/self/dashboard")}
                />
                <NavButton
                  to="/self/application"
                  label="My Application"
                  active={location.pathname.startsWith("/self/application")}
                />
                <NavButton
                  to="/self/documents"
                  label="My Documents"
                  active={location.pathname.startsWith("/self/documents")}
                />
                <NavButton
                  to="/profile"
                  label="Profile"
                  active={location.pathname.startsWith("/profile")}
                />
                <NavButton
                  to="/strategy"
                  label="Strategy"
                  active={location.pathname.startsWith("/strategy")}
                />
              </>
            )}

            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

function NavButton({ to, label, active = false }) {
  return (
    <Link
      to={to}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}