import { useEffect, useMemo } from "react";
import useBillingAccess from "../hooks/useBillingAccess";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getBillingAccess } from "../api";

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "individual_pro") return "pro";
  if (value === "agent_pro") return "premium";
  if (value === "premium") return "premium";
  if (value === "pro") return "pro";
  return "free";
}

export default function CurrentPlanBadge({ className = "" }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = String(i18n.language || "en").toLowerCase().startsWith("fr")
    ? "fr"
    : "en";
  const { status, access } = useBillingAccess();
  const plan = normalizePlan(access?.plan);
  useEffect(() => {
    if (status === "unknown") getBillingAccess().catch(() => {});
  }, [status]);

  const ui = useMemo(() => {
    if (language === "fr") {
      return {
        free: "Gratuit",
        pro: "Pro",
        premium: "Premium",
        upgrade: "Voir les tarifs",
        loading: "Chargement...",
      };
    }

    return {
      free: "Free",
      pro: "Pro",
      premium: "Premium",
      upgrade: "View pricing",
      loading: "Loading...",
    };
  }, [language]);

  const label =
    plan === "premium" ? ui.premium : plan === "pro" ? ui.pro : ui.free;

  const badgeClass =
    plan === "premium"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : plan === "pro"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  if (!status.startsWith("verified_")) {
    return (
      <div
        className={`rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 ${className}`}
      >
        {status === "error" ? (language === "fr" ? "Accès indisponible" : "Access unavailable") : ui.loading}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => navigate("/pricing")}
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-90 ${badgeClass}`}
      >
        {label}
      </button>

      {plan === "free" && (
        <button
          type="button"
          onClick={() => navigate("/pricing")}
          className="text-xs font-medium text-slate-700 transition hover:text-slate-950"
        >
          {ui.upgrade}
        </button>
      )}
    </div>
  );
}
