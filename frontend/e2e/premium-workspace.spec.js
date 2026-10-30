import { test, expect } from './fixtures';
const api = 'http://127.0.0.1:8010';
async function synthetic(request, suffix) {
  const email = 'premium-workspace-' + Date.now() + '-' + suffix + '@example.com',
    password = 'Synthetic-Workspace-2026!';
  expect((await request.post(api + '/auth/register', {
    data: {
      email,
      password
    }
  })).ok()).toBeTruthy();
  const session = await (await request.post(api + '/auth/login', {
    form: {
      username: email,
      password
    }
  })).json();
  const headers = {
    Authorization: 'Bearer ' + session.access_token
  };
  const req = await (await request.get(api + '/disclosures/requirements')).json();
  for (const d of req.required_disclosures) expect((await request.post(api + '/disclosures/accept', {
    headers,
    data: d
  })).ok()).toBeTruthy();
  expect((await request.put(api + '/profiles/me', {
    headers,
    data: {
      first_name: 'Synthetic',
      last_name: 'Workspace',
      nationality: 'France',
      current_country: 'France',
      current_city: 'Paris',
      marital_status: 'single',
      age: 28,
      education: 'bachelor',
      experience_years: 3,
      occupation: 'Administrative officer',
      noc_code: '13100',
      preferred_province: 'Ontario'
    }
  })).ok()).toBeTruthy();
  const context = await (await request.get(api + '/application-cases/context', {
    headers
  })).json();
  return {
    session,
    headers,
    context
  };
}
async function signIn(page, session, lang = 'en') {
  await page.addInitScript(({
    session,
    lang
  }) => {
    if (sessionStorage.getItem('premium-seeded')) return;
    sessionStorage.setItem('premium-seeded', '1');
    localStorage.setItem('token', session.access_token);
    localStorage.setItem('current_user', JSON.stringify(session.user));
    localStorage.setItem('user', JSON.stringify(session.user));
    localStorage.setItem('language', lang);
    localStorage.setItem('i18nextLng', lang);
    localStorage.setItem('nbai_sop_guide_seen_v1', 'true');
  }, {
    session,
    lang
  });
}
for (const lang of ['en', 'fr']) for (const width of [320, 390, 768, 1440]) {
  test('premium owned workspace ' + lang + ' ' + width, async ({
    page,
    request
  }, info) => {
    const a = await synthetic(request, lang + '-' + width);
    await signIn(page, a.session, lang);
    await page.setViewportSize({
      width,
      height: width >= 768 ? 1000 : 844
    });
    let mutations = 0;
    page.on('request', r => {
      if (r.url().startsWith(api) && !['GET', 'OPTIONS', 'HEAD'].includes(r.method())) mutations++;
    });
    await page.addInitScript(() => {
      window.__premiumTiming = {
        layoutShift: 0,
        readyMs: null,
        overviewMounts: 0
      };
      const seen = new WeakSet();
      new MutationObserver(() => {
        const root = document.querySelector('[data-testid="premium-overview"]');
        if (root && !seen.has(root)) {
          seen.add(root);
          window.__premiumTiming.overviewMounts++;
        }
        if (root?.dataset.state === 'ready' && window.__premiumTiming.readyMs === null) window.__premiumTiming.readyMs = performance.now();
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-state']
      });
      if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__premiumTiming.layoutShift += e.value;
      }).observe({
        type: 'layout-shift',
        buffered: true
      });
    });
    await page.goto('/dashboard');
    await expect(page.getByTestId('premium-overview')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByRole('heading', {
      level: 1,
      name: lang === 'fr' ? 'Votre préparation, en un coup d’œil.' : 'Your preparation, in view.'
    })).toBeVisible();
    await expect(page.locator('.premium-next-action .premium-primary-link')).toHaveCount(1);
    expect(await page.locator('.premium-secondary>a').count()).toBeLessThanOrEqual(3);
    await expect(page.getByText(lang === 'fr' ? 'Non confirmé' : 'Not confirmed', {
      exact: true
    }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(mutations).toBe(0);
    const facts = await page.locator('.premium-facts').innerText();
    expect(facts).not.toMatch(/[0-9]+%/);
    await page.locator('#preparation-priority').selectOption('resources');
    await expect(page.locator('.premium-next-action h2')).toHaveText(lang === 'fr' ? 'Vérifier la disponibilité des ressources officielles' : 'Check official resource availability');
    await page.locator('.premium-next-action .premium-primary-link').click();
    await expect(page.locator('#processing-times')).toBeVisible();
    await expect(page.locator('#program-references')).toBeAttached();
    await expect(page.getByRole('link', {
      name: lang === 'fr' ? 'Ouvrir le vérificateur IRCC' : 'Open the IRCC processing-time checker',
      exact: true
    })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 1024) await page.getByRole('button', {
      name: lang === 'fr' ? 'Ouvrir le menu' : 'Open menu',
      exact: true
    }).click();
    await page.getByRole('button', {
      name: lang === 'fr' ? 'Vue d’ensemble' : 'Overview',
      exact: true
    }).click();
    await expect(page.getByTestId('premium-overview')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('#preparation-priority')).toHaveValue('resources');
    await page.screenshot({
      path: info.outputPath('overview-' + lang + '-' + width + '.png'),
      fullPage: true
    });
    await page.emulateMedia({
      forcedColors: 'active',
      reducedMotion: 'reduce'
    });
    await expect(page.locator('.premium-primary-link')).toBeVisible();
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    expect(await page.locator('.premium-primary-link').evaluate(n => getComputedStyle(n).transitionDuration)).toBe('0s');
    await page.getByRole('link', {
      name: lang === 'fr' ? 'Aller au contenu' : 'Skip to content',
      exact: true
    }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#workspace-content')).toBeFocused();
    const metrics = await page.evaluate(() => ({
      initialView: window.__premiumTiming,
      navigation: performance.getEntriesByType('navigation').map(n => ({
        ttfb: n.responseStart - n.requestStart,
        domReady: n.domContentLoadedEventEnd,
        load: n.loadEventEnd
      })),
      paints: performance.getEntriesByType('paint').map(p => ({
        name: p.name,
        startTime: p.startTime
      })),
      resources: performance.getEntriesByType('resource').length,
      fonts: performance.getEntriesByType('resource').filter(r => /woff|ttf/.test(r.name)).length
    }));
    await info.attach('application-performance', {
      body: JSON.stringify({
        lang,
        width,
        ...metrics
      }),
      contentType: 'application/json'
    });
    await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'});
    await page.goto('/strategy#processing-times');
    await expect(page.getByRole('heading',{level:1,name:lang==='fr'?'Explorer le Canada':'Explore Canada',exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath('explore-'+lang+'-'+width+'.png'),fullPage:true});
    expect((await request.post(api+'/self/workspace',{headers:a.headers,data:{case_id:a.context.case_id,matter_type:a.context.case.application_type,intake:{first_name:'Synthetic',custom_note:'PRESERVE PREPARATION NOTE'}}})).ok()).toBeTruthy();
    let workspaceWrites=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/self/workspace'&&r.method()==='POST')workspaceWrites++;});
    await page.goto('/self/application');
    await expect(page.locator('.premium-preparation .premium-case-hero')).toBeVisible();
    await expect(page.getByRole('heading',{level:1,name:lang==='fr'?'Votre préparation reste connectée.':'Your preparation stays connected.',exact:true})).toBeVisible();
    expect(workspaceWrites).toBe(1);
    const retained=await(await request.get(api+'/self/application/saved?case_id='+a.context.case_id,{headers:a.headers})).json();expect(retained.intake_payload.custom_note).toBe('PRESERVE PREPARATION NOTE');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('preparation-'+lang+'-'+width+'.png'),fullPage:true});
  });
}
test('Overview retry after context failure; no stale case shown', async ({
  page,
  request
}) => {
  const a = await synthetic(request, 'retry');
  await signIn(page, a.session);
  let failed = true;
  await page.route('**/application-cases/context', r => failed ? r.fulfill({
    status: 503,
    json: {
      detail: 'unavailable'
    }
  }) : r.continue());
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toContainText('Case information could not be verified');
  await expect(page.locator('.premium-case-hero')).toHaveCount(0);
  failed = false;
  await page.getByRole('button', {
    name: 'Try again',
    exact: true
  }).click();
  await expect(page.getByTestId('premium-overview')).toHaveAttribute('data-state', 'ready');
});
test('changed active case rejects pending old case and resets choice scope', async ({
  page,
  request
}) => {
  const a = await synthetic(request, 'case-change');
  await signIn(page, a.session);
  const b = await (await request.post(api + '/application-cases', {
    headers: a.headers,
    data: {
      application_type: 'study_permit',
      case_title: 'NEW-OWNED-CASE'
    }
  })).json();
  expect((await request.post(api + '/application-cases/' + a.context.case_id + '/activate', {headers:a.headers})).ok()).toBeTruthy();
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  let started;
  const pending = new Promise(resolve => {
    started = resolve;
  });
  await page.route(url => url.pathname === '/self/application/saved', async r => {
    started();
    await gate;
    await r.continue();
  });
  await page.goto('/dashboard');
  await pending;
  expect((await request.post(api + '/application-cases/' + b.id + '/activate', {
    headers: a.headers
  })).ok()).toBeTruthy();
  release();
  await expect(page.getByRole('alert')).toContainText('Case information could not be verified');
  await expect(page.locator('.premium-case-hero')).toHaveCount(0);
  await page.unrouteAll({
    behavior: 'wait'
  });
  await page.getByRole('button', {
    name: 'Try again',
    exact: true
  }).click();
  await expect(page.locator('.premium-case-hero')).toContainText('NEW-OWNED-CASE');
  await expect(page.locator('#preparation-priority')).toHaveValue('');
});
test('saved Forms and draft links remain case-scoped without Overview writes', async ({
  page,
  request
}) => {
  const a = await synthetic(request, 'saved');
  const saved = await request.post(api + '/self/workspace', {
    headers: a.headers,
    data: {
      case_id: a.context.case_id,
      matter_type: a.context.case.application_type,
      intake: {
        first_name: 'Synthetic',
        custom_note: 'PRESERVE EXACT FORM VALUE'
      }
    }
  });
  expect(saved.ok()).toBeTruthy();
  const before = await (await request.get(api + '/self/application/saved?case_id=' + a.context.case_id, {
    headers: a.headers
  })).json();
  await signIn(page, a.session);
  await page.goto('/dashboard');
  await expect(page.getByTestId('premium-overview')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.premium-next-action .premium-primary-link')).toHaveAttribute('href', '/forms?case_id=' + a.context.case_id);
  const after = await (await request.get(api + '/self/application/saved?case_id=' + a.context.case_id, {
    headers: a.headers
  })).json();
  expect(after).toEqual(before);
});
test('My Preparation never regenerates from unavailable saved Forms', async ({
  page,
  request
}) => {
  const a = await synthetic(request, 'prep-unavailable');
  await signIn(page, a.session);
  let writes = 0;
  page.on('request', r => {
    if (r.url().includes('/self/workspace') && r.method() === 'POST') writes++;
  });
  await page.route(url => url.pathname === '/self/application/saved', r => r.fulfill({
    status: 503,
    json: {
      detail: 'unavailable'
    }
  }));
  await page.goto('/self/application');
  await expect(page.getByRole('alert')).toContainText('Failed to load your application');
  expect(writes).toBe(0);
  await expect(page.locator('.premium-case-hero')).toHaveCount(0);
});

test('late Overview facts cannot cross an account switch',async({page,context,request})=>{
 const a=await synthetic(request,'account-a');const b=await synthetic(request,'account-b');expect((await request.put(api+'/application-cases/'+a.context.case_id,{headers:a.headers,data:{case_title:'PRIVATE-ACCOUNT-A'}})).ok()).toBeTruthy();expect((await request.put(api+'/application-cases/'+b.context.case_id,{headers:b.headers,data:{case_title:'CURRENT-ACCOUNT-B'}})).ok()).toBeTruthy();await signIn(page,a.session);let release;const gate=new Promise(resolve=>{release=resolve;});let started;const pending=new Promise(resolve=>{started=resolve;});await page.route(url=>url.pathname==='/self/application/saved'&&url.searchParams.get('case_id')===String(a.context.case_id),async r=>{started();await gate;await r.continue();});await page.goto('/dashboard');await pending;const other=await context.newPage();await other.goto('/auth');await other.evaluate(session=>{localStorage.setItem('current_user',JSON.stringify(session.user));localStorage.setItem('user',JSON.stringify(session.user));localStorage.setItem('token',session.access_token);},b.session);await other.close();await expect(page.locator('.premium-case-hero')).toContainText('CURRENT-ACCOUNT-B');const oldResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/self/application/saved'&&new URL(r.url()).searchParams.get('case_id')===String(a.context.case_id));release();await oldResponse;await expect(page.locator('.premium-case-hero')).toContainText('CURRENT-ACCOUNT-B');await expect(page.getByText('PRIVATE-ACCOUNT-A',{exact:true})).toHaveCount(0);await expect(page.locator('#preparation-priority')).toHaveValue('');
});

// P2 review regressions: deferred responses, real synthetic ownership and no timing sleeps.
function deferredResponse() {
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  return {entered, enter, pending, release};
}
async function preservedForms(request, a) {
  const profile = await (await request.get(api + '/profiles/me', {headers:a.headers})).json();
  const strings = ['first_name','last_name','nationality','current_country','current_city','marital_status','preferred_language','education','occupation','noc_code','preferred_province'];
  const numbers = ['age','language_score','experience_years'];
  const intake = {custom_note:'P2 PRESERVE SAVED DATA',application_type:a.context.case.application_type};
  for (const key of strings) intake[key] = profile[key] || '';
  for (const key of numbers) intake[key] = profile[key] ?? '';
  expect((await request.post(api+'/self/workspace',{headers:a.headers,data:{case_id:a.context.case_id,matter_type:a.context.case.application_type,intake}})).ok()).toBeTruthy();
  return (await request.get(api+'/self/application/saved?case_id='+a.context.case_id,{headers:a.headers})).json();
}
for (const failure of ['saved Forms','workspace']) test('My Preparation Retry recovers after '+failure+' errors without changing saved Forms',async({page,request})=>{
  const a=await synthetic(request,'p2-retry-'+failure.replace(' ',''));const before=await preservedForms(request,a);await signIn(page,a.session);
  let failures=2,successfulWrites=0,workspaceRequests=0;
  await page.route(url=>url.pathname==='/self/application/saved'||url.pathname==='/self/workspace',async r=>{
    const workspace=new URL(r.request().url()).pathname==='/self/workspace';
    if(workspace)workspaceRequests++;
    if(failures>0 && workspace===(failure==='workspace')){failures--;await r.fulfill({status:503,json:{detail:'synthetic temporary failure'}});return;}
    const response=await r.fetch();if(workspace&&response.ok())successfulWrites++;await r.fulfill({response});
  });
  await page.goto('/self/application');await expect(page.getByRole('alert')).toContainText('Failed to load your application');await expect(page.locator('.premium-case-hero')).toHaveCount(0);
  await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Failed to load your application');expect(successfulWrites).toBe(0);
  await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.locator('.premium-case-hero')).toContainText('#'+a.context.case_id);await expect(page.getByRole('alert')).toHaveCount(0);
  expect(successfulWrites).toBe(1);expect(workspaceRequests).toBe(failure==='workspace'?3:1);
  for(const link of await page.locator('.premium-preparation a[href^="/forms?"]').all())await expect(link).toHaveAttribute('href','/forms?case_id='+a.context.case_id);
  const after=await(await request.get(api+'/self/application/saved?case_id='+a.context.case_id,{headers:a.headers})).json();expect(after.intake_payload).toEqual(before.intake_payload);
});
for (const mode of ['success','error','success without focus','error without focus']) test('My Preparation rejects delayed Case A '+mode+' and renders only active Case B',async({page,request})=>{
  const a=await synthetic(request,'p2-case-'+mode.replaceAll(' ',''));const b=await(await request.post(api+'/application-cases',{headers:a.headers,data:{application_type:'study_permit',case_title:'P2-AUTHORITATIVE-B'}})).json();expect((await request.post(api+'/application-cases/'+a.context.case_id+'/activate',{headers:a.headers})).ok()).toBeTruthy();await signIn(page,a.session);
  const old=deferredResponse(),fresh=deferredResponse();let oldWrites=0,newWrites=0;
  await page.route(url=>url.pathname==='/self/workspace',async r=>{
    const id=r.request().postDataJSON().case_id;
    if(id===a.context.case_id){oldWrites++;const response=mode.startsWith('error')?null:await r.fetch();old.enter();await old.pending;if(response)await r.fulfill({response});else await r.fulfill({status:503,json:{detail:'late old-case failure'}});}
    else if(id===b.id){newWrites++;const response=await r.fetch();fresh.enter();await fresh.pending;await r.fulfill({response});}
    else await r.continue();
  });
  await page.goto('/self/application');await old.entered;expect((await request.post(api+'/application-cases/'+b.id+'/activate',{headers:a.headers})).ok()).toBeTruthy();
  if(mode.includes('without focus'))old.release();else await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await fresh.entered;await expect(page.locator('.premium-case-hero')).toHaveCount(0);await expect(page.locator('.premium-preparation a[href^="/forms?"]')).toHaveCount(0);await expect(page.getByRole('status')).toBeVisible();
  fresh.release();await expect(page.locator('.premium-case-hero')).toContainText('P2-AUTHORITATIVE-B');
  if(!mode.includes('without focus')){const done=page.waitForResponse(r=>new URL(r.url()).pathname==='/self/workspace'&&r.request().postDataJSON().case_id===a.context.case_id);old.release();await(await done).finished();}
  await expect(page.locator('.premium-case-hero')).toContainText('#'+b.id);await expect(page.locator('.premium-case-hero')).not.toContainText('#'+a.context.case_id);await expect(page.getByRole('alert')).toHaveCount(0);
  const links=page.locator('.premium-preparation a[href^="/forms?"]');expect(await links.count()).toBeGreaterThan(0);for(const link of await links.all())await expect(link).toHaveAttribute('href','/forms?case_id='+b.id);
  expect(oldWrites).toBe(1);expect(newWrites).toBe(1);
});
for(const outcome of ['success','error'])test('My Preparation ignores old-account '+outcome+' after account switching',async({page,context,request})=>{
  const a=await synthetic(request,'p2-account-a-'+outcome),b=await synthetic(request,'p2-account-b-'+outcome);expect((await request.put(api+'/application-cases/'+b.context.case_id,{headers:b.headers,data:{case_title:'P2-CURRENT-ACCOUNT-B'}})).ok()).toBeTruthy();await signIn(page,a.session);const old=deferredResponse();
  await page.route(url=>url.pathname==='/self/workspace',async r=>{if(r.request().postDataJSON().case_id!==a.context.case_id){await r.continue();return;}const response=outcome==='success'?await r.fetch():null;old.enter();await old.pending;if(response)await r.fulfill({response});else await r.fulfill({status:503,json:{detail:'old account failure'}});});
  await page.goto('/self/application');await old.entered;const other=await context.newPage();await other.goto('/auth');await other.evaluate(session=>{localStorage.setItem('current_user',JSON.stringify(session.user));localStorage.setItem('user',JSON.stringify(session.user));localStorage.setItem('token',session.access_token);},b.session);await other.close();
  await expect(page.locator('.premium-case-hero')).toContainText('P2-CURRENT-ACCOUNT-B');const done=page.waitForResponse(r=>new URL(r.url()).pathname==='/self/workspace'&&r.request().postDataJSON().case_id===a.context.case_id);old.release();await(await done).finished();await expect(page.locator('.premium-case-hero')).toContainText('#'+b.context.case_id);await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.premium-preparation a[href^="/forms?"]').first()).toHaveAttribute('href','/forms?case_id='+b.context.case_id);
});
test('My Preparation rejects pending workspace completion after logout',async({page,request})=>{
  const a=await synthetic(request,'p2-logout');await signIn(page,a.session);const old=deferredResponse();await page.route(url=>url.pathname==='/self/workspace',async r=>{const response=await r.fetch();old.enter();await old.pending;await r.fulfill({response});});await page.goto('/self/application');await old.entered;await page.getByRole('button',{name:'Log out',exact:true}).first().click();await expect(page).toHaveURL(/\/auth(?:[?#]|$)/);old.release();await expect(page.locator('.premium-case-hero')).toHaveCount(0);await expect(page.locator('a[href^="/forms?case_id="]')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull();
});
test('My Preparation same-case focus revalidation does not duplicate workspace writes',async({page,request})=>{
  const a=await synthetic(request,'p2-same-case');const before=await preservedForms(request,a);await signIn(page,a.session);let writes=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/self/workspace'&&r.method()==='POST')writes++;});await page.goto('/self/application');await expect(page.locator('.premium-case-hero')).toContainText('#'+a.context.case_id);
  const checked=page.waitForResponse(r=>new URL(r.url()).pathname==='/application-cases/context');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await(await checked).finished();await expect(page.getByRole('status')).toHaveCount(0);await expect(page.locator('.premium-case-hero')).toContainText('#'+a.context.case_id);expect(writes).toBe(1);const after=await(await request.get(api+'/self/application/saved?case_id='+a.context.case_id,{headers:a.headers})).json();expect(after.intake_payload).toEqual(before.intake_payload);
});

// Original independent release-review checks, retained for hosted CI.
test('review: My Preparation recovers after transient saved-Forms failure',async({page,request},info)=>{
 const a=await synthetic(request,'review-retry');await signIn(page,a.session);let fail=true;
 await page.route(url=>url.pathname==='/self/application/saved',r=>fail?r.fulfill({status:503,json:{detail:'synthetic transient failure'}}):r.continue());
 await page.goto('/self/application');await expect(page.getByRole('alert')).toContainText('Failed to load your application');fail=false;
 const workspace=page.waitForResponse(r=>new URL(r.url()).pathname==='/self/workspace'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Try again',exact:true}).click();const response=await workspace;
 expect(response.status()).toBe(200);await expect(page.getByRole('status')).toHaveCount(0);
 await info.attach('review-retry-evidence',{body:JSON.stringify({workspace_status:response.status(),alert:await page.getByRole('alert').allTextContents(),rendered_case_count:await page.locator('.premium-case-hero').count()}),contentType:'application/json'});
 await expect(page.locator('.premium-case-hero')).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});
test('review: My Preparation rejects old case after delayed workspace response',async({page,request},info)=>{
 const a=await synthetic(request,'review-case');const b=await(await request.post(api+'/application-cases',{headers:a.headers,data:{application_type:'study_permit',case_title:'REVIEW-CURRENT-B'}})).json();expect((await request.post(api+'/application-cases/'+a.context.case_id+'/activate',{headers:a.headers})).ok()).toBeTruthy();await signIn(page,a.session);
 let release,started;const gate=new Promise(r=>release=r),pending=new Promise(r=>started=r);
 await page.route(url=>url.pathname==='/self/workspace',async r=>{const response=await r.fetch();started();await gate;await r.fulfill({response});});
 await page.goto('/self/application');await pending;expect((await request.post(api+'/application-cases/'+b.id+'/activate',{headers:a.headers})).ok()).toBeTruthy();release();
 await expect(page.getByRole('status')).toHaveCount(0);const active=await(await request.get(api+'/application-cases/context',{headers:a.headers})).json();
 await info.attach('review-case-evidence',{body:JSON.stringify({original_case:a.context.case_id,active_case:active.case_id,rendered_case:await page.locator('.premium-case-hero').allTextContents()}),contentType:'application/json'});
 await expect(page.locator('.premium-case-hero')).not.toContainText('#'+a.context.case_id);
});