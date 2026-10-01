# Soft-launch assessment — September 29, 2026

## Decision

Ready for a controlled production acceptance rehearsal. A customer launch is not yet substantiated by the evidence inspected. The final next move is to complete and record one production journey from a fresh account to useful output, paid access, and cancellation, with a second account checking document isolation.

This is a targeted repository and operational readiness review, not an exhaustive security audit or certification of immigration content. No production accounts were created, emails sent, or payments initiated during this review.

## Evidence

- Repository reviewed at commit `7358746`; working tree was clean at the start.
- Public frontend returned HTTP 200.
- API `/health/live` returned HTTP 200 with `status: ok`.
- API `/health/ready` returned HTTP 200 with database, rate limiter, and document storage all `ok`.
- Local backend test suite: 3 passed, including the launch security smoke contract and empty-profile onboarding/timeline checks.
- CI configuration includes PostgreSQL migrations, backend tests, frontend lint/build/dependency audit, and a Chromium registration/disclosure test. Current remote CI execution and deployed commit identity were not verified.

## What the evidence does not establish

1. **Full customer journey:** `frontend/e2e/registration-disclosure.spec.js` stops on arrival at onboarding. It does not complete the profile, produce a strategy, upload a document, or purchase a plan. Its configured backend disables email providers. The smoke contract checks checkout gating, not a successful real payment.
2. **External services:** readiness checks database connectivity, rate limiting, and storage health. S3 health uses `head_bucket`, which does not prove object upload, retrieval, or deletion permissions. Readiness does not exercise email delivery, Stripe, OpenAI, or Sentry alert delivery.
3. **Operational ownership and recovery:** the runbook requests an alert test and support owner, but the inspected documents contain no completed evidence record or named owner. Frontend rollback is mentioned; database restore and backend rollback evidence were not found in those documents. These are unverified, not proven absent from the deployment.
4. **Content freshness:** `backend/app/data/ircc_reference.py` records May 8, 2026 as its last review. Recheck decision-sensitive content before launch. This date alone does not prove the content is incorrect; this review did not validate immigration rules.

## Final acceptance rehearsal

Use team-controlled inboxes and synthetic, non-sensitive documents. Record the deployed release identifier, timestamp, outcome, owner, and relevant request/event IDs for each step. Keep credentials and document contents out of the record.

| Gate | Required evidence |
| --- | --- |
| Identity | Fresh registration; confirmation email received and link works; password reset completes; subsequent login works. |
| Product value | Disclosures saved; onboarding completed; strategy produces a useful result; expected free/premium restrictions hold. Repeat the core path in English and French and at mobile width. |
| Documents | Upload, download, and delete a synthetic file; a second account cannot access it; persisted files remain available across a normal deployment. |
| Billing | An explicitly authorized controlled purchase; verified Stripe webhook delivery; matching billing record and plan access; receipt/confirmation; cancellation and expected access through the paid period. Check retry handling in a safe Stripe test environment. |
| Operations | Controlled alert reaches a named owner; support inbox is monitored; previous frontend/backend versions are identified; backup availability and a safe isolated restore are evidenced. |
| Content | Named reviewer checks the decision-sensitive recommendations and source links against current official sources and records the review date. |

Proceed with a small invitation cohort once every applicable gate passes and no critical access, billing, privacy, disclosure, or core-workflow failure remains. A suggested starting cohort is 5–10 users, with daily review during the first week. Hold invitations if a gate fails; fix and repeat the affected path.

Existing operating procedures: [soft-release runbook](soft-release-runbook.md) and [support playbook](support-playbook.md).

## Rehearsal progress

Owner: Amadou, assigned by the user. No customer invitations authorized by this record.

### Verified

- User signed in to the existing production admin/Premium account. Dashboard, strategy, documents, profile, and pricing pages rendered. Existing Premium status is not evidence of a new purchase; the billing page had no recorded transactions.
- Production password-reset request returned HTTP 200, request ID `46ac1c87c0cc4487a2da64c3ab953ba8`. The user confirmed inbox receipt and a successful reset link flow. This is user-confirmed completion; no password or reset token is recorded here.
- Backend suite: six tests passed after the corrections below, including document ownership/storage checks in the launch smoke contract. These storage checks are local, not proof of production S3 operations.
- The isolated frontend build passed. Its API URL targets localhost for the browser rehearsal; do not deploy that build directory.

### Defects found and corrected locally

- Strategy and simulation calculations still granted 50 CRS points for a job offer. Removed the bonus and the English/French roadmap promise. A regression verifies no CRS gain while preserving employer-supported pathway consideration.
- Production displayed a nonexistent Quebec Provincial Nominee Program. Quebec preferences now lead to a separate eligibility-review recommendation, without a PNP recommendation or a promised 600-point roadmap gain. Added regression coverage for Quebec/Québec and both UI languages.
- These changes have not been deployed. Full CRS parity and the remaining heuristic eligibility/probability logic have not been certified by these targeted corrections.

### Source review

Reviewed September 29, 2026: the category list and French-language threshold match [IRCC category selection](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html); the NOC structure matches the cited [Statistics Canada standard](https://www.statcan.gc.ca/en/subjects/standard/noc/2021/indexV1). [IRCC CRS criteria](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html) confirm removal of job-offer points. [IRCC PNP guidance](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html) excludes Quebec. This is a scoped reference review, not a review of every program, article, or scoring rule.

### Remaining evidence

- Fresh production test-account creation/confirmation/disclosures and onboarding: in progress using the user-approved disposable alias. Existing admin access does not prove free-plan restrictions.
- Controlled purchase, webhook delivery, receipt, paid access, and cancellation: pending on the disposable account; do not cancel the owner's existing subscription.
- Production synthetic-file upload/download/delete and two-account isolation: pending.
- Sentry alert receipt, monitored support inbox, database backup/isolated restore, and backend rollback: pending access/evidence.
- Vercel CLI authentication is invalid; deployed commit and prior rollback deployment could not be verified.
- Two initial local browser runs timed out: first before the auth form loaded, second after reaching onboarding. An optional production-preview command was added to the browser-test configuration to distinguish development compilation delays from journey failures. The test now also completes onboarding and checks the dashboard. External AI calls are disabled in this isolated test server.

Keep the launch on hold until the fixes are deployed, the affected production paths are repeated, and the remaining gates have evidence.
