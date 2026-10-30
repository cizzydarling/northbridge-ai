import { test, expect } from "./fixtures";
// Initialize the worker browser outside the first application's 90-second budget.
test.beforeAll(async ({browser}) => { await browser.version(); });
const api = "http://127.0.0.1:8010";
async function account(request, suffix) {
  const email = 'sprint2-recovery-' + Date.now() + '-' + suffix + '@example.com';
  const password = 'Synthetic-Recovery-2026!';
  expect((await request.post(api + '/auth/register', {data:{email,password}})).ok()).toBeTruthy();
  const session = await (await request.post(api + '/auth/login', {form:{username:email,password}})).json();
  const headers = {Authorization:'Bearer ' + session.access_token};
  const requirements = await (await request.get(api + '/disclosures/requirements')).json();
  for (const disclosure of requirements.required_disclosures) expect((await request.post(api + '/disclosures/accept', {headers,data:disclosure})).ok()).toBeTruthy();
  expect((await request.put(api + '/profiles/me', {headers,data:{first_name:'Synthetic',last_name:suffix,nationality:'France',current_country:'France',current_city:'Paris',marital_status:'single',age:28,education:'bachelor',experience_years:3,occupation:'Administrative officer',noc_code:'13100',preferred_province:'Ontario'}})).ok()).toBeTruthy();
  expect((await request.get(api + '/application-cases/context', {headers})).ok()).toBeTruthy();
  expect((await request.get(api + '/self/application', {headers})).ok()).toBeTruthy();
  return {session,headers};
}
async function signIn(page, session, language) {
  await page.addInitScript(({session,language}) => {
    if (!sessionStorage.getItem('feature-recovery-seeded')) {
      localStorage.setItem('token',session.access_token);
      localStorage.setItem('current_user',JSON.stringify(session.user));
      localStorage.setItem('user',JSON.stringify(session.user));
      localStorage.setItem('language',language); localStorage.setItem('i18nextLng',language);
      localStorage.setItem('nbai_sop_guide_seen_v1','true');
      sessionStorage.setItem('feature-recovery-seeded','true');
    }
    window.open = url => { window.__officialHandoff = url; return null; };
  },{session,language});
}
for (const language of ['en','fr']) {
  const fr = language === 'fr';
  test('Free official handoffs and truthful checklist ' + language, async ({page,request}) => {
    const {session,headers} = await account(request,language);
    await signIn(page,session,language);
    await page.goto('/strategy#processing-times');
    const processing = page.locator('#processing-times');
    await expect(processing.getByRole('link',{name:fr?'Ouvrir le vérificateur IRCC':'Open the IRCC processing-time checker'})).toHaveAttribute('href',fr?'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande/verifier-delais-traitement.html':'https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html');
    await expect(processing).toContainText(fr?'pas une prévision personnelle':'not a personal prediction');
    await expect(processing.getByRole('link',{name:fr?'Continuer la planification du dossier':'Continue case planning'})).toHaveAttribute('href','/applications');
    await expect(page.getByRole('link',{name:fr?'Explorer les carrières depuis la CNP':'Explore careers from NOC'})).toHaveAttribute('href','/career-match');
    await expect(page.getByRole('link',{name:fr?'Pratique de citoyenneté':'Citizenship practice',exact:true})).toHaveAttribute('href','/citizenship/quiz');
    const processingPreview=await (await request.get(api+'/immigration-intelligence/processing-times',{headers})).json();
    expect(processingPreview.locked).toBe(true);
    await page.getByRole('link',{name:fr?'Centres de tests officiels':'Official test centres',exact:true}).click();
    await expect(page).toHaveURL(/official-finders\?tab=tests$/);
    const directories=page.getByRole('button',{name:fr?'Voir les centres officiels':'View official centres',exact:true});
    await expect(directories).toHaveCount(5);
    await directories.first().click();
    expect(await page.evaluate(()=>window.__officialHandoff)).toBe('https://www.celpip.ca/take-celpip/find-a-test-date/');
    await expect(page.getByText(fr?'Contexte déclaré du profil (Premium)':'Recorded profile context (Premium)',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:fr?'Établissements d’enseignement désignés':'DLI schools',exact:true}).click();
    await expect(page).toHaveURL(/official-finders\?tab=schools$/);
    await page.getByLabel(fr?'Rechercher les fiches officielles':'Search official records').fill('SYNTHETIC research note');
    await expect(page.getByText(fr?'Liste de préparation aux études':'Study research checklist',{exact:true})).toBeVisible();
    await expect(page.getByText(fr?'Aucun résultat d’admissibilité':'No eligibility result',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:fr?'Ouvrir la liste officielle des EED':'Open official DLI list',exact:true}).click();
    expect(await page.evaluate(()=>window.__officialHandoff)).toContain(fr?'/fr/immigration-refugies-citoyennete/':'/en/immigration-refugees-citizenship/');
    expect(await page.evaluate(()=>window.__officialHandoff)).toContain(fr?'liste-etablissements-enseignement-designes':'designated-learning-institutions-list');
    await expect(page.getByText(/June 18|18 juin|appointment slots|places disponibles/)).toHaveCount(0);
    await page.getByRole('link',{name:fr?'Continuer la préparation aux études':'Continue study preparation'}).click();
    await expect(page.locator('#study-preparation')).toBeVisible();
    await page.goto('/official-finders');
    await expect(directories).toHaveCount(5);
    await page.goto('/profile?section=language#language-evidence');
    await expect(page.getByRole('heading',{name:fr?'Résultats d’examen par compétence':'Four-skill test evidence',exact:true})).toBeVisible();
    await expect(page.locator('#language-evidence')).toBeFocused();
    await expect(page.getByRole('link',{name:fr?'Centres de tests officiels':'Official test centres',exact:true})).toHaveAttribute('href','/official-finders?tab=tests');
    await page.goto('/strategy/simulator');
    await expect(page.getByRole('heading',{name:fr?'Simulateur temporairement indisponible':'Simulator temporarily unavailable',exact:true})).toBeVisible();
    await expect(page.getByText(fr?'prévisions et rapports analytiques sont indisponibles':'forecasts and analytical reports are unavailable',{exact:false})).toBeVisible();
  });
  test('Mobile navigation and paid boundaries ' + language, async ({page,request}) => {
    const {session,headers}=await account(request,'mobile-'+language);
    await signIn(page,session,language);
    await page.setViewportSize({width:390,height:844});
    await page.goto('/official-finders?tab=schools');
    await expect(page.getByRole('button',{name:fr?'Établissements d’enseignement désignés':'DLI schools',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:fr?'Ouvrir le menu':'Open menu',exact:true}).click();
    const menu=page.getByRole('dialog',{name:fr?'Menu principal':'Main menu'});
    await expect(menu).toBeVisible();
    for (const label of fr?['Explorer le Canada','Langues et études','Ma préparation','Assistant IA']:['Explore Canada','Language & Education','My Preparation','AI Assistant']) await expect(menu.getByRole('paragraph').filter({hasText:label})).toBeVisible();
    const centres=menu.getByRole('button',{name:fr?'Centres de tests':'Test centres',exact:true});
    await centres.focus(); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/official-finders\?tab=tests$/);
    await expect(menu).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.goBack();
    await expect(page).toHaveURL(/official-finders\?tab=schools$/);
    await page.reload();
    await expect(page.getByRole('button',{name:fr?'Établissements d’enseignement désignés':'DLI schools',exact:true})).toHaveAttribute('aria-pressed','true');
    const access=await (await request.get(api+'/billing/access',{headers})).json();
    expect(access.can_use_language_practice).toBe(false);
    expect(access.can_save_career_jobs).toBe(false);
    expect(access.can_use_official_finders).toBe(false);
    expect(access.can_use_career_advanced_intelligence).toBe(false);
    expect(access.can_track_citizenship_progress).toBe(false);
    expect(access.can_take_citizenship_mock_exam).toBe(false);
    expect(access.can_review_documents_full).toBe(false);
    await page.goto('/language-practice');
    await expect(page.getByTestId('upgrade-prompt')).toBeVisible();
    await expect(page.getByTestId('upgrade-prompt').getByRole('button')).toBeVisible();
    expect((await request.post(api+'/_test/sprint2-access',{headers,data:{plan:'individual_pro'}})).ok()).toBeTruthy();
    const pro=await (await request.get(api+'/billing/access',{headers})).json();
    expect(pro.can_save_career_jobs).toBe(true);
    expect(pro.can_use_language_practice).toBe(false);
    expect(pro.can_use_career_advanced_intelligence).toBe(false);
    expect(pro.can_track_citizenship_progress).toBe(true);
    expect(pro.can_take_citizenship_mock_exam).toBe(false);
    expect(pro.can_review_documents_full).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading',{name:fr?'Pratique linguistique':'Language practice',exact:true})).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    expect((await request.get(api+'/citizenship/language-sessions',{headers})).status()).toBe(403);
  });
}
test('Resource navigation preserves logout and account isolation', async ({page,request})=>{
  const first=await account(request,'first'); const second=await account(request,'second');
  expect((await request.post(api+'/_test/sprint2-access',{headers:first.headers,data:{plan:'individual_pro'}})).ok()).toBeTruthy();
  await signIn(page,first.session,'en'); await page.goto('/official-finders?tab=tests');
  await expect(page.getByRole('heading',{name:'Test centres and designated schools'})).toBeVisible();
  // A fresh document bootstrap with a second real synthetic session must re-evaluate entitlements.
  await page.evaluate(session=>{localStorage.setItem('token',session.access_token);localStorage.setItem('current_user',JSON.stringify(session.user));localStorage.setItem('user',JSON.stringify(session.user));},second.session);
  await page.goto('/language-practice');
  await expect(page.getByTestId('upgrade-prompt')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('current_user')).id)).toBe(second.session.user.id);
  await page.evaluate(()=>{localStorage.removeItem('token');localStorage.removeItem('current_user');localStorage.removeItem('user');});
  await page.goto('/official-finders?tab=schools'); await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('heading',{name:'Test centres and designated schools'})).toHaveCount(0);
});
