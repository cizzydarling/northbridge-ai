import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

/* =========================
   DISCLOSURE
========================= */

export const acceptDisclosure = (payload) =>
  api.post("/disclosures/accept", payload);

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

export const getMyDisclosures = (params = {}) =>
  api.get("/disclosures/mine", { params });

/* =========================
   TOKEN + USER HELPERS
========================= */

export const getToken = () => localStorage.getItem("token");

export const setToken = (token) => {
  localStorage.setItem("token", token);
};

export const removeToken = () => {
  localStorage.removeItem("token");
};

export const getCurrentUserLocal = () => {
  const raw = localStorage.getItem("current_user");
  return raw ? JSON.parse(raw) : null;
};

export const setCurrentUserLocal = (user) => {
  localStorage.setItem("current_user", JSON.stringify(user));
};

export const removeCurrentUserLocal = () => {
  localStorage.removeItem("current_user");
};

export const logoutUser = () => {
  removeToken();
  removeCurrentUserLocal();
};

export const getLanguage = () => {
  return localStorage.getItem("language") || "en";
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
   AUTH
========================= */

export const registerUser = (payload) => api.post("/auth/register", payload);

export const loginUser = async ({ email, password }) => {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  return api.post("/auth/login", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const getMe = () => api.get("/auth/me");

export const refreshCurrentUser = async () => {
  const response = await getMe();
  const user = response.data;
  setCurrentUserLocal(user);
  return user;
};

/* =========================
   BILLING
========================= */

export const getBillingStatus = () => api.get("/billing/me");

export const getAvailablePlans = () => api.get("/billing/plans");

export const devSetPlan = (plan, subscription_status = "active") =>
  api.post("/billing/dev/set-plan", { plan, subscription_status });

export const createCheckoutSession = (plan) =>
  api.post("/billing/create-checkout-session", { plan });

export const createBillingPortalSession = () =>
  api.post("/billing/create-portal-session");

/* =========================
   PERSONAL PROFILE
========================= */

export const getMyProfile = () => api.get("/profiles/me");
export const createProfile = (payload) => api.post("/profiles/create", payload);
export const updateMyProfile = (payload) => api.put("/profiles/me", payload);
export const getSelfApplicationContext = () => api.get("/self/application");

export const runSelfEligibility = (payload) =>
  api.post("/self/eligibility", payload);

export const runSelfFormsAssistant = (payload) =>
  api.post("/self/forms-assistant", payload);

export const runSelfChecklist = (payload) =>
  api.post("/self/checklist", payload);

export const runSelfWorkspace = (payload, language = getLanguage()) =>
  api.post("/self/workspace", payload, {
    params: { language },
  });

export const getSavedSelfApplication = () =>
  api.get("/self/application/saved");

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
  api.get("/strategy/me", {
    params: { language },
  });

export const refreshStrategy = (language = getLanguage()) =>
  api.get("/strategy/me", {
    params: { language },
  });

export const downloadStrategyReport = (language = getLanguage()) =>
  api.get("/strategy/report", {
    params: { language },
    responseType: "blob",
    headers: {
      Accept: "application/pdf,text/html,application/json,text/plain",
    },
  });

/* =========================
   GPS / JOURNEY ENGINE
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
    message,
    chat_history,
    language,
  });

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
   CLIENT HELPERS
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