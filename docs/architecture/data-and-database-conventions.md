# Data and Database Conventions

Status: conventions only. **No HRMS, Payroll, or Accounting schema is created by this PR.** `apps/svegip/netlify/database/migrations/` (four migrations, `001`–`004`) is untouched and remains SVEGIP's own, separate migration set — verified byte-identical as part of this PR's pre-merge checklist.

## Target database

PostgreSQL, for both `apps/svegip` (via Netlify DB/Neon today) and future `platform-services/*` (via `packages/shared`'s `DatabaseProvider`, backed by private PostgreSQL or AWS RDS PostgreSQL depending on deployment target — see `deployment-portability.md`). No other database engine is in scope.

## Migration naming and versioning

Future shared migrations live under `database/` (see its `README.md`), following the same numbered, directory-per-migration pattern already working in `apps/svegip/netlify/database/migrations/` (`NNN_description/migration.sql`, idempotent `CREATE TABLE IF NOT EXISTS` / guarded `INSERT ... WHERE NOT EXISTS` seed statements) — a proven pattern, not a new invention. Migration numbers are sequential and never reused or renumbered after landing on `main`.

## Effective-dated records

For any record where history matters — employment status, department, position, manager, salary, grade, cost centre — never overwrite in place. Use effective-dating:

```
effective_from   DATE NOT NULL
effective_to     DATE          -- NULL = currently in effect
<the changing fields>
reason           TEXT
approved_by      TEXT
```

A query for "what was true on date X" is `effective_from <= X AND (effective_to IS NULL OR effective_to > X)`. This applies from the first HRMS/compensation schema onward — it is not something to retrofit after the fact.

## ID strategy

New shared-service tables use UUIDs (`uuid` column type, generated application-side or via `gen_random_uuid()`) rather than the `BIGSERIAL` sequential IDs `apps/svegip`'s existing tables use. Rationale: UUIDs don't leak record counts across entity boundaries, and they avoid ID collisions when data eventually needs to move between environments (e.g. a private-server database and an AWS RDS instance) during a portability migration. `apps/svegip`'s existing `BIGSERIAL` tables are not retrofitted by this convention — it applies to new tables only.

## Created/updated metadata

Every table includes, at minimum:

```
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
created_by   TEXT (or UUID FK to the identity user)
updated_by   TEXT (or UUID FK)
```

— the same fields `apps/svegip`'s existing tables already carry.

## Archive / soft-delete

Records that matter for audit or history (employment records, payroll runs, journals, controlled documents) are never hard-deleted. Use a `status`/`archived_at` field, or for effective-dated records, close the current row (`effective_to`) rather than deleting it. Hard deletes are reserved for genuinely transient, non-sensitive data only.

## Audit / event records

See `security-architecture.md`'s audit event contract. At the schema level, tables holding sensitive or approval-gated state should have a companion `_audit` table (SVEGIP's `employee_account_audit`, `controlled_document_audit`, `management_decision_audit`, `portal_business_audit` are working examples of this pattern) until/unless a central `platform-services/audit` service is adopted, at which point domains emit events to it instead of maintaining their own audit table.

## Entity scoping

Every table holding business data (not pure identity/config) carries an explicit entity-scoping column — at minimum `legal_entity_id`, and `business_unit_id`/`department_id` where the data is scoped that finely — referencing the `LegalEntity`/`BusinessUnit`/`Department` shapes in `packages/types/src/entity-context.ts`. Do not infer entity scope from a joined employee record alone; store it directly so queries and row-level access checks don't depend on a join succeeding.

## Transactional integrity

Multi-statement writes that must succeed or fail together (e.g. registering a controlled document and its first version row, as `apps/svegip/netlify/functions/documents.mts` already does) use `DatabaseProvider.transaction(...)` (see `packages/shared/src/DatabaseProvider.ts`) rather than sequential unguarded statements. Payroll-period finalisation and any accounting-posting operation are expected to be the strictest examples of this once they exist — a partially-applied payroll run or partially-posted journal is not an acceptable failure mode.
