import { test, expect } from './fixtures';
const api = 'http://127.0.0.1:8010';

async function prepare(page, request, language) {
  const email = `feedback-${Date.now()}@example.com`;
  const password = 'Feedback-test-2026!';
  expect((await request.post(`${api}/auth/register`, { data: { email, password } })).status()).toBe(200);
  const session = await (await request.post(`${api}/auth/login`, { form: { username: email, password } })).json();
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const requirements = await (await request.get(`${api}/disclosures/requirements`)).json();
  for (const item of requirements.required_disclosures) {
    expect((await request.post(`${api}/disclosures/accept`, { headers, data: item })).status()).toBe(200);
  }
  await request.put(`${api}/profiles/me`, { headers, data: { first_name:'Beta', last_name:'Tester', nationality:'France', current_country:'France', current_city:'Paris', marital_status:'single', age:28, education:'bachelor', language_score:9, english_language_score:9, experience_years:3, occupation:'Administrative officer', noc_code:'13100', preferred_province:'Ontario' } });
  await request.get(`${api}/application-cases/context`, { headers });
  await page.addInitScript(({ session, language }) => {
    localStorage.setItem('token', session.access_token);
    localStorage.setItem('current_user', JSON.stringify(session.user));
    localStorage.setItem('user', JSON.stringify(session.user));
    localStorage.setItem('language', language);
    localStorage.setItem('nbai_sop_guide_seen_v1', 'true');
    for (const module of ['strategy','documents','generator','forms']) localStorage.setItem(`nbai_feature_guide_seen_v1_${module}`, 'true');
    localStorage.setItem('nbai_onboarding_modal_dismissed_until_v3', String(Date.now() + 86400000));
  }, { session, language });
}

for (const language of ['en', 'fr']) {
  test(`beta feedback ${language}: submit, privacy, failure, keyboard and responsive pages`, async ({ page, request }) => {
    test.setTimeout(300000);
    await prepare(page, request, language);
    const fr = language === 'fr';
    const title = fr ? 'Commentaires bêta' : 'Beta Feedback';
    const payloads = [];
    page.on('request', r => { if (new URL(r.url()).pathname === '/feedback') payloads.push(r.postDataJSON()); });
    await page.goto('/dashboard');
    const trigger = page.getByRole('button', { name: title, exact: true });
    await expect(trigger).toBeVisible();
    expect(payloads).toHaveLength(0);
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#feedback-category')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator('#feedback-category').selectOption('bug');
    await page.locator('#feedback-message').fill('The feedback button is easy to find.');
    const response = page.waitForResponse(r => r.url().endsWith('/feedback'));
    await page.getByRole('button', { name: fr ? 'Envoyer le commentaire' : 'Send feedback', exact: true }).click();
    expect((await response).status()).toBe(201);
    await expect(dialog.getByRole('status')).toContainText(fr ? 'Merci' : 'Thanks');
    expect(payloads).toHaveLength(1);
    expect(Object.keys(payloads[0]).sort()).toEqual(['allow_follow_up','application_version','category','device_context','language','message','page_path','rating'].sort());
    expect(payloads[0].application_version).toMatch(/^[a-f0-9]{40}(-dirty)?$/);
    await page.getByRole('button', { name: fr ? 'Fermer' : 'Close', exact: true }).click();

    for (const [path, width, height] of [['/household',1280,800],['/strategy',768,1024],['/documents',390,844],['/chat',390,844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(path + '?private=must-not-capture#private');
      await expect(trigger).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const box = await trigger.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await trigger.click();
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path:`test-results/feedback-${language}-${width}-${path.slice(1)}.png` });
      await page.keyboard.press('Escape');
    }
    await page.route('**/ai/chat', route => route.fulfill({ json: {
      ai_status:'unavailable', response_mode:'fallback', reply:'Synthetic private reply not to capture.',
      insights:[], limitations:[], suggested_next_actions:[],
    } }));
    await page.locator('textarea').fill('Synthetic private prompt not to capture.');
    await page.getByRole('button', {name:fr ? 'Envoyer' : 'Send',exact:true}).click();
    await expect(page.getByText('Synthetic private reply not to capture.', {exact:true})).toBeVisible();
    // Simulate a transient500; retry preserves draft and a double click submits once.
    let calls = 0;
    await page.route('**/feedback', async route => {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 250));
      await route.fulfill(calls === 1 ? { status:500, json:{detail:'test failure'} } : { status:201, json:{success:true,feedback_id:999} });
    });
    await trigger.click();
    await page.locator('#feedback-category').selectOption('ai');
    await page.locator('#feedback-message').fill('Please explain the unavailable label more clearly.');
    const send = page.getByRole('button', { name:fr ? 'Envoyer le commentaire' : 'Send feedback', exact:true });
    await send.click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(page.locator('#feedback-message')).toHaveValue('Please explain the unavailable label more clearly.');
    await send.evaluate(button => { button.click(); button.click(); });
    await expect(dialog.getByRole('status')).toBeVisible();
    expect(calls).toBe(2);
    expect(payloads.at(-1).page_path).toBe('/chat');
    expect(payloads.at(-1).ai_status).toBe('unavailable');
    expect(JSON.stringify(payloads.at(-1))).not.toContain('Synthetic private');
    await page.screenshot({ path:`test-results/beta-feedback-${language}-mobile.png` });
    expect((await request.get(`${api}/clients`)).status()).toBe(404);
  });
}

test('feedback remains usable during entitlement loading and never fetches feedback history', async ({page, request}) => {
  await prepare(page, request, 'en');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/billing/access', async route => { await gate; await route.continue(); });
  const requests = [];
  page.on('request', r => { if (new URL(r.url()).pathname.includes('feedback')) requests.push(r.method()); });
  await page.goto('/pricing');
  await page.getByRole('button', {name:'Beta Feedback',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#feedback-message').fill('Draft remains while entitlement resolves.');
  release();
  await expect(page.locator('#feedback-message')).toHaveValue('Draft remains while entitlement resolves.');
  expect(requests).toEqual([]);
});
