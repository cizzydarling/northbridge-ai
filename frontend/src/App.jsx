import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import "./i18n";
import { getCurrentUserLocal, getMyProfile, logoutUser } from "./api";

// Public
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import PricingPage from "./pages/PricingPage";
import BillingSuccessPage from "./pages/BillingSuccessPage";

// Self flow
import SelfDashboardPage from "./pages/SelfDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import StrategyPage from "./pages/StrategyPage";
import ChatPage from "./pages/ChatPage";
import SelfApplicationPage from "./pages/SelfApplicationPage";
import SelfDocumentsPage from "./pages/SelfDocumentsPage";
import DisclosureAcceptancePage from "./pages/DisclosureAcceptancePage";
import DocumentGeneratorPage from "./pages/DocumentGeneratorPage";
import DocumentReviewPage from "./pages/DocumentReviewPage";
import FormsPage from "./pages/FormsPage";
import OnboardingPage from "./pages/OnboardingPage";

// Client flow
import ClientsPage from "./pages/ClientsPage";
import ClientOverviewPage from "./pages/ClientOverviewPage";
import ClientProfilePage from "./pages/ClientProfilePage";
import ClientStrategyPage from "./pages/ClientStrategyPage";
import ClientSimulationPage from "./pages/ClientSimulationPage";
import ClientDocumentsPage from "./pages/ClientDocumentsPage";
import ClientMattersPage from "./pages/ClientMattersPage";

function PublicOnlyRoute({ children }) {
  const user = getCurrentUserLocal();

  if (user) {
    if (user.role === "agent" || user.plan === "agent_pro") {
      return <Navigate to="/clients" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ProtectedRoute({ children }) {
  const user = getCurrentUserLocal();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return children;
}

function OnboardingGate({ children }) {
  const user = getCurrentUserLocal();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      if (user.role === "agent" || user.plan === "agent_pro") {
        if (mounted) {
          setHasProfile(true);
          setLoading(false);
        }
        return;
      }

      try {
        await getMyProfile();
        if (mounted) {
          setHasProfile(true);
        }
      } catch (err) {
        if (err?.response?.status === 404) {
          if (mounted) {
            setHasProfile(false);
          }
        } else if (err?.response?.status === 401) {
          logoutUser();
        } else {
          if (mounted) {
            setHasProfile(false);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkProfile();

    return () => {
      mounted = false;
    };
  }, [user, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (user?.role !== "agent" && user?.plan !== "agent_pro") {
    if (!hasProfile && location.pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }

    if (hasProfile && location.pathname === "/onboarding") {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}

function ProtectedAppRoute({ children }) {
  return (
    <ProtectedRoute>
      <OnboardingGate>{children}</OnboardingGate>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <LandingPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/auth"
        element={
          <PublicOnlyRoute>
            <AuthPage />
          </PublicOnlyRoute>
        }
      />

      {/* Pricing must be available both before and after login */}
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/billing" element={<PricingPage />} />

      <Route
        path="/billing/success"
        element={
          <ProtectedAppRoute>
            <BillingSuccessPage />
          </ProtectedAppRoute>
        }
      />

      {/* ONBOARDING */}
      <Route
        path="/onboarding"
        element={
          <ProtectedAppRoute>
            <OnboardingPage />
          </ProtectedAppRoute>
        }
      />

      {/* SELF FLOW */}
      <Route
        path="/dashboard"
        element={
          <ProtectedAppRoute>
            <SelfDashboardPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedAppRoute>
            <ProfilePage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/strategy"
        element={
          <ProtectedAppRoute>
            <StrategyPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedAppRoute>
            <ChatPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/forms"
        element={
          <ProtectedAppRoute>
            <FormsPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/self/application"
        element={
          <ProtectedAppRoute>
            <SelfApplicationPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/self/documents"
        element={
          <ProtectedAppRoute>
            <SelfDocumentsPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/documents/generator"
        element={
          <ProtectedAppRoute>
            <DocumentGeneratorPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/documents/review"
        element={
          <ProtectedAppRoute>
            <DocumentReviewPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/legal/disclosure"
        element={
          <ProtectedAppRoute>
            <DisclosureAcceptancePage />
          </ProtectedAppRoute>
        }
      />

      {/* CLIENT FLOW */}
      <Route
        path="/clients"
        element={
          <ProtectedAppRoute>
            <ClientsPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/clients/:clientId"
        element={
          <ProtectedAppRoute>
            <ClientOverviewPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/clients/:clientId/profile"
        element={
          <ProtectedAppRoute>
            <ClientProfilePage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/clients/:clientId/strategy"
        element={
          <ProtectedAppRoute>
            <ClientStrategyPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/clients/:clientId/simulations"
        element={
          <ProtectedAppRoute>
            <ClientSimulationPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/clients/:clientId/documents"
        element={
          <ProtectedAppRoute>
            <ClientDocumentsPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/clients/:clientId/matters"
        element={
          <ProtectedAppRoute>
            <ClientMattersPage />
          </ProtectedAppRoute>
        }
      />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}