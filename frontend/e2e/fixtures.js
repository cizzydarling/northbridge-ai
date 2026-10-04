import { test as base, expect } from "@playwright/test";
import { guardAPI, isAllowedTestURL } from "./networkGuard";

export const test = base.extend({
  request: async ({ request }, provide) => {
    await provide(guardAPI(request));
  },
  localOnly: [async ({ context, request }, use) => {
    const externalOrigins = new Set();
    guardAPI(context.request);
    await context.route("**/*", (route) => {
      if (isAllowedTestURL(route.request().url())) return route.continue();
      externalOrigins.add(new URL(route.request().url()).origin);
      return route.abort("blockedbyclient");
    });
    await context.routeWebSocket("**/*", (ws) => {
      if (isAllowedTestURL(ws.url())) return ws.connectToServer();
      externalOrigins.add(new URL(ws.url()).origin);
      ws.close();
    });
    const marker = await request.get("http://127.0.0.1:8010/_test/isolation");
    expect(await marker.json()).toEqual({ environment: "TEST", external_attempts: 0 });
    await request.post("http://127.0.0.1:8010/_test/reset");
    await use();
    expect([...externalOrigins], "Browser tests attempted external requests").toEqual([]);
    const result = await request.get("http://127.0.0.1:8010/_test/isolation");
    expect(await result.json()).toEqual({ environment: "TEST", external_attempts: 0 });
  }, { auto: true }],
});
export { expect };
