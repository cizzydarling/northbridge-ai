import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "./ui/Button";

const navItems = [
  { label: "Home", path: "/" },
  { label: "Blog", path: "/blog" },
  { label: "Pricing", path: "/pricing" },
];

export default function MarketingShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  function isActive(path) {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white shadow-sm">
              NB
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-950">
                NorthBridgeAI
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">
                Canadian immigration copilot
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(item.path)
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/blog"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950 md:hidden"
            >
              Blog
            </Link>
            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => navigate("/auth")}
            >
              Sign in
            </Button>
            <Button
              variant="premium"
              size="sm"
              onClick={() => navigate("/auth")}
            >
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm md:grid-cols-[1.3fr_0.7fr] md:px-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-xs font-semibold text-white">
                NB
              </span>
              <div>
                <p className="font-semibold text-slate-950">NorthBridgeAI</p>
                <p className="text-slate-500">
                  AI-assisted Canadian immigration planning.
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-slate-500">
              NorthBridgeAI helps applicants organize strategy, profile details,
              documents, forms, and AI guidance in one modern workspace. Content
              is informational and is not legal advice.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3 md:justify-end">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="rounded-lg px-3 py-2 text-slate-600 transition hover:bg-stone-100 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/auth"
              className="rounded-lg px-3 py-2 text-slate-600 transition hover:bg-stone-100 hover:text-slate-950"
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
