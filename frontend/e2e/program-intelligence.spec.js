import {test, expect} from './fixtures';
const api = 'http://127.0.0.1:8010';

async function synthetic(page, request, language) {
  const email = `program-reference-${Date.now()}-${language}@example.com`;
  const password = 'Synthetic-Reference-2026!';
  expect((await request.post(api+'/auth/register',{data:{email,password}})).ok()).toBeTruthy();
  const session = await (await request.post(api+'/auth/login',{form:{username:email,password}})).json();
  const headers = {Authorization:'Bearer '+session.access_token};
  const requirements = await (await request.get(api+'/disclosures/requirements')).json();
  for(const disclosure of requirements.required_disclosures)
    expect((await request.post(api+'/disclosures/accept',{headers,data:disclosure})).ok()).toBeTruthy();
  expect((await request.put(api+'/profiles/me',{headers,data:{first_name:'Synthetic',last_name:'Program',nationality:'France',current_country:'France',current_city:'Paris',marital_status:'single',age:28,education:'bachelor',experience_years:3,occupation:'Administrative officer',noc_code:'13100',preferred_province:'Ontario'}})).ok()).toBeTruthy();
  expect((await request.get(api+'/application-cases/context',{headers})).ok()).toBeTruthy();
  await page.addInitScript(({session,language})=>{
    localStorage.setItem('token',session.access_token);
    localStorage.setItem('current_user',JSON.stringify(session.user));
    localStorage.setItem('user',JSON.stringify(session.user));
    localStorage.setItem('language',language);localStorage.setItem('i18nextLng',language);
    localStorage.setItem('nbai_sop_guide_seen_v1','true');
  },{session,language});
  return {headers,session};
}

for(const language of ['en','fr']) test('Free reviewed program references and jurisdiction safeguards '+language,async({page,request})=>{
  const fr=language==='fr';const {headers}=await synthetic(page,request,language);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/strategy#program-references');
  const programs=page.locator('#program-references');
  await expect(programs.getByRole('heading',{name:fr?'Catégorie de l’expérience canadienne':'Canadian Experience Class',exact:true})).toBeVisible();
  await expect(programs).toContainText(fr?'trois années précédentes':'preceding three years');
  await expect(programs).toContainText(fr?'grille de sélection est distincte du SCG':'selection grid is not CRS');
  await expect(programs).toContainText(fr?'Acceptation indépendante':'Independent criteria acceptance');
  const reference=await(await request.get(api+'/program-registry?browse=true',{headers})).json();
  expect(reference.eligibility).toBe('not_assessed');expect(reference.automatic_activation).toBe(false);
  expect(reference.records.filter(r=>r.identifier.startsWith('federal.')&&r.criteria)).toHaveLength(3);
  for(const jurisdiction of ['QC','NU']){
    await programs.getByLabel(fr?'Lieu d’établissement':'Settlement jurisdiction').selectOption(jurisdiction);
    await programs.getByRole('button',{name:fr?'Consulter les références':'Browse references',exact:true}).click();
    if(jurisdiction==='QC'){
      await expect(programs).toContainText('QC · quebec_selection');
      await expect(programs.getByRole('heading',{name:fr?'Catégorie de l’expérience canadienne':'Canadian Experience Class',exact:true})).toHaveCount(0);
    }else await expect(programs.getByRole('heading',{name:fr?'Catégorie de l’expérience canadienne':'Canadian Experience Class',exact:true})).toBeVisible();
    const filtered=await(await request.get(api+'/program-registry?browse=true&jurisdiction='+jurisdiction,{headers})).json();
    expect(filtered.records.some(r=>r.family==='pnp')).toBe(false);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await request.get(api+'/program-registry?browse=true')).status()).toBe(401);
});
