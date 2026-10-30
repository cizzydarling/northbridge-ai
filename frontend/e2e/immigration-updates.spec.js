import {test,expect} from './fixtures';
const api='http://127.0.0.1:8010';

async function syntheticOwner(page,request,language){
 const email='updates-'+Date.now()+'-'+language+'@example.com',password='Synthetic-Updates-2026!';
 expect((await request.post(api+'/auth/register',{data:{email,password}})).ok()).toBeTruthy();
 const response=await request.post(api+'/auth/login',{form:{username:email,password}});
 expect(response.ok()).toBeTruthy();
 const session=await response.json(),headers={Authorization:'Bearer '+session.access_token};
 const requirements=await (await request.get(api+'/disclosures/requirements')).json();
 for(const disclosure of requirements.required_disclosures)expect((await request.post(api+'/disclosures/accept',{headers,data:disclosure})).ok()).toBeTruthy();
 expect((await request.put(api+'/profiles/me',{headers,data:{first_name:'Synthetic',last_name:'Updates',current_country:'France',current_city:'Paris',nationality:'France',marital_status:'single',preferred_language:language,age:28,education:'bachelor',experience_years:3,occupation:'Administrative officer',noc_code:'13100',preferred_province:'Ontario'}})).ok()).toBeTruthy();
 expect((await (await request.get(api+'/app/bootstrap',{headers})).json()).profile_complete).toBe(true);
 await page.addInitScript(({session,language})=>{if(!sessionStorage.getItem('updates-seeded')){localStorage.setItem('token',session.access_token);localStorage.setItem('current_user',JSON.stringify(session.user));localStorage.setItem('user',JSON.stringify(session.user));localStorage.setItem('language',language);localStorage.setItem('i18nextLng',language);localStorage.setItem('nbai_sop_guide_seen_v1','true');sessionStorage.setItem('updates-seeded','true');}},{session,language});
 return {headers};
}

for(const language of ['en','fr']){
 test('Historical draw snapshots and Free boundaries '+language,async({page,request})=>{
  const fr=language==='fr';const {headers}=await syntheticOwner(page,request,language);
  await page.setViewportSize({width:390,height:844});await page.goto('/strategy#immigration-updates');
  const region=page.getByRole('region',{name:fr?'Actualités historiques sur l’immigration':'Historical immigration updates'});
  await expect(region.getByRole('heading',{name:/#9002/})).toBeVisible();
  await expect(region).toContainText('2026-10-28');
  await expect(region).toContainText('1500');
  await expect(region).toContainText('450');
  await expect(region).toContainText('2026-10-01T09:00:00+00:00');
  await expect(region).toContainText(fr?'Non indiqué / fuseau horaire inconnu':'Not supplied / timezone unknown');
  await expect(region).toContainText(fr?'ne prédisent pas':'not future invitation probabilities');
  await expect(region).toContainText('crs-2025-03-25');
  expect((await (await request.get(api+'/immigration-intelligence/draws',{headers})).json()).locked).toBeTruthy();
  await region.getByLabel(fr?'Catégorie de ronde':'Draw category',{exact:true}).fill('does-not-exist');
  await region.getByRole('button',{name:fr?'Rechercher dans l’historique':'Search history',exact:true}).click();
  await expect(region).toContainText(fr?'Aucune fiche historique correspondante.':'No matching historical records.');
  await expect(region.getByRole('heading',{name:/#9002/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 });
}

test('Historical reference retry recovers without stale data or writes',async({page,request})=>{
 await syntheticOwner(page,request,'en');let fail=true;
 await page.route('**/immigration-intelligence/draws?*',async route=>{if(fail)await route.abort('failed');else await route.continue();});
 await page.goto('/strategy#immigration-updates');
 const region=page.getByRole('region',{name:'Historical immigration updates'});
 await expect(region.getByRole('alert')).toContainText('No results were invented.');
 fail=false;await region.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(region.getByRole('heading',{name:/#9002/})).toBeVisible();
 await expect(region.getByRole('alert')).toHaveCount(0);
});
