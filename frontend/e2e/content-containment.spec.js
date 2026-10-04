import { test, expect } from "./fixtures";

const api = "http://127.0.0.1:8010";
for (const language of ["en", "fr"]) {
  test(`content containment ${language}: handoff, simulator and drafts`, async ({ page, request }) => {
    test.setTimeout(180000);
    const email = `containment-${Date.now()}@example.com`;
    const password = "Containment-test-2026!";
    expect((await request.post(`${api}/auth/register`, { data: { email, password } })).status()).toBe(200);
    const session = await (await request.post(`${api}/auth/login`, { form: { username: email, password } })).json();
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const requirements = await (await request.get(`${api}/disclosures/requirements`)).json();
    for (const item of requirements.required_disclosures) {
      expect((await request.post(`${api}/disclosures/accept`, { headers, data: item })).status()).toBe(200);
    }
    expect((await request.put(`${api}/profiles/me`, { headers, data: {
      first_name: "Test", last_name: "Owner", age: 30, education: "master", language_score: 9,
      experience_years: 3, occupation: "Administrative officer", noc_code: "13100",
      nationality: "France", current_country: "France", current_city: "Paris", marital_status: "single",
      preferred_language: language, english_language_score: 9, preferred_province: "Ontario",
    } })).status()).toBe(200);
    expect((await request.get(`${api}/application-cases/context`, { headers })).status()).toBe(200);
    await page.goto("/auth");
    await page.evaluate(({ session, language }) => {
      localStorage.setItem("token", session.access_token);
      localStorage.setItem("current_user", JSON.stringify(session.user));
      localStorage.setItem("user", JSON.stringify(session.user));
      localStorage.setItem("language", language);
      localStorage.setItem("i18nextLng", language);
    }, { session, language });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    for (const path of ["/strategy", "/strategy/simulator"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const link = page.locator('a[href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html"]');
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect(page.locator("main").last()).not.toContainText(/\+28|\+50|\+600|\d+\s*%/);
      // Validate the handoff without permitting external traffic in browser tests.
      expect(new URL(await link.getAttribute("href")).hostname).toBe("www.canada.ca");
    }
    await page.goto("/forms");
    await expect(page.locator("h1").first()).toBeVisible();
    await page.getByRole("button", { name: language === "fr" ? "Prévisualiser le dossier" : "Preview package", exact: true }).first().click();
    await expect(page.getByText(language === "fr" ? "Progression de la collecte NorthBridgeAI" : "NorthBridgeAI intake progress", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(language === "fr" ? "Votre dossier est prêt" : "Your forms package is ready", { exact: true })).toHaveCount(0);
    await page.goto("/documents");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(/Not all required documents|Tous les documents requis/)).toHaveCount(0);
    await page.goto("/profile");
    await page.getByRole("button", { name: language === "fr" ? "Assistant CNP" : "NOC Assistant", exact: true }).first().click();
    const nocResponse = page.waitForResponse(response => response.url().includes("/noc/suggest") && response.request().method() === "POST");
    await page.getByRole("button", { name: language === "fr" ? "Suggérer un CNP" : "Suggest NOC", exact: true }).click();
    const noc = await nocResponse;
    expect(noc.status()).toBe(200);
    const suggestion = await noc.json();
    expect(suggestion.classification_status).toBe("suggested_match_requires_duties_review");
    expect(suggestion.immigration_flags).toBeUndefined();
    await expect(page.getByText(language === "fr" ? "CNP suggéré" : "Suggested NOC", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
