import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const isFrench = i18n.language === "fr";

  const tryAssistantLabel = isFrench
    ? "Essayer l’assistant IA"
    : "Try AI Assistant";

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-900 text-sm font-bold text-white">
              NB
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {t("app.name")}
              </p>
              <p className="text-xs text-slate-500">{t("app.tagline")}</p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => switchLanguage("en")}
              className={`rounded-lg px-3 py-2 text-sm ${
                i18n.language === "en"
                  ? "bg-blue-900 text-white"
                  : "text-slate-600"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => switchLanguage("fr")}
              className={`rounded-lg px-3 py-2 text-sm ${
                i18n.language === "fr"
                  ? "bg-blue-900 text-white"
                  : "text-slate-600"
              }`}
            >
              FR
            </button>

            <Button onClick={() => navigate("/auth")}>
              {t("landing.getStarted")}
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <h1 className="text-4xl font-bold text-white md:text-6xl">
            {isFrench
              ? "Votre parcours vers le Canada, propulsé par l’IA"
              : "Your AI-Powered Path to Canada"}
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            {isFrench
              ? "Vérifiez votre admissibilité, construisez votre demande et avancez plus vite avec une expérience claire et guidée."
              : "Check your eligibility, build your application, and move faster with a clear, guided experience."}
          </p>

          {/* ✅ FIXED BUTTONS */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              variant="white"
              className="h-12 w-full sm:w-auto"
              onClick={() => navigate("/auth")}
            >
              {t("landing.getStarted")}
            </Button>

            <Button
              variant="outlineLight"
              className="h-12 w-full sm:w-auto"
              onClick={() => navigate("/chat")}
            >
              {tryAssistantLabel}
            </Button>
          </div>

          {/* STATS */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <HeroStat
              value={isFrench ? "Guidé" : "Guided"}
              label={isFrench ? "Parcours clair" : "Clear journey"}
            />
            <HeroStat
              value={isFrench ? "Simple" : "Simple"}
              label={isFrench ? "Expérience moderne" : "Modern experience"}
            />
            <HeroStat
              value={isFrench ? "Fiable" : "Trusted"}
              label={isFrench ? "Conçu pour rassurer" : "Built for confidence"}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold">
            {isFrench
              ? "Commencez à bâtir votre parcours vers le Canada"
              : "Start building your path to Canada"}
          </h2>

          <p className="mt-4 text-slate-300">
            {isFrench
              ? "Avancez avec clarté et confiance."
              : "Move forward with clarity and confidence."}
          </p>

          {/* ✅ FIXED BUTTONS */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center sm:items-center">
            <Button
              variant="white"
              className="h-12 w-full sm:w-auto"
              onClick={() => navigate("/auth")}
            >
              {t("landing.getStarted")}
            </Button>

            <Button
              variant="outlineLight"
              className="h-12 w-full sm:w-auto"
              onClick={() => navigate("/chat")}
            >
              {tryAssistantLabel}
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-500">
          © {new Date().getFullYear()} NorthBridgeAI
        </div>
      </footer>
    </div>
  );
}

/* SMALL COMPONENTS */

function HeroStat({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-300">{label}</p>
    </div>
  );
}