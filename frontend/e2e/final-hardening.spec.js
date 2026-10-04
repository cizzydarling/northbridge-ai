import { test, expect } from "./fixtures";
const sessions = new WeakMap();
const api = "http://127.0.0.1:8010";
async function prepare(page, request, language, paid) {
  const email = `hardening-${Date.now()}-${language}@example.com`;
  const password = "Hardening-test-2026!";
  expect((await request.post(`${api}/auth/register`, {data:{email,password}})).status()).toBe(200);
  const session = await (await request.post(`${api}/auth/login`,{form:{username:email,password}})).json();
  const headers={Authorization:`Bearer ${session.access_token}`};
  const requirements=await (await request.get(`${api}/disclosures/requirements`)).json();
  for(const d of requirements.required_disclosures) await request.post(`${api}/disclosures/accept`,{headers,data:d});
  await request.put(`${api}/profiles/me`,{headers,data:{first_name:"Test",last_name:"Owner",nationality:"France",current_country:"France",current_city:"Paris",marital_status:"single",age:28,education:"bachelor",language_score:9,english_language_score:9,experience_years:3,occupation:"Administrative officer",noc_code:"13100",preferred_province:"Ontario"}});
  const bootstrap=await (await request.get(`${api}/app/bootstrap`,{headers})).json();
  // SQLite cannot exercise PostgreSQL's owner-row lock. Initialize this test
  // identity before the UI issues concurrent context requests; PostgreSQL
  // concurrency remains covered by the backend rehearsal suite.
  expect((await request.get(`${api}/application-cases/context`,{headers})).status()).toBe(200);
  if(paid){
    bootstrap.user.plan="individual_premium";
    bootstrap.access={...bootstrap.access,plan:"premium",is_pro:true,is_premium:true,is_free:false};
    for(const key of Object.keys(bootstrap.access)) if(key.startsWith("can_")) bootstrap.access[key]=true;
    for(const key of Object.keys(bootstrap.access.features)) bootstrap.access.features[key]=true;
  }
  sessions.set(bootstrap, session);
  await page.addInitScript(({session,language})=>{
    if (sessionStorage.getItem("hardening-seeded")) return;
    sessionStorage.setItem("hardening-seeded", "1");
    localStorage.setItem("token",session.access_token); localStorage.setItem("current_user",JSON.stringify(session.user));
    localStorage.setItem("user",JSON.stringify(session.user)); localStorage.setItem("language",language); localStorage.setItem("i18nextLng",language);
    // Persisted access is intentionally poisoned; it must never authorize UI.
    localStorage.setItem("nbai_billing_access",JSON.stringify({plan:"premium",is_premium:true}));
  },{session,language});
  await page.route("**/auth/me",r=>r.fulfill({json:bootstrap.user}));
  await page.route("**/billing/access",r=>r.fulfill({json:bootstrap.access}));
  return bootstrap;
}
for(const language of ["en","fr"]){
  test(`entitlement ${language}: slow paid bootstrap, refresh and AI unavailable`,async({page,request})=>{
    test.setTimeout(180000);
    const bootstrap=await prepare(page,request,language,true);
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    await page.route("**/app/bootstrap",async r=>{await gate;await r.fulfill({json:bootstrap});});
    await page.goto('/documents/review');
    await expect(page.getByTestId('upgrade-prompt')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(0);
    release();
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByTestId('upgrade-prompt')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByTestId('upgrade-prompt')).toHaveCount(0);
    await page.goto('/strategy');
    await expect(page.getByTestId('ai-unavailable')).toContainText(language==='fr'?'stratégie calculée':'calculated strategy');
    await expect(page.locator('h1').first()).toBeVisible();
  });
  test(`entitlement ${language}: free only after verification, billing error and recovery`,async({page,request})=>{
    test.setTimeout(180000);
    const bootstrap=await prepare(page,request,language,false);
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    await page.route("**/app/bootstrap",async r=>{await gate;await r.fulfill({json:bootstrap});});
    await page.goto('/documents/review');
    await expect(page.getByTestId('upgrade-prompt')).toHaveCount(0);
    release();
    await expect(page.getByRole('button',{name:language==='fr'?'Passer Pro':'Upgrade',exact:true}).first()).toBeVisible();
    await page.route("**/billing/access",r=>r.fulfill({status:503,json:{detail:'unavailable'}}));
    await page.reload();
    await expect(page.getByTestId('entitlement-status')).toContainText(language==='fr'?'indisponible':'unavailable');
    await expect(page.getByTestId('upgrade-prompt')).toHaveCount(0);
    await page.unroute("**/billing/access");
    await page.route("**/billing/access",r=>r.fulfill({json:bootstrap.access}));
    await page.getByRole('button',{name:language==='fr'?'Réessayer':'Try again',exact:true}).click();
    await expect(page.getByRole('button',{name:language==='fr'?'Passer Pro':'Upgrade',exact:true}).first()).toBeVisible();
  });
}

test("account switch clears paid UI; logout clears access", async ({page, context, request}) => {
  test.setTimeout(180000);
  let current = await prepare(page, request, "en", true);
  await page.route("**/app/bootstrap", r => r.fulfill({json:current}));
  await page.goto("/documents/review");
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByTestId("upgrade-prompt")).toHaveCount(0);
  current = await prepare(page, request, "en", false);
  const session = sessions.get(current);
  // Changing storage in another same-origin tab emits the actual storage event.
  const other = await context.newPage();
  await other.goto("/auth");
  await other.evaluate(({session}) => {
    localStorage.setItem("current_user",JSON.stringify(session.user));
    localStorage.setItem("user",JSON.stringify(session.user));
    localStorage.setItem("token",session.access_token);
  }, {session});
  await other.close();
  await expect(page.getByRole('button',{name:'Upgrade',exact:true}).first()).toBeVisible();
  await page.getByRole("button", {name:/logout|log out|sign out/i}).first().click();
  await expect(page).toHaveURL(/\/auth/);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("nbai_billing_access"))).toBeNull();
});

test("bootstrap failure is retryable and agent accounts stay isolated", async ({page, request}) => {
  const bootstrap = await prepare(page, request, "en", false);
  let failed = true;
  bootstrap.user.role = "agent";
  await page.route("**/app/bootstrap", r => failed
    ? r.fulfill({status:503,json:{detail:"unavailable"}})
    : r.fulfill({json:bootstrap}));
  await page.goto("/strategy");
  await expect(page.getByTestId("entitlement-status")).toContainText("unavailable");
  await expect(page.getByTestId("upgrade-prompt")).toHaveCount(0);
  failed = false;
  await page.getByRole("button",{name:"Try again",exact:true}).click();
  await expect(page.getByText("This launch is available to individual users only.")).toBeVisible();
});
