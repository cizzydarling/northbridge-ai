import { test, expect } from './fixtures';

const api = 'http://127.0.0.1:8010';
for (const language of ['en', 'fr']) {
  test(`chat ${language}: real handoff, useful AI and honest degradation`, async ({ page, request }) => {
    test.setTimeout(180000);
    const email = `chat-${Date.now()}@example.com`, password = 'Chat-test-2026!';
    expect((await request.post(`${api}/auth/register`, { data: { email, password } })).status()).toBe(200);
    const session = await (await request.post(`${api}/auth/login`, { form: { username: email, password } })).json();
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const requirements = await (await request.get(`${api}/disclosures/requirements`)).json();
    for (const item of requirements.required_disclosures) await request.post(`${api}/disclosures/accept`, { headers, data: item });
    expect((await request.put(`${api}/profiles/me`, { headers, data: {
      first_name: 'Test', last_name: 'Owner', nationality: 'France', current_country: 'France',
      current_city: 'Paris', marital_status: 'single', age: 30, education: 'bachelor',
      language_score: 8, english_language_score: 8, experience_years: 3, occupation: 'Administrative officer',
      noc_code: '13100', preferred_language: language, preferred_province: 'Ontario',
    } })).status()).toBe(200);
    expect((await request.get(`${api}/application-cases/context`, { headers })).status()).toBe(200);
    expect((await (await request.get(`${api}/app/bootstrap`, { headers })).json()).profile_complete).toBe(true);
    await page.addInitScript(({ session, language }) => {
      localStorage.setItem('token', session.access_token);
      localStorage.setItem('current_user', JSON.stringify(session.user));
      localStorage.setItem('user', JSON.stringify(session.user));
      localStorage.setItem('language', language);
      localStorage.setItem('i18nextLng', language);
      // Verify navigation intent without permitting any external browser request.
      window.open = (...args) => { window.chatOpenedAction = args; };
    }, { session, language });
    await page.goto('/chat');
    await page.getByRole('button', { name: language === 'fr' ? 'Compris' : 'Got it', exact: true }).click();
    const send = page.getByRole('button', { name: language === 'fr' ? 'Envoyer' : 'Send', exact: true });
    await page.locator('textarea').fill(language === 'fr' ? 'Calcule mon SCG.' : 'Calculate my CRS.');
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/ai/chat'));
    await send.click();
    const body = await (await responsePromise).json();
    expect(body.ai_status).toBe('not_requested');
    expect(body.response_mode).toBe('official_handoff');
    await page.getByRole('button', { name: language === 'fr' ? 'Calculateur officiel du SCG' : 'Official CRS calculator', exact: true }).click();
    expect(await page.evaluate(() => window.chatOpenedAction)).toEqual([
      'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html', '_blank', 'noopener,noreferrer',
    ]);
    await page.locator('textarea').fill(language === 'fr' ? 'Explique la CEC.' : 'Explain CEC.');
    const conceptPromise = page.waitForResponse(r => r.url().endsWith('/ai/chat'));
    await send.click();
    const concept = await (await conceptPromise).json();
    expect(concept.ai_status).toBe('not_requested');
    await expect(page.getByText(concept.reply, { exact: true })).toBeVisible();
    expect(concept.reply).toContain(language === 'fr' ? 'Consignez séparément' : 'Record each work period');
    const reply = language === 'fr' ? 'Organisez vos renseignements sans supposer les faits inconnus.' : 'Organize your information without guessing unknown facts.';
    const limitation = language === 'fr' ? 'La progression ne confirme pas la conformité officielle.' : 'Progress does not confirm official completeness.';
    await page.route('**/ai/chat', route => route.fulfill({ json: { reply, insights: [], limitations: [limitation], suggested_next_actions: [], ai_status: 'available', response_mode: 'ai' } }));
    await page.locator('textarea').fill(language === 'fr' ? 'Aide-moi à organiser mes documents.' : 'Help organize my documents.');
    await send.click();
    await expect(page.getByText(reply, { exact: true })).toBeVisible();
    await expect(page.getByText(limitation, { exact: true })).toBeVisible();
    await page.unroute('**/ai/chat');
    await page.locator('textarea').fill(language === 'fr' ? 'Rédige une question polie pour mon conseiller.' : 'Draft a polite question for my adviser.');
    const failurePromise = page.waitForResponse(r => r.url().endsWith('/ai/chat'));
    await send.click();
    const failure = await (await failurePromise).json();
    expect(failure.ai_status).toBe('unavailable');
    expect(failure.response_mode).toBe('fallback');
    await expect(page.getByText(failure.reply, { exact: true })).toBeVisible();
  });
}
