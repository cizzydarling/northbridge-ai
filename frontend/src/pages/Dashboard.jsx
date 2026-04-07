// frontend/src/pages/Dashboard.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import {
  getBillingStatus,
  getMyProfile,
  getMyStrategy,
  getToken,
  logoutUser,
  getCurrentUserLocal,
  refreshCurrentUser,
} from "../api";

function hasPaidPlan(user, billingPlan) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const effectivePlan = billingPlan || user.plan;
  return ["individual_pro", "agent_pro", "individual_premium"].includes(effectivePlan);
}

function isPremiumPlan(plan) {
  return plan === "individual_premium";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [profile, setProfile] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(getCurrentUserLocal());

  const currentPlan = billing?.plan || currentUser?.plan || "free";
  const paidAccess = hasPaidPlan(currentUser, currentPlan);
  const isPremium = isPremiumPlan(currentPlan);

  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token) {
        navigate("/auth");
        return;
      }

      try {
        const refreshed = await refreshCurrentUser();
        setCurrentUser(refreshed);
      } catch {}

      const [profileRes, strategyRes, billingRes] = await Promise.allSettled([
        getMyProfile(),
        getMyStrategy(),
        getBillingStatus(),
      ]);

      if (profileRes.status === "fulfilled") setProfile(profileRes.value.data);
      if (strategyRes.status === "fulfilled") setStrategy(strategyRes.value.data);
      if (billingRes.status === "fulfilled") setBilling(billingRes.value.data);

      setLoading(false);
    };

    load();
  }, [navigate]);

  // -------------------------
  // 🔥 CORE FUNNEL LOGIC
  // -------------------------
  const nextAction = useMemo(() => {
    if (!profile) {
      return {
        label: "Complete Profile",
        path: "/onboarding",
      };
    }

    if (!strategy) {
      return {
        label: "Build My Strategy",
        path: "/strategy",
      };
    }

    if (!paidAccess) {
      return {
        label: "Unlock Forms & Documents",
        path: "/pricing",
      };
    }

    if (paidAccess && !isPremium) {
      return {
        label: "Finalize with PDF Export",
        path: "/pricing",
      };
    }

    return {
      label: "Continue My Application",
      path: "/documents",
    };
  }, [profile, strategy, paidAccess, isPremium]);

  const secondaryAction = useMemo(() => {
    if (!profile) return { label: "View Pricing", path: "/pricing" };
    if (!strategy) return { label: "Complete Profile", path: "/profile" };
    if (!paidAccess) return { label: "View Strategy", path: "/strategy" };
    return { label: "Open Forms Studio", path: "/forms" };
  }, [profile, strategy, paidAccess]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <p className="text-lg">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* HERO */}
      <div className="mb-10 rounded-3xl bg-gradient-to-br from-blue-900 to-blue-600 p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold">
          Your guided immigration workspace
        </h1>

        <p className="mt-4 max-w-2xl text-sm text-blue-100">
          Move from uncertainty to action with a clearer profile, stronger strategy,
          and a more organized application workflow.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate(nextAction.path)}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-blue-900"
          >
            {nextAction.label}
          </button>

          <button
            onClick={() => navigate(secondaryAction.path)}
            className="rounded-xl border border-white px-5 py-3 text-sm"
          >
            {secondaryAction.label}
          </button>
        </div>
      </div>

      {/* 🔥 PREMIUM PUSH */}
      {paidAccess && !isPremium && (
        <div className="mb-6 rounded-2xl border border-purple-200 bg-purple-50 p-5">
          <p className="text-sm text-purple-800">
            You're one step away from finishing your application.
            Unlock PDF export and finalize everything cleanly.
          </p>

          <button
            onClick={() => navigate("/pricing")}
            className="mt-3 rounded-xl bg-purple-600 px-4 py-2 text-sm text-white"
          >
            Upgrade to Premium
          </button>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Profile" value={profile ? "Completed" : "Missing"} />
        <StatCard label="Strategy" value={strategy ? "Ready" : "Not started"} />
        <StatCard label="Plan" value={currentPlan} />
        <StatCard label="Access" value={paidAccess ? "Unlocked" : "Locked"} />
      </div>

      {/* NEXT ACTION CARD */}
      <div className="mt-6 rounded-2xl border bg-white p-6 shadow">
        <h3 className="text-xl font-semibold">Your next step</h3>

        <p className="mt-2 text-sm text-slate-600">
          Follow the guided flow to move forward.
        </p>

        <button
          onClick={() => navigate(nextAction.path)}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-white"
        >
          {nextAction.label}
        </button>
      </div>
    </Layout>
  );
}