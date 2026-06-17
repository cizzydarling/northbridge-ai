import axios from "axios";
import { getActiveCaseId } from "./utils/activeCase";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:8000",
});

/* =========================
   TOKEN + USER HELPERS
========================= */

export const getToken = () => localStorage.getItem("token");
const ACCESS_CACHE_KEY = "nbai_billing_access";

export const saveToken = (token) => {
  localStorage.setItem("token", token);
};

export const setToken = (token) => {
  saveToken(token);
};

export const removeToken = () => {
  localStorage.removeItem("token");
};

export const getCurrentUserLocal = () => {
  const raw =
    localStorage.getItem("current_user") || localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
};

function readLocalJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildAccessFromUser(user) {
  if (!user) return null;
  return normalizeAccess({
    plan: user.plan || "free",
    subscription_status: user.subscription_status,
    role: user.role,
    features: user.features || {},
  });
}

export const getCachedBillingAccess = () => {
  const cached = readLocalJson(ACCESS_CACHE_KEY);
  if (cached) return normalizeAccess(cached);

  return buildAccessFromUser(getCurrentUserLocal());
};

export const saveBillingAccess = (access) => {
  if (!access) return null;
  const normalized = normalizeAccess(access);
  localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(normalized));
  return normalized;
};

function humanizeEmailName(email) {
  const localPart = String(email || "").split("@")[0]?.trim();
  if (!localPart) return "";

  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const getUserDisplayName = (user, fallback = "User") => {
  const firstName =
    user?.first_name?.trim?.() ||
    user?.profile?.first_name?.trim?.() ||
    "";

  const lastName =
    user?.last_name?.trim?.() ||
    user?.profile?.last_name?.trim?.() ||
    "";

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const savedDisplayName =
    user?.display_name?.trim?.() ||
    user?.full_name?.trim?.() ||
    user?.name?.trim?.() ||
    user?.profile?.display_name?.trim?.() ||
    user?.profile?.full_name?.trim?.() ||
    user?.profile?.name?.trim?.() ||
    "";

  return (
    fullName ||
    savedDisplayName ||
    humanizeEmailName(
      user?.email ||
        user?.username ||
        user?.preferred_username ||
        user?.profile?.email ||
        user?.profile?.username
    ) ||
    fallback
  );
};

export const saveCurrentUser = (user) => {
  localStorage.setItem("current_user", JSON.stringify(user));
  localStorage.setItem("user", JSON.stringify(user));
  saveBillingAccess(buildAccessFromUser(user));
  window.dispatchEvent(new Event("userUpdated"));
};

export const setCurrentUserLocal = (user) => {
  saveCurrentUser(user);
};

export const removeCurrentUserLocal = () => {
  localStorage.removeItem("current_user");
  localStorage.removeItem("user");
  localStorage.removeItem(ACCESS_CACHE_KEY);
};

export const logoutUser = () => {
  removeToken();
  removeCurrentUserLocal();
};

export const getLanguage = () => {
  const raw =
    localStorage.getItem("i18nextLng") ||
    localStorage.getItem("language") ||
    "en";
  return raw.toLowerCase().startsWith("fr") ? "fr" : "en";
};

/* =========================
   ATTACH TOKEN
========================= */

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* =========================
   RESPONSE HANDLING
========================= */

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      removeToken();
      removeCurrentUserLocal();
    }

    return Promise.reject(error);
  }
);

export default api;

/* =========================
   BILLING ACCESS NORMALIZATION
========================= */

function normalizeAccess(raw) {
  const plan = raw?.plan || "free";
  const features = raw?.features || {};

  const isPro =
    Boolean(raw?.is_pro) || plan === "pro" || plan === "premium";
  const isPremium =
    Boolean(raw?.is_premium) || plan === "premium";

  return {
    ...raw,
    plan,
    features,

    is_free: raw?.is_free ?? (!isPro && !isPremium),
    is_pro: isPro,
    is_premium: isPremium,

    can_view_basic_strategy:
      raw?.can_view_basic_strategy ?? true,
    can_view_full_strategy:
      raw?.can_view_full_strategy ?? features?.full_strategy ?? isPro,

    can_preview_forms:
      raw?.can_preview_forms ?? features?.forms_preview ?? true,
    can_download_forms:
      raw?.can_download_forms ?? features?.forms_download ?? isPro,
    can_use_forms_ai_assistant:
      raw?.can_use_forms_ai_assistant ??
      features?.forms_ai_assistant ??
      isPro,

    can_preview_document_generator:
      raw?.can_preview_document_generator ??
      features?.document_generator_preview ??
      true,
    can_generate_documents_full:
      raw?.can_generate_documents_full ??
      features?.document_generator_full ??
      isPro,
    can_download_document_docx:
      raw?.can_download_document_docx ??
      features?.document_docx_download ??
      isPro,

    can_preview_document_review:
      raw?.can_preview_document_review ??
      features?.document_review_preview ??
      true,
    can_review_documents_full:
      raw?.can_review_documents_full ??
      features?.document_review_full ??
      isPro,

    can_use_basic_ai:
      raw?.can_use_basic_ai ?? features?.basic_ai ?? true,
    can_use_advanced_ai:
      raw?.can_use_advanced_ai ??
      features?.advanced_ai ??
      isPro,
    can_use_priority_ai:
      raw?.can_use_priority_ai ??
      features?.priority_ai ??
      isPremium,

    can_export_pdf:
      raw?.can_export_pdf ?? features?.pdf_export ?? isPremium,
    can_use_live_ircc_draws:
      raw?.can_use_live_ircc_draws ?? features?.live_ircc_draws ?? isPremium,
    can_view_processing_times:
      raw?.can_view_processing_times ??
      features?.processing_time_tracker ??
      isPremium,
    can_use_job_opportunity_matching:
      raw?.can_use_job_opportunity_matching ??
      features?.job_opportunity_matching ??
      isPremium,
    can_preview_career_match:
      raw?.can_preview_career_match ??
      features?.career_match_preview ??
      true,
    can_use_full_career_match:
      raw?.can_use_full_career_match ??
      features?.career_match_full ??
      isPro,
    can_save_career_jobs:
      raw?.can_save_career_jobs ??
      features?.career_saved_jobs ??
      isPro,
    can_use_career_advanced_intelligence:
      raw?.can_use_career_advanced_intelligence ??
      features?.career_advanced_intelligence ??
      isPremium,
    can_view_citizenship_study_guide:
      raw?.can_view_citizenship_study_guide ??
      features?.citizenship_study_guide ??
      true,
    can_take_citizenship_practice_quiz:
      raw?.can_take_citizenship_practice_quiz ??
      features?.citizenship_practice_quiz ??
      true,
    can_track_citizenship_progress:
      raw?.can_track_citizenship_progress ??
      features?.citizenship_progress ??
      isPro,
    can_take_citizenship_mock_exam:
      raw?.can_take_citizenship_mock_exam ??
      features?.citizenship_mock_exam ??
      isPremium,
    can_use_language_practice:
      raw?.can_use_language_practice ??
      features?.language_practice ??
      isPremium,
    can_access_self_workspace:
      raw?.can_access_self_workspace ??
      features?.self_workspace ??
      isPro,
    can_access_simulations:
      raw?.can_access_simulations ??
      features?.simulation_access ??
      isPro,
  };
}

export const getBillingAccess = async () => {
  try {
    const res = await api.get("/billing/access");
    return { data: saveBillingAccess(res.data) };
  } catch (err) {
    console.warn("Billing access fallback triggered", err);
    const cached = getCachedBillingAccess();
    if (cached) {
      return { data: cached };
    }

    return {
      data: normalizeAccess({
        plan: "free",
        is_free: true,
        is_pro: false,
        is_premium: false,
        features: {},
      }),
    };
  }
};

export const getMyAccess = getBillingAccess;

export const getAppBootstrap = async () => {
  const res = await api.get("/app/bootstrap");
  const access = res.data?.access
    ? saveBillingAccess(res.data.access)
    : getCachedBillingAccess() || normalizeAccess();
  if (res.data?.user) {
    saveCurrentUser(res.data.user);
  }
  return {
    data: {
      ...res.data,
      access,
    },
  };
};

/* =========================
   CITIZENSHIP COACH
========================= */

export const getCitizenshipStudyGuide = (language = getLanguage()) =>
  api.get("/citizenship/study-guide", { params: { language } });

export const getCitizenshipQuestions = ({
  language = getLanguage(),
  mode = "practice",
  limit = 10,
  section,
} = {}) =>
  api.get("/citizenship/questions", {
    params: {
      language,
      mode,
      limit,
      ...(section ? { section } : {}),
    },
  });

export const submitCitizenshipQuiz = (payload) =>
  api.post("/citizenship/quiz-attempts", payload);

export const getCitizenshipProgress = () =>
  api.get("/citizenship/progress");

export const getLanguagePracticePrompts = (language = getLanguage()) =>
  api.get("/citizenship/language-prompts", { params: { language } });

export const getLanguagePracticeSessions = () =>
  api.get("/citizenship/language-sessions");

export const createLanguagePracticeSession = (payload) =>
  api.post("/citizenship/language-sessions", payload);

/* =========================
   CAREER MATCH
========================= */

export const runCareerMatch = (payload) =>
  api.post("/career-match/match", payload);

export const getSavedCareerJobs = () =>
  api.get("/career-match/saved-jobs");

export const saveCareerJob = (payload) =>
  api.post("/career-match/saved-jobs", payload);

export const deleteSavedCareerJob = (jobId) =>
  api.delete(`/career-match/saved-jobs/${jobId}`);

/* =========================
   DISCLOSURE
========================= */

export const acceptDisclosure = (payload) =>
  api.post("/disclosures/accept", payload);

export const getDisclosureRequirements = () =>
  api.get("/disclosures/requirements");

export const getDisclosureStatus = (params = {}) =>
  api.get("/disclosures/status", { params });

export const getMyDisclosures = (params = {}) =>
  api.get("/disclosures/mine", { params });

export const getLatestDisclosureAcceptance = ({
  disclosure_type,
  client_id,
  matter_id,
}) =>
  api.get("/disclosures/latest", {
    params: {
      disclosure_type,
      client_id,
      matter_id,
    },
  });

/* =========================
   AUTH
========================= */

export const registerUser = (payload) => api.post("/auth/register", payload);
export const requestEmailConfirmation = (email) =>
  api.post("/auth/request-email-confirmation", { email });
export const confirmEmail = (token) => api.post("/auth/confirm-email", { token });
export const requestPasswordReset = (email) =>
  api.post("/auth/request-password-reset", { email });
export const resetPassword = ({ token, password }) =>
  api.post("/auth/reset-password", { token, password });

export const loginUser = async ({ email, password }) => {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const res = await api.post("/auth/login", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (res.data?.access_token) {
    saveToken(res.data.access_token);
  }

  if (res.data?.user) {
    saveCurrentUser(res.data.user);
  }

  return res;
};

export const getMe = () => api.get("/auth/me");

export const refreshCurrentUser = async () => {
  const response = await getMe();
  const user = response.data;
  saveCurrentUser(user);
  return response;
};

/* =========================
   BILLING
========================= */

export const getBillingStatus = () => api.get("/billing/me");

export const getAvailablePlans = () => api.get("/billing/plans");
export const getBillingPlans = getAvailablePlans;

export const getBillingTransactions = () => api.get("/billing/transactions");

export const devSetPlan = (planOrPayload, subscription_status = "active") => {
  const payload =
    typeof planOrPayload === "object" && planOrPayload !== null
      ? planOrPayload
      : { plan: planOrPayload, subscription_status };

  return api.post("/billing/dev/set-plan", payload);
};

export const createCheckoutSession = (planOrPayload) => {
  const payload =
    typeof planOrPayload === "object" && planOrPayload !== null
      ? planOrPayload
      : { plan: planOrPayload };

  return api.post("/billing/create-checkout-session", payload);
};

export const syncCheckoutSession = (sessionId) =>
  api.post("/billing/sync-checkout-session", { session_id: sessionId });

export const createPortalSession = () =>
  api.post("/billing/create-portal-session");

export const createBillingPortalSession = createPortalSession;

export const cancelSubscription = () =>
  api.post("/billing/cancel-subscription");

export const redeemPromoCode = (code) =>
  api.post("/billing/redeem-code", { code });

export const getAdminPromoCodes = () =>
  api.get("/billing/admin/promo-codes");

export const createAdminPromoCode = (payload) =>
  api.post("/billing/admin/promo-codes", payload);

export const updateAdminPromoCode = (promoCodeIdentifier, payload) =>
  api.patch(
    `/billing/admin/promo-codes/${encodeURIComponent(promoCodeIdentifier)}`,
    payload
  );

/* =========================
   PERSONAL PROFILE
========================= */

export const normalizeProfilePayload = (payload = {}) => {
  const normalized = {
    ...payload,
    first_name: payload.first_name?.trim() || null,
    last_name: payload.last_name?.trim() || null,
    nationality: payload.nationality?.trim() || null,
    current_country: payload.current_country?.trim() || null,
    current_city: payload.current_city?.trim() || null,
    phone_number: payload.phone_number?.trim() || null,
    date_of_birth: payload.date_of_birth || null,
    marital_status: payload.marital_status || null,
    preferred_language:
      String(payload.preferred_language || getLanguage()).toLowerCase().startsWith("fr")
        ? "fr"
        : "en",

    age:
      payload.age === "" || payload.age === null || payload.age === undefined
        ? null
        : Number(payload.age),

    language_score:
      payload.language_score === "" ||
      payload.language_score === null ||
      payload.language_score === undefined
        ? null
        : Number(payload.language_score),

    english_language_score:
      payload.english_language_score === "" ||
      payload.english_language_score === null ||
      payload.english_language_score === undefined
        ? null
        : Number(payload.english_language_score),

    french_language_score:
      payload.french_language_score === "" ||
      payload.french_language_score === null ||
      payload.french_language_score === undefined
        ? null
        : Number(payload.french_language_score),

    experience_years:
      payload.experience_years === "" ||
      payload.experience_years === null ||
      payload.experience_years === undefined
        ? null
        : Number(payload.experience_years),

    education: payload.education?.trim() || null,
    occupation: payload.occupation?.trim() || null,
    noc_code: payload.noc_code?.trim() || null,

    job_description: payload.job_description?.trim() || null,
    job_duties: payload.job_duties?.trim() || null,

    preferred_province: payload.preferred_province || null,

    has_job_offer: Boolean(payload.has_job_offer),
    has_canadian_experience: Boolean(payload.has_canadian_experience),
    studied_in_canada: Boolean(payload.studied_in_canada),
  };

  return normalized;
};

export const getMyProfile = () => api.get("/profiles/me");

/* Auto-created at registration now */
export const createProfile = (payload) =>
  api.put("/profiles/me", normalizeProfilePayload(payload));

export const saveMyProfile = (payload) =>
  api.put("/profiles/me", normalizeProfilePayload(payload));

export const updateMyProfile = (payload) =>
  api.put("/profiles/me", normalizeProfilePayload(payload));

/* =========================
   SELF WORKSPACE
========================= */

export const getSelfApplicationContext = () => api.get("/self/application");

export const runSelfEligibility = (payload) =>
  api.post("/self/eligibility", payload);

export const runSelfFormsAssistant = (payload) =>
  api.post("/self/forms-assistant", payload);

export const runSelfChecklist = (payload) =>
  api.post("/self/checklist", payload);

export const runSelfWorkspace = (payload, language = getLanguage()) =>
  api.post(`/self/workspace?language=${language}`, payload);

export const getSavedSelfApplication = () =>
  api.get("/self/application/saved");

export async function saveSelfApplication(
  payload,
  language = getLanguage()
) {
  const inferredMatterType =
    payload?.matter_type ||
    payload?.application_type ||
    payload?.intake_payload?.application_type ||
    "permanent_residence";

  const intake =
    payload?.intake ||
    payload?.intake_payload ||
    payload ||
    {};

  return runSelfWorkspace(
    {
      matter_type: inferredMatterType,
      intake,
    },
    language
  );
}

/* =========================
   PRICING NAV HELPERS
========================= */

export const buildProPricingPath = (
  source = "app",
  intent = "upgrade"
) => `/pricing?plan=pro&source=${source}&intent=${intent}`;

export const buildPremiumPricingPath = (
  source = "app",
  intent = "export"
) => `/pricing?plan=premium&source=${source}&intent=${intent}`;

/* =========================
   SELF DOCUMENTS
========================= */

export const getSelfDocuments = (matterType) =>
  api.get("/self-documents", {
    params: matterType ? { matter_type: matterType } : {},
  });

export const createSelfDocument = (payload) =>
  api.post("/self-documents", payload);

export const updateSelfDocument = (documentId, payload) =>
  api.put(`/self-documents/${documentId}`, payload);

export const deleteSelfDocument = (documentId) =>
  api.delete(`/self-documents/${documentId}`);

export const uploadSelfDocumentFile = (documentId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post(`/self-documents/${documentId}/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const downloadSelfDocumentFile = (documentId) =>
  api.get(`/self-documents/${documentId}/file`, {
    responseType: "blob",
  });

export const removeSelfDocumentFile = (documentId) =>
  api.delete(`/self-documents/${documentId}/file`);

export const getDocuments = () => {
  const caseId = getActiveCaseId();
  return api.get(`/documents?case_id=${caseId}`);
};

/* =========================
   PERSONAL STRATEGY
========================= */

function strategyParams(language = getLanguage()) {
  const caseId = getActiveCaseId();

  return {
    language,
    ...(caseId ? { case_id: caseId } : {}),
  };
}

export const getMyStrategy = (language = getLanguage()) =>
  api.get("/self/strategy", {
    params: strategyParams(language),
  });

export const refreshStrategy = (language = getLanguage()) =>
  getMyStrategy(language);

export const exportMyStrategyPdf = (language = getLanguage()) =>
  api.get("/self/strategy/export-pdf", {
    params: strategyParams(language),
    responseType: "blob",
  });

export const downloadStrategyReport = exportMyStrategyPdf;

export const getMyStrategyLite = (language = getLanguage()) =>
  api.get("/self/strategy", {
    params: strategyParams(language),
  });

export const getImmigrationIntelligence = (language = getLanguage()) =>
  api.get("/immigration-intelligence/summary", {
    params: { language },
  });

export const getImmigrationProcessingTimes = (
  { application_type, country } = {},
  language = getLanguage()
) =>
  api.get("/immigration-intelligence/processing-times", {
    params: {
      language,
      ...(application_type ? { application_type } : {}),
      ...(country ? { country } : {}),
    },
  });

/* =========================
   JOURNEY
========================= */

export const getMyJourney = (language = getLanguage()) =>
  api.get("/journey/me", {
    params: { language },
  });

/* =========================
   AI ASSISTANT
========================= */

export const sendAIMessage = ({
  message,
  chat_history = [],
  language = getLanguage(),
}) =>
  api.post("/ai/chat", {
    message: (message || "").trim(),
    chat_history,
    language: language === "fr" ? "fr" : "en",
  });

/* ===============================
   AI DOCUMENT GENERATOR
=============================== */

export const generateAIDocument = (payload) =>
  api.post("/ai/generate-document", payload);

export const downloadAIDocumentDocx = (payload) =>
  api.post("/ai/generate-document/docx", payload, {
    responseType: "blob",
  });

export const generateDocument = generateAIDocument;

export const fixAIDocumentIssues = (payload) =>
  api.post("/ai/generate-document", {
    ...payload,
    mode: "fix_all",
  });

export const improveAIDocumentIntro = (payload) =>
  api.post("/ai/generate-document", {
    ...payload,
    mode: "improve_intro",
  });

export const improveAIDocumentBody = (payload) =>
  api.post("/ai/generate-document", {
    ...payload,
    mode: "improve_body",
  });

export const improveAIDocumentConclusion = (payload) =>
  api.post("/ai/generate-document", {
    ...payload,
    mode: "improve_conclusion",
  });

export const scoreAIDocumentConfidence = (payload) =>
  api.post("/ai/generate-document", {
    ...payload,
    mode: "confidence",
  });

/* ===============================
   AI DOCUMENT ENHANCEMENTS
=============================== */

export const explainAIDocument = (payload) =>
  api.post("/ai/generate-document", {
    ...payload,
    mode: "explain",
  });

export const makeAIDocumentOfficerReady = (payload) =>
  api.post("/ai/generate-document", {
    ...payload,
    mode: "officer_ready",
  });

export const generateAIDocumentSections = (payload) =>
  api.post("/ai/generate-document", {
    ...payload,
    mode: "sections",
  });

/* Backward/forward-compatible aliases */
export const explainDocument = explainAIDocument;
export const makeDocumentOfficerReady = makeAIDocumentOfficerReady;
export const generateDocumentSections = generateAIDocumentSections;

/* ===============================
   AI DOCUMENT EXPORT (PDF)
=============================== */

export const exportAIDocumentPdf = (payload) =>
  api.post("/ai/generate-document/pdf", payload, {
    responseType: "blob",
  });

export const exportDocumentPdf = exportAIDocumentPdf;

/* =========================
   DOCUMENT REVIEW AI
========================= */

export const reviewAIDocument = async (payload) => {
  try {
    return await api.post("/documents/review", payload);
  } catch (err) {
    console.error("Document review failed", err);
    throw err;
  }
};

/* =========================
   SAVED GENERATED DOCUMENTS
========================= */

export const getSavedDocuments = () => api.get("/documents");

export const getDocument = (id) => api.get(`/documents/${id}`);

export const createDocument = (payload) => api.post("/documents", payload);

export const updateDocument = (id, payload) =>
  api.put(`/documents/${id}`, payload);

export const duplicateDocument = (id) =>
  api.post(`/documents/${id}/duplicate`);

export const deleteDocument = (id) => api.delete(`/documents/${id}`);

/* =========================
   FORMS STUDIO
========================= */

export const getFormsApplicationTypes = (language = getLanguage()) =>
  api.get(`/forms/application-types?language=${language}`);

export const previewFormsPackage = (payload) =>
  api.post("/forms/package/preview", payload);

export const downloadFormsPackage = (payload) =>
  api.post("/forms/package/download", payload, {
    responseType: "blob",
  });

/* =========================
   NOC
========================= */

function getSavedAppLanguage() {
  if (typeof window === "undefined") return "en";
  const savedLanguage =
    window.localStorage.getItem("i18nextLng") ||
    window.localStorage.getItem("language") ||
    "en";
  return String(savedLanguage).toLowerCase().startsWith("fr") ? "fr" : "en";
}

export const suggestNOC = (payload) =>
  api.post("/noc/suggest", {
    occupation: payload?.occupation?.trim() || "",
    job_description: payload?.job_description?.trim() || "",
    duties: Array.isArray(payload?.duties)
      ? payload.duties
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [],
    top_k: payload?.top_k || 3,
    language: payload?.language || getSavedAppLanguage(),
  });

export const getNOCDetails = (nocCode) => api.get(`/noc/${nocCode}`);

/* =========================
   CLIENTS
========================= */

export const getClients = () => api.get("/clients/");

export const getClientById = (clientId) => api.get(`/clients/${clientId}`);

export const createClient = (payload) => api.post("/clients/", payload);

export const updateClient = (clientId, payload) =>
  api.put(`/clients/${clientId}`, payload);

export const deleteClient = (clientId) => api.delete(`/clients/${clientId}`);

export const getClientOverview = (clientId) =>
  api.get(`/clients/${clientId}/overview`);

/* =========================
   VERIFY HELPER
========================= */

export const verifyClientDocument = (clientId, documentId) =>
  updateClientDocument(clientId, documentId, { status: "Verified" });

export const unverifyClientDocument = (clientId, documentId) =>
  updateClientDocument(clientId, documentId, { status: "Uploaded" });

/* =========================
   CLIENT PROFILE
========================= */

export const getClientProfile = (clientId) =>
  api.get(`/clients/${clientId}/profile`);

export const createClientProfile = (clientId, payload) =>
  api.post(`/clients/${clientId}/profile`, payload);

export const updateClientProfile = (clientId, payload) =>
  api.put(`/clients/${clientId}/profile`, payload);

export const deleteClientProfile = (clientId) =>
  api.delete(`/clients/${clientId}/profile`);

/* =========================
   CLIENT STRATEGY
========================= */

export const getClientStrategy = (clientId) =>
  api.get(`/client-strategy/${clientId}`);

export const downloadClientStrategyReport = (clientId) =>
  api.get(`/client-strategy/${clientId}/report`, {
    responseType: "blob",
    headers: {
      Accept: "application/pdf,text/html,application/json,text/plain",
    },
  });

/* =========================
   CLIENT DOCUMENTS
========================= */

export const getClientDocuments = (clientId) =>
  api.get(`/client-documents/${clientId}`);

export const createClientDocument = (clientId, payload) =>
  api.post(`/client-documents/${clientId}`, payload);

export const updateClientDocument = (clientId, documentId, payload) =>
  api.put(`/client-documents/${clientId}/${documentId}`, payload);

export const deleteClientDocument = (clientId, documentId) =>
  api.delete(`/client-documents/${clientId}/${documentId}`);

export const generateMatterDocuments = (clientId, matterId, payload) =>
  api.post(`/client-documents/${clientId}/matters/${matterId}/generate`, payload);

export const uploadClientDocumentFile = (clientId, documentId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post(`/client-documents/${clientId}/${documentId}/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const downloadClientDocumentFile = (clientId, documentId) =>
  api.get(`/client-documents/${clientId}/${documentId}/file`, {
    responseType: "blob",
  });

export const removeClientDocumentFile = (clientId, documentId) =>
  api.delete(`/client-documents/${clientId}/${documentId}/file`);

/* =========================
   CLIENT SIMULATIONS
========================= */

export const runClientSimulation = (clientId, payload) =>
  api.post(`/client-simulations/${clientId}/run`, payload);

export const getClientSimulations = (clientId) =>
  api.get(`/clients/${clientId}/simulations`);

export const getClientSimulationById = (clientId, simulationId) =>
  api.get(`/clients/${clientId}/simulations/${simulationId}`);

export const createClientSimulation = (clientId, payload) =>
  api.post(`/clients/${clientId}/simulations`, payload);

export const updateClientSimulation = (clientId, simulationId, payload) =>
  api.put(`/clients/${clientId}/simulations/${simulationId}`, payload);

export const deleteClientSimulation = (clientId, simulationId) =>
  api.delete(`/clients/${clientId}/simulations/${simulationId}`);

export const compareClientSimulations = (clientId, payload) =>
  api.post(`/clients/${clientId}/simulations/compare`, payload);

export const downloadClientSimulationReport = (clientId, simulationId) =>
  api.get(`/clients/${clientId}/simulations/${simulationId}/report`, {
    responseType: "blob",
    headers: {
      Accept: "application/pdf",
    },
  });

export const downloadSimulationComparisonReport = (clientId, payload) =>
  api.post(`/clients/${clientId}/simulations/compare/report`, payload, {
    responseType: "blob",
    headers: {
      Accept: "application/pdf",
    },
  });

/* =========================
   CLIENT MATTERS
========================= */

export const getClientMatters = (clientId) =>
  api.get(`/clients/${clientId}/matters`);

export const getClientMatterById = (clientId, matterId) =>
  api.get(`/clients/${clientId}/matters/${matterId}`);

export const createClientMatter = (clientId, payload) =>
  api.post(`/clients/${clientId}/matters`, payload);

export const updateClientMatter = (clientId, matterId, payload) =>
  api.put(`/clients/${clientId}/matters/${matterId}`, payload);

export const deleteClientMatter = (clientId, matterId) =>
  api.delete(`/clients/${clientId}/matters/${matterId}`);

/* =========================
   LEGACY COMPATIBILITY
========================= */

export const getClient = getClientById;

export const saveClientProfile = async (clientId, payload) => {
  try {
    return await updateClientProfile(clientId, payload);
  } catch (err) {
    if (err.response?.status === 404) {
      return createClientProfile(clientId, payload);
    }
    throw err;
  }
};

/* =========================
   HOUSEHOLD
========================= */

export const getMyHousehold = () => api.get("/households/me");

export const createHousehold = (payload) =>
  api.post("/households", payload);

export const getHouseholdMembers = () =>
  api.get("/households/members");

export const addHouseholdMember = (payload) =>
  api.post("/households/members", payload);

export const updateHouseholdMember = (memberId, payload) =>
  api.put(`/households/members/${memberId}`, payload);

/* =========================
   APPLICATION CASES
========================= */

export const getApplicationCases = () =>
  api.get("/application-cases");

export const createApplicationCase = (payload) =>
  api.post("/application-cases", payload);

export const getApplicationCase = (caseId) =>
  api.get(`/application-cases/${caseId}`);

export const updateApplicationCase = (caseId, payload) =>
  api.put(`/application-cases/${caseId}`, payload);
