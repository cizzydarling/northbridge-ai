# Official resource snapshots

This package changes delivery of DLI and official processing references only. It
creates no scheduler, public import API, startup job, rule activation, feature
activation, paid account change or external service. Collection and promotion are
explicit operator actions. Production execution requires separate authorization.

## Trust and freshness

Public requests read a consistent active-head/snapshot join in PostgreSQL. They
never fetch Canada.ca or write snapshots. Existing authenticated self-user reads,
Free official references, Pro owned saves, and read/remove-after-expiry boundaries
remain unchanged. Test-provider adapters retain their existing bounded refresh.

A bundle contains a strict manifest and the exact UTF-8 public source bodies.
Import reparses those bodies using the fixed versioned parser. Caller-supplied
normalized rows are never trusted. The manifest records source/language/URLs,
component acquisition times, SHA-256 source-body checksums, normalized checksum,
record count, schema/parser versions, explicitly supplied publisher dates and
freshness bounds. Body hashes describe UTF-8 entity bytes after HTTP decompression,
including any UTF-8 BOM, not compressed wire bytes. Hashes detect corruption;
they do not authenticate arbitrary uploaded content. Only an authenticated trusted
operator may collect/transport/import. No user-supplied URL is accepted.

Each processing language is an atomic three-component bundle: country estimates,
non-country estimates and country names. All must validate. EN and FR are separate
sources and cannot silently substitute for each other. DLI remains the official
English listing in both UI languages; bilingual controls do not imply translated
institution data. Institution designation never establishes PGWP, programme or
study-permit eligibility. Missing estimates stay unknown, not zero or invented.

The oldest component acquisition time sets the bundle age; components must be
acquired within five minutes. Future/expired acquisitions, unknown schemas/fields,
mismatched URLs, wrong content types, checksums/counts, exact duplicate source rows, conflicting identities, duplicate JSON
keys, empty/malformed/restricted/sensitive sources and incomplete bundles fail
closed. Distinct official eight-column DLI variants with identical supported institution
fields retain the existing single institution identity. Their raw-row and collapsed
variant counts are disclosed in the validated manifest. Unsupported extra columns
never imply PGWP eligibility. Exact duplicate rows or conflicting supported fields
are rejected; normalized snapshot identities remain unique.

A count decline greater than 20% against the active snapshot requires
separate source/validator review; there is no force-promotion switch. The importer
never infers publication dates from retrieval or footer dates.

- Fresh: age below 1 hour.
- Stale: age from 1 hour to below 24 hours, clearly disclosed.
- Unavailable: missing/invalid/inaccessible snapshot, future acquisition or age at
  least 24 hours. No records returned.

A failed fetch or import never changes timestamps or clears a good snapshot.
Unchanged source content can be acquired again with a genuinely newer acquisition
time. Publisher dates remain unchanged. Existing processing-reference handling
also marks publisher dates older than 14 days stale. Stale records cannot be newly
shortlisted under the current API/UI contract. A successful retrieval is schema
validation, never an immigration eligibility review or a current-designation
warranty.

## Storage and atomic promotion

Migration: c4f8a2d6e901 -> d9a7e3b2f610. It adds only
official_resource_snapshots and official_resource_heads. No existing rows are
updated/backfilled. Models are registered in app.models; one Alembic head remains.

Promotion needs a dedicated Session and an exact expected head (NONE initially).
It creates/locks a per-source head slot, compares its generation, inserts the
immutable candidate, changes the pointer and removes obsolete unreferenced
versions in one transaction. A composite FK prevents a head from referencing a
snapshot of another source. Concurrent or stale importers cannot silently
supersede each other. PostgreSQL lock timeout is 2 seconds and statement timeout
10 seconds for promotion. Caller errors or commit failure roll back the candidate,
head and retention deletes together. Reads have a 2-second PostgreSQL statement
budget and a read-only transaction. Core database readiness remains independently
required; source unavailability is not hidden as healthy resource data.

Keep active plus one previous good version per source: three source IDs, at most
six snapshots. Each normalized payload is bounded to 2,000,000 bytes and 10,000
records (12,000,000 canonical payload bytes total), plus JSON escaping overhead (up to
72,000,000 bytes worst case) and bounded metadata/index/WAL/backup
usage. No raw HTML, credentials, accounts, immigration answers or payment records
are stored in these tables. An oversized candidate is rejected, never truncated.
The previous version is preserved for recovery/inspection but is not silently
made current or re-dated. Snapshot recovery and application rollback are distinct
operator actions requiring approval. Downgrade refuses automatic data loss.

## Operator commands

From backend, with an explicitly configured environment:

    python -m app.services.official_resource_snapshot_cli collect --source dli --output <private-directory>/dli.json
    python -m app.services.official_resource_snapshot_cli validate --file <private-directory>/dli.json
    python -m app.services.official_resource_snapshot_cli import --file <private-directory>/dli.json --expected-head NONE

Valid source IDs: dli, processing_en, processing_fr. Collection has no database
requirement. It honors fixed official URLs, public destinations, validated TLS,
robots/access policy, bounded requests and payloads; no redirects, cookies,
ambient credentials/proxies, access bypass or automatic retries. A robots failure
or unsupported scheduling directive aborts, rather than assuming permission.
Collection uses the existing 2-second connect/3-second read limits and a bounded
stream/run deadline. No global timeout is raised. Test a chosen network path;
local success does not establish that Render or a future external worker works.

APP_ENV must explicitly be test, local, development or production. Import requires
an explicit DATABASE_URL before dotenv/database initialization. Local import is
restricted to a loopback PostgreSQL nbai_* database or the existing workspace-only
sprint2 SQLite isolation convention; query-based routing overrides are rejected.
The operator must migrate an isolated database explicitly before import; commands
never create schemas or run migrations themselves.

Production import is not authorized by implementing this package. A separately
authorized operator must also supply all three explicit CLI guards:
--production-host <exact-host>, --production-database <exact-name>, and
--ack-production-public-write, with APP_ENV=production and the matching explicit
PostgreSQL URL. These flags do not obtain human authorization or bypass database
permissions. An existing head must be supplied exactly; wrong/replayed/older
imports stop. Never put connection strings in shell logs or pass them as command
arguments. Use the established private environment/SSH procedure after approval.

Artifacts are written exclusively outside the repository, with no overwrite.
Keep them in an access-controlled operator directory, remove them after approved
import/reconciliation, and in any case within 24 hours. Validation/import rejects
expired acquisitions; no scheduled cleanup or task is introduced. Console output
contains only fixed result codes, public source IDs, counts, hashes and snapshot
IDs. It never prints raw bodies or external exception text. Do not download
production backups or user data for resource refreshes.

## Operational rollout gates

1. Approve/review code, migrations and local/hosted validation separately.
2. Establish documented source-reuse permission/licence and robots/access policy.
   General Canada.ca terms distinguish commercial redistribution from non-commercial
   reproduction; a public URL is not proof of an Open Government Licence:
   https://www.canada.ca/en/transparency/terms.html . No government branding copied.
3. Assign refresh ownership/cadence. Target below 1 hour (e.g. 30 minutes) if fresh
   availability is required. This package deliberately does not schedule anything.
4. Separately authorize maintenance/backup/migration, resource import, exact-SHA
   deployment and acceptance. Verify database capacity and preserve protected-user
   fingerprints. Apply bounded DDL timeouts using the established migration runner.
5. Import and verify each required source while private. Validate EN/FR category,
   geography, dates, unknown estimates, DLI search, Free read and Pro owned-save
   isolation, cold start and expiry. No Stripe/CRS/rule/analytics activation.
6. Reopening requires separate authorization and passing required acceptance.

## Testing

Synthetic bundles are test fixtures, not official evidence. Unit tests exercise
strict manifests, provenance/checksums/dates, failure preservation, expiry, bounded
retention, corruption rejection, operator guards and no-network/no-write reads.
Real loopback PostgreSQL tests exercise migration preservation, head FKs,
concurrent first/existing-head CAS, transaction/commit rollback, bounded lock
failure and recovery. Historical shortlist tests remain pinned to their original
migration. Current-head/schema expectations advance by one additive revision.

The explicitly disposable E2E entry point seeds exactly three validated synthetic
snapshots after schema creation. It verifies APP_ENV=test plus the precise SQLite
fixture path, or a guarded loopback nbai_rehearsal_* PostgreSQL database, before
any query/write. Its fixed 2026-10-29 UTC acquisition clock and public fixture
payloads/checksums are deterministic. Repeated initialization validates and reuses
the same three heads without new versions. DLI/processing remote-adapter calls
then fail explicitly in the test process; browser success requires real snapshot
reads. These hooks never run in production startup or public routes.

PostgreSQL 16 hosted execution and production imports remain separate from local
PostgreSQL 18 evidence.
# Historical draw extension (local implementation)

The proposed `e6b4c1d8a203` migration follows `d9a7e3b2f610`. It widens only
the source-ID checks on the existing snapshot/head tables for `draws_en` and
`draws_fr`; no new tables, backfill, user-record write or automatic import.
PostgreSQL lock/statement budgets remain 2s/10s. Narrowing refuses if either draw
source has retained records or an active head; data is never deleted to make a
downgrade succeed.

The source is the fixed official `ee_rounds_123_en.json` / `_fr.json`. The full
`rounds` structure is typed before normalization: identifiers, ISO event dates,
category strings, positive invitation/cutoff values, bounded official metadata,
and Canada.ca detail links agreeing with the round ID. Unknown structural
substitutions, duplicates, invalid timestamps and mixed date values fail closed.
Historical timestamps lacking an explicit UTC suffix remain timezone-unknown.
Draw dates never renew feed publication/freshness. Cutoffs are historical context,
not eligibility or an invitation prediction; comparisons across rules/categories
are not presented as equivalent.

`collect --source draws_en` and `draws_fr` use the existing guarded CLI. Candidate
validation, checksum/CAS, prior-good retention and transactional promotion are
unchanged. Production import additionally requires `--ack-source-reuse-rights`
after documented permission for the exact artefact; the acknowledgement does not
grant a licence or deployment/import authorization. Rights remain unresolved.

The existing draws endpoint retains its default Premium contract. Its new
`scope=official_reference` is inactive by default and always unavailable in
production in this package. Only explicit nonproduction environment plus
`NBAI_TEST_OFFICIAL_DRAWS=true` exposes the local/test reference path. No paid
entitlement boundary or production feature activation is authorized here.

The disposable E2E initializer seeds exactly the existing three resource bundles
plus two synthetic draw bundles, after identity/schema verification, through the
same validator/promoter. It freezes only the disposable fixture clock, is
idempotent, and rejects remote/unknown databases before any query or write.
