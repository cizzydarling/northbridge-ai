import { Link, useNavigate, useLocation } from "react-router-dom";
import { logoutUser } from "../api";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logoutUser();
    navigate("/auth");
  };

  const isActive = (path) =>
    location.pathname === path
      ? "text-blue-600 font-semibold"
      : "text-slate-700 hover:text-blue-600";

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        {/* Logo / Brand */}
        <Link
          to="/dashboard"
          className="text-lg font-bold text-slate-900"
        >
          NorthBridgeAI
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link to="/dashboard" className={isActive("/dashboard")}>
            Dashboard
          </Link>

          <Link to="/profile" className={isActive("/profile")}>
            Profile
          </Link>

          <Link to="/strategy" className={isActive("/strategy")}>
            Strategy
          </Link>

          <Link to="/clients" className={isActive("/clients")}>
            Clients
          </Link>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}