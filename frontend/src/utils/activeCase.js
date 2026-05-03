const KEY = "nbai_active_application_case_id";

export function getActiveCaseId() {
  return localStorage.getItem(KEY);
}

export function setActiveCaseId(id) {
  localStorage.setItem(KEY, String(id));
  window.dispatchEvent(new Event("nbai-active-case-updated"));
}