import {test,expect} from './fixtures';
// Initialize the worker browser outside the first application's 90-second budget.
test.beforeAll(async ({browser}) => { await browser.version(); });
const api='http://127.0.0.1:8010';
async function owner(page,request,language){
 const email='sprint2-resources-'+Date.now()+'-'+language+'@example.com',password='Synthetic-Resources-2026!';
 expect((await request.post(api+'/auth/register',{data:{email,password}})).ok()).toBeTruthy();
 const session=await (await request.post(api+'/auth/login',{form:{username:email,password}})).json(),headers={Authorization:'Bearer '+session.access_token};
 const disclosures=await (await request.get(api+'/disclosures/requirements')).json();
 for(const d of disclosures.required_disclosures)expect((await request.post(api+'/disclosures/accept',{headers,data:d})).ok()).toBeTruthy();
 expect((await request.put(api+'/profiles/me',{headers,data:{first_name:'Synthetic',last_name:'Resources',nationality:'France',current_country:'France',current_city:'Paris',marital_status:'single',age:28,education:'bachelor',experience_years:3,occupation:'Administrative officer',noc_code:'13100',preferred_province:'Ontario'}})).ok()).toBeTruthy();
 const context=await (await request.get(api+'/application-cases/context',{headers})).json();
 await page.addInitScript(({session,language})=>{if(!sessionStorage.getItem('resource-seeded')){localStorage.setItem('token',session.access_token);localStorage.setItem('current_user',JSON.stringify(session.user));localStorage.setItem('user',JSON.stringify(session.user));localStorage.setItem('language',language);localStorage.setItem('i18nextLng',language);localStorage.setItem('nbai_sop_guide_seen_v1','true');sessionStorage.setItem('resource-seeded','true');}},{session,language});
 return {headers,context};
}
for(const language of ['en','fr']){
 const fr=language==='fr';
 test('In-app official processing and jurisdiction '+language,async({page,request})=>{
  await owner(page,request,language);await page.setViewportSize({width:390,height:844});await page.goto('/strategy#processing-times');
  const processing=page.getByRole('region',{name:fr?'Recherche des délais':'Processing-time search'});
  await processing.getByRole('combobox',{name:fr?'Type de demande':'Application category',exact:true}).selectOption('visitor_visa_inside_canada');
  await expect(processing.getByRole('status')).toHaveText('12 days');
  await expect(processing).toContainText('October 21, 2026');
  await processing.getByRole('combobox',{name:fr?'Type de demande':'Application category',exact:true}).selectOption('visitor_visa_outside_canada');
  await processing.getByRole('combobox',{name:fr?'Pays applicable':'Applicable country',exact:true}).selectOption('FR');
  await expect(processing.getByRole('status')).toHaveText('37 days');
  await expect(processing).toContainText(fr?'Non indiquée':'Not supplied');
  await expect(processing).toContainText(fr?'pas une prévision personnelle':'not a personal prediction');
  await processing.getByRole('combobox',{name:fr?'Pays applicable':'Applicable country',exact:true}).selectOption('CA');
  await expect(processing.getByRole('status')).toContainText(fr?'Aucune estimation disponible':'No estimate available');
  const programs=page.getByRole('region',{name:fr?'Références territoriales':'Jurisdiction references'});
  await programs.getByRole('combobox',{name:fr?'Lieu d’établissement':'Settlement jurisdiction',exact:true}).selectOption('QC');
  await programs.getByRole('button',{name:fr?'Consulter les références':'Browse references',exact:true}).click();
  await expect(programs.getByText('QC · quebec_selection',{exact:true})).toBeVisible();
  await expect(programs.getByText(/· pnp/)).toHaveCount(0);
  await expect(programs).toContainText('UNDER_REVIEW');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 });
 test('In-app DLI shortlist and paid ownership '+language,async({page,request})=>{
  const {headers,context}=await owner(page,request,language);
  await page.goto('/official-finders?tab=schools');
  await expect(page.getByRole('heading',{name:'SYNTHETIC Maple College',exact:true})).toBeVisible();
  await page.getByLabel(fr?'Rechercher les fiches officielles':'Search official records',{exact:true}).fill('Maple');
  await page.getByLabel(fr?'Province ou territoire':'Province or territory',{exact:true}).fill('ON');
  await page.getByRole('button',{name:fr?'Rechercher / actualiser':'Search / refresh',exact:true}).click();
  await expect(page.getByRole('heading',{name:'SYNTHETIC Laurent School',exact:true})).toHaveCount(0);
  const save=page.getByRole('button',{name:fr?'Enregistrer dans la liste du dossier (Pro)':'Save to case shortlist (Pro)',exact:true});
  await expect(save).toBeDisabled();
  expect((await request.post(api+'/_test/sprint2-access',{headers,data:{plan:'individual_pro'}})).ok()).toBeTruthy();
  await page.reload();await expect(save.first()).toBeEnabled();await save.first().click();
  const shortlist=page.getByRole('region',{name:fr?'Liste de ressources du dossier':'Case resource shortlist'});
  await expect(shortlist).toContainText('SYNTHETIC Maple College');
  const path=api+'/preparation/cases/'+context.case_id+'/resource-shortlist';
  const saved=await (await request.get(path,{headers})).json();expect(saved).toHaveLength(1);
  const again=await request.post(path,{headers,data:{kind:'dli',resource_id:saved[0].resource.id}});expect(again.ok()).toBeTruthy();
  expect(await (await request.get(path,{headers})).json()).toHaveLength(1);
  await page.reload();await expect(shortlist).toContainText('SYNTHETIC Maple College');
  expect((await request.post(api+'/_test/sprint2-access',{headers,data:{plan:'free'}})).ok()).toBeTruthy();
  await page.reload();await expect(shortlist).toContainText('SYNTHETIC Maple College');
  await shortlist.getByRole('button',{name:fr?'Retirer la ressource enregistrée':'Remove saved resource',exact:true}).click();
  await expect(shortlist).toContainText(fr?'Aucune ressource enregistrée.':'No saved resources.');
 });
 test('Centre discovery and restricted source '+language,async({page,request})=>{
  await owner(page,request,language);await page.goto('/official-finders?tab=tests');
  await expect(page.getByRole('heading',{name:'SYNTHETIC CELPIP Centre',exact:true})).toBeVisible();
  await expect(page.getByText('1 Example Road, Ottawa, ON K1A 0A1, Canada',{exact:true})).toBeVisible();
  for(const provider of ['ielts','pte','tef']){
   await page.getByRole('combobox',{name:fr?'Fournisseur du test':'Test provider',exact:true}).selectOption(provider);
   await expect(page.getByRole('heading',{name:'SYNTHETIC '+provider+' Centre',exact:true})).toBeVisible();
  }
  await page.getByRole('combobox',{name:fr?'Fournisseur du test':'Test provider',exact:true}).selectOption('tcf');
  await expect(page.getByText(fr?'Les fiches fiables sont indisponibles. Utilisez le lien officiel de vérification.':'Reliable location records are unavailable from this source. Use the official verification link.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'SYNTHETIC CELPIP Centre',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:fr?'Vérifier la source officielle':'Verify official source',exact:true})).toHaveAttribute('href','https://www.france-education-international.fr/centres-d-examen/carte');
 });
}
