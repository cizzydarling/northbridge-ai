import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { getBillingStatus, refreshCurrentUser } from "../api";

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [billing, setBilling] = useState(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    async function loadSuccessState() {
      try {
        setLoading(true);
        setMessage("");

        await refreshCurrentUser();
        const billingRes = await getBillingStatus();
        setBilling(billingRes.data);

        if (
          billingRes.data?.subscription_status === "active" ||
          billingRes.data?.subscription_status === "trialing"
        ) {
          setMessage("Your subscription is active and your account has been updated.");
        } else {
          setMessage(
            "Your checkout was received. Your subscription may still be processing."
          );
        }
      } catch (err) {
        console.error(err);
        setMessage(
          err.response?.data?.detail ||
            "We could not confirm your billing status yet. Please refresh this page in a moment."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSuccessState();
  }, []);

  const currentPlan = billing?.plan || "free";
  const subscriptionStatus = billing?.subscription_status || "unknown";
  const role = billing?.role || "individual";

  const goToBestNextPage = () => {
    if (role === "agent" || role === "admin") {
      navigate("/clients");
      return;
    }

    navigate("/strategy");
  };

  return (
    <Layout maxWidth="max-w-4xl">
      <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Billing Success
        </h1>

        <p className="mt-3 text-slate-600">
          {loading
            ? "We’re confirming your subscription and updating your access."
            : message}
        </p>

        {sessionId ? (
          <p className="mt-3 text-xs text-slate-500">
            Checkout session: {sessionId}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatusCard
            label="Role"
            value={loading ? "Updating..." : role}
          />
          <StatusCard
            label="Current Plan"
            value={loading ? "Updating..." : currentPlan}
          />
          <StatusCard
            label="Subscription Status"
            value={loading ? "Updating..." : subscriptionStatus}
          />
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">What’s next</h2>

          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>• Your plan-based features should unlock automatically once billing is active.</p>
            <p>• If access still looks unchanged, go back to your dashboard and refresh once.</p>
            <p>• You can manage your subscription anytime from the billing page.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={goToBestNextPage}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Continue
          </button>

          <button
            onClick={() => navigate("/billing")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Billing
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </Layout>
  );
}

function StatusCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value || "--"}</p>
    </div>
  );
}