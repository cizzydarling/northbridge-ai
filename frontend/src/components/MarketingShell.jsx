import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "./ui/Button";

const marketingCopy = {
  en: {
    subtitle: "Canadian immigration copilot",
    navItems: [
      { label: "Home", path: "/" },
      { label: "Blog", path: "/blog" },
      { label: "Pricing", path: "/pricing" },
    ],
    signIn: "Sign in",
    getStarted: "Get started",
    footerSubtitle: "AI-assisted Canadian immigration planning.",
    footerBody:
      "NorthBridgeAI helps applicants organize strategy, profile details, documents, forms, and AI guidance in one modern workspace. Content is informational and is not legal advice.",
    languageLabel: "Language",
  },
  fr: {
    subtitle: "Copilote d'immigration canadienne",
    navItems: [
      { label: "Accueil", path: "/" },
      { label: "Blog", path: "/fr/blog" },
      { label: "Tarifs", path: "/pricing" },
    ],
    signIn: "Connexion",
    getStarted: "Commencer",
    footerSubtitle: "Planification de l'immigration canadienne assistee par IA.",
    footerBody:
      "NorthBridgeAI aide les candidats a organiser leur strategie, leur profil, leurs documents, leurs formulaires et l'assistance IA dans un espace de travail moderne. Le contenu est informatif et ne constitue pas un avis juridique.",
    languageLabel: "Langue",
  },
};

export default function MarketingShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const routeLanguage = location.pathname.startsWith("/fr/") ? "fr" : null;
  const storedLanguage = String(i18n.resolvedLanguage || i18n.language)
    .toLowerCase()
    .startsWith("fr")
    ? "fr"
    : "en";
  const language = routeLanguage || storedLanguage;
  const copy = marketingCopy[language];
  const navItems = copy.navItems;

  useEffect(() => {
    if (routeLanguage && storedLanguage !== routeLanguage) {
      i18n.changeLanguage(routeLanguage);
    }
  }, [i18n, routeLanguage, storedLanguage]);

  function getLocalizedPath(nextLanguage) {
    const path = location.pathname;

    if (nextLanguage === "fr") {
      if (path === "/blog") return "/fr/blog";
      if (path.startsWith("/blog/")) return `/fr${path}`;
      return path;
    }

    if (path === "/fr/blog") return "/blog";
    if (path.startsWith("/fr/blog/")) return path.replace("/fr", "");

    return path;
  }

  function switchLanguage(nextLanguage) {
    i18n.changeLanguage(nextLanguage);
    const nextPath = getLocalizedPath(nextLanguage);

    if (nextPath !== location.pathname) {
      navigate(nextPath);
    }
  }

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
                {copy.subtitle}
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
              to={language === "fr" ? "/fr/blog" : "/blog"}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-950 md:hidden"
            >
              Blog
            </Link>
            <div
              className="hidden items-center rounded-lg border border-stone-200 bg-white p-1 text-xs font-semibold shadow-sm sm:flex"
              aria-label={copy.languageLabel}
            >
              {["en", "fr"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => switchLanguage(item)}
                  className={`rounded-md px-2.5 py-1.5 uppercase transition ${
                    language === item
                      ? "bg-slate-950 text-white"
                      : "text-slate-500 hover:bg-stone-100 hover:text-slate-950"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => navigate("/auth")}
            >
              {copy.signIn}
            </Button>
            <Button
              variant="premium"
              size="sm"
              onClick={() => navigate("/auth")}
            >
              {copy.getStarted}
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
                  {copy.footerSubtitle}
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-slate-500">
              {copy.footerBody}
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
              {copy.signIn}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
