import EntitlementStatus from "./components/EntitlementStatus";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import "./i18n";
import {
  getAppBootstrap,
  getCurrentUserLocal,
  logoutUser,
} from "./api";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const BillingSuccessPage = lazy(() => import("./pages/BillingSuccessPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const SelfDashboardPage = lazy(() => import("./pages/SelfDashboardPage"));
const HouseholdPage = lazy(() => import("./pages/HouseholdPage"));
const ApplicationCasesPage = lazy(() => import("./pages/ApplicationCasesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const StrategyPage = lazy(() => import("./pages/PlanningStrategyPage"));
const StrategySimulatorPage = lazy(() => import("./pages/PlanningStrategyPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const SelfApplicationPage = lazy(() => import("./pages/SelfApplicationPage"));
const SelfDocumentsPage = lazy(() => import("./pages/SelfDocumentsPage"));
const DisclosureAcceptancePage = lazy(() => import("./pages/DisclosureAcceptancePage"));
const DocumentGeneratorPage = lazy(() => import("./pages/DocumentGeneratorPage"));
const DocumentReviewPage = lazy(() => import("./pages/DocumentReviewPage"));
const FormsPage = lazy(() => import("./pages/FormsPage"));
const CareerMatchPage = lazy(() => import("./pages/CareerMatchPage"));
const ProvinceJobMatchPage = lazy(() => import("./pages/ProvinceJobMatchPage"));
const SavedJobsPage = lazy(() => import("./pages/SavedJobsPage"));
const CitizenshipPracticePage = lazy(() => import("./pages/CitizenshipPracticePage"));
const CitizenshipQuizPage = lazy(() => import("./pages/CitizenshipQuizPage"));
const CitizenshipProgressPage = lazy(() => import("./pages/CitizenshipProgressPage"));
const LanguagePracticePage = lazy(() => import("./pages/LanguagePracticePage"));
const OfficialFindersPage = lazy(() => import("./pages/OfficialFindersPage"));
const AdminPromoCodesPage = lazy(() => import("./pages/AdminPromoCodesPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));

let appRoutePrefetchStarted = false;

function prefetchAppRoutes() {
  if (appRoutePrefetchStarted || typeof window === "undefined") return;
  appRoutePrefetchStarted = true;

  const run = () => {
    import("./pages/SelfDashboardPage");
    import("./pages/ProfilePage");
    import("./pages/PlanningStrategyPage");
    import("./pages/SelfDocumentsPage");
    import("./pages/CareerMatchPage");
    import("./pages/CitizenshipPracticePage");
    import("./pages/OfficialFindersPage");
    import("./pages/PricingPage");
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 900);
  }
}

function syncLocalUser(user) {
  if (!user) return;

  const next = JSON.stringify(user);
  const current = localStorage.getItem("current_user");

  if (current !== next) {
    localStorage.setItem("current_user", next);
    localStorage.setItem("user", next);
  }
}

function getCurrentLanguage() {
  const savedLanguage =
    localStorage.getItem("i18nextLng") || localStorage.getItem("language") || "en";
  return String(savedLanguage).toLowerCase().startsWith("fr") ? "fr" : "en";
}

function LoadingScreen() {
  const language = getCurrentLanguage();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-slate-600">
        {language === "fr" ? "Chargement..." : "Loading..."}
      </p>
    </div>
  );
}

function PublicOnlyRoute({ children }) {
  const user = getCurrentUserLocal();

  if (user) {
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

function BootstrapGate({ children }) {
  const user = getCurrentUserLocal();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [verifiedBootstrapKey, setVerifiedBootstrapKey] = useState(null);
  const bootstrapKey = `${user?.email || ""}:${location.pathname}`;
  const bootstrapLoadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function loadBootstrap() {
      if (!getCurrentUserLocal()) {
        bootstrapLoadedRef.current = false;
        if (mounted) setLoading(false);
        return;
      }

      try {
        if (!bootstrapLoadedRef.current) {
          setLoading(true);
        }
        const res = await getAppBootstrap();
        if (!mounted) return;

        syncLocalUser(res.data?.user);
        setBootstrap(res.data);
        setVerifiedBootstrapKey(`${getCurrentUserLocal()?.email || ""}:${location.pathname}`);
        bootstrapLoadedRef.current = true;
        prefetchAppRoutes();
      } catch (err) {
        if (err?.response?.status === 401) {
          logoutUser();
          bootstrapLoadedRef.current = false;
        }
        if (mounted) setBootstrap(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBootstrap();

    window.addEventListener("nbai-bootstrap-refresh", loadBootstrap);
    window.addEventListener("nbai-disclosures-accepted", loadBootstrap);

    return () => {
      mounted = false;
      window.removeEventListener("nbai-bootstrap-refresh", loadBootstrap);
      window.removeEventListener("nbai-disclosures-accepted", loadBootstrap);
    };
  }, [user?.email, location.pathname]);

  if (loading || (bootstrap && verifiedBootstrapKey !== bootstrapKey)) {
    return <LoadingScreen />;
  }

  if (!bootstrap) {
    return <EntitlementStatus error onRetry={() => window.dispatchEvent(new Event("nbai-bootstrap-refresh"))} />;
  }

  const isDisclosurePage = location.pathname === "/legal/disclosure";
  const disclosureAccepted = Boolean(bootstrap.disclosures?.accepted);

  if (!disclosureAccepted && !isDisclosurePage) {
    const redirect = encodeURIComponent(
      `${location.pathname}${location.search || ""}`
    );
    return <Navigate to={`/legal/disclosure?redirect=${redirect}`} replace />;
  }

  const bootstrapUser = bootstrap.user || user;
  const isAgent = bootstrapUser?.role === "agent" || bootstrapUser?.plan === "agent_pro";

  if (isAgent) {
    return <main className="p-8"><p>{getCurrentLanguage() === "fr"
      ? "Le lancement est réservé aux utilisateurs individuels."
      : "This launch is available to individual users only."}</p>
      <button onClick={() => { logoutUser(); window.location.assign("/auth"); }}>
        {getCurrentLanguage() === "fr" ? "Déconnexion" : "Sign out"}
      </button></main>;
  }
  if (!bootstrap.profile_complete && location.pathname !== "/onboarding" && !isDisclosurePage) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

function ProtectedAppRoute({ children }) {
  return (
    <ProtectedRoute>
      <BootstrapGate>{children}</BootstrapGate>
    </ProtectedRoute>
  );
}

function AppLoading() {
  return <LoadingScreen />;
}

export default function App() {
  return (
    <Suspense fallback={<AppLoading />}>
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
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/terms" element={<LegalPage />} />
      <Route path="/privacy" element={<LegalPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/fr/blog" element={<BlogPage />} />
      <Route path="/fr/blog/:slug" element={<BlogPostPage />} />
      <Route
        path="/upgrade"
        element={<Navigate to="/pricing?source=app&intent=upgrade" replace />}
      />

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
        path="/household"
        element={
          <ProtectedAppRoute>
            <HouseholdPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/applications"
        element={
          <ProtectedAppRoute>
            <ApplicationCasesPage />
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
        path="/strategy/simulator"
        element={
          <ProtectedAppRoute>
            <StrategySimulatorPage />
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
        path="/career-match"
        element={
          <ProtectedAppRoute>
            <CareerMatchPage />
          </ProtectedAppRoute>
        }
      />
      <Route
        path="/career-match/province"
        element={
          <ProtectedAppRoute>
            <ProvinceJobMatchPage />
          </ProtectedAppRoute>
        }
      />
      <Route
        path="/career-match/saved"
        element={
          <ProtectedAppRoute>
            <SavedJobsPage />
          </ProtectedAppRoute>
        }
      />
      <Route
        path="/citizenship"
        element={
          <ProtectedAppRoute>
            <CitizenshipPracticePage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/citizenship/quiz"
        element={
          <ProtectedAppRoute>
            <CitizenshipQuizPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/citizenship/progress"
        element={
          <ProtectedAppRoute>
            <CitizenshipProgressPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/language-practice"
        element={
          <ProtectedAppRoute>
            <LanguagePracticePage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/official-finders"
        element={
          <ProtectedAppRoute>
            <OfficialFindersPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/admin/promo-codes"
        element={
          <ProtectedAppRoute>
            <AdminPromoCodesPage />
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
        path="/documents"
        element={
          <ProtectedAppRoute>
            <SelfDocumentsPage />
          </ProtectedAppRoute>
        }
      />

      <Route
        path="/self/documents"
        element={<Navigate to="/documents" replace />}
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

      {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
