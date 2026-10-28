import { test, expect } from "./fixtures";
const api = "http://127.0.0.1:8010";
for (const language of ["en", "fr"]) {
  test(`saved CRS preparation ${language}: incomplete, durable, conflict, mobile`, async ({ page, request }) => {
    test.setTimeout(180000);
    const email = `sprint2-sprint3-${Date.now()}-${language}@example.com`;
    const password = "Synthetic-Sprint3-2026!";
    expect((await request.post(api+"/auth/register", {data:{email,password}})).status()).toBe(200);
    const session = await (await request.post(api+"/auth/login",{form:{username:email,password}})).json();
    const headers={Authorization:`Bearer ${session.access_token}`};
    const requirements=await (await request.get(api+"/disclosures/requirements")).json();
    for(const d of requirements.required_disclosures) expect((await request.post(api+"/disclosures/accept",{headers,data:d})).ok()).toBeTruthy();
    expect((await request.put(api+"/profiles/me",{headers,data:{first_name:"Synthetic",last_name:"Owner",nationality:"France",current_country:"France",current_city:"Paris",marital_status:"single",age:28,education:"bachelor",experience_years:3,occupation:"Administrative officer",noc_code:"13100",preferred_province:"Ontario"}})).ok()).toBeTruthy();
    const context=await (await request.get(api+"/application-cases/context",{headers})).json();
    expect((await request.get(api+"/self/application",{headers})).ok()).toBeTruthy();
    await page.addInitScript(({session,language})=>{localStorage.setItem("token",session.access_token);localStorage.setItem("current_user",JSON.stringify(session.user));localStorage.setItem("user",JSON.stringify(session.user));localStorage.setItem("language",language);localStorage.setItem("i18nextLng",language);},{session,language});
    await page.setViewportSize({width:390,height:844});
    await page.goto('/strategy');
    // Complete the real first-use guide before interacting with the workspace.
    const starter=page.getByRole('button',{name:language==='fr'?'Compris':'Got it',exact:true}).first();
    await expect(starter).toBeVisible();
    await starter.click();
    const region=page.getByRole('region',{name:language==='fr'?'Préparation SCG enregistrée':'Saved CRS preparation'});
    const age=region.getByLabel(language==='fr'?'Âge':'Age',{exact:true});
    await expect(age).toBeEnabled();
    await age.fill('32');
    await region.getByRole('button',{name:language==='fr'?'Enregistrer la préparation':'Save preparation',exact:true}).click();
    await expect(region.getByRole('status')).toContainText(language==='fr'?'Enregistré':'Saved on server');
    const url=api+`/preparation/cases/${context.case_id}/crs-inputs`;
    const saved=await (await request.get(url,{headers})).json();
    expect(saved.score).toBeNull(); expect(saved.facts.age).toBe(32);
    await page.reload();
    await expect(age).toHaveValue('32');
    expect((await request.put(url,{headers,data:{revision:saved.revision,facts:{age:33}}})).ok()).toBeTruthy();
    await age.fill('34');
    await region.getByRole('button',{name:language==='fr'?'Enregistrer la préparation':'Save preparation',exact:true}).click();
    await expect(region.getByRole('alert')).toContainText(language==='fr'?'non confirmé':'not confirmed');
    await expect(age).toHaveValue('34');
    await region.getByRole('button',{name:language==='fr'?'Recharger la préparation':'Reload saved preparation',exact:true}).click();
    await expect(age).toHaveValue('33');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    await page.route("**/billing/plans", route => route.fulfill({json:{checkout_available:true}}));
    await page.goto("/pricing?plan=premium");
    await expect(page.getByText(language === "fr" ? "SCG numérique" : "Numerical CRS", {exact:true})).toBeVisible();
    await expect(page.getByText(language === "fr" ? "Stratégie complète" : "Full strategy", {exact:true})).toHaveCount(0);
    await expect(page.getByTestId("premium-offer-unavailable").first()).toBeVisible();
    await expect(page.getByRole("button",{name:language === "fr" ? "Choisir Premium" : "Choose Premium",exact:true})).toHaveCount(0);
    await page.goto('/documents/review');
    const documentInput=page.getByPlaceholder(language==='fr'?'Collez ici votre document...':'Paste your document here...',{exact:true});
    const syntheticDraft='SYNTHETIC PREPARATION ONLY. I am organizing my recorded information and supporting sources. These notes do not establish eligibility or approval. I will verify dates and facts before using this draft.';
    await documentInput.fill(syntheticDraft);
    await page.getByRole('button',{name:language==='fr'?'Réviser le document':'Review document',exact:true}).click();
    await expect(page.getByText(language==='fr'?'Pro donne accès à la révision de préparation complète pour la clarté et l’organisation; elle ne confirme ni l’admissibilité ni la préparation au dépôt.':'Pro provides the full preparation review for clarity and organization; it does not establish eligibility or submission readiness.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:language==='fr'?'Passer à Premium':'Upgrade to Premium',exact:true})).toHaveCount(0);
    expect((await request.post(api+'/_test/sprint2-access',{headers,data:{plan:'individual_pro'}})).ok()).toBeTruthy();
    await page.reload();
    await documentInput.fill(syntheticDraft);
    const reviewResult=page.waitForResponse(response=>response.url()===api+'/documents/review'&&response.request().method()==='POST');
    await page.getByRole('button',{name:language==='fr'?'Réviser le document':'Review document',exact:true}).click();
    const reviewed=await (await reviewResult).json();
    expect(reviewed.locked).toBe(false);expect(reviewed.upgrade_reason).toBeNull();
    await expect(page.getByTestId('upgrade-prompt')).toHaveCount(0);
    expect((await request.post(api+'/_test/sprint2-access',{headers,data:{plan:'free'}})).ok()).toBeTruthy();

  });
}


for (const language of ['en','fr']) {
  test('landing preparation claims and navigation '+language,async ({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/');
    const header=page.getByRole('banner');
    await header.getByRole('button',{name:language.toUpperCase(),exact:true}).click();
    await expect(page.getByRole('heading',{name:language==='fr'?'Préparation enregistrée':'Saved preparation',exact:true})).toBeVisible();
    await expect(page.getByText(/best pathways|Personalized strategy|tailored to your profile|Priority recommendations|meilleures voies|Stratégie personnalisée|plan structuré adapté|Recommandations prioritaires/)).toHaveCount(0);
    await expect(page.getByText(language==='fr'?'Pro est nécessaire pour créer des brouillons de dossier et exporter en DOCX.':'Pro is required to create case drafts and export DOCX.',{exact:false})).toBeVisible();
    await expect(header.getByRole('link',{name:language==='fr'?'Tarifs':'Pricing',exact:true})).toHaveAttribute('href','/pricing');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    await header.getByRole('button',{name:language==='fr'?'Commencer gratuitement':'Get Started Free',exact:true}).click();
    await expect(page).toHaveURL(/\/auth$/);
  });
}
