> Scope update: Household V1 is now required. The historical exclusion described below is superseded by [Household V1](household-v1.md) and forward revision `fc9a4123b075`. Earlier security/schema fixes remain in place.

# Individual-only migration contract and rehearsal

Head: `eb8f3012a964`, following the unchanged token revision `da7e2f901c63`.
This document does not authorize production migration or deployment.

## Supported paths

1. Empty PostgreSQL: repaired historical chain to the new head.
2. Inventoried production-compatible schema at `f6a1b2c3d4e5`: token revision,
   then validation/adoption of existing disclosure, generated-document and profile objects.

Profiles retain `user_id NOT NULL UNIQUE REFERENCES users(id)` and nullable
onboarding fields. Job description/duties are nullable `TEXT`. No client profile
ownership, household or application-case tables are added. Existing agent tables
and disclosure references remain, but agent APIs are unmounted.

The five bounded historical repairs retain their revision identifiers. Existing
databases beyond those revisions do not rerun them. Other historical database
shapes are not automatically supported: inventory and review them first.

`migration_contract.py` is frozen migration support, not mutable ORM metadata.
It validates columns, types, nullability, defaults, primary/foreign/unique keys,
indexes and PostgreSQL validation flags for the reconciled tables, including users.
Unknown shapes abort rather than silently adopting same-named objects. Existing
records and existing compatible objects are not recreated.

The forward revision adds missing job columns and creates generated documents
only when absent. The repaired disclosure revision creates that table when absent
or validates an already complete compatible table. Pre-audit partial disclosure
tables deliberately fail validation and require their own explicit review.

## Disposable test environment

Use a dedicated PostgreSQL cluster bound to loopback. No test may use a production
URL or load a production dump without a separate authorization and data-handling plan.

Set `TEST_POSTGRES_ADMIN_URL` explicitly to that cluster's `postgres` database.
The tests refuse non-loopback hosts and other administrative database names. They
create random `nbai_rehearsal_*` databases and drop only databases they created.
This variable never falls back to the application's `DATABASE_URL`.

Example PowerShell, substituting the disposable cluster's credentials/port:

```powershell
$env:DATABASE_URL = 'sqlite://'
$env:APP_ENV = 'test'
$env:OPENAI_API_KEY = ''
$env:RESEND_API_KEY = ''
$env:SMTP_HOST = ''
$env:TEST_POSTGRES_ADMIN_URL = 'postgresql://TEST_USER@127.0.0.1:TEST_PORT/postgres'
.\.venv\Scripts\python.exe -m pytest backend/tests -q -W error
```

The production-shape fixture uses historical migrations to `f6a1b2c3d4e5`, then
independent SQL for the inventoried out-of-band job columns and generated table.
It seeds synthetic 24 users, 24 profiles, 48 disclosures, 10 self applications and
73 documents. It additionally populates generated documents to test preservation
more strongly than production's empty generated table. It is not a restored
production backup and does not reproduce every production value or auxiliary row.

Tests demonstrate the missing-token-column ORM exception locally before upgrade,
then successful ORM loading, correct/incorrect/missing-account login, reset version
increments, JWT revocation and new login after upgrade. They do not establish the
exact exception recorded by Render; no production traceback was retrieved.

For PostgreSQL-backed Playwright tests, migrate a separate disposable database,
set its `DATABASE_URL`, `DB_SSL_MODE=disable`, and set `E2E_BACKEND_COMMAND` to run
`uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8010` through
the test Python interpreter. Run `npm run test:e2e` from `frontend`. The default
SQLite E2E bootstrap is not evidence of Alembic correctness. CI uses PostgreSQL
for both migration rehearsals and browser tests.

## Before any later production authorization

- Confirm the deployment's actual database identity and current Alembic revision.
- Refresh the read-only schema/constraint/index inventory and check migration assumptions.
- Take and restore-test a full database backup; preserve uploaded file storage separately.
- Rehearse the exact release on a secured restored snapshot, checking row contents,
  sequence positions, constraints and application compatibility.
- Check long-running transactions and use a bounded lock timeout/maintenance window.
- Preserve the currently deployed code and migration artifacts for recovery.

The token ADD COLUMN takes an exclusive table lock until transaction commit.
PostgreSQL supports its constant-default addition without a table rewrite, but
lock acquisition may still block. A failed reconciliation rolls back its upgrade
transaction, including token addition when upgrading from f6 in one invocation.

## Recovery and deferred work

Reconciliation downgrades are intentionally blocked: adopted objects may predate
the revision and must not be dropped. The disclosure repair also refuses destructive
downgrade. Do not remove token_version after resets: this loses revocation state.
Prefer a compatible application rollback with the additive schema retained, or a
forward correction. Snapshot recovery must account for writes since the snapshot.

An unrelated older client-document downgrade has an unnamed-constraint issue;
this remediation does not claim that arbitrary historical downgrades are supported.

Autogeneration explicitly excludes household/application-case tables. It retains
existing agent tables. Known comparison differences are three retained server
defaults (`promo_codes.active`, `promo_codes.current_uses`,
`citizenship_questions.active`) and two redundant billing unique constraints.
Tests allow only those differences; do not blindly apply their removal.

Agent checkout and promo issuance/redemption are disabled; reconciliation and
webhooks remain available for existing billing state. Family/case pages and APIs
are unavailable. Individual requests ignore stale browser case context; saved
document categories such as `case_777` are preserved without rewriting records.

## Local validation results

- PostgreSQL 18.3 on Windows: final migration/contract suite, 19 passed.
- Full backend suite with warnings treated as errors: 274 passed; three additional
  regression cases added afterward also passed (277 current collected tests).
- Final focused billing regression: 113 passed.
- Production-build Playwright against the migrated disposable PostgreSQL database:
  both registration/onboarding and stale-case/disabled-route tests passed.
- Frontend production build and ESLint passed; launch smoke passed; diff whitespace
  checks passed. The revision graph has 19 linear revisions and one head.
- Production PostgreSQL 18.6 and CI PostgreSQL 16 were not run in this local rehearsal.

The browser rehearsal found and corrected the onboarding secondary button sending
an already-onboarded user back to the accepted disclosure page instead of the
dashboard. Authorization/disclosure guards remain in place.

Existing NOC scoring took approximately 36 seconds for one synthetic strategy.
Browser tests allow that computation to complete; this performance risk remains
outside migration remediation. The disabled-route portion reuses a real strategy
response already verified earlier in the same browser test to avoid redundant work.

## Task file manifest

Existing access-control, forms-backend, AI-orchestrator and billing-entitlement test
changes were preserved. Billing, strategy and simulation-test files also contained
prior work; this task made only the scoped additions described above.

- `.github/workflows/ci.yml`
- `backend/alembic/env.py`
- `backend/alembic/versions/0338efb1cafc_add_audit_fields_to_disclosure_.py`
- `backend/alembic/versions/0f98882e3384_add_matters_table.py`
- `backend/alembic/versions/11e407a1445a_baseline_schema.py`
- `backend/alembic/versions/6896f9168f58_add_updated_at_to_saved_simulation_.py`
- `backend/alembic/versions/7c1f4c9b2a10_add_user_identity_and_profile_personal_fields.py`
- `backend/alembic/versions/eb8f3012a964_reconcile_individual_launch_schema.py` (new)
- `backend/app/main.py`
- `backend/app/models/profile_model.py`
- `backend/app/routes/billing_routes.py`
- `backend/app/routes/disclosure_routes.py`
- `backend/app/routes/strategy_routes.py`
- `backend/app/services/promo_code_service.py`
- `backend/migration_contract.py` (new)
- `backend/tests/test_individual_launch_postgres.py` (new)
- `backend/tests/test_simulation_authorization.py`
- `backend/tests/test_soft_launch_isolation.py` (new)
- `docs/individual-launch-migration-rehearsal.md` (new)
- `frontend/e2e/registration-disclosure.spec.js`
- `frontend/e2e/soft-launch-isolation.spec.js` (new)
- `frontend/src/App.jsx`
- `frontend/src/api.js`
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/SOPGuideModal.jsx`
- `frontend/src/pages/AdminPromoCodesPage.jsx`
- `frontend/src/pages/AuthPage.jsx`
- `frontend/src/pages/FormsPage.jsx`
- `frontend/src/pages/OnboardingPage.jsx`
- `frontend/src/pages/SelfDashboardPage.jsx`
- `frontend/src/pages/SelfDocumentsPage.jsx`
