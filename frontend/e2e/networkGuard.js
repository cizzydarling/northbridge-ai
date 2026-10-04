const hosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const ports = new Set(["8010", "4173"]);
export function isAllowedTestURL(value) {
  try {
    const url = new URL(value);
    return ["http:", "ws:"].includes(url.protocol) && hosts.has(url.hostname) && ports.has(url.port);
  } catch { return false; }
}
const guarded = new WeakSet();
export function guardAPI(request) {
  if (guarded.has(request)) return request;
  guarded.add(request);
  for (const method of ["get", "post", "put", "patch", "delete", "head", "fetch"]) {
    const original = request[method].bind(request);
    request[method] = async (url, options = {}) => {
      if (!isAllowedTestURL(typeof url === "string" ? url : url.url())) throw new Error("TEST API destination is not allowlisted");
      // Redirects must not escape the allowlist inside the Playwright driver.
      return original(url, { ...options, maxRedirects: 0 });
    };
  }
  return request;
}
