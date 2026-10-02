import { expect, test } from "@playwright/test";

test("individual routes ignore stale cases and deferred routes never load", async ({ page, request }) => {
  test.setTimeout(600_000);
  const api = "http://127.0.0.1:8010";
  const email = `isolated-${Date.now()}@example.com`;
  const password = "Soft-launch-test-2026";
  expect((await request.post(`${api}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const login = await request.post(`${api}/auth/login`, { form: { username: email, password } });
  expect(login.status()).toBe(200);
  const session = await login.json();
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const requirements = await (await request.get(`${api}/disclosures/requirements`)).json();
  for (const item of requirements.required_disclosures) {
    expect((await request.post(`${api}/disclosures/accept`, { headers, data: {
      disclosure_type: item.disclosure_type,
      disclosure_version: item.disclosure_version,
      accepted_text_snapshot: item.accepted_text_snapshot,
    } })).status()).toBe(200);
  }
  expect((await request.put(`${api}/profiles/me`, { headers, data: {
    first_name: "Individual", last_name: "Launch", nationality: "France", current_country: "France",
    current_city: "Paris", marital_status: "single", preferred_language: "en", age: 28,
    education: "bachelor", english_language_score: 9, language_score: 9, experience_years: 3,
    occupation: "Administrative officer", noc_code: "13100", preferred_province: "Ontario",
  } })).status()).toBe(200);
  await page.addInitScript(({ session }) => {
    localStorage.setItem("token", session.access_token);
    localStorage.setItem("current_user", JSON.stringify(session.user));
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("nbai_active_application_case_id", "777");
    localStorage.setItem("language", "en");
  }, { session });
  const requests = [];
  const errors = [];
  page.on("request", (req) => { if (req.url().startsWith(api)) requests.push(req.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  const failures = [];
  let verifiedStrategy;
  page.on("response", (res) => { if (res.url().startsWith(api) && res.status() >= 500) failures.push(res.url()); });
  page.on("response", async (res) => {
    if (res.url().startsWith(`${api}/self/strategy?`) && res.status() === 200) {
      verifiedStrategy = await res.json();
    }
  });
  for (const path of ["/dashboard", "/strategy", "/strategy/simulator", "/forms", "/self/application", "/documents"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    // Exercise the real backend, including the existing slow NOC computation.
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('a[href^="/clients"]')).toHaveCount(0);
  }
  expect(verifiedStrategy).toBeTruthy();
  // The following assertions test route isolation. Reuse the real response already
  // verified above, avoiding nine redundant expensive strategy recalculations.
  await page.route("**/self/strategy?**", (route) => route.fulfill({ json: verifiedStrategy }));
  for (const path of ["/clients", "/clients/1", "/clients/1/profile", "/clients/1/strategy",
    "/clients/1/simulations", "/clients/1/documents", "/clients/1/matters"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Welcome back, Individual", exact: true })).toBeVisible();
  }
  expect(requests.some((url) => /\/clients|\/client-/.test(url))).toBe(false);
  // Owned server-resolved case IDs are valid; the stale browser ID must never be used.
  expect(requests.some((url) => new URL(url).searchParams.get("case_id") === "777")).toBe(false);
  expect(requests.some((url) => url.includes("/self/strategy"))).toBe(true);
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});
