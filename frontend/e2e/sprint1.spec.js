import { test, expect } from "./fixtures";
import { mkdir } from "node:fs/promises";
import process from "node:process";
import { Buffer } from "node:buffer";

const api = "http://127.0.0.1:8010";
const evidence = process.env.SPRINT_EVIDENCE_DIR || "test-results/sprint1-screenshots";

async function prepare(page, request, lang) {
  const email = `sprint-${Date.now()}-${lang}@example.com`;
  const password = "Synthetic-sprint-2026!";
  expect((await request.post(`${api}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const login = await request.post(`${api}/auth/login`, { form: { username: email, password } });
  expect(login.status()).toBe(200);
  const session = await login.json();
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const requirements = (await (await request.get(`${api}/disclosures/requirements`)).json()).required_disclosures;
  for (const disclosure of requirements) expect((await request.post(`${api}/disclosures/accept`, { headers, data: disclosure })).status()).toBe(200);
  expect((await request.put(`${api}/profiles/me`, { headers, data: { first_name: "Sprint", last_name: "Synthetic", nationality: "France", current_country: "France", current_city: "Paris", marital_status: "single", preferred_language: lang, age: 28, education: "bachelor", english_language_score: null, french_language_score: null, experience_years: 3, occupation: "Administrative officer", noc_code: "13100", preferred_province: "Ontario" } })).status()).toBe(200);
  // Initialize serially: PostgreSQL locking is tested separately from SQLite E2E.
  expect((await request.get(`${api}/application-cases/context`, { headers })).status()).toBe(200);
  const created = await request.post(`${api}/application-cases`, { headers, data: { application_type: "study_permit", case_title: "Synthetic preparation" } });
  expect(created.status()).toBe(200);
  const active = await created.json();
  await page.goto("/auth");
  await page.evaluate(({ session, lang }) => {
    localStorage.setItem("token", session.access_token);
    localStorage.setItem("current_user", JSON.stringify(session.user));
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("language", lang); localStorage.setItem("i18nextLng", lang);
  }, { session, lang });
  return { headers, active, email, password };
}

for (const lang of ["en", "fr"]) test(`Sprint 1 ${lang}: household documents forms save return and responsive navigation`, async ({ page, request }) => {
  test.setTimeout(240000);
  const fr = lang === "fr";
  const { headers, active, email, password } = await prepare(page, request, lang);
  await page.evaluate(() => { localStorage.removeItem("token"); localStorage.removeItem("current_user"); localStorage.removeItem("user"); });
  await page.goto("/auth");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/household");
  await expect(page.getByRole("heading", { name: fr ? "Ménage" : "Household", exact: true })).toBeVisible();
  await page.getByRole("button", { name: fr ? "Compris" : "Got it", exact: true }).click();
  await page.getByLabel(fr ? "Prénom" : "Given name", { exact: true }).fill("Synthetic child");
  await page.getByLabel(fr ? "Lien familial" : "Relationship", { exact: true }).selectOption("child");
  await page.getByRole("button", { name: fr ? "Enregistrer le membre" : "Save member", exact: true }).click();
  await expect(page.getByText("Synthetic child", { exact: true })).toBeVisible();
  await page.goto("/applications");
  await page.getByLabel("Synthetic child participation", { exact: true }).selectOption("unknown");
  await page.getByRole("button", { name: fr ? "Enregistrer la demande" : "Save application", exact: true }).click();
  await expect.poll(async () => (await (await request.get(`${api}/application-cases/context`, { headers })).json()).family_size).toBe(2);
  await page.goto("/documents");
  const family = page.locator("section").filter({ has: page.getByRole("heading", { name: fr ? "Documents familiaux" : "Family documents", exact: true }) });
  await expect(family.getByLabel(fr ? "Examiné pour ce membre" : "Reviewed for this member")).toBeEnabled();
  await page.route("**/self-documents/*", route => route.request().method() === "PUT" ? route.fulfill({ status: 503, json: { detail: "synthetic save failure" } }) : route.continue());
  const review = family.getByRole("checkbox");
  await review.click();
  await expect(family.getByRole("alert")).toContainText(fr ? "pas confirmées" : "not been confirmed");
  await expect(review).not.toBeChecked();
  await expect(review).toBeEnabled();
  const failedReviewRecords = await (await request.get(`${api}/self-documents/?matter_type=case_${active.id}`, { headers })).json();
  expect(failedReviewRecords).toHaveLength(1);
  expect(failedReviewRecords[0].completed).toBe(false);
  await page.unroute("**/self-documents/*");
  const content = Buffer.from("%PDF-1.4\nSynthetic local document\n%%EOF");
  await family.locator('input[type="file"]').setInputFiles({ name: "synthetic.pdf", mimeType: "application/pdf", buffer: content });
  await expect(family.getByRole("button", { name: "synthetic.pdf", exact: true })).toBeVisible();
  await family.getByText(fr ? "Aperçu des métadonnées du document" : "Preview document metadata", { exact: true }).click();
  await expect(family.getByText(`case_${active.id}`, { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await family.getByRole("button", { name: "synthetic.pdf", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe("synthetic.pdf");
  const records = await (await request.get(`${api}/self-documents/?matter_type=case_${active.id}`, { headers })).json();
  expect(records).toHaveLength(1);
  expect(records[0].completed).toBe(true);
  await page.getByRole("navigation", { name: fr ? "Parcours de préparation" : "Preparation journey" }).getByRole("link", { name: fr ? "Renseignements de préparation" : "Draft information", exact: true }).click();
  const school = page.getByLabel(fr ? "Établissement / école" : "School / Institution", { exact: true });
  await school.fill("Synthetic local college");
  await expect(page.getByTestId("forms-save-status")).toContainText(fr ? "Enregistré sur le serveur" : "Saved to server");
  const saved = await (await request.get(`${api}/self/application/saved?case_id=${active.id}`, { headers })).json();
  expect(saved.intake_payload.school_name).toBe("Synthetic local college");
  await page.goto("/documents");
  await page.goto("/forms");
  await expect(school).toHaveValue("Synthetic local college");
  // Failure is visible; a browser copy must not masquerade as server persistence.
  await page.route("**/self/workspace?*", route => route.fulfill({ status: 503, json: { detail: "synthetic outage" } }));
  await school.fill("Unsynced synthetic edit");
  await expect(page.getByTestId("forms-save-status")).toContainText(fr ? "Non enregistré sur le serveur" : "Not saved to the server");
  expect((await (await request.get(`${api}/self/application/saved?case_id=${active.id}`, { headers })).json()).intake_payload.school_name).toBe("Synthetic local college");
  await page.unroute("**/self/workspace?*");
  await page.getByRole("button", { name: fr ? "Réessayer l’enregistrement" : "Retry save", exact: true }).click();
  await expect(page.getByTestId("forms-save-status")).toContainText(fr ? "Enregistré sur le serveur" : "Saved to server");
  for (const [width, height, size] of [[1440, 1000, "desktop"], [390, 844, "mobile"]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/documents");
    await expect(family.getByRole("button", { name: "synthetic.pdf", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (evidence) { await mkdir(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/documents-${lang}-${size}.png`, fullPage: false }); }
    if (size === "mobile") {
      const open = page.getByRole("button", { name: fr ? "Ouvrir le menu" : "Open menu", exact: true });
      await open.click();
      const dialog = page.getByRole("dialog", { name: fr ? "Menu principal" : "Main menu", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: fr ? "Fermer le menu" : "Close menu", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(open).toBeFocused();
    }
    for (const route of ["/dashboard", "/profile", "/strategy", "/"]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      const contrast = await page.locator("h1").evaluate(node => {
        const rgba = value => { const nums = value.match(/[\d.]+/g).map(Number); return [nums[0], nums[1], nums[2], nums[3] ?? 1]; };
        const blend = (foreground, background) => foreground.slice(0, 3).map((v, i) => v * foreground[3] + background[i] * (1 - foreground[3]));
        const ancestors = []; for (let p = node; p; p = p.parentElement) ancestors.push(p);
        let background = [255, 255, 255];
        for (const p of ancestors.reverse()) background = blend(rgba(getComputedStyle(p).backgroundColor), background);
        const foreground = blend(rgba(getComputedStyle(node).color), background);
        const luminance = color => color.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const a = luminance(foreground), b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(contrast, `${route} heading contrast`).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (evidence) await page.screenshot({ path: `${evidence}/${route.slice(1) || "landing"}-${lang}-${size}.png`, fullPage: false });
    }
  }
});

for (const failure of ["network", "401", "403", "503"]) test(`Sprint 1 list failure ${failure} is not a household or empty-list error`, async ({ page, request }) => {
  await prepare(page, request, "en");
  await page.route("**/self-documents/?*", route => failure === "network" ? route.abort("failed") : route.fulfill({ status: Number(failure), json: { detail: "synthetic failure" } }));
  await page.route(`${api}/self-documents/`, route => failure === "network" ? route.abort("failed") : route.fulfill({ status: Number(failure), json: { detail: "synthetic failure" } }));
  await page.goto("/documents");
  if (failure === "401") {
    await expect(page).toHaveURL(/\/auth/);
    expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
    return;
  }
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Family documents", exact: true })).toBeVisible();
  const family = page.locator("section").filter({ has: page.getByRole("heading", { name: "Family documents", exact: true }) });
  await expect(family.getByRole("alert")).toContainText(failure === "network" ? "Connection failed" : failure === "401" ? "session expired" : failure === "403" ? "not authorized" : "document list");
  await expect(family.getByText("Unable to load family documents.", { exact: true })).toHaveCount(0);
  await page.unroute("**/self-documents/?*"); await page.unroute(`${api}/self-documents/`);
  await family.getByRole("button", { name: "Retry document loading", exact: true }).click();
  await expect(family.getByRole("alert")).toHaveCount(0);
  await expect(family.getByRole("heading", { name: "No family members selected for this application.", exact: true })).toBeVisible();
});
