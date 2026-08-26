# NorthBridgeAI soft-release runbook

Use this checklist for every production deployment during the soft-release period.

## Before deployment

- [ ] Review the release diff and confirm no unrelated user changes are included.
- [ ] Run `npm run lint` and `npm run build` from `frontend`.
- [ ] Run `backend/launch_smoke_test.py` from the repository root.
- [ ] Run the registration and disclosure browser E2E test.
- [ ] Confirm `frontend/public/sitemap.xml` includes all new article routes.
- [ ] Keep the prior successful Vercel deployment available as the rollback target.

## Immediately after deployment

- [ ] Confirm `https://www.northbridgeia.com` loads without browser-console errors.
- [ ] Confirm `/health/live` and `/health/ready` return HTTP 200.
- [ ] Open the English and French blog indexes and each newly published article.
- [ ] Verify page title, description, canonical URL, JSON-LD, source links, and call-to-action links.
- [ ] Test mobile-width layouts for the Strategy page and the published articles.

## Production journey check

- [ ] Register a new test account using an inbox the team can access.
- [ ] Confirm the confirmation and password-reset emails arrive and the links work.
- [ ] Sign in, accept all disclosures, and complete onboarding.
- [ ] Generate or open a strategy, create a document task, and confirm the expected premium gating.
- [ ] Complete one controlled Stripe purchase and verify the resulting plan access.
- [ ] Confirm the related Stripe webhook, billing record, and receipt/confirmation email.
- [ ] Test cancellation using the documented billing flow.

## Monitoring and support

- [ ] Confirm Sentry receives a deliberate, non-sensitive test exception and routes an alert to the release owner.
- [ ] Check request IDs, rate-limiting, database readiness, and document-storage readiness.
- [ ] Assign a daily owner for support inbox triage during the first seven days.
- [ ] Record product defects, content corrections, and recurring customer questions in the launch log.

## Go / no-go criteria

Expand the soft release only when there are no unresolved P0 or P1 defects, core signup-to-strategy and billing flows complete successfully, and support response ownership is active. Roll back or pause acquisition if access, billing, privacy, document ownership, or disclosure failures are observed.
