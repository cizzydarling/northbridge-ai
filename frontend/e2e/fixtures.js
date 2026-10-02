import { test as base, expect } from "@playwright/test";

// A built bundle can retain a deployment URL despite webServer environment overrides.
// Browser journeys must never reach external services, including production.
export const test = base.extend({
  localOnly: [async ({ context }, use) => {
    const externalOrigins = new Set();
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        return route.continue();
      }
      externalOrigins.add(url.origin);
      return route.abort("blockedbyclient");
    });
    await use();
    expect([...externalOrigins], "Browser tests attempted external requests").toEqual([]);
  }, { auto: true }],
});

export { expect };
