import { test, expect } from "./fixtures";
import { mkdir, readFile } from "node:fs/promises";
import process from "node:process";

const api = "http://127.0.0.1:8010";
const evidence = process.env.SPRINT2_EVIDENCE_DIR;

async function prepare(page, request, lang, { paid = true, admin = false } = {}) {
  const email = `sprint2-${Date.now()}-${lang}@example.com`;
  const password = "Synthetic-local-Sprint2-2026!";
  expect((await request.post(`${api}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const session = await (await request.post(`${api}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const requirements = (await (await request.get(`${api}/disclosures/requirements`)).json()).required_disclosures;
  for (const d of requirements) expect((await request.post(`${api}/disclosures/accept`, { headers, data: d })).status()).toBe(200);
  expect((await request.put(`${api}/profiles/me`, { headers, data: { first_name: "Synthetic", last_name: "Sprint Two", age: 28, nationality: "France", current_country: "France", current_city: "Paris", marital_status: "single", preferred_language: lang, education: "bachelor", english_language_score: 9, french_language_score: null, occupation: "Administrative officer", experience_years: 3, noc_code: "13100", preferred_province: "Quebec" } })).status()).toBe(200);
  expect((await request.get(`${api}/application-cases/context`, { headers })).status()).toBe(200);
  const created = await request.post(`${api}/application-cases`, { headers, data: { application_type: "study_permit", case_title: "Synthetic Sprint 2 case" } });
  expect(created.status()).toBe(200);
  const active = await created.json();
  expect((await request.post(`${api}/_test/sprint2-access`, { headers, data: { plan: paid ? "individual_pro" : "free", admin } })).status()).toBe(200);
  await page.goto("/auth");
  await page.evaluate(lang => { localStorage.setItem("language", lang); localStorage.setItem("i18nextLng", lang); }, lang);
  await page.reload();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
  if (!admin) await page.getByRole("button", { name: lang === "fr" ? "Compris" : "Got it", exact: true }).click();
  return { headers, active, email, password };
}

for (const lang of ["en", "fr"]) test(`Sprint 2 ${lang}: language to case draft review export logout and retrieve`, async ({ page, request }) => {
  test.setTimeout(240000);
  const fr = lang === "fr";
  const { headers, active, email, password } = await prepare(page, request, lang);
  await page.goto("/profile?section=language");
  const language = page.getByRole("region", { name: fr ? "Résultats d’examen" : "Test evidence", exact: true });
  await expect(language).toContainText(fr ? "Inconnu / pas encore testé" : "Unknown / not tested");
  await language.getByLabel(fr ? "Examen et édition pris en charge" : "Approved test and edition", { exact: true }).selectOption(fr ? "tcf_canada" : "ielts_general");
  await language.getByLabel(fr ? "Date de l’examen" : "Test date", { exact: true }).fill("2026-10-01");
  for (const [en, french, value] of [["Listening", "Compréhension orale", fr ? "503" : "8"], ["Reading", "Compréhension écrite", fr ? "499" : "7"], ["Writing", "Expression écrite", fr ? "12" : "7"], ["Speaking", "Expression orale", fr ? "12" : "7"]]) {
    await language.getByLabel(fr ? french : en, { exact: true }).fill(value);
  }
  const profileWrites = [];
  page.on("request", r => { if (["PUT", "PATCH"].includes(r.method()) && new URL(r.url()).pathname === "/profiles/me") profileWrites.push(r.method()); });
  await language.getByLabel(fr ? "Expression orale" : "Speaking", { exact: true }).press("Enter");
  await language.getByRole("button", { name: fr ? "Enregistrer les résultats" : "Save test record", exact: true }).click();
  await expect(language.getByRole("heading", { name: /2026-10-01/ })).toBeVisible();
  await language.getByRole("button", { name: fr ? "Utiliser actuellement" : "Use as current", exact: true }).click();
  await expect(language.getByRole("button", { name: fr ? "Sélectionné" : "Selected", exact: true })).toBeDisabled();
  expect(profileWrites).toEqual([]);
  const profile = await (await request.get(`${api}/profiles/me`, { headers })).json();
  expect(profile.english_language_score).toBe(9);
  expect(profile.french_language_score).toBeNull();
  await page.goto("/strategy");
  await expect(page.getByRole("region", { name: fr ? "Références territoriales" : "Jurisdiction references" })).toContainText(fr ? "n’ont pas de PCP" : "have no PNP");
  await page.getByRole("button", { name: fr ? "Vérifier les preuves manquantes" : "Check missing evidence", exact: true }).click();
  await expect(page.getByText(fr ? "Aucun score calculé" : "No score calculated", { exact: false })).toBeVisible();
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: fr ? "Documents familiaux" : "Family documents", exact: true })).toBeVisible();
  await page.goto(`/forms?case_id=${active.id}`);
  await page.getByLabel(fr ? "Établissement / école" : "School / Institution", { exact: true }).fill("Synthetic Sprint 2 college");
  await expect(page.getByTestId("forms-save-status")).toContainText(fr ? "Enregistré sur le serveur" : "Saved to server");
  await page.goto(`/documents/generator?case_id=${active.id}`);
  const drafts = page.getByRole("region", { name: fr ? "Préparation du dossier enregistrée" : "Saved case preparation", exact: true });
  await drafts.getByRole("button", { name: fr ? "Créer un brouillon depuis les réponses" : "Create draft from saved answers", exact: true }).click();
  const editor = drafts.getByRole("textbox", { name: fr ? "Brouillon modifiable" : "Editable draft", exact: true });
  await expect(editor).toHaveValue(/Synthetic Sprint 2 college/);
  const content = `Synthetic saved draft ${lang}. The source answers remain in the owned case. These preparation notes require human review.`;
  await editor.fill(content);
  await page.route("**/preparation/drafts/*", route => route.request().method() === "PATCH" ? route.fulfill({ status: 503, json: { detail: "synthetic failed save" } }) : route.continue());
  await drafts.getByRole("button", { name: fr ? "Enregistrer le brouillon" : "Save draft", exact: true }).click();
  await expect(drafts).toContainText(fr ? "Aucun enregistrement confirmé" : "Nothing is marked saved");
  await expect(editor).toHaveValue(content);
  await expect(drafts.getByRole("button", { name: fr ? "Exporter le DOCX enregistré" : "Export saved DOCX", exact: true })).toBeDisabled();
  await page.unroute("**/preparation/drafts/*");
  await drafts.getByRole("button", { name: fr ? "Enregistrer le brouillon" : "Save draft", exact: true }).click();
  await expect(drafts).toContainText(fr ? "Enregistré sur le serveur" : "Saved on server");
  await drafts.getByRole("button", { name: fr ? "Réviser le brouillon enregistré" : "Review saved draft", exact: true }).click();
  await expect(drafts.getByRole("region", { name: fr ? "Révision de préparation" : "Preparation review" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await drafts.getByRole("button", { name: fr ? "Exporter le DOCX enregistré" : "Export saved DOCX", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/preparation-draft-\d+\.docx/);
  expect((await readFile(await download.path())).subarray(0, 2).toString()).toBe("PK");
  if (evidence) { await mkdir(evidence, { recursive: true }); await download.saveAs(`${evidence}/synthetic-draft-${lang}.docx`); }
  for (const [width, height, name] of [[1440, 1000, "desktop"], [768, 1024, "tablet"], [390, 844, "mobile"]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (evidence) await page.screenshot({ path: `${evidence}/draft-${lang}-${name}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const guide = page.getByRole("button", { name: fr ? "Compris" : "Got it", exact: true });
  if (await guide.count()) await guide.click();
  await page.getByRole("button", { name: /logout|log out|sign out|déconnexion|se déconnecter/i }).click();
  await expect(page).toHaveURL(/\/auth/);
  await page.goto(`/documents/generator?case_id=${active.id}`);
  await expect(page).toHaveURL(/\/auth/);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(`/documents/generator?case_id=${active.id}`);
  await drafts.getByRole("button", { name: /(?:Preparation notes|Notes de préparation) · #/ }).click();
  await expect(editor).toHaveValue(content);
  expect((await (await request.get(`${api}/self/application/saved?case_id=${active.id}`, { headers })).json()).intake_payload.school_name).toBe("Synthetic Sprint 2 college");
});

test("Sprint 2 Free cannot create case drafts and failed reads never enable editing", async ({ page, request }) => {
  const { active } = await prepare(page, request, "en", { paid: false });
  await page.goto(`/documents/generator?case_id=${active.id}`);
  const drafts = page.getByRole("region", { name: "Saved case preparation", exact: true });
  await expect(drafts.getByRole("button", { name: "Create draft from saved answers", exact: true })).toBeDisabled();
  await page.route("**/preparation/cases/*/drafts", route => route.fulfill({ status: 503, json: { detail: "synthetic outage" } }));
  await drafts.getByRole("button", { name: "Reload saved work", exact: true }).click();
  await expect(drafts.getByRole("alert")).toContainText("Editing is disabled");
  await expect(drafts.getByRole("button", { name: "Create draft from saved answers", exact: true })).toHaveCount(0);
});

for (const lang of ["en", "fr"]) test(`Sprint 2 ${lang}: admin inactive source queue has no activation bypass`, async ({ page, request }) => {
  const { headers } = await prepare(page, request, lang, { admin: true });
  expect((await request.post(`${api}/_test/sprint2-rules-seed`, { headers })).status()).toBe(200);
  await page.goto("/admin/rules-review");
  await expect(page.getByRole("heading", { name: lang === "fr" ? "File de révision des sources officielles" : "Official-source review queue", exact: true })).toBeVisible();
  await expect(page.getByText("NOT_VALIDATED · DISABLED", { exact: false }).first()).toBeVisible();
  expect(await page.getByRole("button", { name: /activate|approve|activer|approuver/i }).count()).toBe(0);
  await expect(page.getByRole("link", { name: /IRCC · CA · ircc.ee/ })).toBeVisible();
});
