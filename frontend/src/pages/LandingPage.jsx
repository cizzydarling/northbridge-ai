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
    <div className="nb-landing min-h-screen text-slate-900">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-sm">
              NB
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t("app.name")}
              </p>
              <p className="text-xs text-slate-500">{t("app.tagline")}</p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/blog"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:block"
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
                  ? "bg-slate-950 text-white"
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
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              FR
            </button>

            <Button onClick={() => navigate("/auth")}>{primaryCta}</Button>
          </div>
        </div>
      </header>

      <section className="nb-hero relative overflow-hidden">

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200 backdrop-blur-sm">
              {isFrench
                ? "Préparation à l’immigration assistée par IA"
                : "AI-assisted immigration preparation"}
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-6xl">
              {isFrench
                ? "Votre parcours vers le Canada, avec plus de clarté à chaque étape"
                : "Your path to Canada, with more clarity at every step"}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              {isFrench
                ? "Organisez votre profil et votre ménage, consultez les sources officielles et préparez vos brouillons dans un espace structuré."
                : "Organize your profile and household, explore official information, and prepare document drafts in a structured workspace."}
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
                {isFrench ? "Préparation enregistrée" : "Saved preparation"}
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
                  ? "Des renseignements à la préparation"
                  : "From information to preparation"
              }
              body={
                isFrench
                  ? "NorthBridgeAI vous aide à organiser les renseignements enregistrés, consulter les sources officielles et préparer des brouillons modifiables. Pro est nécessaire pour créer des brouillons de dossier et exporter en DOCX. L’assistance IA dépend du fournisseur; elle ne détermine pas votre admissibilité et ne garantit aucune approbation."
                  : "NorthBridgeAI helps you organize your recorded information, consult official sources, and prepare editable document drafts. Pro is required to create case drafts and export DOCX. AI assistance depends on provider availability; it does not determine your eligibility or guarantee approval."
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
                value={isFrench ? "Ciblé" : "Focused"}
                label={isFrench ? "Préparation structurée" : "Structured preparation"}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            {isFrench ? "Pourquoi NorthBridgeAI" : "Why NorthBridgeAI"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {isFrench
              ? "Une plateforme conçue pour réduire l’incertitude"
              : "A platform designed to reduce uncertainty"}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {isFrench
              ? "Passez de l’exploration à une préparation organisée : consultez les sources officielles, enregistrez vos renseignements et retrouvez votre travail sauvegardé."
              : "Move from exploration to organized preparation: consult official sources, record your information, and return to your saved work."}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title={isFrench ? "Renseignements organisés" : "Organized information"}
            desc={
              isFrench
                ? "Organisez vos renseignements et consultez les critères officiels."
                : "Organize your information and review official criteria."
            }
          />
          <FeatureCard
            title={isFrench ? "Préparation enregistrée" : "Saved preparation"}
            desc={
              isFrench
                ? "Organisez votre profil, vos objectifs, vos réponses enregistrées et vos tâches de préparation dans un même espace."
                : "Organize your profile, goals, saved answers and preparation tasks in one workspace."
            }
          />
          <FeatureCard
            title={isFrench ? "Préparation guidée" : "Guided preparation"}
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
                ? "NorthBridgeAI relie votre profil, vos dossiers, vos réponses enregistrées et votre préparation documentaire dans un même espace."
                : "NorthBridgeAI connects your profile, cases, saved answers and document preparation in one workspace."
            }
            items={
              isFrench
                ? [
                    "Votre profil enregistré et vos réponses sauvegardées",
                    "Sources officielles et tâches de préparation à examiner",
                    "Aide IA à la préparation, selon sa disponibilité",
                  ]
                : [
                    "Your recorded profile and saved answers",
                    "Official references and preparation tasks to review",
                    "AI preparation assistance, when available",
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
                ? "Explorez les sources officielles et préparez les renseignements de votre dossier à votre rythme."
                : "Explore official sources and prepare your case information at your own pace."
            }
            items={
              isFrench
                ? [
                    "Consulter les critères officiels",
                    "Organiser votre dossier et vos réponses enregistrées",
                    "Préparer des brouillons de documents modifiables",
                  ]
                : [
                    "Explore official criteria",
                    "Organize your case and saved answers",
                    "Prepare editable document drafts",
                  ]
            }
          />
        </div>
      </section>

      <section className="bg-[#172033] text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
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
            <Link className="rounded-md px-2 py-1 hover:bg-slate-100" to="/legal">
              {isFrench ? "Mentions légales" : "Legal"}
            </Link>
            <Link className="rounded-md px-2 py-1 hover:bg-slate-100" to="/privacy">
              {isFrench ? "Confidentialité" : "Privacy"}
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
    <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-stone-100 backdrop-blur-sm">
      {children}
    </div>
  );
}

function HeroPanel({ eyebrow, title, body }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
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
