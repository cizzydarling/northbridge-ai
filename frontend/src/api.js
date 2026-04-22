import axios from "axios";

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

export const saveCurrentUser = (user) => {
  localStorage.setItem("current_user", JSON.stringify(user));
  localStorage.setItem("user", JSON.stringify(user));
  window.dispatchEvent(new Event("userUpdated"));
};

export const setCurrentUserLocal = (user) => {
  saveCurrentUser(user);
};

export const removeCurrentUserLocal = () => {
  localStorage.removeItem("current_user");
  localStorage.removeItem("user");
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
    return { data: normalizeAccess(res.data) };
  } catch (err) {
    console.warn("Billing access fallback triggered", err);

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

/* =========================
   DISCLOSURE
========================= */

export const acceptDisclosure = (payload) =>
  api.post("/disclosures/accept", payload);

export const getDisclosureRequirements = () =>
  api.get("/disclosures/requirements");

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

export const createPortalSession = () =>
  api.post("/billing/create-portal-session");

export const createBillingPortalSession = createPortalSession;

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

export const removeSelfDocumentFile = (documentId) =>
  api.delete(`/self-documents/${documentId}/file`);

/* =========================
   PERSONAL STRATEGY
========================= */

export const getMyStrategy = (language = getLanguage()) =>
  api.get(`/self/strategy?language=${language}`);

export const refreshStrategy = (language = getLanguage()) =>
  getMyStrategy(language);

export const exportMyStrategyPdf = (language = getLanguage()) =>
  api.get(`/self/strategy/export-pdf?language=${language}`, {
    responseType: "blob",
  });

export const downloadStrategyReport = exportMyStrategyPdf;

export const getMyStrategyLite = (language = getLanguage()) =>
  api.get(`/self/strategy?language=${language}`);

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