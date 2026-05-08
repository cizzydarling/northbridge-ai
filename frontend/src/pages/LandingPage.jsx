import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "../components/ui/Button";

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const isFrench = i18n.language === "fr";

  const tryAssistantLabel = isFrench
    ? "Essayer l’assistant IA"
    : "Try AI Assistant";

  const primaryCta = isFrench ? "Commencer gratuitement" : "Get Started Free";
  const secondaryCta = tryAssistantLabel;

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-900 text-sm font-bold text-white shadow-sm">
              NB
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t("app.name")}
              </p>
              <p className="text-xs text-slate-500">{t("app.tagline")}</p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/blog"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Blog
            </Link>

            <Link
              to="/pricing"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {isFrench ? "Tarifs" : "Pricing"}
            </Link>

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

            <Button onClick={() => navigate("/auth")}>{primaryCta}</Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.10),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.08),transparent_32%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100 backdrop-blur-sm">
              {isFrench
                ? "Planification d’immigration assistée par IA"
                : "AI-assisted immigration planning"}
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-6xl">
              {isFrench
                ? "Votre parcours vers le Canada, avec plus de clarté à chaque étape"
                : "Your path to Canada, with more clarity at every step"}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              {isFrench
                ? "Analysez votre admissibilité, construisez une stratégie personnalisée, préparez vos documents et avancez avec une expérience moderne, structurée et guidée."
                : "Analyze your eligibility, build a personalized strategy, prepare your documents, and move forward with a modern, structured, guided experience."}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="white"
                className="h-12 w-full sm:w-auto"
                onClick={() => navigate("/auth")}
              >
                {primaryCta}
              </Button>

              <Button
                variant="outlineLight"
                className="h-12 w-full sm:w-auto"
                onClick={() => navigate("/chat")}
              >
                {secondaryCta}
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <TrustPill>
                {isFrench ? "Stratégie personnalisée" : "Personalized strategy"}
              </TrustPill>
              <TrustPill>
                {isFrench ? "Guidance étape par étape" : "Step-by-step guidance"}
              </TrustPill>
              <TrustPill>
                {isFrench ? "Copilote IA intégré" : "Built-in AI copilot"}
              </TrustPill>
            </div>
          </div>

          <div className="grid gap-4">
            <HeroPanel
              eyebrow={isFrench ? "Vue produit" : "Product view"}
              title={
                isFrench
                  ? "De la stratégie à l’exécution"
                  : "From strategy to execution"
              }
              body={
                isFrench
                  ? "NorthBridgeAI vous aide à comprendre votre position, identifier vos meilleures voies et passer à l’action avec les bons documents."
                  : "NorthBridgeAI helps you understand where you stand, identify your best pathways, and move into action with the right documents."
              }
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <HeroStat
                value={isFrench ? "Guidé" : "Guided"}
                label={isFrench ? "Parcours clair" : "Clear journey"}
              />
              <HeroStat
                value={isFrench ? "Simple" : "Simple"}
                label={isFrench ? "Expérience moderne" : "Modern UX"}
              />
              <HeroStat
                value={isFrench ? "Fiable" : "Focused"}
                label={isFrench ? "Décisions éclairées" : "Better decisions"}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            {isFrench ? "Pourquoi NorthBridgeAI" : "Why NorthBridgeAI"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {isFrench
              ? "Une plateforme conçue pour réduire l’incertitude"
              : "A platform designed to reduce uncertainty"}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {isFrench
              ? "Passez d’une simple exploration à une vraie exécution, avec une expérience qui vous aide à voir vos options, vos priorités et vos prochaines étapes."
              : "Move from basic exploration to real execution, with an experience that helps you see your options, priorities, and next steps."}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title={isFrench ? "Analyse intelligente" : "Smart analysis"}
            desc={
              isFrench
                ? "Comprenez vos chances, vos écarts et les éléments qui influencent le plus votre dossier."
                : "Understand your chances, your gaps, and the factors that matter most in your case."
            }
          />
          <FeatureCard
            title={isFrench ? "Stratégie personnalisée" : "Personal strategy"}
            desc={
              isFrench
                ? "Recevez un plan structuré adapté à votre profil, vos objectifs et votre progression."
                : "Get a structured plan tailored to your profile, goals, and progress."
            }
          />
          <FeatureCard
            title={isFrench ? "Exécution guidée" : "Guided execution"}
            desc={
              isFrench
                ? "Préparez vos documents, suivez vos prochaines étapes et avancez avec plus de confiance."
                : "Prepare your documents, follow your next steps, and move forward with more confidence."
            }
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <ValuePanel
            eyebrow={isFrench ? "Ce que vous débloquez" : "What you unlock"}
            title={
              isFrench
                ? "Plus qu’un simple outil, un vrai parcours produit"
                : "More than a simple tool, a real product journey"
            }
            body={
              isFrench
                ? "NorthBridgeAI combine stratégie, guidance, IA et exécution documentaire dans une seule expérience cohérente."
                : "NorthBridgeAI combines strategy, guidance, AI, and document execution in one coherent experience."
            }
            items={
              isFrench
                ? [
                    "Vue claire de votre profil et de vos options",
                    "Recommandations prioritaires faciles à suivre",
                    "Aide IA pour comprendre quoi faire ensuite",
                  ]
                : [
                    "A clear view of your profile and options",
                    "Priority recommendations that are easy to follow",
                    "AI help to understand what to do next",
                  ]
            }
          />

          <ValuePanel
            eyebrow={isFrench ? "Pour qui" : "Who it is for"}
            title={
              isFrench
                ? "Pensé pour les utilisateurs qui veulent avancer"
                : "Built for users who want to move forward"
            }
            body={
              isFrench
                ? "Que vous exploriez vos chances ou que vous soyez prêt à préparer un dossier plus complet, la plateforme s’adapte à votre étape."
                : "Whether you are exploring your chances or ready to prepare a fuller case, the platform adapts to your stage."
            }
            items={
              isFrench
                ? [
                    "Explorer votre admissibilité",
                    "Construire une stratégie personnalisée",
                    "Passer à l’exécution avec les bons documents",
                  ]
                : [
                    "Explore your eligibility",
                    "Build a personalized strategy",
                    "Move into execution with the right documents",
                  ]
            }
          />
        </div>
      </section>

      <section className="bg-blue-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">
            {isFrench ? "Commencez maintenant" : "Start now"}
          </p>

          <h2 className="mt-3 text-3xl font-bold">
            {isFrench
              ? "Commencez votre parcours aujourd’hui"
              : "Start your journey today"}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-300">
            {isFrench
              ? "Clair. Structuré. Propulsé par l’IA."
              : "Clear. Structured. AI-powered."}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="white"
              className="h-12 w-full sm:w-auto"
              onClick={() => navigate("/auth")}
            >
              {primaryCta}
            </Button>

            <Button
              variant="outlineLight"
              className="h-12 w-full sm:w-auto"
              onClick={() => navigate("/chat")}
            >
              {secondaryCta}
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-10 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} NorthBridgeAI</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link className="rounded-md px-2 py-1 hover:bg-slate-100" to="/blog">
              Blog
            </Link>
            <Link
              className="rounded-md px-2 py-1 hover:bg-slate-100"
              to="/pricing"
            >
              {isFrench ? "Tarifs" : "Pricing"}
            </Link>
            <button
              type="button"
              onClick={() => switchLanguage("en")}
              className="rounded-md px-2 py-1 hover:bg-slate-100"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => switchLanguage("fr")}
              className="rounded-md px-2 py-1 hover:bg-slate-100"
            >
              FR
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TrustPill({ children }) {
  return (
    <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur-sm">
      {children}
    </div>
  );
}

function HeroPanel({ eyebrow, title, body }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-300">{body}</p>
    </div>
  );
}

function HeroStat({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-300">{label}</p>
    </div>
  );
}

function FeatureCard({ title, desc }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{desc}</p>
    </div>
  );
}

function ValuePanel({ eyebrow, title, body, items }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>

      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
