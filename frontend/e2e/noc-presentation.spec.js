import { test, expect } from "./fixtures";

const api = "http://127.0.0.1:8010";
async function signIn(page, request, language) {
  const email = `noc-ui-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = "Isolated-NOC-test-2026!";
  expect((await request.post(`${api}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const session = await (await request.post(`${api}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const requirements = await (await request.get(`${api}/disclosures/requirements`)).json();
  for (const item of requirements.required_disclosures) {
    expect((await request.post(`${api}/disclosures/accept`, { headers, data: item })).status()).toBe(200);
  }
  const profile = { first_name: "Synthetic", last_name: "Match", age: 30, education: "master", language_score: 9,
    english_language_score: 9, experience_years: 3, occupation: "Software developer", noc_code: "21232",
    nationality: "France", current_country: "France", current_city: "Paris", marital_status: "single", preferred_language: language, preferred_province: "Ontario" };
  expect((await request.put(`${api}/profiles/me`, { headers, data: profile })).status()).toBe(200);
  await page.goto("/auth");
  await page.evaluate(({ session, language }) => {
    localStorage.setItem("token", session.access_token);
    localStorage.setItem("current_user", JSON.stringify(session.user));
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("language", language);
    localStorage.setItem("i18nextLng", language);
  }, { session, language });
  return profile;
}

function fixture(confidence) {
  return { suggested_noc: "21232", suggested_title: "Synthetic developer", teer: 1, confidence,
    broad_category: "Synthetic category", classification_status: "suggested_match_requires_duties_review",
    why_matched: ["Synthetic text alignment"], alternatives: [
      { noc: "21234", title: "Synthetic alternative", teer: 1, confidence: .75 },
      { noc: "21231", title: "Another synthetic alternative", teer: 1, confidence: .6 },
    ], matches: [{ noc: "21232", title: "Synthetic developer", confidence }] };
}

async function qualification(scope, language) {
  const review = scope.getByTestId("noc-match-qualification");
  await expect(review).toBeVisible();
  await expect(review).toContainText(language === "fr" ? "fonctions principales réelles" : "actual main duties");
  await expect(review).toContainText(language === "fr" ? "ne confirme pas votre code CNP officiel" : "does not confirm your official NOC");
  await expect(review).toContainText(language === "fr" ? "ne détermine pas votre admissibilité" : "or determine immigration eligibility");
  const link = review.getByRole("link");
  await expect(link).toHaveAttribute("href", "https://noc.esdc.gc.ca/");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await link.focus();
  await expect(link).toBeFocused();
  await expect(scope).not.toContainText(/98% eligibility|98% chance|definitely your NOC|confirmed NOC|you can submit|98 % d’admissibilité|CNP confirmé|vous pouvez soumettre/i);
}

for (const language of ["en", "fr"]) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    test(`NOC semantics ${language} ${viewport.width}: high, lower, alternatives, compact`, async ({ page, request }, testInfo) => {
      test.setTimeout(180000); // Match containment tests, including cold browser startup on Windows.
      await page.setViewportSize(viewport);
      await signIn(page, request, language);
      let confidence = .98;
      await page.route("**/noc/suggest", route => route.fulfill({ json: fixture(confidence) }));
      await page.goto("/profile");
      const guide = page.getByRole("button", { name: language === "fr" ? "Compris" : "Got it", exact: true });
      await guide.click();
      await page.getByRole("button", { name: language === "fr" ? "Assistant CNP" : "NOC Assistant", exact: true }).click();
      for (const value of [.98, .6]) {
        confidence = value;
        await page.getByRole("button", { name: language === "fr" ? "Suggérer un CNP" : "Suggest NOC", exact: true }).click();
        const primary = page.getByTestId("noc-match-result");
        await expect(primary.getByTestId("noc-match-signal")).toContainText(`${Math.round(value * 100)}${language === "fr" ? " %" : "%"}`);
        await expect(primary).toContainText(language === "fr" ? "Correspondance" : "Text & duties match");
        await qualification(primary, language);
        const alternatives = page.getByTestId("noc-alternatives");
        await qualification(alternatives, language);
        await expect(alternatives.getByTestId("noc-match-signal")).toHaveCount(2);
        for (const signal of await alternatives.getByTestId("noc-match-signal").all()) {
          await expect(signal).toHaveAttribute("aria-describedby", await alternatives.getByTestId("noc-match-qualification").getAttribute("id"));
        }
        await expect(alternatives).not.toContainText(/Confidence|Confiance/);
        expect(await primary.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (value === .98) {
          await primary.scrollIntoViewIfNeeded();
          await page.screenshot({ path: testInfo.outputPath("noc-high-match.png"), fullPage: true });
        }
      }
      await page.getByRole("button", { name: language === "fr" ? "Profil d’immigration" : "Immigration Profile", exact: true }).click();
      await qualification(page.getByTestId("noc-match-result"), language);
      await expect(page.getByTestId("noc-match-signal")).toContainText(language === "fr" ? "60 %" : "60%");
    });
  }
  test(`onboarding NOC qualification ${language}: modal and dedicated`, async ({ page, request }) => {
    test.setTimeout(180000);
    const profile = await signIn(page, request, language);
    await page.route("**/profiles/me", route => route.request().method() === "GET"
      ? route.fulfill({ json: { ...profile, occupation: "", noc_code: "", education: "", language_score: null, english_language_score: null, age: null, experience_years: null } }) : route.continue());
    await page.route("**/noc/suggest", route => {
      const data = fixture(.98);
      delete data.matches; // Protect the parent-result fallback adapter, too.
      return route.fulfill({ json: data });
    });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: language === "fr" ? "Compris" : "Got it", exact: true }).click();
    const next = page.getByRole("button", { name: language === "fr" ? "Suivant" : "Next", exact: true });
    await next.click();
    await page.locator('input[name="age"]').fill("30");
    await page.locator('input[name="english_language_score"]').fill("9");
    await page.locator('select[name="education"]').selectOption("masters");
    await page.locator('input[name="experience_years"]').fill("3");
    await next.click();
    await page.locator('input[name="occupation"]').fill("Software developer");
    await expect(page.getByTestId("noc-match-signal").first()).toContainText(language === "fr" ? "98 %" : "98%");
    await qualification(page.locator('[data-testid="noc-match-qualification"]').locator(".."), language);
    await page.goto("/onboarding");
    await page.getByRole("button", { name: language === "fr" ? "Continuer" : "Continue", exact: true }).click();
    await page.locator('input[name="occupation"]').fill("Software developer");
    await expect(page.getByTestId("noc-match-qualification")).toBeVisible();
    await qualification(page.getByTestId("noc-match-qualification").locator(".."), language);
  });
}
