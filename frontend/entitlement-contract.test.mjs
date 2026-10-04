import assert from "node:assert/strict";
import { test } from "node:test";
import { beginEntitlements, finishEntitlements, failEntitlements, resetEntitlements, getEntitlementState } from "./src/entitlementStore.js";
import { isAllowedTestURL, guardAPI } from "./e2e/networkGuard.js";
const paid = { is_pro: true, is_premium: true, features: { full_strategy: true } };
const free = { is_pro: false, is_premium: false, features: { full_strategy: false } };
test("unknown/loading never exposes paid or free; authoritative resolution", () => {
  resetEntitlements(); assert.equal(getEntitlementState().status, "unknown");
  let ticket = beginEntitlements("A"); assert.equal(getEntitlementState().access, null);
  finishEntitlements(ticket, paid); assert.equal(getEntitlementState().status, "verified_paid");
  ticket = beginEntitlements("A"); finishEntitlements(ticket, free);
  assert.equal(getEntitlementState().status, "verified_free");
});
test("failure/malformed response does not synthesize free", () => {
  let ticket = beginEntitlements("A"); failEntitlements(ticket);
  assert.deepEqual(getEntitlementState(), { status: "error", access: null });
  ticket = beginEntitlements("A"); assert.throws(() => finishEntitlements(ticket, {plan:"premium"}));
  assert.equal(getEntitlementState().status, "error");
});
test("account switch, logout and stale response cannot leak paid access", () => {
  const old = beginEntitlements("A"); const current = beginEntitlements("B");
  assert.equal(finishEntitlements(old, paid), false);
  finishEntitlements(current, free); resetEntitlements();
  assert.equal(finishEntitlements(current, paid), false);
  assert.equal(getEntitlementState().access, null);
});
test("API guard rejects production and non-test loopback ports before transport", async () => {
  let calls=0; const api={};
  for(const method of ["get","post","put","patch","delete","head","fetch"]) api[method]=async(_url,options)=>{calls++;return options;};
  guardAPI(api);
  for(const url of ["https://northbridge-ai-2.onrender.com", "https://www.northbridgeia.com", "https://api.stripe.com", "https://api.resend.com", "http://127.0.0.1:5432", "http://evil.test:8010"]) {
    assert.equal(isAllowedTestURL(url),false); await assert.rejects(api.post(url));
  }
  assert.equal(calls,0);
  assert.equal((await api.get("http://127.0.0.1:8010/auth/me",{maxRedirects:10})).maxRedirects,0);
});

