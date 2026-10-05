import { test, expect } from "./fixtures";
const api = "http://127.0.0.1:8010";
for (const language of ["en", "fr"]) {
  for (const plan of ["free", "pro", "premium"]) {
    test(`beta checkout ${language} ${plan}`, async ({ page, request }) => {
      const email = `beta-${language}-${plan}-${Date.now()}@example.com`;
      const password = "Beta-test-2026!";
      await request.post(`${api}/_test/reset`);
      expect((await request.post(`${api}/auth/register`, {data:{email,password}})).status()).toBe(200);
      const session = await (await request.post(`${api}/auth/login`,{form:{username:email,password}})).json();
      const headers = {Authorization:`Bearer ${session.access_token}`};
      const requirements = await (await request.get(`${api}/disclosures/requirements`)).json();
      for (const d of requirements.required_disclosures) await request.post(`${api}/disclosures/accept`,{headers,data:d});
      await request.put(`${api}/profiles/me`,{headers,data:{first_name:"Beta",last_name:"Tester",nationality:"France",current_country:"France",current_city:"Paris",marital_status:"single",age:28,education:"bachelor",language_score:9,english_language_score:9,experience_years:3,occupation:"Administrative officer",noc_code:"13100",preferred_province:"Ontario"}});
      const bootstrap = await (await request.get(`${api}/app/bootstrap`,{headers})).json();
      bootstrap.user.plan = plan === "free" ? "free" : `individual_${plan}`;
      bootstrap.access = {...bootstrap.access, plan, is_pro:plan!=="free",is_premium:plan==="premium",is_free:plan==="free"};
      const status = {...bootstrap.user, subscription_status:plan === "free" ? null : "active"};
      await page.addInitScript(({session,language})=>{
        localStorage.setItem("token",session.access_token);
        localStorage.setItem("current_user",JSON.stringify(session.user));
        localStorage.setItem("user",JSON.stringify(session.user));
        localStorage.setItem("language",language); localStorage.setItem("i18nextLng",language);
        localStorage.setItem("PAID_CHECKOUT_ENABLED","true");
      },{session,language});
      await page.route("**/app/bootstrap",r=>r.fulfill({json:bootstrap}));
      await page.route("**/auth/me",r=>r.fulfill({json:bootstrap.user}));
      await page.route("**/billing/access",r=>r.fulfill({json:bootstrap.access}));
      await page.route("**/billing/me",r=>r.fulfill({json:status}));
      let purchases=0;
      await page.route("**/billing/create-checkout-session",r=>{purchases++;return r.abort();});
      await page.goto("/pricing?plan=pro&intent=checkout&success=true");
      const beta=language==="fr"?"Accès bêta sur invitation":"Beta access by invitation";
      await expect(page.getByTestId("beta-checkout-disabled").first()).toHaveText(beta);
      await expect(page.getByRole("status").filter({hasText:beta})).toBeVisible();
      await expect(page.getByText(language==="fr"?"Impossible de confirmer le paiement.":"Unable to confirm payment.",{exact:false})).toBeVisible();
      await expect(page.getByRole("button",{name:beta})).toHaveCount(0);
      expect(purchases).toBe(0);
      expect(page.url()).toContain("127.0.0.1:4173/pricing");
      await page.goto("/upgrade");
      await expect(page).toHaveURL(/pricing.*intent=upgrade/);
      await expect(page.getByTestId("beta-checkout-disabled").first()).toHaveText(beta);
      await page.goto("/billing");
      await expect(page.getByTestId("beta-checkout-disabled").first()).toHaveText(beta);
      await page.goto("/billing/success?session_id=unverified");
      await expect(page.getByRole("heading", {name:language === "fr" ? "Statut de facturation" : "Billing status",exact:true})).toBeVisible();
      await expect(page.getByText(language === "fr" ? "Paiement confirm\u00e9" : "Payment confirmed",{exact:true})).toHaveCount(0);
      await page.goto("/pricing?plan=pro&intent=checkout");
      // Capability failure also fails closed; a client-controlled flag cannot enable it.
      await page.route("**/billing/plans",r=>r.fulfill({status:503,json:{detail:"unavailable"}}));
      await page.reload();
      await expect(page.getByTestId("beta-checkout-disabled").first()).toHaveText(beta);
      expect(purchases).toBe(0);
    });
  }
}
