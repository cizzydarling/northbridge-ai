import { useMemo, useState } from "react";
import Button from "./ui/Button";
import { devSetPlan, getCurrentUserLocal, refreshCurrentUser } from "../api";

function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "individual_pro") return "pro";
  if (value === "individual_premium") return "premium";
  if (value === "agent_pro") return "premium";
  if (value === "premium") return "premium";
  if (value === "pro") return "pro";
  return "free";
}

function getAllowedPlansForRole(role) {
  if (role === "agent") {
    return [
      { key: "free", label: "Free" },
      { key: "agent_pro", label: "Agent Pro" },
    ];
  }

  if (role === "admin") {
    return [
      { key: "free", label: "Free" },
      { key: "individual_pro", label: "Pro" },
      { key: "individual_premium", label: "Premium" },
      { key: "agent_pro", label: "Agent Pro" },
    ];
  }

  return [
    { key: "free", label: "Free" },
    { key: "individual_pro", label: "Pro" },
    { key: "individual_premium", label: "Premium" },
  ];
}

export default function DevPlanSwitcher() {
  const [loadingPlan, setLoadingPlan] = useState("");
  const [message, setMessage] = useState("");

  const currentUser = getCurrentUserLocal();
  const role = currentUser?.role || "individual";

  const plans = useMemo(() => getAllowedPlansForRole(role), [role]);
  const currentPlan = normalizePlan(currentUser?.plan);

  async function handleSwitch(plan) {
    try {
      setLoadingPlan(plan);
      setMessage("");

      const subscription_status = plan === "free" ? null : "active";

      await devSetPlan({ plan, subscription_status });
      await refreshCurrentUser();

      window.dispatchEvent(new Event("userUpdated"));
      window.dispatchEvent(new Event("nbai-strategy-refresh"));
      window.dispatchEvent(new Event("nbai-document-engine-updated"));

      setMessage("Dev plan updated.");
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail || "Unable to switch dev plan."
      );
    } finally {
      setLoadingPlan("");
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/70 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
        Dev tools
      </p>
      <h3 className="mt-2 text-sm font-semibold text-slate-900">
        Plan switcher
      </h3>
      <p className="mt-1 text-xs leading-6 text-slate-600">
        Current: {currentPlan === "free" ? "Free" : currentPlan === "pro" ? "Pro" : "Premium"}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {plans.map((plan) => (
          <Button
            key={plan.key}
            variant="secondary"
            onClick={() => handleSwitch(plan.key)}
            disabled={loadingPlan === plan.key}
            className="w-full justify-center"
          >
            {loadingPlan === plan.key ? "Switching..." : `Use ${plan.label}`}
          </Button>
        ))}
      </div>

      {message ? (
        <p className="mt-3 text-xs text-slate-600">{message}</p>
      ) : null}
    </div>
  );
}