import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const isFrench = i18n.language === "fr";

  const testimonials = isFrench
    ? [
        {
          name: "Amina R.",
          role: "Candidate à l’immigration",
          text: "NorthBridgeAI m’a aidée à comprendre mes options plus clairement et à avancer étape par étape.",
        },
        {
          name: "David K.",
          role: "Travailleur qualifié",
          text: "L’expérience est simple, professionnelle et très rassurante. On sait quoi faire ensuite.",
        },
        {
          name: "Sara M.",
          role: "Demandeuse d’études",
          text: "J’ai enfin eu l’impression d’avoir un plan clair au lieu de naviguer seule dans le processus.",
        },
      ]
    : [
        {
          name: "Amina R.",
          role: "Immigration candidate",
          text: "NorthBridgeAI helped me understand my options clearly and move forward step by step.",
        },
        {
          name: "David K.",
          role: "Skilled worker",
          text: "The experience feels simple, professional, and reassuring. You always know what to do next.",
        },
        {
          name: "Sara M.",
          role: "Study applicant",
          text: "For the first time, I felt like I had a clear plan instead of navigating the process alone.",
        },
      ];

  const pricingCards = isFrench
    ? [
        {
          name: "Gratuit",
          price: "$0",
          subtitle: "Pour commencer",
          features: [
            "Vérification d’admissibilité de base",
            "Profil personnel",
            "Accès limité à l’assistant IA",
          ],
          cta: "Commencer",
          featured: false,
        },
        {
          name: "Premium",
          price: "$29",
          subtitle: "par mois",
          features: [
            "Stratégie personnalisée complète",
            "Conseils IA plus avancés",
            "Suivi de progression",
            "Recommandations de prochaines étapes",
          ],
          cta: "Choisir Premium",
          featured: true,
        },
        {
          name: "Pro",
          price: "$79",
          subtitle: "par mois",
          features: [
            "Outils de préparation avancés",
            "Espace documents",
            "Aide à la structuration du dossier",
            "Expérience guidée complète",
          ],
          cta: "Choisir Pro",
          featured: false,
        },
      ]
    : [
        {
          name: "Free",
          price: "$0",
          subtitle: "to get started",
          features: [
            "Basic eligibility check",
            "Personal profile",
            "Limited AI assistant access",
          ],
          cta: "Get Started",
          featured: false,
        },
        {
          name: "Premium",
          price: "$29",
          subtitle: "per month",
          features: [
            "Full personalized strategy",
            "More advanced AI guidance",
            "Progress tracking",
            "Recommended next steps",
          ],
          cta: "Choose Premium",
          featured: true,
        },
        {
          name: "Pro",
          price: "$79",
          subtitle: "per month",
          features: [
            "Advanced preparation tools",
            "Document workspace",
            "Application structure support",
            "Full guided experience",
          ],
          cta: "Choose Pro",
          featured: false,
        },
      ];

  const heroTitle = isFrench
    ? "Votre parcours vers le Canada, propulsé par l’IA"
    : "Your AI-Powered Path to Canada";

  const heroSubtitle = isFrench
    ? "Vérifiez votre admissibilité, construisez votre demande et avancez plus vite avec une expérience claire, guidée et rassurante."
    : "Check your eligibility, build your application, and move faster with a clear, guided, and trustworthy experience.";

  const tryAssistantLabel = isFrench ? "Essayer l’assistant IA" : "Try AI Assistant";
  const socialProofTitle = isFrench ? "Conçu pour inspirer confiance" : "Built to inspire confidence";
  const socialProofSubtitle = isFrench
    ? "Une expérience moderne pour aider les utilisateurs à comprendre leur situation, organiser leurs documents et avancer avec plus de clarté."
    : "A modern experience built to help users understand their situation, organize documents, and move forward with more clarity.";

  const howItWorksTitle = isFrench ? "Comment ça fonctionne" : "How it works";
  const howItWorksSteps = isFrench
    ? [
        {
          title: "1. Complétez votre profil",
          text: "Rassemblez les informations clés pour obtenir une lecture plus précise de votre situation.",
        },
        {
          title: "2. Vérifiez votre admissibilité",
          text: "Comprenez vos options, vos points forts et les éléments à améliorer.",
        },
        {
          title: "3. Suivez votre parcours",
          text: "Recevez des prochaines étapes claires, des conseils IA et une progression guidée.",
        },
      ]
    : [
        {
          title: "1. Complete your profile",
          text: "Capture the key details needed for a more accurate view of your immigration situation.",
        },
        {
          title: "2. Check your eligibility",
          text: "Understand your options, strengths, and what still needs improvement.",
        },
        {
          title: "3. Follow your journey",
          text: "Get clear next steps, AI guidance, and a guided path forward.",
        },
      ];

  const trustBlockTitle = isFrench ? "Simple. Fiable. Guidé." : "Simple. Trustworthy. Guided.";
  const trustBlocks = isFrench
    ? [
        {
          title: "Simple comme ChatGPT",
          text: "Une interface claire, moderne et facile à comprendre dès le premier regard.",
        },
        {
          title: "Fiable comme une banque",
          text: "Une présentation professionnelle, structurée et conçue pour rassurer.",
        },
        {
          title: "Guidé comme un GPS",
          text: "Toujours savoir quoi faire ensuite, sans rester bloqué dans l’incertitude.",
        },
      ]
    : [
        {
          title: "Simple like ChatGPT",
          text: "A clean, modern interface that feels easy to understand from the first screen.",
        },
        {
          title: "Trustworthy like a bank",
          text: "A professional, structured presentation designed to build confidence.",
        },
        {
          title: "Guided like a GPS",
          text: "Always know what to do next instead of getting stuck in uncertainty.",
        },
      ];

  const legalHeadline = isFrench ? "Information importante" : "Important information";
  const legalText = isFrench
    ? "NorthBridgeAI fournit un soutien informatif, éducatif et de planification. La plateforme ne remplace pas un avis juridique provenant d’un avocat autorisé ou d’un consultant réglementé."
    : "NorthBridgeAI provides informational, educational, and planning support. The platform does not replace legal advice from a licensed lawyer or regulated consultant.";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0B1F3A] text-sm font-bold text-white">
              NB
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">{t("app.name")}</p>
              <p className="text-xs text-slate-500">{t("app.tagline")}</p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => i18n.changeLanguage("en")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                i18n.language === "en"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => i18n.changeLanguage("fr")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                i18n.language === "fr"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              FR
            </button>

            <button
              onClick={() => navigate("/auth")}
              className="ml-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t("nav.login")}
            </button>

            <button
              onClick={() => navigate("/auth")}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              {t("landing.getStarted")}
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#0B1F3A]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(220,38,38,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-slate-200">
              {t("landing.badge")}
            </span>

            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-white md:text-6xl">
              {heroTitle}
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              {heroSubtitle}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate("/auth")}
                className="rounded-2xl bg-red-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                {t("landing.getStarted")}
              </button>

              <button
                onClick={() => navigate("/chat")}
                className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/15"
              >
                {tryAssistantLabel}
              </button>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
              <HeroStat
                value={isFrench ? "Guidé" : "Guided"}
                label={isFrench ? "Parcours clair" : "Clear journey"}
              />
              <HeroStat
                value={isFrench ? "Simple" : "Simple"}
                label={isFrench ? "Expérience moderne" : "Modern experience"}
              />
              <HeroStat
                value={isFrench ? "Fiable" : "Trustworthy"}
                label={isFrench ? "Conçu pour rassurer" : "Built for confidence"}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-sm">
            <div className="rounded-3xl bg-white p-6 text-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-600">{t("app.name")}</p>
                  <h3 className="mt-1 text-2xl font-bold text-[#0B1F3A]">
                    {isFrench ? "Votre tableau de bord" : "Your dashboard"}
                  </h3>
                </div>
                <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  {isFrench ? "Assistant IA" : "AI Assistant"}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <DashboardPreviewCard
                  title={isFrench ? "Vérifier l’admissibilité" : "Check eligibility"}
                  text={
                    isFrench
                      ? "Obtenez une lecture claire de votre profil et de vos options."
                      : "Get a clear read on your profile and your available options."
                  }
                />
                <DashboardPreviewCard
                  title={isFrench ? "Continuer la demande" : "Continue application"}
                  text={
                    isFrench
                      ? "Reprenez votre progression et avancez étape par étape."
                      : "Resume your progress and move forward step by step."
                  }
                />
                <DashboardPreviewCard
                  title={isFrench ? "Parler à l’assistant IA" : "Ask AI Assistant"}
                  text={
                    isFrench
                      ? "Recevez des réponses personnalisées selon votre profil."
                      : "Get personalized answers based on your profile."
                  }
                  featured
                />
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {isFrench ? "Prochaine étape" : "Next best step"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {isFrench
                    ? "Complétez votre profil, consultez votre stratégie et préparez vos documents avec une expérience guidée."
                    : "Complete your profile, review your strategy, and prepare documents with a guided experience."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
              {socialProofTitle}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-[#0B1F3A]">
              {isFrench ? "Une plateforme conçue pour avancer avec confiance" : "A platform designed to move forward with confidence"}
            </h2>
            <p className="mt-4 text-lg text-slate-600">{socialProofSubtitle}</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <div
                key={item.name}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
              >
                <p className="text-sm leading-7 text-slate-700">“{item.text}”</p>
                <div className="mt-5">
                  <p className="font-semibold text-[#0B1F3A]">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
              {howItWorksTitle}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-[#0B1F3A]">
              {isFrench
                ? "Une expérience claire du début à la préparation"
                : "A clear experience from start to preparation"}
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {howItWorksSteps.map((step) => (
              <div
                key={step.title}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
              >
                <h3 className="text-xl font-semibold text-[#0B1F3A]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
              {trustBlockTitle}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-[#0B1F3A]">
              {isFrench
                ? "Votre produit doit refléter votre philosophie"
                : "Your product should reflect your philosophy"}
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {trustBlocks.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
              >
                <h3 className="text-xl font-semibold text-[#0B1F3A]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
              {t("common.pricing")}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-[#0B1F3A]">
              {isFrench ? "Choisissez le bon niveau d’accompagnement" : "Choose the right level of support"}
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              {isFrench
                ? "Commencez gratuitement, puis évoluez vers plus de conseils, plus d’outils et une expérience plus guidée."
                : "Start free, then grow into more guidance, more tools, and a more complete guided experience."}
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricingCards.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl p-6 shadow-sm ${
                  plan.featured
                    ? "border-2 border-red-500 bg-white"
                    : "border border-slate-200 bg-white"
                }`}
              >
                {plan.featured ? (
                  <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    {isFrench ? "Le plus populaire" : "Most popular"}
                  </span>
                ) : null}

                <h3 className="mt-4 text-2xl font-bold text-[#0B1F3A]">{plan.name}</h3>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  <span className="pb-1 text-sm text-slate-500">{plan.subtitle}</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate("/auth")}
                  className={`mt-8 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    plan.featured
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0B1F3A]">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center md:px-6">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            {isFrench
              ? "Commencez à bâtir votre parcours vers le Canada"
              : "Start building your path to Canada"}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            {isFrench
              ? "Vérifiez votre admissibilité, construisez votre demande et avancez avec plus de clarté."
              : "Check your eligibility, build your application, and move forward with more clarity."}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => navigate("/auth")}
              className="rounded-2xl bg-red-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-red-700"
            >
              {t("landing.getStarted")}
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/15"
            >
              {tryAssistantLabel}
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0B1F3A] text-sm font-bold text-white">
                  NB
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0B1F3A]">{t("app.name")}</p>
                  <p className="text-xs text-slate-500">{t("app.tagline")}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">{legalHeadline}</p>
                <p className="mt-2 text-sm leading-6 text-red-700">{legalText}</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {isFrench ? "Produit" : "Product"}
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <button onClick={() => navigate("/auth")} className="block hover:text-slate-900">
                    {t("landing.getStarted")}
                  </button>
                  <button onClick={() => navigate("/chat")} className="block hover:text-slate-900">
                    {tryAssistantLabel}
                  </button>
                  <button onClick={() => navigate("/pricing")} className="block hover:text-slate-900">
                    {t("common.pricing")}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {isFrench ? "Accès" : "Access"}
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <button onClick={() => navigate("/auth")} className="block hover:text-slate-900">
                    {t("nav.login")}
                  </button>
                  <button onClick={() => navigate("/auth")} className="block hover:text-slate-900">
                    {t("nav.register")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroStat({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-300">{label}</p>
    </div>
  );
}

function DashboardPreviewCard({ title, text, featured = false }) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        featured
          ? "border border-red-200 bg-red-50"
          : "border border-slate-200 bg-slate-50"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          featured ? "text-red-700" : "text-[#0B1F3A]"
        }`}
      >
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}