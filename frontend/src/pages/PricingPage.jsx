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

function PlanCard({
  plan,
  text,
  language,
  isCurrent,
  onSelect,
  loading,
}) {
  const isFeatured = Boolean(plan.featured);

  return (
    <div
      className={`relative flex h-full flex-col rounded-[32px] border bg-white p-7 shadow-[0_16px_50px_rgba(15,23,42,0.06)] transition ${
        isFeatured
          ? "border-blue-200 ring-1 ring-blue-100"
          : "border-slate-200"
      }`}
    >
      {isFeatured && (
        <div className="absolute -top-3 left-7 rounded-full bg-blue-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm">
          {text.mostPopular}
        </div>
      )}

      {plan.badge ? (
        <div className="mb-4 inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
          {plan.badge}
        </div>
      ) : null}

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {plan.audience}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {plan.title}
        </h2>
        <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
          {plan.price}
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {plan.description}
        </p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-900">
          {text.includedFeatures}
        </p>

        <div className="mt-4 space-y-2.5">
          {plan.features.map((feature, index) => (
            <div
              key={`${plan.key}-${index}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            >
              {feature}
            </div>
          ))}
        </div>
      </div>

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
            variant={isFeatured ? "primary" : "secondary"}
          >
            {loading
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : plan.cta}
          </Button>
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
      language === "fr"
        ? "Paiement annulé."
        : "Checkout cancelled."
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

      const backendPlan = toBackendPlan(plan);
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
        title: "Une tarification conçue pour faire avancer votre dossier",
        subtitle:
          "Commencez gratuitement pour explorer votre parcours, puis passez à Pro ou Premium au moment où vous êtes prêt à préparer sérieusement votre dossier.",
        currentPlan: "Plan actuel",
        billingStatus: "Statut de facturation",
        manageBilling: "Gérer ma facturation",
        includedFeatures: "Fonctionnalités incluses",
        mostPopular: "Le plus populaire",
        startFree: "Commencer gratuitement",
        upgradeToPro: "Choisir Pro",
        upgradeToPremium: "Choisir Premium",
        current: "Plan actuel",
        devTools: "Outils de développement",
        switchToFree: "Passer à Gratuit",
        switchToPro: "Passer à Pro",
        switchToPremium: "Passer à Premium",
        explore: "Explorer",
        build: "Finaliser plus vite",
        accelerate: "Préparer un dossier complet",
        freeTitle: "Gratuit",
        proTitle: "Pro",
        premiumTitle: "Premium",
        freePrice: "0 $",
        proPrice: "39 $ / 30 jours",
        premiumPrice: "99 $ / 90 jours",
        freeDesc:
          "Pour découvrir NorthBridgeAI, structurer votre profil et voir ce qui manque avant de payer.",
        proDesc:
          "Pour les utilisateurs prêts à avancer maintenant, télécharger leurs dossiers et utiliser les outils essentiels de préparation.",
        premiumDesc:
          "Pour les utilisateurs qui préparent un dossier complet et veulent plus de temps, l’export PDF et un contrôle plus fort sur leur processus.",
        comparisonTitle: "Comparaison rapide",
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
        valueTitle: "Pourquoi les utilisateurs passent à une offre supérieure",
        valueCards: [
          {
            title: "Plus de clarté",
            body: "Comprenez ce qui manque, ce qui bloque votre dossier et sur quoi agir ensuite.",
          },
          {
            title: "Plus de vitesse",
            body: "Téléchargez, générez et révisez plus rapidement au lieu d’avancer à l’aveugle.",
          },
          {
            title: "Plus de contrôle",
            body: "Choisissez Pro pour aller vite ou Premium pour avancer sur une période plus longue.",
          },
        ],
        ctaTitle: "Le bon moment pour passer à un forfait payant",
        ctaBody:
          "La plupart des utilisateurs restent en Gratuit pour explorer, passent à Pro lorsqu’ils sont prêts à agir, puis choisissent Premium lorsqu’ils veulent plus de temps pour préparer un dossier complet.",
        summaryTitle: "Votre abonnement en un coup d’œil",
        premiumBadge: "Meilleure valeur",
        whyNowTitle: "Pourquoi passer à un plan payant maintenant",
        whyNowLine1:
          "Vous avez déjà une stratégie. La prochaine étape est d’agir dessus.",
        whyNowLine2:
          "Les utilisateurs passent à Pro lorsqu’ils veulent avancer rapidement avec les bons documents et formulaires.",
        whyNowLine3:
          "Ils passent à Premium lorsqu’ils veulent préparer un dossier complet avec plus de temps et de contrôle.",
        paymentConfirmed: "Paiement confirmé",
        paymentConfirmedBody:
          "Votre accès vient d’être actualisé. Vous pouvez maintenant retourner au tableau de bord ou ouvrir votre stratégie.",
        openDashboard: "Ouvrir le tableau de bord",
        openStrategy: "Ouvrir ma stratégie",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Pricing built to move your case forward",
      subtitle:
        "Start free to explore your path, then move into Pro or Premium when you are ready to seriously prepare your application.",
      currentPlan: "Current plan",
      billingStatus: "Billing status",
      manageBilling: "Manage billing",
      includedFeatures: "Included features",
      mostPopular: "Most popular",
      startFree: "Start free",
      upgradeToPro: "Choose Pro",
      upgradeToPremium: "Choose Premium",
      current: "Current plan",
      devTools: "Development tools",
      switchToFree: "Switch to Free",
      switchToPro: "Switch to Pro",
      switchToPremium: "Switch to Premium",
      explore: "Explore",
      build: "Finish faster",
      accelerate: "Build a fuller case",
      freeTitle: "Free",
      proTitle: "Pro",
      premiumTitle: "Premium",
      freePrice: "$0",
      proPrice: "$39 / 30 days",
      premiumPrice: "$99 / 90 days",
      freeDesc:
        "For exploring NorthBridgeAI, structuring your profile, and seeing what is missing before you pay.",
      proDesc:
        "For users ready to move now, download their packages, and use the essential preparation tools.",
      premiumDesc:
        "For users preparing a complete application who want more time, PDF export, and full control over their process.",
      comparisonTitle: "Quick comparison",
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
          body: "Understand what is missing, what is blocking your case, and what to do next.",
        },
        {
          title: "More speed",
          body: "Download, generate, and review faster instead of piecing everything together manually.",
        },
        {
          title: "More control",
          body: "Choose Pro to move quickly or Premium to work through a fuller application over more time.",
        },
      ],
      ctaTitle: "The right time to upgrade",
      ctaBody:
        "Most users stay on Free to explore, move to Pro when they are ready to act, and choose Premium when they want more time to prepare a fuller case.",
      summaryTitle: "Your subscription at a glance",
      premiumBadge: "Best value",
      whyNowTitle: "Why upgrade now",
      whyNowLine1: "You already have a strategy. The next step is acting on it.",
      whyNowLine2:
        "Users upgrade to Pro when they want to move forward quickly with the right documents and forms.",
      whyNowLine3:
        "They move to Premium when they want more time and control to prepare a complete application.",
      paymentConfirmed: "Payment confirmed",
      paymentConfirmedBody:
        "Your access has just been refreshed. You can now go back to the dashboard or open your strategy.",
      openDashboard: "Open dashboard",
      openStrategy: "Open my strategy",
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
          language === "fr"
            ? "Outils IA limités"
            : "Limited AI tools",
        ],
      },
      {
        key: "pro",
        title: text.proTitle,
        price: text.proPrice,
        description: text.proDesc,
        audience: text.build,
        featured: true,
        cta: text.upgradeToPro,
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
          language === "fr"
            ? "Outils IA avancés"
            : "Advanced AI tools",
        ],
      },
      {
        key: "premium",
        title: text.premiumTitle,
        price: text.premiumPrice,
        description: text.premiumDesc,
        audience: text.accelerate,
        cta: text.upgradeToPremium,
        features: [
          language === "fr" ? "Tout dans Pro" : "Everything in Pro",
          language === "fr"
            ? "Période de préparation plus longue"
            : "Longer preparation window",
          language === "fr"
            ? "Export PDF"
            : "PDF export",
          language === "fr"
            ? "Meilleur choix pour un dossier complet"
            : "Best for a fuller case",
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
        label: text.forms,
        free: text.no,
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
        label: text.review,
        free: text.no,
        pro: text.yes,
        premium: text.yes,
      },
      {
        label: text.copilots,
        free: text.limited,
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
        <div className="mb-6 rounded-[24px] border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
          {message}
        </div>
      )}

      {successRefreshing ? (
        <SurfaceCard className="mb-6 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700">
            {text.paymentConfirmed}
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {language === "fr"
              ? "Actualisation de votre accès..."
              : "Refreshing your access..."}
          </p>
        </SurfaceCard>
      ) : null}

      {successFlag !== "true" && (subscriptionStatus === "active" || currentPlan !== "free") ? (
        <SurfaceCard className="mb-6 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700">
            {text.paymentConfirmed}
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {text.paymentConfirmedBody}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => navigate("/dashboard")} className="rounded-2xl">
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
        </SurfaceCard>
      ) : null}

      <div className="mb-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            {text.brand}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            {text.title}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {text.subtitle}
          </p>
        </div>

        <SurfaceCard className="h-fit">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {text.summaryTitle}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {getDisplayPlan(currentPlan, language)}
          </h2>

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

      <SurfaceCard className="mb-6 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
          {text.whyNowTitle}
        </p>

        <div className="mt-4 space-y-3 text-sm text-slate-700">
          <p>{text.whyNowLine1}</p>
          <p>{text.whyNowLine2}</p>
          <p>{text.whyNowLine3}</p>
        </div>
      </SurfaceCard>

      <SurfaceCard className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {text.valueTitle}
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {text.valueCards.map((item, index) => (
            <div
              key={index}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
            >
              <p className="text-lg font-semibold tracking-tight text-slate-900">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            text={text}
            language={language}
            isCurrent={currentPlan === plan.key}
            loading={checkoutLoadingPlan === plan.key}
            onSelect={() => {
              if (plan.key === "free") {
                navigate("/dashboard");
              } else {
                handleCheckout(plan.key);
              }
            }}
          />
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
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {text.comparisonTitle}
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600">
                  {text.includedFeatures}
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600">
                  {text.freeTitle}
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600">
                  {text.proTitle}
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600">
                  {text.premiumTitle}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <td className="rounded-l-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
                    {row.label}
                  </td>
                  <td className="border-y border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    {row.free}
                  </td>
                  <td className="border-y border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    {row.pro}
                  </td>
                  <td className="rounded-r-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    {row.premium}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

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
    </Layout>
  );
}