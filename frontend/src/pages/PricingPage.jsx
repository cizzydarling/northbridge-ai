import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import {
  createCheckoutSession,
  createPortalSession,
  devSetPlan,
  getBillingAccess,
  getBillingPlans,
  getBillingStatus,
  refreshCurrentUser,
} from "../api";

function normalizeLanguage(language) {
  return String(language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();

  if (value === "individual_pro") return "pro";
  if (value === "individual_premium") return "premium";
  if (value === "premium") return "premium";
  if (value === "pro") return "pro";
  return "free";
}

function toBackendPlan(productPlan) {
  const value = String(productPlan || "").trim().toLowerCase();

  if (value === "pro") return "individual_pro";
  if (value === "premium") return "individual_premium";
  return "free";
}

function getDisplayPlan(plan, lang) {
  const normalized = normalizePlan(plan);

  if (lang === "fr") {
    if (normalized === "premium") return "Premium";
    if (normalized === "pro") return "Pro";
    return "Gratuit";
  }

  if (normalized === "premium") return "Premium";
  if (normalized === "pro") return "Pro";
  return "Free";
}

function SurfaceCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

function StatusPill({ children, active = false, featured = false }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        featured
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function ValueCard({ title, body }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <p className="text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </p>
      <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function FeatureListItem({ children, highlighted = false }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-2.5 text-sm leading-6 ${
        highlighted
          ? "border-blue-100 bg-blue-50 text-slate-700"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {children}
    </div>
  );
}

function ComparisonValue({ value, emphasized = false, language = "en" }) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "yes" || normalized === "oui") {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
          emphasized
            ? "bg-blue-50 text-blue-700"
            : "bg-emerald-50 text-emerald-700"
        }`}
      >
        ✓
      </span>
    );
  }

  if (normalized === "no" || normalized === "non") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        —
      </span>
    );
  }

  if (normalized === "limited" || normalized === "limité") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        {language === "fr" ? "Limité" : "Limited"}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        emphasized
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {value}
    </span>
  );
}

function PlanCard({
  plan,
  text,
  language,
  isCurrent,
  isHighlighted,
  onSelect,
  loading,
  recommendedPlan,
}) {
  const isFeatured = Boolean(plan.featured);
  const isRecommended = recommendedPlan === plan.key;
  const shouldHighlight = Boolean(isHighlighted && !isCurrent);

  const highlightStyle = isRecommended
    ? "border-blue-400 ring-2 ring-blue-200 bg-gradient-to-b from-white to-blue-50/40 shadow-[0_22px_70px_rgba(37,99,235,0.10)]"
    : shouldHighlight
    ? "border-amber-300 ring-2 ring-amber-200"
    : isFeatured
    ? "border-blue-200 ring-1 ring-blue-100"
    : "border-slate-200";

  return (
    <div
      className={`relative flex h-full flex-col rounded-[30px] border bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(15,23,42,0.10)] ${highlightStyle}`}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-5 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm">
          {text.recommendationPill}
        </div>
      )}

      {isFeatured && (
        <div className="absolute -top-3 right-5 rounded-full bg-blue-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm">
          {text.mostPopular}
        </div>
      )}

      {plan.badge ? (
        <div className="mb-4 inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
          {plan.badge}
        </div>
      ) : null}

      {plan.key === "premium" && (
        <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-800">
          {language === "fr"
            ? "Pour finaliser un dossier complet et prêt à être partagé"
            : "For completing a full, submission-ready case"}
        </div>
      )}

      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {plan.audience}
        </p>
        <h2 className="mt-2.5 text-[28px] md:text-[30px] font-semibold tracking-tight text-slate-900">
          {plan.title}
        </h2>
        <p className="mt-2.5 text-[34px] md:text-[38px] font-semibold tracking-tight text-slate-900">
          {plan.price}
        </p>
        {plan.subprice ? (
          <p className="mt-2 text-sm font-medium text-slate-500">
            {plan.subprice}
          </p>
        ) : null}
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {plan.description}
        </p>

        {isRecommended ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {language === "fr"
              ? "C’est le meilleur point de départ pour débloquer votre stratégie complète et commencer l’exécution."
              : "This is the best starting point to unlock your full strategy and begin execution."}
          </div>
        ) : null}
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-900">
          {text.includedFeatures}
        </p>

        <div className="mt-3.5 space-y-2">
          {plan.features.map((feature, index) => (
            <FeatureListItem
              key={`${plan.key}-${index}`}
              highlighted={isRecommended}
            >
              {feature}
            </FeatureListItem>
          ))}
        </div>
      </div>

      {plan.fitNote ? (
        <div
          className={`mb-5 rounded-[22px] border px-4 py-3.5 text-sm leading-6 ${
            isRecommended
              ? "border-blue-200 bg-blue-50 text-slate-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <span className="font-semibold text-slate-900">
            {text.bestFitLabel}{" "}
          </span>
          {plan.fitNote}
        </div>
      ) : null}

      <div className="mt-auto">
        {isCurrent ? (
          <Button variant="secondary" disabled className="w-full rounded-2xl">
            {text.current}
          </Button>
        ) : (
          <Button
            onClick={onSelect}
            disabled={loading}
            className="w-full rounded-2xl"
            variant={isRecommended ? "primary" : "secondary"}
          >
            {loading
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : plan.cta}
          </Button>
        )}

        {plan.key === "pro" && !isCurrent && (
          <p className="mt-2.5 text-[11px] leading-5 text-slate-500">
            {language === "fr"
              ? "Recommandé pour débloquer immédiatement votre stratégie complète"
              : "Recommended to unlock your full strategy immediately"}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const language = normalizeLanguage(i18n.language);

  const [billingStatus, setBillingStatus] = useState(null);
  const [access, setAccess] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [devSwitchLoading, setDevSwitchLoading] = useState("");
  const [successRefreshing, setSuccessRefreshing] = useState(false);

  const successFlag = searchParams.get("success");
  const cancelledFlag = searchParams.get("cancelled");
  const requestedPlan = normalizePlan(searchParams.get("plan") || "");
  const source = searchParams.get("source") || "";
  const intent = searchParams.get("intent") || "";

  useEffect(() => {
    loadBillingPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleStripeReturn = async () => {
      if (successFlag !== "true") return;

      try {
        setSuccessRefreshing(true);
        setMessage("");

        await refreshCurrentUser();
        await loadBillingPage();

        setMessage(
          language === "fr"
            ? "Paiement confirmé. Votre abonnement a été actualisé."
            : "Payment confirmed. Your subscription has been refreshed."
        );

        const next = new URLSearchParams(searchParams);
        next.delete("success");
        setSearchParams(next, { replace: true });
      } catch (err) {
        console.error(err);
        setMessage(
          language === "fr"
            ? "Le paiement a réussi, mais l’actualisation du compte a échoué. Rechargez la page dans quelques secondes."
            : "Payment succeeded, but account refresh failed. Reload the page in a few seconds."
        );
      } finally {
        setSuccessRefreshing(false);
      }
    };

    handleStripeReturn();
  }, [successFlag, language, searchParams, setSearchParams]);

  useEffect(() => {
    if (cancelledFlag !== "true") return;

    setMessage(
      language === "fr" ? "Paiement annulé." : "Checkout cancelled."
    );

    const next = new URLSearchParams(searchParams);
    next.delete("cancelled");
    setSearchParams(next, { replace: true });
  }, [cancelledFlag, language, searchParams, setSearchParams]);

  async function loadBillingPage() {
    try {
      setLoading(true);

      const [statusRes, accessRes, plansRes] = await Promise.allSettled([
        getBillingStatus(),
        getBillingAccess(),
        getBillingPlans(),
      ]);

      if (statusRes.status === "fulfilled") {
        setBillingStatus(statusRes.value.data);
      }

      if (accessRes.status === "fulfilled") {
        setAccess(accessRes.value.data);
      }

      if (plansRes.status === "fulfilled") {
        setAvailablePlans(plansRes.value.data?.available_plans || []);
      }
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de charger les informations de tarification."
          : "Unable to load pricing information."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(plan) {
  try {
    setCheckoutLoadingPlan(plan);
    setMessage("");

    const isDevEnvironment =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      import.meta.env.DEV;

    const backendPlan = toBackendPlan(plan);

    // 🔥 DEV MODE → instant upgrade (no Stripe)
    if (isDevEnvironment) {
      await devSetPlan({
        plan: backendPlan,
        subscription_status: backendPlan === "free" ? null : "active",
      });

      await refreshCurrentUser();
      await loadBillingPage();

      // 🔥 notify entire app
      window.dispatchEvent(new Event("userUpdated"));
      window.dispatchEvent(new Event("nbai-strategy-refresh"));
      window.dispatchEvent(new Event("nbai-document-engine-updated"));

      setMessage(
        language === "fr"
          ? "Plan activé instantanément (mode développement)."
          : "Plan activated instantly (development mode)."
      );

      navigate("/dashboard");
      return;
    }

    // 🔥 PRODUCTION → Stripe
    const res = await createCheckoutSession({ plan: backendPlan });
    const url = res?.data?.url;

    if (!url) {
      throw new Error("Missing checkout URL");
    }

    window.location.href = url;
  } catch (err) {
    console.error(err);
    setMessage(
      err?.response?.data?.detail ||
        (language === "fr"
          ? "Impossible de démarrer le paiement."
          : "Unable to start checkout.")
    );
  } finally {
    setCheckoutLoadingPlan("");
  }
}

  async function handlePortal() {
    try {
      setPortalLoading(true);
      setMessage("");

      const res = await createPortalSession();
      const url = res?.data?.url;

      if (!url) {
        throw new Error("Missing portal URL");
      }

      window.location.href = url;
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible d’ouvrir le portail de facturation."
            : "Unable to open billing portal.")
      );
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleDevPlanSwitch(plan) {
  try {
    setDevSwitchLoading(plan);
    setMessage("");

    const backendPlan = toBackendPlan(plan);
    await devSetPlan({
      plan: backendPlan,
      subscription_status: backendPlan === "free" ? null : "active",
    });

    await refreshCurrentUser();
    await loadBillingPage();

    window.dispatchEvent(new Event("userUpdated"));
    window.dispatchEvent(new Event("nbai-strategy-refresh"));
    window.dispatchEvent(new Event("nbai-document-engine-updated"));

    setMessage(
      language === "fr"
        ? "Plan mis à jour pour le développement."
        : "Plan updated for development."
    );
  } catch (err) {
    console.error(err);
    setMessage(
      err?.response?.data?.detail ||
        (language === "fr"
          ? "Impossible de changer le plan de test."
          : "Unable to switch the test plan.")
    );
  } finally {
    setDevSwitchLoading("");
  }
}

  const currentPlan = normalizePlan(access?.plan || billingStatus?.plan || "free");
  const rawPlan = billingStatus?.raw_plan || access?.raw_plan || "free";
  const subscriptionStatus = billingStatus?.subscription_status || "";
  const currentRole = billingStatus?.role || "individual";
  const hasStripeCustomer = Boolean(billingStatus?.stripe_customer_id);

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Choisissez le bon niveau pour avancer dans votre dossier",
        subtitle:
          "Commencez gratuitement pour explorer votre position, passez à Pro pour débloquer l’exécution complète, puis choisissez Premium lorsque vous voulez plus de temps, plus de contrôle et l’export PDF.",
        currentPlan: "Plan actuel",
        billingStatus: "Statut de facturation",
        manageBilling: "Gérer ma facturation",
        includedFeatures: "Fonctionnalités incluses",
        mostPopular: "Le plus populaire",
        focusedChoice: "Choix ciblé",
        startFree: "Commencer gratuitement",
        upgradeToPro: "Choisir Pro",
        upgradeToPremium: "Choisir Premium",
        current: "Plan actuel",
        devTools: "Outils de développement",
        switchToFree: "Passer à Gratuit",
        switchToPro: "Passer à Pro",
        switchToPremium: "Passer à Premium",
        explore: "Explorer",
        build: "Agir maintenant",
        accelerate: "Finaliser un dossier complet",
        freeTitle: "Gratuit",
        proTitle: "Pro",
        premiumTitle: "Premium",
        freePrice: "0 $",
        proPrice: "39 $ / 30 jours",
        premiumPrice: "99 $ / 90 jours",
        proSubprice: "Pour débloquer l’exécution",
        premiumSubprice: "Pour aller jusqu’au rendu final",
        freeDesc:
          "Pour découvrir NorthBridgeAI, structurer votre profil et voir ce qui manque avant de payer.",
        proDesc:
          "Pour les utilisateurs prêts à avancer maintenant avec la stratégie complète, les outils essentiels et une meilleure vitesse d’exécution.",
        premiumDesc:
          "Pour les utilisateurs qui préparent un dossier complet et veulent l’export PDF, plus de temps et une couche de finition plus forte.",
        comparisonTitle: "Ce que chaque plan débloque",
        strategy: "Stratégie complète",
        forms: "Téléchargement des formulaires",
        documents: "Génération de documents",
        review: "Révision IA",
        copilots: "Outils IA avancés",
        exports: "Export PDF",
        yes: "Oui",
        limited: "Limité",
        no: "Non",
        notAvailable: "Non disponible",
        roleLabel: "Rôle",
        rawPlanLabel: "Plan brut",
        valueTitle: "Pourquoi les utilisateurs passent à un forfait supérieur",
        valueCards: [
          {
            title: "Plus de clarté",
            body: "Comprenez précisément ce qui manque, ce qui bloque votre dossier et quelles étapes ont le plus d’impact.",
          },
          {
            title: "Plus de vitesse",
            body: "Téléchargez, générez et révisez plus rapidement au lieu d’avancer manuellement.",
          },
          {
            title: "Plus de contrôle",
            body: "Choisissez Pro pour agir vite ou Premium pour préparer un dossier plus complet avec l’export final.",
          },
        ],
        ctaTitle: "Quel plan choisir",
        ctaBody:
          "La plupart des utilisateurs commencent en Gratuit pour explorer, passent à Pro lorsqu’ils sont prêts à agir, puis choisissent Premium lorsqu’ils veulent plus de temps et l’export PDF.",
        summaryTitle: "Votre abonnement en un coup d’œil",
        premiumBadge: "Meilleure valeur",
        whyNowTitle: "Pourquoi passer à un plan payant maintenant",
        whyNowLine1:
          "Vous avez déjà une stratégie. L’étape suivante est de l’exécuter.",
        whyNowLine2:
          "Pro est conçu pour les utilisateurs qui veulent avancer rapidement avec les bons documents, formulaires et outils.",
        whyNowLine3:
          "Premium est conçu pour ceux qui veulent aller jusqu’au rendu final avec plus de temps et l’export PDF.",
        paymentConfirmed: "Accès débloqué",
        paymentConfirmedBody:
          "Votre abonnement est actif. Vous pouvez maintenant revenir au tableau de bord, ouvrir votre stratégie complète et continuer l’exécution de votre dossier.",
        openDashboard: "Ouvrir le tableau de bord",
        openStrategy: "Ouvrir ma stratégie",
        strategyUnlockTitle: "Votre stratégie mérite une vraie exécution",
        strategyUnlockBody:
          "Le niveau Gratuit aide à comprendre votre position. Pro débloque la stratégie complète, l’exécution et les outils essentiels. Premium ajoute la finition, plus de temps et l’export PDF.",
        bestFitLabel: "Meilleur choix :",
        freeFit: "vous voulez explorer votre profil avant de payer.",
        proFit:
          "vous êtes prêt à agir maintenant et débloquer la stratégie complète.",
        premiumFit:
          "vous voulez finaliser un dossier plus complet avec PDF et plus de marge de préparation.",
        recommendedPlanLabel: "Recommandation actuelle",
        recommendedPro:
          "Pro est le meilleur point d’entrée pour commencer à exécuter votre dossier.",
        recommendedPremium:
          "Premium est le meilleur choix si vous voulez l’export PDF et une préparation plus complète.",
        recommendationPill: "Recommandé",
        targetedTitle: "Parcours recommandé",
        targetedPro:
          "Vous êtes arrivé ici pour débloquer la stratégie complète et l’exécution. Pro est le meilleur choix pour cette étape.",
        targetedPremium:
          "Vous êtes arrivé ici pour l’export PDF ou une préparation plus complète. Premium est le meilleur choix pour cette étape.",
        quickDecision: "Décision rapide",
        quickDecisionTitle:
          "Prêt à avancer ? Commencez avec Pro",
        quickDecisionBody:
          "La majorité des utilisateurs choisissent Pro pour débloquer leur stratégie complète et commencer l’exécution immédiatement.",
        quickDecisionCta: "Commencer avec Pro",
        bottomCtaTitle: "Débloquez votre stratégie aujourd’hui",
        bottomCtaBody:
          "Passez à Pro pour commencer à avancer immédiatement.",
        bottomCtaPrimary: "Choisir Pro",
        bottomCtaSecondary: "Voir Premium",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Choose the right tier to move your case forward",
      subtitle:
        "Start free to understand where you stand, move to Pro to unlock full execution, then choose Premium when you want more time, more control, and PDF export.",
      currentPlan: "Current plan",
      billingStatus: "Billing status",
      manageBilling: "Manage billing",
      includedFeatures: "Included features",
      mostPopular: "Most popular",
      focusedChoice: "Focused choice",
      startFree: "Start free",
      upgradeToPro: "Choose Pro",
      upgradeToPremium: "Choose Premium",
      current: "Current plan",
      devTools: "Development tools",
      switchToFree: "Switch to Free",
      switchToPro: "Switch to Pro",
      switchToPremium: "Switch to Premium",
      explore: "Explore",
      build: "Take action now",
      accelerate: "Finish a fuller case",
      freeTitle: "Free",
      proTitle: "Pro",
      premiumTitle: "Premium",
      freePrice: "$0",
      proPrice: "$39 / 30 days",
      premiumPrice: "$99 / 90 days",
      proSubprice: "For unlocking execution",
      premiumSubprice: "For going to final output",
      freeDesc:
        "For exploring NorthBridgeAI, structuring your profile, and seeing what is missing before you pay.",
      proDesc:
        "For users ready to move now with the full strategy, essential tools, and faster execution.",
      premiumDesc:
        "For users preparing a fuller application who want PDF export, more time, and a stronger finishing layer.",
      comparisonTitle: "What each plan unlocks",
      strategy: "Full strategy",
      forms: "Forms download",
      documents: "Document generation",
      review: "AI review",
      copilots: "Advanced AI tools",
      exports: "PDF export",
      yes: "Yes",
      limited: "Limited",
      no: "No",
      notAvailable: "Not available",
      roleLabel: "Role",
      rawPlanLabel: "Raw plan",
      valueTitle: "Why users upgrade",
      valueCards: [
        {
          title: "More clarity",
          body: "Understand exactly what is missing, what is blocking your case, and which next steps matter most.",
        },
        {
          title: "More speed",
          body: "Download, generate, and review faster instead of piecing everything together by hand.",
        },
        {
          title: "More control",
          body: "Choose Pro to move quickly or Premium to prepare a fuller case with final export.",
        },
      ],
      ctaTitle: "Which plan should you choose",
      ctaBody:
        "Most users start on Free to explore, move to Pro when they are ready to act, and choose Premium when they want more time and PDF export.",
      summaryTitle: "Your subscription at a glance",
      premiumBadge: "Best value",
      whyNowTitle: "Why upgrade now",
      whyNowLine1: "You already have a strategy. The next step is executing on it.",
      whyNowLine2:
        "Pro is built for users who want to move forward quickly with the right documents, forms, and tools.",
      whyNowLine3:
        "Premium is built for users who want more time and PDF export to finish a fuller case package.",
      paymentConfirmed: "Access unlocked",
      paymentConfirmedBody:
        "Your subscription is active. You can now return to the dashboard, open your full strategy, and continue executing your case.",
      openDashboard: "Open dashboard",
      openStrategy: "Open my strategy",
      strategyUnlockTitle: "Your strategy deserves real execution",
      strategyUnlockBody:
        "Free helps you understand where you stand. Pro unlocks the full strategy, execution, and essential tools. Premium adds finishing value, more time, and PDF export.",
      bestFitLabel: "Best for when",
      freeFit: "you want to explore your profile before paying.",
      proFit: "you are ready to act now and unlock the full strategy.",
      premiumFit:
        "you want to finish a fuller case with PDF export and more preparation runway.",
      recommendedPlanLabel: "Current recommendation",
      recommendedPro:
        "Pro is the best starting point when you are ready to execute your case.",
      recommendedPremium:
        "Premium is the best choice when you want PDF export and a fuller preparation flow.",
      recommendationPill: "Recommended",
      targetedTitle: "Suggested path",
      targetedPro:
        "You came here to unlock the full strategy and execution. Pro is the best fit for this step.",
      targetedPremium:
        "You came here for PDF export or fuller preparation. Premium is the best fit for this step.",
      quickDecision: "Quick decision",
      quickDecisionTitle:
        "Ready to move forward? Start with Pro",
      quickDecisionBody:
        "Most users choose Pro to unlock their full strategy and start execution immediately.",
      quickDecisionCta: "Start with Pro",
      bottomCtaTitle: "Unlock your strategy today",
      bottomCtaBody:
        "Upgrade to Pro and start moving forward immediately.",
      bottomCtaPrimary: "Choose Pro",
      bottomCtaSecondary: "See Premium",
    };
  }, [language]);

  const plans = useMemo(() => {
    const backendAvailable = new Set(
      availablePlans.map((plan) => normalizePlan(plan))
    );

    const planList = [
      {
        key: "free",
        title: text.freeTitle,
        price: text.freePrice,
        description: text.freeDesc,
        audience: text.explore,
        cta: text.startFree,
        fitNote: "",
        features: [
          language === "fr"
            ? "Profil et orientation de base"
            : "Profile and basic direction",
          language === "fr"
            ? "Aperçu de stratégie"
            : "Strategy preview",
          language === "fr"
            ? "Prévisualisation des formulaires"
            : "Forms preview",
        ],
      },
      {
        key: "pro",
        title: text.proTitle,
        price: text.proPrice,
        subprice: text.proSubprice,
        description: text.proDesc,
        audience: text.build,
        featured: true,
        cta: text.upgradeToPro,
        fitNote: text.proFit,
        features: [
          language === "fr" ? "Stratégie complète" : "Full strategy",
          language === "fr"
            ? "Téléchargement du dossier de formulaires"
            : "Forms package download",
          language === "fr"
            ? "Génération complète de documents"
            : "Full document generation",
          language === "fr"
            ? "Révision IA complète"
            : "Full AI review",
        ],
      },
      {
        key: "premium",
        title: text.premiumTitle,
        price: text.premiumPrice,
        subprice: text.premiumSubprice,
        description: text.premiumDesc,
        audience: text.accelerate,
        cta: text.upgradeToPremium,
        fitNote: text.premiumFit,
        features: [
          language === "fr" ? "Tout dans Pro" : "Everything in Pro",
          language === "fr"
            ? "Période de préparation plus longue"
            : "Longer preparation window",
          language === "fr"
            ? "Export PDF"
            : "PDF export",
        ],
        badge: text.premiumBadge,
      },
    ];

    return planList.filter((plan) => {
      if (plan.key === "free") return true;
      if (!availablePlans.length) return true;
      return backendAvailable.has(plan.key);
    });
  }, [availablePlans, language, text]);

  const comparisonRows = useMemo(() => {
  return [
    {
      label: text.strategy,
      free: text.limited,
      pro: text.yes,
      premium: text.yes,
    },
    {
      label: text.documents,
      free: text.limited,
      pro: text.yes,
      premium: text.yes,
    },
    {
      label: text.forms,
      free: text.no,
      pro: text.yes,
      premium: text.yes,
    },
    {
      label: text.exports,
      free: text.no,
      pro: text.no,
      premium: text.yes,
    },
  ];
}, [text]);

  const recommendedPlan = useMemo(() => {
    if (currentPlan === "premium") return null;
    if (requestedPlan === "premium" && currentPlan !== "premium") return "premium";
    if (requestedPlan === "pro" && currentPlan === "free") return "pro";
    if (currentPlan === "pro") return "premium";
    return "pro";
  }, [currentPlan, requestedPlan]);

  const recommendedPlanMessage =
    recommendedPlan === "premium"
      ? text.recommendedPremium
      : text.recommendedPro;

  const targetedPlanMessage =
    requestedPlan === "premium"
      ? text.targetedPremium
      : requestedPlan === "pro"
      ? text.targetedPro
      : "";

  const showActiveSubscriptionCard =
    successFlag !== "true" &&
    (subscriptionStatus === "active" || currentPlan !== "free");

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <div className="rounded-[28px] border border-slate-200 bg-white px-10 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-medium text-slate-700">
              {language === "fr" ? "Chargement..." : "Loading..."}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {message && (
        <div className="mb-5 rounded-[24px] border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
          {message}
        </div>
      )}

      {successRefreshing ? (
        <SurfaceCard className="mb-6 border-green-200 bg-gradient-to-br from-green-50 via-white to-white">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700">
                {text.paymentConfirmed}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {language === "fr"
                  ? "Actualisation de votre accès et de vos fonctionnalités..."
                  : "Refreshing your access and unlocked features..."}
              </p>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      {showActiveSubscriptionCard ? (
        <SurfaceCard className="mb-6 border-green-200 bg-gradient-to-br from-green-50 via-white to-white">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-full bg-green-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                {text.paymentConfirmed}
              </div>

              <h2 className="mt-4 text-[30px] font-semibold tracking-tight text-slate-900">
                {language === "fr"
                  ? `Votre accès ${getDisplayPlan(currentPlan, language)} est actif`
                  : `Your ${getDisplayPlan(currentPlan, language)} access is active`}
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-700">
                {text.paymentConfirmedBody}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill active>{getDisplayPlan(currentPlan, language)}</StatusPill>
                {subscriptionStatus ? (
                  <StatusPill active>{subscriptionStatus}</StatusPill>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:w-[320px] md:grid-cols-1">
              <Button
                onClick={() => navigate("/dashboard")}
                className="rounded-2xl"
              >
                {text.openDashboard}
              </Button>

              <Button
                variant="secondary"
                onClick={() => navigate("/strategy")}
                className="rounded-2xl"
              >
                {text.openStrategy}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="mb-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            {text.brand}
          </p>
          <h1 className="text-[36px] font-semibold tracking-tight text-slate-900 md:text-[46px]">
            {text.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
            {text.subtitle}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <StatusPill active={currentPlan === "free"}>
              {text.freeTitle}
            </StatusPill>
            <StatusPill active={currentPlan === "pro"} featured={recommendedPlan === "pro"}>
              {text.proTitle}
            </StatusPill>
            <StatusPill active={currentPlan === "premium"} featured={recommendedPlan === "premium"}>
              {text.premiumTitle}
            </StatusPill>
          </div>
        </div>

        <SurfaceCard className="h-fit border-blue-100 bg-gradient-to-br from-white to-blue-50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {text.summaryTitle}
          </p>
          <h2 className="mt-3 text-[32px] font-semibold tracking-tight text-slate-900">
            {getDisplayPlan(currentPlan, language)}
          </h2>

          {currentPlan !== "free" ? (
            <p className="mt-2 text-sm text-green-700">
              {language === "fr"
                ? "Fonctionnalités premium actives"
                : "Premium features active"}
            </p>
          ) : null}

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>
              {text.billingStatus}:{" "}
              <span className="font-medium text-slate-900">
                {subscriptionStatus || text.notAvailable}
              </span>
            </p>
            <p>
              {text.roleLabel}:{" "}
              <span className="font-medium text-slate-900">{currentRole}</span>
            </p>
            <p>
              {text.rawPlanLabel}:{" "}
              <span className="font-medium text-slate-900">{rawPlan}</span>
            </p>
          </div>

          {recommendedPlan ? (
            <div className="mt-5 rounded-[22px] border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                {text.recommendedPlanLabel}
            </p>
            <p className="mt-2 text-sm leading-7 text-blue-900">
              {recommendedPlanMessage}
            </p>

            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                {recommendedPlan === "premium" ? text.premiumTitle : text.proTitle}
              </span>
            </div>
          </div>
        ) : null}

          {hasStripeCustomer && currentPlan !== "free" && (
            <div className="mt-5">
              <Button
                onClick={handlePortal}
                disabled={portalLoading}
                className="w-full rounded-2xl"
              >
                {portalLoading
                  ? language === "fr"
                    ? "Ouverture..."
                    : "Opening..."
                  : text.manageBilling}
              </Button>
            </div>
          )}
        </SurfaceCard>
      </div>

      {requestedPlan && targetedPlanMessage ? (
        <SurfaceCard className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
            {text.targetedTitle}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            {targetedPlanMessage}
          </p>
          {(source || intent) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {source ? <StatusPill active>{source}</StatusPill> : null}
              {intent ? <StatusPill active>{intent}</StatusPill> : null}
            </div>
          )}
        </SurfaceCard>
      ) : null}

      <SurfaceCard className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white shadow-[0_16px_50px_rgba(37,99,235,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
          {text.quickDecision}
        </p>

        <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-900">
          {text.quickDecisionTitle}
        </h2>

        <p className="mt-3 text-sm text-slate-600">
          {text.quickDecisionBody}
        </p>

        <div className="mt-4">
          <Button
            nClick={() => handleCheckout("pro")}
            disabled={checkoutLoadingPlan === "pro"}
            className="rounded-2xl px-5"
          >
            {checkoutLoadingPlan === "pro"
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : text.quickDecisionCta}
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {text.valueTitle}
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {text.valueCards.map((item, index) => (
            <ValueCard key={index} title={item.title} body={item.body} />
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.key}
            className={plan.key === "premium" ? "md:col-span-2 xl:col-span-1" : ""}
          >
            <PlanCard
              plan={plan}
              text={text}
              language={language}
              isCurrent={currentPlan === plan.key}
              isHighlighted={requestedPlan === plan.key}
              loading={checkoutLoadingPlan === plan.key}
              recommendedPlan={recommendedPlan}
              onSelect={() => {
                if (plan.key === "free") {
                  navigate("/dashboard");
                } else {
                  handleCheckout(plan.key);
                }
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
            {text.ctaTitle}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
            {text.ctaBody}
          </p>
        </SurfaceCard>

        <SurfaceCard>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {text.currentPlan}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
              {getDisplayPlan(currentPlan, language)}
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
              {subscriptionStatus || text.notAvailable}
            </div>
            {recommendedPlan ? (
              <div className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                {text.recommendationPill}:{" "}
                {recommendedPlan === "premium" ? text.premiumTitle : text.proTitle}
              </div>
            ) : null}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {text.comparisonTitle}
        </p>

        <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr] bg-slate-50">
              <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                {text.includedFeatures}
            </div>
            <div className="px-4 py-4 text-sm font-semibold text-slate-600">
              {text.freeTitle}
            </div>
            <div className="px-4 py-4 text-sm font-semibold text-blue-700">
              {text.proTitle}
            </div>
            <div className="px-4 py-4 text-sm font-semibold text-slate-600">
              {text.premiumTitle}
            </div>
          </div>
        </div>

          {comparisonRows.map((row, index) => (
            <div
              key={row.label}
              className={`grid grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr] items-center ${
                index !== comparisonRows.length - 1 ? "border-t border-slate-200" : ""
              }`}
            >
              <div
                className={`px-4 py-4 text-sm font-medium text-slate-900 ${
                  row.label === text.exports ? "text-blue-900" : ""
                }`}
              >
                {row.label}
              </div>
              <div className="px-4 py-4 text-sm text-slate-700">
                <ComparisonValue value={row.free} language={language} />
              </div>
              <div className="bg-blue-50/40 px-4 py-4 text-sm text-slate-700">
                <ComparisonValue value={row.pro} emphasized language={language} />
              </div>
              <div className="px-4 py-4 text-sm text-slate-700">
                <ComparisonValue value={row.premium} emphasized language={language} />
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

    {currentPlan === "free" || currentPlan === "pro" ? (
      <SurfaceCard className="mt-8 border-blue-200 bg-gradient-to-br from-blue-50 to-white text-center">
        <h2 className="text-[30px] font-semibold tracking-tight text-slate-900">
          {text.bottomCtaTitle}
        </h2>

        <p className="mt-3 text-sm text-slate-600">
          {text.bottomCtaBody}
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button
            onClick={() => handleCheckout("pro")}
            disabled={checkoutLoadingPlan === "pro"}
            className="rounded-2xl px-5"
          >
            {checkoutLoadingPlan === "pro"
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : text.bottomCtaPrimary}
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleCheckout("premium")}
            disabled={checkoutLoadingPlan === "premium"}
            className="rounded-2xl px-5"
          >
            {checkoutLoadingPlan === "premium"
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : text.bottomCtaSecondary}
          </Button>
        </div>
      </SurfaceCard>
    ) : null}

    {(window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      import.meta.env.DEV) && (
      <SurfaceCard className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {text.devTools}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => handleDevPlanSwitch("free")}
            disabled={devSwitchLoading === "free"}
          >
            {devSwitchLoading === "free"
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : text.switchToFree}
          </Button>

          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => handleDevPlanSwitch("pro")}
            disabled={devSwitchLoading === "pro"}
          >
            {devSwitchLoading === "pro"
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : text.switchToPro}
          </Button>

          <Button
            variant="secondary"
            className="rounded-2xl"
            onClick={() => handleDevPlanSwitch("premium")}
            disabled={devSwitchLoading === "premium"}
          >
            {devSwitchLoading === "premium"
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : text.switchToPremium}
          </Button>
        </div>
      </SurfaceCard>
    )}
    </Layout>
  );
}