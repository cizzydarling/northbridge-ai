import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { getBillingAccess, getBillingStatus, refreshCurrentUser } from "../api";

function normalizeLanguage(language) {
  return String(language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "individual_pro") return "pro";
  if (value === "agent_pro") return "premium";
  if (value === "premium") return "premium";
  if (value === "pro") return "pro";
  return "free";
}

export default function BillingSuccessPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const language = normalizeLanguage(i18n.language);

  const [loading, setLoading] = useState(true);
  const [billingStatus, setBillingStatus] = useState(null);
  const [access, setAccess] = useState(null);
  const [message, setMessage] = useState("");

  const sessionId = searchParams.get("session_id") || "";

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");

      const [statusRes, accessRes] = await Promise.allSettled([
        getBillingStatus(),
        getBillingAccess(),
      ]);

      if (statusRes.status === "fulfilled") {
        setBillingStatus(statusRes.value.data);
      }

      if (accessRes.status === "fulfilled") {
        setAccess(accessRes.value.data);
      }

      try {
        await refreshCurrentUser();
      } catch (err) {
        console.error(err);
      }
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de charger votre statut de facturation."
          : "Unable to load your billing status."
      );
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const normalizedPlan = normalizePlan(access?.plan || billingStatus?.plan || "free");
  const rawPlan = billingStatus?.raw_plan || access?.raw_plan || "free";
  const subscriptionStatus = billingStatus?.subscription_status || "";

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Paiement confirmé",
        subtitle:
          "Votre abonnement a été traité. Votre accès devrait maintenant être activé.",
        loading: "Chargement...",
        activePlan: "Plan actif",
        billingStatus: "Statut de facturation",
        rawPlan: "Plan brut",
        session: "Session",
        nextStepsTitle: "Prochaines étapes recommandées",
        nextSteps: [
          "Retournez à votre stratégie pour voir les sections désormais débloquées.",
          "Ouvrez le générateur ou la révision documentaire pour utiliser vos nouvelles fonctions.",
          "Vérifiez votre tableau de bord pour confirmer votre accès actif.",
        ],
        goDashboard: "Aller au tableau de bord",
        openStrategy: "Ouvrir ma stratégie",
        openDocuments: "Ouvrir mes documents",
        backPricing: "Retour à la tarification",
        free: "Gratuit",
        pro: "Pro",
        premium: "Premium",
        statusUnknown: "Non disponible",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Payment confirmed",
      subtitle:
        "Your subscription was processed. Your access should now be active.",
      loading: "Loading...",
      activePlan: "Active plan",
      billingStatus: "Billing status",
      rawPlan: "Raw plan",
      session: "Session",
      nextStepsTitle: "Recommended next steps",
      nextSteps: [
        "Return to your strategy to see newly unlocked sections.",
        "Open the generator or document review to use your upgraded features.",
        "Check your dashboard to confirm active access.",
      ],
      goDashboard: "Go to dashboard",
      openStrategy: "Open my strategy",
      openDocuments: "Open my documents",
      backPricing: "Back to pricing",
      free: "Free",
      pro: "Pro",
      premium: "Premium",
      statusUnknown: "Not available",
    };
  }, [language]);

  const displayPlan =
    normalizedPlan === "premium"
      ? text.premium
      : normalizedPlan === "pro"
      ? text.pro
      : text.free;

  return (
    <Layout>
      {message && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      <Card className="mx-auto max-w-4xl p-8">
        <p className="text-sm font-semibold text-blue-600">{text.brand}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{text.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {text.subtitle}
        </p>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            {text.loading}
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {text.activePlan}
                </p>
                <p className="mt-2 text-2xl font-bold text-blue-900">
                  {displayPlan}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {text.billingStatus}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {subscriptionStatus || text.statusUnknown}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {text.rawPlan}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {rawPlan}
                </p>
              </div>
            </div>

            {sessionId && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                  {text.session}:
                </span>{" "}
                {sessionId}
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <p className="text-sm font-semibold text-blue-900">
                {text.nextStepsTitle}
              </p>
              <div className="mt-4 space-y-3">
                {text.nextSteps.map((step, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => navigate("/dashboard")}>
            {text.goDashboard}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/strategy")}>
            {text.openStrategy}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/self/documents")}>
            {text.openDocuments}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/pricing")}>
            {text.backPricing}
          </Button>
        </div>
      </Card>
    </Layout>
  );
}
