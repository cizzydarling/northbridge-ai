import { test, expect } from "./fixtures";
const api="http://127.0.0.1:8010";
async function account(request, suffix) {
  const email=`family-${Date.now()}-${suffix}@example.com`;
  const r=await request.post(`${api}/auth/register`,{data:{email,password:"Household-test-2026!"}});
  expect(r.status(),await r.text()).toBe(200);
  const login=await request.post(`${api}/auth/login`,{form:{username:email,password:"Household-test-2026!"}});
  expect(login.status(),await login.text()).toBe(200);
  const session=await login.json();const headers={Authorization:`Bearer ${session.access_token}`};
  const requirements=(await (await request.get(`${api}/disclosures/requirements`)).json()).required_disclosures;
  for(const d of requirements)expect((await request.post(`${api}/disclosures/accept`,{headers,data:{disclosure_type:d.disclosure_type,disclosure_version:d.disclosure_version,accepted_text_snapshot:d.accepted_text_snapshot}})).status()).toBe(200);
  expect((await request.put(`${api}/profiles/me`,{headers,data:{first_name:"Family",last_name:"Owner",nationality:"France",current_country:"France",current_city:"Paris",marital_status:"married",preferred_language:"en",age:28,education:"bachelor",language_score:9,english_language_score:9,experience_years:3,occupation:"Administrative officer",noc_code:"13100",preferred_province:"Ontario"}})).status()).toBe(200);
  return {session,headers};
}
for(const lang of ["en","fr"])test(`Household V1 ${lang}: members, cases, documents and recovery`,async({page,request})=>{
  test.setTimeout(300000);
  page.setDefaultTimeout(30000);
  const {session,headers}=await account(request,lang);const fr=lang==="fr";const failures=[];
  page.on("pageerror",e=>failures.push(e.message));
  page.on("response",r=>{if(r.url().startsWith(api)&&r.status()>=500)failures.push(`${r.status()} ${r.url()}`);});
  await page.goto("/auth");
  await page.evaluate(({session,lang})=>{localStorage.setItem("token",session.access_token);localStorage.setItem("current_user",JSON.stringify(session.user));localStorage.setItem("user",JSON.stringify(session.user));localStorage.setItem("language",lang);localStorage.setItem("i18nextLng",lang);localStorage.setItem("nbai_active_application_case_id","999999");},{session,lang});
  await page.goto("/household");
  await expect(page.getByRole("heading",{name:fr?"Ménage":"Household",exact:true})).toBeVisible();
  await expect(page.getByText(fr?"VOUS — Demandeur principal":"YOU — Primary applicant",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:fr?"Compris":"Got it",exact:true}).click();
  for(const [name,relationship] of [["Partner","common_law_partner"],["Child One","child"],["Child Two","child"]]){
    await page.getByLabel(fr?"Prénom":"Given name",{exact:true}).fill(name);
    await page.getByLabel(fr?"Lien familial":"Relationship",{exact:true}).selectOption(relationship);
    await page.getByRole("button",{name:fr?"Enregistrer le membre":"Save member",exact:true}).click();
    await expect(page.getByText(name,{exact:true})).toBeVisible();
  }
  const members=await (await request.get(`${api}/households/members`,{headers})).json();const children=members.filter(m=>m.relationship_to_primary==="child");
  await page.goto("/applications?case_id=999999");
  await expect(page.getByRole("alert")).toContainText(fr?"indisponible":"unavailable");
  await page.getByLabel("Partner participation",{exact:true}).selectOption("accompanying");
  await page.getByLabel("Child One participation",{exact:true}).selectOption("non_accompanying");
  await page.getByLabel("Child Two participation",{exact:true}).selectOption("unknown");
  await page.getByRole("button",{name:fr?"Enregistrer la demande":"Save application",exact:true}).click();
  await expect.poll(async()=> (await (await request.get(`${api}/application-cases/context`,{headers})).json()).family_size).toBe(4);
  await page.reload();await expect(page.getByLabel("Child Two participation",{exact:true})).toHaveValue("unknown");
  await page.goto("/documents");
  const first=page.getByTestId(`family-document-${children[0].id}`);const second=page.getByTestId(`family-document-${children[1].id}`);
  await expect(first).toBeVisible({timeout:120000});await expect(second).toBeVisible();
  await first.getByRole("checkbox").check();await expect(first.getByRole("checkbox")).toBeEnabled();await expect(first.getByRole("checkbox")).toBeChecked();await expect(second.getByRole("checkbox")).not.toBeChecked();
  await page.reload();await expect(first.getByRole("checkbox")).toBeChecked({timeout:120000});await expect(second.getByRole("checkbox")).not.toBeChecked();
  await page.goto("/applications");await page.getByRole("button",{name:fr?"Nouvelle demande":"New application",exact:true}).click();
  await expect.poll(async()=> (await (await request.get(`${api}/application-cases`,{headers})).json()).length).toBe(2);
  const current=await (await request.get(`${api}/application-cases/context`,{headers})).json();
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:fr?"Archiver":"Archive",exact:true}).click();
  await expect.poll(async()=> (await (await request.get(`${api}/application-cases`,{headers})).json()).length).toBe(1);
  await page.goto(`/applications?case_id=${current.case_id}`);await expect(page.getByRole("heading",{name:fr?"Demandes":"Applications",exact:true})).toBeVisible();
  if (!fr) {
  const original=(await (await request.get(`${api}/application-cases/context`,{headers})).json()).case_id;
  await page.evaluate(()=>{localStorage.removeItem("token");localStorage.removeItem("current_user");localStorage.removeItem("user");});
  await page.goto("/household");await expect(page).toHaveURL(/\/auth/);
  const another=await account(request,`${lang}-second`);
  await page.evaluate(({session})=>{localStorage.setItem("token",session.access_token);localStorage.setItem("current_user",JSON.stringify(session.user));localStorage.setItem("user",JSON.stringify(session.user));},{session:another.session});
  await page.goto(`/applications?case_id=${original}`);
  await expect(page.getByRole("alert")).toContainText(fr?"indisponible":"unavailable");
  await expect(page.getByLabel("Child One participation",{exact:true})).toHaveCount(0);
  const own=(await (await request.get(`${api}/application-cases/context`,{headers:another.headers})).json()).case_id;
  expect(own).not.toBe(original);
  }
  expect(failures).toEqual([]);
});
