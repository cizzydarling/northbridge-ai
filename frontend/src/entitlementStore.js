// Only authenticated billing/bootstrap responses may publish access. Nothing is
// hydrated from localStorage: a new page load must verify the current session.
let state = { status: "unknown", access: null };
let session = null;
let revision = 0;
const listeners = new Set();
function publish(next) {
  state = next;
  listeners.forEach((listener) => listener());
}
export const getEntitlementState = () => state;
export const subscribeEntitlements = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function resetEntitlements(key = null) {
  session = key;
  revision += 1;
  publish({ status: "unknown", access: null });
}
export function beginEntitlements(key) {
  if (session !== key) resetEntitlements(key);
  const ticket = { key, revision: ++revision };
  publish({ status: "loading", access: null });
  return ticket;
}
export function finishEntitlements(ticket, access) {
  if (ticket.key !== session || ticket.revision !== revision) return false;
  if (!access || typeof access.is_pro !== "boolean" || typeof access.is_premium !== "boolean" || !access.features) {
    failEntitlements(ticket);
    throw new Error("Invalid entitlement response");
  }
  publish({ status: access.is_pro || access.is_premium ? "verified_paid" : "verified_free", access });
  return true;
}
export function failEntitlements(ticket) {
  if (ticket.key === session && ticket.revision === revision) publish({ status: "error", access: null });
}
