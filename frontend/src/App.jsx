import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import "./i18n";
import { getCurrentUserLocal } from "./api";

// Public
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import PricingPage from "./pages/PricingPage";

// Self flow
import SelfDashboardPage from "./pages/SelfDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import StrategyPage from "./pages/StrategyPage";
import ChatPage from "./pages/ChatPage";
import SelfApplicationPage from "./pages/SelfApplicationPage";
import SelfDocumentsPage from "./pages/SelfDocumentsPage";
import DisclosureAcceptancePage from "./pages/DisclosureAcceptancePage";

// Client flow
import ClientsPage from "./pages/ClientsPage";
import ClientOverviewPage from "./pages/ClientOverviewPage";
import ClientProfilePage from "./pages/ClientProfilePage";
import ClientStrategyPage from "./pages/ClientStrategyPage";
import ClientSimulationPage from "./pages/ClientSimulationPage";
import ClientDocumentsPage from "./pages/ClientDocumentsPage";
import ClientMattersPage from "./pages/ClientMattersPage";

/**
 * Public-only routes
 */
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

/**
 * Protected routes
 */
function ProtectedRoute({ children }) {
  const user = getCurrentUserLocal();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return children;
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

      <Route
        path="/pricing"
        element={
          <PublicOnlyRoute>
            <PricingPage />
          </PublicOnlyRoute>
        }
      />

      {/* SELF FLOW */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <SelfDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/strategy"
        element={
          <ProtectedRoute>
            <StrategyPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/self/application"
        element={
          <ProtectedRoute>
            <SelfApplicationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/self/documents"
        element={
          <ProtectedRoute>
            <SelfDocumentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/legal/disclosure"
        element={
          <ProtectedRoute>
            <DisclosureAcceptancePage />
          </ProtectedRoute>
        }
      />

      {/* CLIENT FLOW */}
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <ClientsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients/:clientId"
        element={
          <ProtectedRoute>
            <ClientOverviewPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients/:clientId/profile"
        element={
          <ProtectedRoute>
            <ClientProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients/:clientId/strategy"
        element={
          <ProtectedRoute>
            <ClientStrategyPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients/:clientId/simulations"
        element={
          <ProtectedRoute>
            <ClientSimulationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients/:clientId/documents"
        element={
          <ProtectedRoute>
            <ClientDocumentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients/:clientId/matters"
        element={
          <ProtectedRoute>
            <ClientMattersPage />
          </ProtectedRoute>
        }
      />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}