import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import {
  cancelSubscription,
  createCheckoutSession,
  createPortalSession,
  devSetPlan,
  getBillingAccess,
  getBillingPlans,
  getBillingStatus,
  getBillingTransactions,
  refreshCurrentUser,
  syncCheckoutSession,
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

function getDisplayPlan(plan, language) {
  const normalized = normalizePlan(plan);
  if (language === "fr") {
    if (normalized === "premium") return "Premium";
    if (normalized === "pro") return "Pro";
    return "Gratuit";
  }
  if (normalized === "premium") return "Premium";
  if (normalized === "pro") return "Pro";
  return "Free";
}

function formatBillingAmount(amount, currency = "CAD", language = "en") {
  if (amount === null || typeof amount === "undefined") return "--";

  const normalizedCurrency = String(currency || "CAD").toUpperCase();
  try {
    return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: normalizedCurrency,
    }).format(Number(amount) / 100);
  } catch {
    return `${(Number(amount) / 100).toFixed(2)} ${normalizedCurrency}`;
  }
}

function formatBillingDate(value, language = "en") {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function SurfaceCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </section>
  );
}

function StatusPill({ children, active = false, featured = false, dark = false }) {
  const className = featured
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : active
    ? dark
      ? "border-white bg-white text-slate-950"
      : "border-slate-950 bg-slate-950 text-white"
    : dark
    ? "border-white/15 bg-white/5 text-stone-200"
    : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex rounded-lg border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function Metric({ label, value, detail, dark = false }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        dark
          ? "border-white/10 bg-white/5 text-white"
          : "border-slate-200 bg-white text-slate-950"
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
          dark ? "text-stone-300" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-semibold tracking-tight">
        {value || "--"}
      </p>
      {detail ? (
        <p
          className={`mt-1 text-xs leading-5 ${
            dark ? "text-stone-300" : "text-slate-500"
          }`}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function ValueCard({ title, body }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <p className="text-lg font-semibold tracking-tight text-slate-950">
        {title}
      </p>
      <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function FeatureListItem({ children, dark = false }) {
  return (
    <div
      className={`flex gap-3 rounded-lg border px-4 py-2.5 text-sm leading-6 ${
        dark
          ? "border-white/10 bg-white/5 text-stone-100"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <span
        className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
          dark ? "bg-amber-300" : "bg-slate-500"
        }`}
      />
      <span>{children}</span>
    </div>
  );
}

function ComparisonValue({ value, emphasized = false, language = "en" }) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "yes" || normalized === "oui") {
    return (
      <span
        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
          emphasized ? "bg-slate-950 text-white" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {language === "fr" ? "Oui" : "Yes"}
      </span>
    );
  }

  if (normalized === "no" || normalized === "non") {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        {language === "fr" ? "Non" : "No"}
      </span>
    );
  }

  if (normalized === "limited" || normalized === "limite" || normalized === "limité") {
    return (
      <span className="inline-flex rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        {language === "fr" ? "Limité" : "Limited"}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
        emphasized ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
      }`}
    >
      {value}
    </span>
  );
}

function TransactionHistory({ transactions, text, language }) {
  const rows = Array.isArray(transactions) ? transactions : [];

  return (
    <SurfaceCard className="mt-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {text.transactionsTitle}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {text.transactionsSubtitle}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[0.9fr_0.85fr_0.75fr_0.7fr_1.35fr_0.8fr] bg-slate-50">
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              {text.transactionDate}
            </div>
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              {text.transactionPlan}
            </div>
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              {text.transactionAmount}
            </div>
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              {text.transactionStatus}
            </div>
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              {text.billingEmail}
            </div>
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              {text.receipt}
            </div>
          </div>

          {rows.length ? (
            rows.map((transaction) => {
              const receiptUrl = transaction.receipt_url || transaction.invoice_pdf;
              return (
                <div
                  key={transaction.id}
                  className="grid grid-cols-[0.9fr_0.85fr_0.75fr_0.7fr_1.35fr_0.8fr] items-center border-t border-slate-200 bg-white"
                >
                  <div className="px-4 py-4 text-sm text-slate-700">
                    {formatBillingDate(
                      transaction.paid_at || transaction.created_at,
                      language
                    )}
                  </div>
                  <div className="px-4 py-4 text-sm font-medium text-slate-900">
                    {getDisplayPlan(transaction.plan, language)}
                  </div>
                  <div className="px-4 py-4 text-sm text-slate-700">
                    {formatBillingAmount(
                      transaction.amount,
                      transaction.currency,
                      language
                    )}
                  </div>
                  <div className="px-4 py-4">
                    <span className="inline-flex rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {transaction.status || "--"}
                    </span>
                  </div>
                  <div className="break-words px-4 py-4 text-sm text-slate-700">
                    {transaction.billing_email || "-"}
                  </div>
                  <div className="px-4 py-4 text-sm">
                    {receiptUrl ? (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {text.viewReceipt}
                      </a>
                    ) : (
                      <span className="text-slate-400">{text.noReceipt}</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="border-t border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
              {text.noTransactions}
            </div>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

function PricingHero({
  text,
  language,
  currentPlan,
  subscriptionStatus,
  recommendedPlan,
  recommendedPlanMessage,
  checkoutLoadingPlan,
  hasStripeCustomer,
  portalLoading,
  onPortal,
  onPro,
  onPremium,
  onDashboard,
  onStrategy,
}) {
  const planLabel = getDisplayPlan(currentPlan, language);
  const recommendationLabel = recommendedPlan
    ? recommendedPlan === "premium"
      ? text.premiumTitle
      : text.proTitle
    : planLabel;

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-blue-100 bg-blue-50/70 p-6 text-slate-950 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            {text.brand}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            {text.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
            {text.subtitle}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <StatusPill active={currentPlan === "free"}>
              {text.freeTitle}
            </StatusPill>
            <StatusPill
              active={currentPlan === "pro"}
              featured={recommendedPlan === "pro"}
            >
              {text.proTitle}
            </StatusPill>
            <StatusPill
              active={currentPlan === "premium"}
              featured={recommendedPlan === "premium"}
            >
              {text.premiumTitle}
            </StatusPill>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {currentPlan === "premium" ? (
              <>
                <Button onClick={onDashboard}>
                  {text.openDashboard}
                </Button>
                <Button variant="secondary" onClick={onStrategy}>
                  {text.openStrategy}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={onPro}
                  loading={checkoutLoadingPlan === "pro"}
                  disabled={checkoutLoadingPlan === "pro"}
                >
                  {checkoutLoadingPlan === "pro"
                    ? text.loading
                    : text.quickDecisionCta}
                </Button>
                <Button
                  variant="secondary"
                  onClick={onPremium}
                  loading={checkoutLoadingPlan === "premium"}
                  disabled={checkoutLoadingPlan === "premium"}
                >
                  {checkoutLoadingPlan === "premium"
                    ? text.loading
                    : text.upgradeToPremium}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {text.summaryTitle}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Metric
              label={text.currentPlan}
              value={planLabel}
              detail={currentPlan !== "free" ? text.paymentConfirmed : ""}
            />
            <Metric
              label={text.billingStatus}
              value={subscriptionStatus || text.notAvailable}
            />
            <Metric
              label={text.recommendedPlanLabel}
              value={recommendationLabel}
              detail={recommendedPlan ? recommendedPlanMessage : ""}
            />
          </div>

          {hasStripeCustomer && currentPlan !== "free" ? (
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={onPortal}
                disabled={portalLoading}
                loading={portalLoading}
                className="w-full"
              >
                {portalLoading ? text.opening : text.manageBilling}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DecisionPanel({ text, checkoutLoadingPlan, onPro }) {
  return (
    <SurfaceCard className="h-full border-stone-200 bg-stone-50">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
        {text.quickDecision}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {text.quickDecisionTitle}
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {text.quickDecisionBody}
      </p>
      <div className="mt-5">
        <Button
          onClick={onPro}
          disabled={checkoutLoadingPlan === "pro"}
          loading={checkoutLoadingPlan === "pro"}
        >
          {checkoutLoadingPlan === "pro" ? text.loading : text.quickDecisionCta}
        </Button>
      </div>
    </SurfaceCard>
  );
}

function PlanCard({
  plan,
  text,
  isCurrent,
  isHighlighted,
  onSelect,
  loading,
  recommendedPlan,
}) {
  const isRecommended = recommendedPlan === plan.key;
  const isPremium = plan.key === "premium";
  const isDark = isRecommended;

  const frameClass = isDark
    ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
    : isHighlighted
    ? "border-amber-300 bg-amber-50/60 ring-2 ring-amber-200"
    : isPremium
    ? "border-amber-200 bg-stone-50"
    : "border-slate-200 bg-white";

  return (
    <article
      className={`relative flex h-full flex-col rounded-lg border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(15,23,42,0.10)] ${frameClass}`}
    >
      {isRecommended ? (
        <div className="absolute -top-3 left-5 rounded-lg bg-amber-400 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-950 shadow-sm">
          {text.recommendationPill}
        </div>
      ) : null}

      {plan.featured && !isRecommended ? (
        <div className="absolute -top-3 right-5 rounded-lg bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm">
          {text.mostPopular}
        </div>
      ) : null}

      {plan.badge ? (
        <div className="mb-4 inline-flex w-fit rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
          {plan.badge}
        </div>
      ) : null}

      <div className="mb-5">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
            isDark ? "text-stone-300" : "text-slate-500"
          }`}
        >
          {plan.audience}
        </p>
        <h2
          className={`mt-2.5 text-[28px] font-semibold tracking-tight md:text-[30px] ${
            isDark ? "text-white" : "text-slate-950"
          }`}
        >
          {plan.title}
        </h2>
        <p
          className={`mt-2.5 text-[34px] font-semibold tracking-tight md:text-[38px] ${
            isDark ? "text-white" : "text-slate-950"
          }`}
        >
          {plan.price}
        </p>
        {plan.subprice ? (
          <p
            className={`mt-2 text-sm font-medium ${
              isDark ? "text-stone-300" : "text-slate-500"
            }`}
          >
            {plan.subprice}
          </p>
        ) : null}
        <p
          className={`mt-3 text-sm leading-6 ${
            isDark ? "text-stone-200" : "text-slate-600"
          }`}
        >
          {plan.description}
        </p>
        {isRecommended ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-100">
            {text.recommendedPro}
          </div>
        ) : null}
      </div>

      <div className="mb-6">
        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          {text.includedFeatures}
        </p>
        <div className="mt-3.5 space-y-2">
          {plan.features.map((feature, index) => (
            <FeatureListItem key={`${plan.key}-${index}`} dark={isDark}>
              {feature}
            </FeatureListItem>
          ))}
        </div>
      </div>

      {plan.fitNote ? (
        <div
          className={`mb-5 rounded-lg border px-4 py-3.5 text-sm leading-6 ${
            isDark
              ? "border-white/10 bg-white/5 text-stone-200"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            {text.bestFitLabel}{" "}
          </span>
          {plan.fitNote}
        </div>
      ) : null}

      <div className="mt-auto">
        {isCurrent ? (
          <Button variant="secondary" disabled className="w-full">
            {text.current}
          </Button>
        ) : (
          <Button
            onClick={onSelect}
            disabled={loading}
            loading={loading}
            className="w-full"
            variant={isDark ? "white" : isPremium ? "primary" : "secondary"}
          >
            {loading ? text.loading : plan.cta}
          </Button>
        )}
      </div>
    </article>
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
  const [transactions, setTransactions] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [devSwitchLoading, setDevSwitchLoading] = useState("");
  const [successRefreshing, setSuccessRefreshing] = useState(false);

  const successFlag = searchParams.get("success");
  const checkoutSessionId = searchParams.get("session_id");
  const cancelledFlag = searchParams.get("cancelled");
  const requestedPlan = normalizePlan(searchParams.get("plan") || "");
  const source = searchParams.get("source") || "";
  const intent = searchParams.get("intent") || "";

  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    import.meta.env.DEV;
  const useDevBillingShortcut =
    isLocalDev && import.meta.env.VITE_BILLING_MODE === "dev";

  const loadBillingPage = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, accessRes, plansRes, transactionsRes] =
        await Promise.allSettled([
          getBillingStatus(),
          getBillingAccess(),
          getBillingPlans(),
          getBillingTransactions(),
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

      if (transactionsRes.status === "fulfilled") {
        setTransactions(
          Array.isArray(transactionsRes.value.data)
            ? transactionsRes.value.data
            : []
        );
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
  }, [language]);

  useEffect(() => {
    loadBillingPage();
  }, [loadBillingPage]);

  useEffect(() => {
    const handleStripeReturn = async () => {
      if (successFlag !== "true") return;

      try {
        setSuccessRefreshing(true);
        setMessage("");

        if (checkoutSessionId) {
          await syncCheckoutSession(checkoutSessionId);
        }

        await refreshCurrentUser();
        await loadBillingPage();

        window.dispatchEvent(new Event("userUpdated"));
        window.dispatchEvent(new Event("nbai-strategy-refresh"));
        window.dispatchEvent(new Event("nbai-document-engine-updated"));

        setMessage(
          language === "fr"
            ? "Paiement confirmé. Votre abonnement a été actualisé."
            : "Payment confirmed. Your subscription has been refreshed."
        );

        const next = new URLSearchParams(searchParams);
        next.delete("success");
        next.delete("session_id");
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
  }, [
    successFlag,
    checkoutSessionId,
    language,
    searchParams,
    setSearchParams,
    loadBillingPage,
  ]);

  useEffect(() => {
    if (cancelledFlag !== "true") return;
    setMessage(language === "fr" ? "Paiement annulé." : "Checkout cancelled.");

    const next = new URLSearchParams(searchParams);
    next.delete("cancelled");
    setSearchParams(next, { replace: true });
  }, [cancelledFlag, language, searchParams, setSearchParams]);

  async function handleCheckout(plan) {
    try {
      setCheckoutLoadingPlan(plan);
      setMessage("");

      const backendPlan = toBackendPlan(plan);

      if (useDevBillingShortcut) {
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
            ? "Plan activé instantanément (mode développement)."
            : "Plan activated instantly (development mode)."
        );

        navigate("/dashboard");
        return;
      }

      const res = await createCheckoutSession({ plan: backendPlan });
      const url = res?.data?.url;
      if (!url) throw new Error("Missing checkout URL");
      window.location.href = url;
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      if (detail?.code === "disclosures_required") {
        const redirect = encodeURIComponent(
          `/pricing?plan=${plan}&source=disclosure&intent=checkout`
        );
        navigate(`/legal/disclosure?redirect=${redirect}`);
        return;
      }
      const localStripeHint =
        isLocalDev && detail
          ? ` ${language === "fr" ? "Vérifiez les variables Stripe locales si vous testez le paiement." : "Check local Stripe variables if you are testing checkout."}`
          : "";
      setMessage(
        typeof detail === "string"
          ? `${detail}${localStripeHint}`
          : language === "fr"
            ? "Impossible de demarrer le paiement."
            : "Unable to start checkout."
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
      if (!url) throw new Error("Missing portal URL");
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible d'ouvrir le portail de facturation."
            : "Unable to open billing portal.")
      );
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleCancelSubscription() {
    const confirmed = window.confirm(text.cancelConfirm);
    if (!confirmed) return;

    try {
      setCancelLoading(true);
      setMessage("");

      const res = await cancelSubscription();
      await refreshCurrentUser();
      await loadBillingPage();

      window.dispatchEvent(new Event("userUpdated"));
      window.dispatchEvent(new Event("nbai-strategy-refresh"));
      window.dispatchEvent(new Event("nbai-document-engine-updated"));

      const emailStatus = res?.data?.email_status;
      setMessage(
        emailStatus === "sent" || emailStatus === "already_sent"
          ? text.cancelSuccessEmail
          : text.cancelSuccessNoEmail
      );
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible d'annuler l'abonnement pour le moment."
            : "Unable to cancel the subscription right now.")
      );
    } finally {
      setCancelLoading(false);
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
  const currentRoleRaw = billingStatus?.role || "individual";
  const currentRole =
    language === "fr"
      ? {
          admin: "Administrateur",
          agent: "Agent",
          client: "Client",
          individual: "Particulier",
          user: "Utilisateur",
        }[String(currentRoleRaw).toLowerCase()] || currentRoleRaw
      : currentRoleRaw;
  const hasStripeCustomer = Boolean(billingStatus?.stripe_customer_id);
  const cancellationScheduled = Boolean(
    billingStatus?.subscription_cancel_at_period_end ||
      subscriptionStatus === "canceling"
  );
  const currentPeriodEndLabel = formatBillingDate(
    billingStatus?.subscription_current_period_end,
    language
  );

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Choisissez le plan qui fait avancer votre dossier",
        subtitle:
          "Commencez gratuitement, passez à Pro pour exécuter votre stratégie, puis choisissez Premium pour plus de temps et l’export final.",
        currentPlan: "Plan actuel",
        billingStatus: "Statut",
        manageBilling: "Gérer ma facturation",
        cancelSubscription: "Annuler l'abonnement",
        cancelingSubscription: "Annulation...",
        cancelConfirm:
          "Confirmez-vous l’annulation de votre abonnement à la fin de la période payée ?",
        cancelSuccessEmail:
          "Annulation programmée. Un courriel de confirmation a été envoyé.",
        cancelSuccessNoEmail:
          "Annulation programmée. Le courriel de confirmation sera envoyé lorsque la configuration SMTP sera active.",
        cancellationScheduled: "Annulation programmée",
        cancellationBody:
          "Votre accès reste actif jusqu’à la fin de la période payée. Aucun renouvellement ne sera facturé.",
        accessUntil: "Accès jusqu’au",
        includedFeatures: "Inclus",
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
        build: "Agir maintenant",
        accelerate: "Finaliser",
        freeTitle: "Gratuit",
        proTitle: "Pro",
        premiumTitle: "Premium",
        freePrice: "0 $",
        proPrice: "39 $ / 30 jours",
        premiumPrice: "99 $ / 90 jours",
        proSubprice: "Pour débloquer l’exécution",
        premiumSubprice: "Pour finaliser le dossier",
        freeDesc:
          "Pour structurer votre profil, voir les premiers signaux et comprendre ce qui manque.",
        proDesc:
          "Pour avancer maintenant avec stratégie complète, formulaires, documents et révision IA.",
        premiumDesc:
          "Pour préparer un dossier plus complet avec plus de temps et l’export PDF.",
        comparisonTitle: "Ce que chaque plan débloque",
        strategy: "Stratégie complète",
        strategyPreview: "Aperçu de stratégie",
        formsPreview: "Aperçu des formulaires",
        formsDownload: "Téléchargement des formulaires",
        documents: "Génération de documents",
        review: "Révision IA",
        irccIntel: "Veille IRCC et ciblage provincial",
        exports: "Export PDF",
        yes: "Oui",
        limited: "Limité",
        preview: "Aperçu",
        savedProgress: "Progression sauvegardée",
        limitedUsage: "Usage limité",
        longerWindow: "Fenêtre plus longue",
        no: "Non",
        notAvailable: "Non disponible",
        roleLabel: "Rôle",
        rawPlanLabel: "Plan brut",
        transactionsTitle: "Transactions",
        transactionsSubtitle:
          "Historique des paiements Stripe avec courriel de facturation et reçu.",
        transactionDate: "Date",
        transactionPlan: "Plan",
        transactionAmount: "Montant",
        transactionStatus: "Statut",
        billingEmail: "Email de facturation",
        receipt: "Reçu",
        viewReceipt: "Voir le reçu",
        noReceipt: "Non disponible",
        noTransactions:
          "Aucune transaction pour le moment. Les nouveaux paiements apparaîtront ici.",
        valueTitle: "Pourquoi passer à un plan supérieur",
        valueCards: [
          {
            title: "Clarté",
            body: "Voyez ce qui manque, ce qui bloque et quelles actions comptent le plus.",
          },
          {
            title: "Vitesse",
            body: "Générez, téléchargez et révisez sans reconstruire votre dossier à la main.",
          },
          {
            title: "Contrôle",
            body: "Choisissez Pro pour agir vite ou Premium pour finaliser avec plus de marge.",
          },
        ],
        ctaTitle: "Quel plan choisir",
        ctaBody:
          "Gratuit sert à explorer. Pro sert à exécuter. Premium sert à finaliser avec plus de temps et l’export PDF.",
        summaryTitle: "Abonnement",
        premiumBadge: "Meilleure valeur",
        paymentConfirmed: "Accès débloqué",
        paymentConfirmedBody:
          "Votre abonnement est actif. Vous pouvez revenir au tableau de bord ou ouvrir votre stratégie.",
        openDashboard: "Ouvrir le tableau de bord",
        openStrategy: "Ouvrir ma stratégie",
        bestFitLabel: "Idéal si",
        freeFit: "vous voulez explorer avant de payer.",
        proFit: "vous êtes prêt à agir maintenant.",
        premiumFit: "vous voulez finaliser un dossier plus complet.",
        recommendedPlanLabel: "Recommandation",
        recommendedPro:
          "Pro est le meilleur point de départ pour débloquer la stratégie complète et commencer l’exécution.",
        recommendedPremium:
          "Premium est le meilleur choix pour l’export PDF et une préparation plus complète.",
        recommendationPill: "Recommandé",
        targetedTitle: "Parcours recommandé",
        targetedPro:
          "Vous êtes arrivé ici pour débloquer la stratégie complète. Pro est le meilleur choix pour cette étape.",
        targetedPremium:
          "Vous êtes arrivé ici pour l’export PDF ou une préparation plus complète. Premium est le meilleur choix.",
        quickDecision: "Décision rapide",
        quickDecisionTitle: "Prêt à avancer ? Commencez avec Pro",
        quickDecisionBody:
          "La plupart des utilisateurs choisissent Pro pour débloquer leur stratégie complète et commencer l’exécution.",
        quickDecisionCta: "Commencer avec Pro",
        bottomCtaTitle: "Débloquez votre stratégie aujourd’hui",
        bottomCtaBody: "Passez à Pro pour commencer à avancer immédiatement.",
        bottomCtaPrimary: "Choisir Pro",
        bottomCtaSecondary: "Voir Premium",
        loading: "Chargement...",
        opening: "Ouverture...",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Choose the plan that moves your case forward",
      subtitle:
        "Start free, move to Pro when you are ready to execute, then choose Premium when you want more time and final PDF export.",
      currentPlan: "Current plan",
      billingStatus: "Status",
      manageBilling: "Manage billing",
      cancelSubscription: "Cancel subscription",
      cancelingSubscription: "Canceling...",
      cancelConfirm:
        "Confirm cancellation at the end of the paid billing period?",
      cancelSuccessEmail:
        "Cancellation scheduled. A confirmation email has been sent.",
      cancelSuccessNoEmail:
        "Cancellation scheduled. The confirmation email will send when SMTP is configured.",
      cancellationScheduled: "Cancellation scheduled",
      cancellationBody:
        "Your access remains active until the end of the paid billing period. No renewal will be charged.",
      accessUntil: "Access until",
      includedFeatures: "Included",
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
      build: "Take action now",
      accelerate: "Finish",
      freeTitle: "Free",
      proTitle: "Pro",
      premiumTitle: "Premium",
      freePrice: "$0",
      proPrice: "$39 / 30 days",
      premiumPrice: "$99 / 90 days",
      proSubprice: "For unlocking execution",
      premiumSubprice: "For final output",
      freeDesc:
        "For structuring your profile, seeing the first signals, and understanding what is missing.",
      proDesc:
        "For moving now with full strategy, forms, documents, and AI review.",
      premiumDesc:
        "For preparing a fuller case with more time and final PDF export.",
      comparisonTitle: "What each plan unlocks",
      strategy: "Full strategy",
      strategyPreview: "Strategy preview",
      formsPreview: "Forms preview",
      formsDownload: "Forms download",
      documents: "Document generation",
      review: "AI review",
      irccIntel: "IRCC intelligence and province targeting",
      exports: "PDF export",
      yes: "Yes",
      limited: "Limited",
      preview: "Preview",
      savedProgress: "Saved progress",
      limitedUsage: "Limited use",
      longerWindow: "Longer window",
      no: "No",
      notAvailable: "Not available",
      roleLabel: "Role",
      rawPlanLabel: "Raw plan",
      transactionsTitle: "Transactions",
      transactionsSubtitle:
        "Stripe payment history with billing email and receipt access.",
      transactionDate: "Date",
      transactionPlan: "Plan",
      transactionAmount: "Amount",
      transactionStatus: "Status",
      billingEmail: "Billing Email",
      receipt: "Receipt",
      viewReceipt: "View Receipt",
      noReceipt: "Not available",
      noTransactions:
        "No transactions yet. New payments will appear here.",
      valueTitle: "Why users upgrade",
      valueCards: [
        {
          title: "Clarity",
          body: "See what is missing, what is blocking you, and which actions matter most.",
        },
        {
          title: "Speed",
          body: "Generate, download, and review instead of rebuilding the case by hand.",
        },
        {
          title: "Control",
          body: "Choose Pro to move fast or Premium to finish with more room.",
        },
      ],
      ctaTitle: "Which plan should you choose",
      ctaBody:
        "Free is for exploring. Pro is for execution. Premium is for finalizing with more time and PDF export.",
      summaryTitle: "Subscription",
      premiumBadge: "Best value",
      paymentConfirmed: "Access unlocked",
      paymentConfirmedBody:
        "Your subscription is active. You can return to the dashboard or open your strategy.",
      openDashboard: "Open dashboard",
      openStrategy: "Open my strategy",
      bestFitLabel: "Best when",
      freeFit: "you want to explore before paying.",
      proFit: "you are ready to act now.",
      premiumFit: "you want to finish a fuller case.",
      recommendedPlanLabel: "Recommendation",
      recommendedPro:
        "Pro is the best starting point to unlock the full strategy and begin execution.",
      recommendedPremium:
        "Premium is the best choice for PDF export and fuller preparation.",
      recommendationPill: "Recommended",
      targetedTitle: "Suggested path",
      targetedPro:
        "You came here to unlock the full strategy. Pro is the best fit for this step.",
      targetedPremium:
        "You came here for PDF export or fuller preparation. Premium is the best fit.",
      quickDecision: "Quick decision",
      quickDecisionTitle: "Ready to move forward? Start with Pro",
      quickDecisionBody:
        "Most users choose Pro to unlock the full strategy and begin execution.",
      quickDecisionCta: "Start with Pro",
      bottomCtaTitle: "Unlock your strategy today",
      bottomCtaBody: "Upgrade to Pro and start moving forward immediately.",
      bottomCtaPrimary: "Choose Pro",
      bottomCtaSecondary: "See Premium",
      loading: "Loading...",
      opening: "Opening...",
    };
  }, [language]);

  const plans = useMemo(() => {
    const backendAvailable = new Set(
      availablePlans.map((plan) => normalizePlan(plan?.key || plan))
    );

    const planList = [
      {
        key: "free",
        title: text.freeTitle,
        price: text.freePrice,
        description: text.freeDesc,
        audience: text.explore,
        cta: text.startFree,
        fitNote: text.freeFit,
        features: [
          language === "fr" ? "Profil et orientation de base" : "Profile and basic direction",
          language === "fr" ? "Aperçu de stratégie" : "Strategy preview",
          language === "fr" ? "Choix du type de demande" : "Application type selection",
          language === "fr" ? "Prévisualisation des formulaires" : "Forms preview",
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
          text.strategy,
          text.formsDownload,
          text.documents,
          text.review,
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
        badge: text.premiumBadge,
        features: [
          language === "fr" ? "Tout dans Pro" : "Everything in Pro",
          language === "fr" ? "Fenêtre de préparation plus longue" : "Longer preparation window",
          language === "fr"
            ? "Veille IRCC : rondes, délais et catégories"
            : "IRCC intelligence: draws, times, and categories",
          language === "fr"
            ? "Signaux Job Bank et ciblage provincial"
            : "Job Bank signals and province targeting",
          text.exports,
        ],
      },
    ];

    return planList.filter((plan) => {
      if (plan.key === "free") return true;
      if (!availablePlans.length) return true;
      return backendAvailable.has(plan.key);
    });
  }, [availablePlans, language, text]);

  const comparisonRows = useMemo(
    () => [
      { label: text.strategy, free: text.limited, pro: text.yes, premium: text.yes },
      { label: text.formsPreview, free: text.yes, pro: text.yes, premium: text.yes },
      { label: text.formsDownload, free: text.no, pro: text.yes, premium: text.yes },
      { label: text.documents, free: text.limitedUsage, pro: text.yes, premium: text.yes },
      { label: text.review, free: text.limitedUsage, pro: text.yes, premium: text.yes },
      { label: text.irccIntel, free: text.no, pro: text.limited, premium: text.yes },
      { label: text.exports, free: text.no, pro: text.no, premium: text.yes },
    ],
    [text]
  );

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
          <div className="rounded-lg border border-slate-200 bg-white px-10 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-medium text-slate-700">
              {text.loading}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {message ? (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
          {message}
        </div>
      ) : null}

      {successRefreshing ? (
        <SurfaceCard className="mb-6 border-emerald-200 bg-emerald-50">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
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
        <SurfaceCard className="mb-6 border-emerald-200 bg-white">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                {text.paymentConfirmed}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                {language === "fr"
                  ? `Votre accès ${getDisplayPlan(currentPlan, language)} est actif`
                  : `Your ${getDisplayPlan(currentPlan, language)} access is active`}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {text.paymentConfirmedBody}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:w-[320px] md:grid-cols-1">
              <Button onClick={() => navigate("/dashboard")}>
                {text.openDashboard}
              </Button>
              <Button variant="secondary" onClick={() => navigate("/strategy")}>
                {text.openStrategy}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <PricingHero
        text={text}
        language={language}
        currentPlan={currentPlan}
        subscriptionStatus={subscriptionStatus}
        recommendedPlan={recommendedPlan}
        recommendedPlanMessage={recommendedPlanMessage}
        checkoutLoadingPlan={checkoutLoadingPlan}
        hasStripeCustomer={hasStripeCustomer}
        portalLoading={portalLoading}
        onPortal={handlePortal}
        onPro={() => handleCheckout("pro")}
        onPremium={() => handleCheckout("premium")}
        onDashboard={() => navigate("/dashboard")}
        onStrategy={() => navigate("/strategy")}
      />

      {requestedPlan && targetedPlanMessage ? (
        <SurfaceCard className="mb-6 border-amber-200 bg-stone-50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
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

      <div className="mb-6 grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <DecisionPanel
          text={text}
          checkoutLoadingPlan={checkoutLoadingPlan}
          onPro={() => handleCheckout("pro")}
        />
        <SurfaceCard>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {text.valueTitle}
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {text.valueCards.map((item) => (
              <ValueCard key={item.title} title={item.title} body={item.body} />
            ))}
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.key}
            className={plan.key === "premium" ? "md:col-span-2 xl:col-span-1" : ""}
          >
            <PlanCard
              plan={plan}
              text={text}
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
        <SurfaceCard className="border-stone-200 bg-stone-50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label={text.currentPlan} value={getDisplayPlan(currentPlan, language)} />
            <Metric label={text.billingStatus} value={subscriptionStatus || text.notAvailable} />
            <Metric label={text.roleLabel} value={currentRole} />
            <Metric label={text.rawPlanLabel} value={rawPlan} />
          </div>
          {recommendedPlan ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <span className="font-semibold">{text.recommendationPill}: </span>
              {recommendedPlan === "premium" ? text.premiumTitle : text.proTitle}
            </div>
          ) : null}
          {cancellationScheduled ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <span className="font-semibold">{text.cancellationScheduled}: </span>
              {text.cancellationBody}
              {currentPeriodEndLabel !== "--" ? (
                <span className="mt-1 block">
                  {text.accessUntil}: {currentPeriodEndLabel}
                </span>
              ) : null}
            </div>
          ) : currentPlan !== "free" && hasStripeCustomer ? (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50/60 px-4 py-3">
              <p className="text-sm leading-6 text-red-900">
                {language === "fr"
                  ? "Vous pouvez programmer l’annulation à la fin de votre période payée."
                  : "You can schedule cancellation at the end of your paid period."}
              </p>
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={handleCancelSubscription}
                loading={cancelLoading}
                disabled={cancelLoading}
              >
                {cancelLoading ? text.cancelingSubscription : text.cancelSubscription}
              </Button>
            </div>
          ) : null}
        </SurfaceCard>
      </div>

      <TransactionHistory
        transactions={transactions}
        text={text}
        language={language}
      />

      <SurfaceCard className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {text.comparisonTitle}
        </p>
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr] bg-slate-50">
              <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                {text.includedFeatures}
              </div>
              <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                {text.freeTitle}
              </div>
              <div className="px-4 py-4 text-sm font-semibold text-slate-950">
                {text.proTitle}
              </div>
              <div className="px-4 py-4 text-sm font-semibold text-slate-600">
                {text.premiumTitle}
              </div>
            </div>
            {comparisonRows.map((row, index) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr] items-center ${
                  index !== comparisonRows.length - 1
                    ? "border-t border-slate-200"
                    : ""
                }`}
              >
                <div className="px-4 py-4 text-sm font-medium text-slate-900">
                  {row.label}
                </div>
                <div className="px-4 py-4 text-sm text-slate-700">
                  <ComparisonValue value={row.free} language={language} />
                </div>
                <div className="bg-stone-50 px-4 py-4 text-sm text-slate-700">
                  <ComparisonValue value={row.pro} emphasized language={language} />
                </div>
                <div className="px-4 py-4 text-sm text-slate-700">
                  <ComparisonValue value={row.premium} emphasized language={language} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {currentPlan === "free" || currentPlan === "pro" ? (
      <SurfaceCard className="mt-8 border-blue-100 bg-blue-50/70 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          {text.bottomCtaTitle}
        </h2>
        <p className="mt-3 text-sm text-slate-600">{text.bottomCtaBody}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button
            onClick={() => handleCheckout("pro")}
            disabled={checkoutLoadingPlan === "pro"}
            loading={checkoutLoadingPlan === "pro"}
          >
            {checkoutLoadingPlan === "pro" ? text.loading : text.bottomCtaPrimary}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleCheckout("premium")}
            disabled={checkoutLoadingPlan === "premium"}
            loading={checkoutLoadingPlan === "premium"}
            >
              {checkoutLoadingPlan === "premium"
                ? text.loading
                : text.bottomCtaSecondary}
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      {isLocalDev ? (
        <SurfaceCard className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {text.devTools}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => handleDevPlanSwitch("free")}
              disabled={devSwitchLoading === "free"}
              loading={devSwitchLoading === "free"}
            >
              {devSwitchLoading === "free" ? text.loading : text.switchToFree}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDevPlanSwitch("pro")}
              disabled={devSwitchLoading === "pro"}
              loading={devSwitchLoading === "pro"}
            >
              {devSwitchLoading === "pro" ? text.loading : text.switchToPro}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDevPlanSwitch("premium")}
              disabled={devSwitchLoading === "premium"}
              loading={devSwitchLoading === "premium"}
            >
              {devSwitchLoading === "premium" ? text.loading : text.switchToPremium}
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-slate-500">
        <Link className="hover:text-slate-900" to="/legal">
          Legal disclosures
        </Link>
        <Link className="hover:text-slate-900" to="/terms">
          Terms
        </Link>
        <Link className="hover:text-slate-900" to="/privacy">
          Privacy
        </Link>
      </div>
    </Layout>
  );
}
