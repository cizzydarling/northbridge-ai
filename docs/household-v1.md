# Household V1 implementation and rehearsal

## Scope and safety boundary

Individual self-serve households are included. Agent/client routers and checkout restrictions remain unchanged. No production connection, migration, data change, or deployment is part of this work. All database rehearsals require an explicit loopback PostgreSQL admin URL and create randomly named disposable databases.

## Database model and migration

Forward revision `fc9a4123b075`, after `eb8f3012a964`, creates `households`, `household_members`, `application_cases`, and `application_case_members`. It adds nullable `self_applications.application_case_id` with an owner-matching composite FK and index. Existing user/profile/disclosure/document rows and the token-version revision are preserved. Alembic now includes household models in schema comparison. The prior frozen migration contract is unchanged.

Households are provisioned lazily on first household/context access, not eagerly for every existing account. Initialization locks the owner row and creates the household and SELF in one transaction. Unique ownership and a partial unique SELF index prevent duplicates. Deferred PostgreSQL constraint triggers require exactly one SELF for every provisioned household at commit. SELF has an immutable identity, cannot be deleted/archived, and references the household owner. Each case primary must reference that SELF through composite keys.

Participation is a case/member association with a composite primary key and same-household foreign keys. States are `accompanying`, `non_accompanying`, `unknown`; SELF participation is derived as `not_applicable`. One non-archived spouse OR common-law partner is allowed. Children have no invented age-based immigration eligibility rule.

Members and cases are archived, preserving associations and documents. Archived members are excluded from current guidance. Physical deletion is constrained by FKs; SELF deletion is prohibited. Application cases have a unique server-persisted active flag per owner. Archive selects the oldest remaining case, or initializes a new empty case when none remain.

Migration DDL is frozen in the new revision and does not import mutable ORM models. An unexpected pre-existing household table causes the new migration to fail, rather than silently adopting unverified development schema. Downgrade deliberately refuses destructive data loss.

## Application context and SelfApplication contract

`resolve_application_context` is the authoritative source for owner, profile, household, case, primary and participating family members. Browser/localStorage IDs never authorize access. Explicit foreign, missing or archived IDs return 404; invalid IDs return 422. The application selector validates URL IDs against the owned list and deterministically restores the server-active case when unavailable.

The account owner remains primary. Profile is canonical for SELF identity. Existing unbounded/malformed profile fields that cannot be represented safely remain in Profile for correction and are unknown in the SELF projection; values are not truncated or invented.

Existing SelfApplication rows are retained. On the first case initialization all unassigned historical rows are linked to the initial case; its type is the latest supported saved type, otherwise permanent residence. The latest row within the selected case is the current workspace. Historical rows and their content remain. New workspaces reference their case. Type changes occur in Applications; a workspace request with a conflicting type is rejected. Nullable legacy JSON is represented as empty structures in API responses without destructive backfill.

Family edits retire derived eligibility/forms/checklist results, preserving intake. New intake derives accompanying information from the case. Unknown participation stays unknown. A child record does not establish immigration dependency eligibility.

## Strategy, documents, forms and AI

Strategy uses real case members and publishes identity, partner/child counts and participation counts to free and paid users. CRS/deterministic formulas are not changed. Family cases carry `REQUIRES RULE VERIFICATION` and an explicit individual-estimate notice. AI strategy prompts receive the same minimal structured family snapshot.

Family document identity is `family:<case_id>:<member_id>:identity_review`. Each member has independent server-persisted upload/completion. Entries are optional identity-evidence review suggestions for supported case types, not universal immigration requirements. Creation validates the case/member context and serializes by owner. Existing document categories remain intact; prior-workspace documents are shown separately. Ordinary new document uploads use the selected case category; browser completion and forms previews are scoped to account and case.

Forms receive validated case context without populating unsupported family-form mappings. An application-type conflict is rejected. Existing primary-applicant mappings remain. Family answers are not inferred. Form drafts are account/case-scoped and global legacy drafts are not automatically adopted.

Chat, strategy AI, document generation/review and journey services resolve the same context. The added AI snapshot excludes household names, email, birth dates and nationality; it contains case/member IDs, relationships, participation, unknown dependency eligibility and instructions against inference. Existing user-authored chat/intake content is outside this structured-family minimization boundary.

## Frontend flow

Profile -> Household -> Applications -> Strategy -> Documents (and Forms). English/French household pages support add/edit/archive, field validation, loading/error/empty states and destructive confirmation. No alternate-primary controls exist. Applications select members and participation, persist active selection on the server, and support type/status/title changes and archival. Existing My Application runs inside that context. Context banners identify the active application and explain family calculation limits.

## Verification

Final backend regression run: **278 passed in 308.61 seconds**, with warnings treated as errors (`-W error`). This includes the disposable PostgreSQL empty/production-shaped migration rehearsals and all billing/access-control tests. Frontend lint and the production Vite build passed. Test coverage includes real PostgreSQL migrations (empty and production-shaped synthetic data), model agreement, legacy row preservation, authentication/reset token-version regressions, concurrent initialization, protected SELF, cross-user operations, invalid payloads, partner policy, children with separate documents, active-case recovery, context propagation and bilingual Chromium flows.

Local backend command:

```powershell
$env:TEST_POSTGRES_ADMIN_URL = 'postgresql://TEST_USER@127.0.0.1:TEST_PORT/postgres'
.\.venv\Scripts\python.exe -m pytest backend/tests -q -W error
```

`backend/household_e2e_server.py` provisions a fresh migrated PostgreSQL browser database using that explicit URL. The browser suite is `frontend/e2e/household-v1.spec.js`. Use a local production Vite bundle targeting localhost for release rehearsal; do not reuse a production API configuration.

## Production migration impact and rollback

No production runtime confirmation is claimed. Before any future production authorization: take and verify a recoverable backup; re-inventory revision/tables/constraints; confirm no conflicting household tables; rehearse that exact shape on disposable PostgreSQL; deploy schema before code needing it; verify login and token revocation plus the family smoke flow. The new revision introduces four tables, two trigger functions and three triggers, and one nullable indexed FK column. Expect a brief schema lock on self_applications; time it on the rehearsal dataset. Existing data is not deleted.

Code rollback can leave the additive schema and household records intact. Migration downgrade refuses to drop household data. Database restoration must follow the reviewed backup/recovery procedure, never stamping around discrepancies.

## Rules deferred for verification / limitations

- Spouse-adjusted CRS, partner factors, immigration dependency eligibility, program-specific family size/funds rules, and family form/document applicability require separate authoritative rule verification.
- Optional identity review is not a complete submission checklist or legal eligibility decision.
- V1 keeps the owner primary, supports at most one active spouse/partner, and limits a case to 50 selected family records.
- Case pathway/province fields do not override the existing deterministic profile calculations.
- Historical unrelated SelfApplication types cannot be reconstructed into separate original cases automatically; they are retained as history under the initial case.
- PostgreSQL enforces the concurrency and trigger contract; SQLite is not a substitute for release validation.
- Active selection is shared across devices for an account. Explicit case IDs remain owner-validated; browser-only legacy IDs are ignored.
- Archive preserves data; there is no restore/archive-management UI in V1.

## Files changed for Household V1

This manifest excludes files changed only by earlier remediation. The total working-tree Git diff also contains that earlier work.

### Database and models

- `backend/alembic/env.py`
- `backend/alembic/versions/fc9a4123b075_household_v1.py`
- `backend/app/models/household_model.py`
- `backend/app/models/household_member_model.py`
- `backend/app/models/application_case_model.py`
- `backend/app/models/self_application_model.py`

### API and validation

- `backend/app/main.py`
- `backend/app/routes/household_routes.py`
- `backend/app/routes/application_case_routes.py`
- `backend/app/routes/strategy_routes.py`
- `backend/app/routes/self_document_routes.py`
- `backend/app/routes/forms_routes.py`
- `backend/app/routes/ai_routes.py`
- `backend/app/routes/document_review_routes.py`
- `backend/app/schemas/household_member_schema.py`
- `backend/app/schemas/application_case_schema.py`
- `backend/app/schemas/self_application_schema.py`

### Services

- `backend/app/services/household_service.py`
- `backend/app/services/strategy_service.py`
- `backend/app/services/ai_orchestrator.py`
- `backend/app/services/ai_advisor.py`
- `backend/app/services/document_generator_service.py`
- `backend/app/services/document_review_service.py`
- `backend/app/services/forms_assistant.py`
- `backend/app/services/journey_service.py`
- `backend/app/services/pdf_service.py`

### Frontend

- `frontend/src/App.jsx`
- `frontend/src/api.js`
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/ApplicationContextBanner.jsx`
- `frontend/src/components/FamilyDocuments.jsx`
- `frontend/src/pages/HouseholdPage.jsx`
- `frontend/src/pages/ApplicationCasesPage.jsx`
- `frontend/src/pages/FormsPage.jsx`
- `frontend/src/pages/SelfApplicationPage.jsx`
- `frontend/src/pages/SelfDocumentsPage.jsx`
- `frontend/src/pages/StrategyPage.jsx`

### Tests and rehearsal

- `backend/tests/test_household_v1.py`
- `backend/tests/test_individual_launch_postgres.py`
- `backend/tests/test_soft_launch_isolation.py`
- `backend/tests/test_billing_entitlements.py`
- `backend/household_e2e_server.py`
- `frontend/e2e/household-v1.spec.js`
- `frontend/e2e/soft-launch-isolation.spec.js`
- `docs/household-v1.md`
- `docs/individual-launch-migration-rehearsal.md`

The route guard in App.jsx also waits for bootstrap validation of the current owner/path, preventing a stale incomplete-profile result from redirecting a freshly onboarded user back to onboarding. Existing authentication, disclosure and role guards remain enforced.

## Final executed validation

- Backend: 278 passed in 308.61 seconds, with warnings treated as errors.
- Browser: English household, French household, and registration/disclosure/onboarding passed in the combined run. The isolation test then passed separately (2.6-minute test; 4.1-minute run) after replacing its obsolete blanket prohibition on case IDs with checks against the stale browser ID and all agent/client requests. All four selected browser scenarios pass on the final implementation.
- Frontend ESLint: passed after the final test change.
- Production Vite build: passed; the browser rehearsal used that built bundle against localhost.
- Git whitespace/error check: passed.
- Tests used disposable local PostgreSQL; no production logs, schema, data, or deployment were accessed.

## Git diff summary

The Household V1 manifest contains 46 files: 34 tracked files and 12 files currently untracked. Several of those files already contained earlier remediation changes. For the tracked manifest paths, the final diff against HEAD is 812 added / 1,828 deleted lines; those figures include overlapping earlier remediation and must not be interpreted as an isolated Household-only patch. New file content is additional to Git's tracked diff. No commit or push was performed. Earlier security and Strategy A work remains present.

HOUSEHOLD V1 READY FOR PRODUCTION REHEARSAL: YES
