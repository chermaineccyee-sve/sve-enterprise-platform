# platform-services/data-vault

**Status: remediated (PR #5), own package.** The CRITICAL finding this
folder used to describe — `apps/svegip/data-vault/index.html` storing its
actual confidential business content (`sveRecords` — evidence records) in
browser `localStorage`, not a database — is fixed. See
`docs/architecture/data-vault-foundation.md` for the full before/after
write-up, the server-side record model, the API, the RBAC/entity/
classification enforcement model, and the CSRF/origin protection design.

## Module ownership and dependency direction

This package owns Data Vault's domain model, repositories, service, and
`/api/v1/data-vault/*` routes (`src/domain`, `src/repositories`,
`src/services`, `src/api`) — Identity is an upstream security capability
this package *consumes*, never the other way round:

```
platform-services/
├── identity/       (identity/access/session/MFA/audit — no Data Vault knowledge)
└── data-vault/      (domain, repositories, services, API/routes, tests — this package)
```

Concretely: `platform-services/identity/src/container.ts` and
`src/api/http.ts` have no import of, or knowledge of, anything in this
package. This package's own composition root
(`src/composition/container.ts`) is where Identity and Data Vault are
wired together — the glue lives on the dependent side, not inside
Identity — importing Identity's Postgres repositories
(`pgUserRepository`, `pgSessionRepository`, `pgRbacRepository`,
`pgAuditRepository`, `pgOrganisationRepository`), its `sessionService`/
`rbacService`/`auditService`, its migration runner, and its
`svegipSessionBridge` (cookie verification) — all by relative source
import, since this monorepo has no package-registry/workspace boundary
between sibling `platform-services/*` yet. Nothing Identity-owned is
reimplemented here: no second session-validation, RBAC-evaluation,
audit-redaction, or Postgres-pool implementation exists in this package.

**A known consequence of source-path imports (not an oversight):** because
Data Vault's composition root imports Identity's `.ts` files directly
rather than through an installed package, Node resolves those files' own
dependencies (`pg`) relative to *their* location — inside
`platform-services/identity/node_modules`. This package's own
`package.json` therefore has **zero runtime dependencies**: every actual
Postgres/crypto operation happens inside Identity's already-reviewed code.
The practical implication is that running or CI-testing this package
requires `platform-services/identity`'s own `npm ci` to have been run
too — see `.github/workflows/ci.yml`'s `validate-data-vault` job, which
installs both before testing. If this coupling becomes a maintenance
burden, the fix is to move to an npm workspace or publish Identity's
consumed pieces as an installable internal package — not to duplicate
their implementation here.

## What's here

- `src/domain/` — `DataVaultRecord`/`DataVaultRecordVersion` and the
  record-code generator, derived from the actual current Evidence Record
  UI in `apps/svegip/data-vault/index.html` (see the architecture doc's
  evidence-based inventory).
- `src/repositories/` — `DataVaultRepository` interface plus Postgres and
  in-memory implementations, against `002_data-vault-foundation`'s
  `data_vault_records`/`data_vault_record_versions` tables.
- `src/services/dataVaultService.ts` — the RBAC/entity/classification
  enforcement, versioning, and audit integration. Depends on Identity's
  `RbacService`/`AuditService`/`OrganisationRepository` *contracts* only.
- `src/api/middleware/dataVaultActor.ts` — resolves the caller via a
  native Identity bearer session OR the transitional SVEGIP session-cookie
  bridge, and enforces explicit Origin/Referer validation on
  cookie-authenticated state-changing requests (CSRF protection — see the
  architecture doc).
- `src/api/routes/dataVault.ts`, `src/api/http.ts`, `src/server.ts` — the
  `/api/v1/data-vault/*` HTTP surface, served by this package's own
  standalone HTTP server (not mounted into Identity's).
- `test/unit/`, `test/integration/` — see the architecture doc's test
  summary for what each file covers.

**Depends on:** `platform-services/identity`'s session/RBAC/audit
services, repositories, and migration runner (by source import — see
above); the shared Postgres schema those repositories operate against
(`legal_entities`, `users`, `entity_access_grants`, `permissions` from
`001_identity-foundation`, plus this package's own
`002_data-vault-foundation` tables).
**Must not depend on:** `hrms`/`payroll` internal schemas.
**API namespace:** `/api/v1/data-vault/*`.
**Data classification range in use:** INTERNAL (default) through PRIVILEGED.
