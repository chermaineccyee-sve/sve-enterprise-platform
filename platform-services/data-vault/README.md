# platform-services/data-vault

**Status: remediated (PR #5), implemented inside `platform-services/identity`.**

The CRITICAL finding this folder used to describe — `apps/svegip/data-vault/
index.html` storing its actual confidential business content (`sveRecords` —
evidence records) in browser `localStorage`, not a database — is fixed as of
PR #5. See `docs/architecture/data-vault-foundation.md` for the full
before/after write-up, the server-side record model, the API, and the
RBAC/entity/classification enforcement model.

## Why the implementation lives in `platform-services/identity`, not here

This folder was scaffolded (PR #3) as the eventual home of a standalone
Data Vault service. When PR #5 came to build it, keeping it a genuinely
separate service would have meant either:

- duplicating session validation, RBAC authorization (`rbacService.ts`),
  and audit redaction logic from `platform-services/identity` into a
  second codebase (a real security risk — two implementations of the same
  security-critical logic drift apart over time), or
- calling back into `platform-services/identity` over HTTP for every
  authorization decision, which this foundation phase has no need for yet
  and would add real latency/complexity with no corresponding benefit at
  current scale.

Instead, PR #5 added the Data Vault domain model, repository, service, and
`/api/v1/data-vault/*` routes directly inside `platform-services/identity`
(`src/domain/dataVault.ts`, `src/services/dataVaultService.ts`,
`src/api/routes/dataVault.ts`, etc.), reusing that service's existing
session validation, `rbacService.authorize()`, and `auditService` in-process
— the same pattern a "modular monolith" uses before a module earns its own
deployment unit. This makes Data Vault the first real business-data
consumer of the Identity/RBAC foundation (PR brief item 7), with zero
duplicated security logic.

**This folder is kept as the documented future extraction point.** If Data
Vault's scale, deployment cadence, or team ownership later justifies a truly
separate service, the code in `platform-services/identity/src/{domain,
repositories,services,api/routes}` related to Data Vault can move here
largely as-is — the repository/service boundary was kept clean specifically
so that split remains low-risk. Extraction is not planned or scheduled by
this PR.

**Depends on:** `platform-services/identity`'s own session/RBAC/audit
services and its Postgres schema (`legal_entities`, `users`,
`entity_access_grants`, `permissions` from `001_identity-foundation`, plus
`data_vault_records`/`data_vault_record_versions` from
`002_data-vault-foundation`).
**Must not depend on:** `hrms`/`payroll` internal schemas.
**API namespace:** `/api/v1/data-vault/*` (implemented).
**Data classification range in use:** INTERNAL (default) through PRIVILEGED.
