import { test, expect } from "./fixtures";

const api = "http://127.0.0.1:8010";
async function openForms(page, lang = "en") {
  await page.goto("/forms");
  await page.getByRole("button", { name: lang === "fr" ? "Compris" : "Got it", exact: true }).click();
}
async function fixture(page, request, lang = "en") {
  const email = `preserve-${Date.now()}@example.com`, password = "Synthetic-only-2026!";
  expect((await request.post(`${api}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const session = await (await request.post(`${api}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const disclosures = (await (await request.get(`${api}/disclosures/requirements`)).json()).required_disclosures;
  for (const item of disclosures) expect((await request.post(`${api}/disclosures/accept`, { headers, data: item })).status()).toBe(200);
  expect((await request.put(`${api}/profiles/me`, { headers, data: { first_name: "Synthetic", last_name: "Tester", nationality: "France", current_country: "France", current_city: "Paris", marital_status: "single", age: 28, education: "bachelor", experience_years: 3, occupation: "Administrative officer", noc_code: "13100", preferred_province: "Ontario", preferred_language: lang, english_language_score: null, french_language_score: null } })).status()).toBe(200);
  await request.get(`${api}/application-cases/context`, { headers });
  const active = await (await request.post(`${api}/application-cases`, { headers, data: { application_type: "study_permit" } })).json();
  const payload = { case_id: active.id, matter_type: "study_permit", intake: { school_name: "Saved school", server_only: { preserve: "exactly" }, representative_used: false } };
  expect((await request.post(`${api}/self/workspace`, { headers, data: payload })).status()).toBe(200);
  await page.goto("/auth");
  await page.evaluate(({ session, lang }) => {
    localStorage.setItem("token", session.access_token);
    localStorage.setItem("current_user", JSON.stringify(session.user));
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("language", lang); localStorage.setItem("i18nextLng", lang);
  }, { session, lang });
  const writes = [];
  page.on("request", r => { if (r.url().startsWith(api) && ["POST", "PUT", "PATCH"].includes(r.method())) writes.push(r); });
  const saved = async () => (await (await request.get(`${api}/self/application/saved?case_id=${active.id}`, { headers })).json()).intake_payload;
  return { headers, active, writes, saved, session };
}

// Observe beyond the documented 900ms debounce; this is a zero-write assertion,
// not a retry or an increased application timeout.
async function noDebouncedWrites(page, writes) {
  await page.waitForTimeout(1200);
  expect(writes).toHaveLength(0);
}

for (const lang of ["en", "fr"]) test(`Forms ${lang}: failed read blocks every write; retry hydrates without saving`, async ({ page, request }) => {
  const { writes, saved } = await fixture(page, request, lang);
  const before = await saved();
  await page.route("**/self/application/saved?*", r => r.fulfill({ status: 503, json: { detail: "Synthetic read failure" } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await openForms(page, lang);
  const retry = page.getByRole("button", { name: lang === "fr" ? "Réessayer le chargement" : "Retry loading", exact: true });
  await expect(retry).toBeVisible();
  await expect(page.getByRole("alert").filter({ has: retry })).toContainText(lang === "fr" ? "Aucun enregistrement automatique" : "Automatic saving is blocked");
  await noDebouncedWrites(page, writes);
  expect(await saved()).toEqual(before);
  await page.unroute("**/self/application/saved?*");
  await retry.focus(); await page.keyboard.press("Enter");
  const field = page.getByLabel(lang === "fr" ? "Établissement / école" : "School / Institution", { exact: true });
  await expect(field).toHaveValue("Saved school");
  await noDebouncedWrites(page, writes);
  await field.fill("Edited school");
  await expect(page.getByTestId("forms-save-status")).toContainText(lang === "fr" ? "Enregistré sur le serveur" : "Saved to server");
  expect(await saved()).toMatchObject({ school_name: "Edited school", server_only: { preserve: "exactly" }, representative_used: false });
});

test("Forms: incomplete successful response is a failed load, never absence", async ({ page, request }) => {
  const { writes, saved } = await fixture(page, request);
  await page.route("**/self/application/saved?*", r => r.fulfill({ status: 200, json: {} }));
  await openForms(page);
  await expect(page.getByRole("button", { name: "Retry loading", exact: true })).toBeVisible();
  await noDebouncedWrites(page, writes);
  expect((await saved()).server_only).toEqual({ preserve: "exactly" });
});

test("Forms: confirmed absence requires a genuine edit and preserves omitted server fields", async ({ page, request }) => {
  const { writes, saved } = await fixture(page, request);
  // Exercise the explicit absence contract without deleting a server record.
  await page.route("**/self/application/saved?*", r => r.fulfill({ status: 404, json: { detail: "No saved self application found." } }));
  await openForms(page);
  await expect(page.getByText("No saved information. Edit a field to start saving.", { exact: true })).toBeVisible();
  await noDebouncedWrites(page, writes);
  await page.getByLabel("School / Institution", { exact: true }).fill("Intentional creation");
  await expect(page.getByTestId("forms-save-status")).toContainText("Saved to server");
  expect(await saved()).toMatchObject({ school_name: "Intentional creation", server_only: { preserve: "exactly" } });
});

test("Forms: leaving before debounce cancels the write", async ({ page, request }) => {
  const { writes, saved } = await fixture(page, request);
  await openForms(page);
  await expect(page.getByLabel("School / Institution", { exact: true })).toHaveValue("Saved school");
  await page.getByLabel("School / Institution", { exact: true }).fill("Must not save");
  await page.goto("/documents");
  await noDebouncedWrites(page, writes);
  expect((await saved()).school_name).toBe("Saved school");
});

test("Forms: active case change rejects queued edit and retry loads only the new case", async ({ page, request }) => {
  const { headers, writes, saved } = await fixture(page, request);
  await openForms(page);
  await expect(page.getByLabel("School / Institution", { exact: true })).toHaveValue("Saved school");
  const other = await (await request.post(`${api}/application-cases`, { headers, data: { application_type: "study_permit" } })).json();
  await page.getByLabel("School / Institution", { exact: true }).fill("Wrong case edit");
  await expect(page.getByRole("button", { name: "Retry loading", exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  expect((await saved()).school_name).toBe("Saved school");
  await page.getByRole("button", { name: "Retry loading", exact: true }).click();
  await expect(page.getByLabel("School / Institution", { exact: true })).toBeVisible();
  await noDebouncedWrites(page, writes);
  const current = await request.get(`${api}/self/application/saved?case_id=${other.id}`, { headers });
  expect(current.status()).toBe(404);
  expect((await current.json()).detail).toBe("No saved self application found.");
});

test("Forms: late failed GET from superseded load cannot replace a successful retry", async ({ page, request }) => {
  const { writes } = await fixture(page, request);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let first = true;
  await page.route("**/self/application/saved?*", async route => {
    if (!first) return route.continue();
    first = false;
    await held;
    await route.fulfill({ status: 503, json: { detail: "Old failure" } }).catch(() => {});
  });
  await openForms(page);
  await expect.poll(() => first).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event("nbai-bootstrap-refresh")));
  await expect(page.getByLabel("School / Institution", { exact: true })).toHaveValue("Saved school");
  release();
  await noDebouncedWrites(page, writes);
  await expect(page.getByRole("button", { name: "Retry loading", exact: true })).toHaveCount(0);
});

test("Forms: case change during GET rejects stale hydration", async ({ page, request }) => {
  const { headers, writes, saved } = await fixture(page, request);
  let release, received = false;
  const hold = new Promise(resolve => { release = resolve; });
  await page.route("**/self/application/saved?*", async route => {
    const response = await route.fetch();
    received = true;
    await hold;
    await route.fulfill({ response }).catch(() => {});
  });
  await openForms(page);
  await expect.poll(() => received).toBe(true);
  expect((await request.post(`${api}/application-cases`, { headers, data: { application_type: "study_permit" } })).status()).toBe(200);
  release();
  await expect(page.getByRole("button", { name: "Retry loading", exact: true })).toBeVisible();
  await noDebouncedWrites(page, writes);
  expect((await saved()).school_name).toBe("Saved school");
});

test("Forms: session invalidation cancels pending edit without sending it as another account", async ({ page, request }) => {
  const { writes, saved } = await fixture(page, request);
  await openForms(page);
  await expect(page.getByLabel("School / Institution", { exact: true })).toHaveValue("Saved school");
  await page.getByLabel("School / Institution", { exact: true }).fill("Wrong account edit");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth/);
  await noDebouncedWrites(page, writes);
  expect((await saved()).school_name).toBe("Saved school");
});

for (const inFlight of [false, true]) test(`Forms: account switch isolates ${inFlight ? "in-flight response" : "pending debounce"}`, async ({ page, request }) => {
  const other = await fixture(page, request);
  expect((await request.post(`${api}/self/workspace`, { headers: other.headers, data: {
    case_id: other.active.id, matter_type: "study_permit", intake: { school_name: "Other account school" }, preserve_omitted_intake: true,
  } })).status()).toBe(200);
  const original = await fixture(page, request);
  await openForms(page);
  const school = page.getByLabel("School / Institution", { exact: true });
  await expect(school).toHaveValue("Saved school");
  let release, received = false;
  const hold = new Promise(resolve => { release = resolve; });
  if (inFlight) await page.route("**/self/workspace?*", async route => {
    const response = await route.fetch();
    received = true;
    await hold;
    await route.fulfill({ response }).catch(() => {});
  });
  await school.fill("Original account edit");
  if (inFlight) await expect.poll(() => received).toBe(true);
  await page.evaluate(session => {
    localStorage.setItem("token", session.access_token);
    localStorage.setItem("current_user", JSON.stringify(session.user));
    localStorage.setItem("user", JSON.stringify(session.user));
    window.dispatchEvent(new Event("nbai-bootstrap-refresh"));
  }, other.session);
  await expect(school).toHaveValue("Other account school");
  release();
  await page.waitForTimeout(1200);
  await expect(school).toHaveValue("Other account school");
  expect((await other.saved()).school_name).toBe("Other account school");
  expect((await original.saved()).school_name).toBe(inFlight ? "Original account edit" : "Saved school");
  expect(original.writes).toHaveLength(inFlight ? 1 : 0);
  await expect(page.getByTestId("forms-save-status")).not.toContainText("Saved to server");
});
