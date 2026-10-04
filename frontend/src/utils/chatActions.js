// Defense in depth: chat actions are owned by the backend, never arbitrary URLs.
export function openChatAction(route, navigate) {
  if (typeof route !== "string") return;
  if (route.startsWith("/") && !route.startsWith("//") && !route.includes("\\")) {
    navigate(route);
    return;
  }
  try {
    const url = new URL(route);
    if (url.protocol === "https:" && ["www.canada.ca", "noc.esdc.gc.ca"].includes(url.hostname)
        && !url.username && !url.password && !url.port) {
      window.open(url.href, "_blank", "noopener,noreferrer");
    }
  } catch { /* Invalid actions are not navigation targets. */ }
}
