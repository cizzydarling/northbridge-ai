import { test, expect } from "./fixtures";
// Initialize the worker browser outside the first application's 90-second budget.
test.beforeAll(async ({browser}) => { await browser.version(); });
const api = "http://127.0.0.1:8010";
async function owner(page, request, language) {
  const email = `language-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = "Synthetic-language-2026!";
  expect((await request.post(`${api}/auth/register`, {data:{email,password}})).status()).toBe(200);
  const session = await (await request.post(`${api}/auth/login`, {form:{username:email,password}})).json();
  const headers = {Authorization:`Bearer ${session.access_token}`};
  const requirements = await (await request.get(`${api}/disclosures/requirements`)).json();
  for (const item of requirements.required_disclosures) await request.post(`${api}/disclosures/accept`,{headers,data:item});
  const profile = {first_name:"Synthetic",last_name:"Language",nationality:"France",current_country:"France",current_city:"Paris",marital_status:"single",preferred_language:language,age:30,education:"bachelor",experience_years:3,occupation:"Administrative officer",noc_code:"13100",preferred_province:"Ontario"};
  expect((await request.patch(`${api}/profiles/me`,{headers,data:profile})).status()).toBe(200);
  await page.addInitScript(({session,language}) => {
    localStorage.setItem("token",session.access_token);
    localStorage.setItem("current_user",JSON.stringify(session.user));
    localStorage.setItem("user",JSON.stringify(session.user));
    localStorage.setItem("language",language);
    localStorage.setItem("i18nextLng",language);
  },{session,language});
  return {headers,profile};
}
for (const language of ["en","fr"]) {
  test(`unknown onboarding and bounded benchmarks ${language}`,async ({page,request}) => {
    const {headers} = await owner(page,request,language);
    await page.setViewportSize({width:390,height:844});
    await page.goto("/onboarding");
    await page.getByRole("button",{name:language === "fr" ? "Continuer" : "Continue",exact:true}).click();
    const english = page.locator('select[name="english_language_score"]');
    await expect(english).toBeVisible();
    await expect(english.locator("option")).toHaveCount(13);
    await english.selectOption("12");
    await page.getByRole("button",{name:language === "fr" ? "Je n'ai pas encore passé de test de langue." : "I haven't taken a language test yet.",exact:true}).click();
    await expect(english).toHaveValue("");
    await page.getByRole("button",{name:language === "fr" ? "Terminer la configuration" : "Finish Setup",exact:true}).click();
    await expect(page.getByRole("heading",{name:language === "fr" ? "Profil complété avec succès" : "Profile successfully completed",exact:true})).toBeVisible();
    const profile = await (await request.get(`${api}/profiles/me`,{headers})).json();
    expect(profile.language_score).toBeNull(); expect(profile.english_language_score).toBeNull(); expect(profile.french_language_score).toBeNull();
    expect((await (await request.get(`${api}/app/bootstrap`,{headers})).json()).profile_complete).toBe(true);
    await page.goto("/dashboard");
    await expect(page.getByText(language === "fr" ? "Inconnu / Pas encore testé" : "Unknown / Not tested",{exact:false}).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto("/official-finders");
    await expect(page.getByRole("heading",{name:language === "fr" ? "Centres de tests et établissements désignés" : "Test centres and designated schools"})).toBeVisible();
    await page.getByRole("button",{name:language === "fr" ? "Compris" : "Got it",exact:true}).click();
    await expect(page.getByRole("button",{name:language === "fr" ? "Voir les centres officiels" : "View official centres",exact:true})).toHaveCount(5);
    await page.getByRole("button",{name:language === "fr" ? "Établissements d’enseignement désignés" : "DLI schools",exact:true}).click();
    await expect(page).toHaveURL(/official-finders\?tab=schools$/);
    await page.evaluate(() => { window.open = url => { window.__dliHandoff = url; return null; }; });
    await page.getByRole("button",{name:language === "fr" ? "Ouvrir la liste officielle des EED" : "Open official DLI list",exact:true}).click();
    expect(await page.evaluate(() => window.__dliHandoff)).toBe(language === "fr" ? "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/etudier-canada/permis-etudes/preparer/liste-etablissements-enseignement-designes.html" : "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html");
    await page.goto("/language-practice");
    await expect(page.getByRole("heading",{name:language === "fr" ? "La pratique linguistique est Premium" : "Language practice is Premium"})).toBeVisible();
    await page.goto("/strategy/simulator");
    await expect(page.getByRole("heading",{name:language === "fr" ? "Simulateur temporairement indisponible" : "Simulator temporarily unavailable"})).toBeVisible();
  });
  test(`legacy review preserved across unrelated edit ${language}`,async ({page,request}) => {
    const {headers,profile} = await owner(page,request,language);
    await page.route("**/profiles/me",async route => {
      if(route.request().method() === "GET") return route.fulfill({json:{...profile,id:99,user_id:99,english_language_score:40,french_language_score:null,language_score:40}});
      return route.continue();
    });
    await page.goto("/profile");
    await page.getByRole("button",{name:language === "fr" ? "Compris" : "Got it",exact:true}).click();
    const immigration = page.getByRole("button",{name:language === "fr" ? "Profil d’immigration" : "Immigration Profile",exact:true});
    await immigration.click();
    const english = page.locator('select[name="english_language_score"]');
    await expect(english).toHaveValue("40");
    await expect(english.locator('option[value="40"]')).toHaveText(language === "fr" ? "À vérifier" : "Needs review");
    await page.locator('input[name="occupation"]').fill("Updated synthetic role");
    const save = page.getByRole("button",{name:language === "fr" ? "Enregistrer le profil" : "Save Profile",exact:true});
    const requestPromise = page.waitForRequest(r => r.url().endsWith("/profiles/me") && r.method() === "PATCH");
    await save.click();
    const body = (await requestPromise).postDataJSON();
    expect(body).toEqual({occupation:"Updated synthetic role"});
    expect(body).not.toHaveProperty("language_score"); expect(body).not.toHaveProperty("english_language_score");
    expect((await request.get(`${api}/profiles/me`,{headers})).status()).toBe(200);
  });
}

test("Pro onboarding accepts unknown without a paywall", async ({page,request}) => {
  const {headers} = await owner(page,request,"en");
  const bootstrap = await (await request.get(`${api}/app/bootstrap`,{headers})).json();
  bootstrap.user.plan = "individual_pro";
  bootstrap.access = {...bootstrap.access,plan:"pro",is_pro:true,is_premium:false,is_free:false};
  await page.route("**/app/bootstrap",route => route.fulfill({json:bootstrap}));
  await page.route("**/billing/access",route => route.fulfill({json:bootstrap.access}));
  await page.goto("/onboarding");
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await page.getByRole("button",{name:"I haven't taken a language test yet.",exact:true}).click();
  await page.getByRole("button",{name:"Finish Setup",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Profile successfully completed",exact:true})).toBeVisible();
  expect((await (await request.get(`${api}/profiles/me`,{headers})).json()).english_language_score).toBeNull();
});

test("interface language toggle preserves unsaved benchmark selections", async ({page,request}) => {
  await owner(page,request,"en");
  await page.goto("/profile");
  await page.getByRole("button",{name:"Got it",exact:true}).click();
  await page.getByRole("button",{name:"Immigration Profile",exact:true}).click();
  const english = page.locator('select[name="english_language_score"]');
  await english.selectOption("12");
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole("button",{name:"FR",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Intelligence linguistique",exact:true})).toBeVisible();
  await expect(english).toHaveValue("12");
  const describedBy = await english.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${describedBy}"]`)).toBeVisible();
  await english.focus();
  await expect(english).toBeFocused();
});
