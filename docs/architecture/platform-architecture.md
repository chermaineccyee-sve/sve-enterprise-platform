# Platform Architecture

Status: architecture contracts and documentation only. No `platform-services/*` module is implemented yet — see each module's `README.md` for its exact status. `apps/svegip` is unchanged and continues to run exactly as it does today.

## Layered architecture

```
Presentation Layer
       ↓
API / Application Layer
       ↓
Domain Services
       ↓
Repository / Data Access
       ↓
PostgreSQL / Storage
```

Rules that follow from this, non-negotiably:

- **The frontend never directly accesses a production database.** Every read/write goes through the API/Application layer. This is already true in `apps/svegip` today (its frontend calls `/api/*` Netlify Functions, never a database driver) and remains true for every future service.
- **Only the Repository/Data Access layer touches PostgreSQL directly.** Domain Services call repository interfaces (`packages/shared`'s `DatabaseProvider`), never raw SQL clients themselves. This is what makes swapping private PostgreSQL for AWS RDS PostgreSQL a provider change, not a rewrite (see `deployment-portability.md`).
- **Dependency direction is one-way, top to bottom.** A Domain Service may depend on Repository/Data Access; Repository/Data Access must never depend back up on a Domain Service. The same one-way rule applies between `platform-services/*` modules — see "Service boundaries" below.
- **API ownership is per-module.** Each `platform-services/*` module owns exactly the `/api/v1/...` paths listed in its own `README.md` (see `api-conventions.md` for the full namespace map). No module reaches into another module's database tables directly — cross-module data needs go through that module's published API/contract, never a shared table or a direct import of another module's internals.

## Service boundaries and dependency direction

The dependency graph is intentionally layered, not a mesh:

```
                    packages/types, packages/security, packages/shared
                                        ↑
                                platform-services/core
                                        ↑
                              platform-services/identity
                                        ↑
                            platform-services/organisation
                       ↑           ↑            ↑           ↑
                 workflow     documents     audit    notifications
                       ↑           ↑            ↑           ↑
        ┌──────────────┴───────────┴────────────┴───────────┴──────────────┐
        │                                                                  │
   hrms → payroll → iclaims                                          data-vault
        │                                                                  │
        └──────────────────────────→ accounting ←────────────────────────┘
```

Concretely:

- `identity` depends on nothing business-specific — it is upstream of everything.
- `organisation` depends only on `identity`.
- `workflow`, `documents`, `audit`, `notifications` are shared services: they depend on `identity`/`organisation` but never on a specific business domain (`hrms`, `payroll`, etc.). Business domains depend on them, not the reverse — see each shared module's own `README.md` for its explicit "must not depend on" line.
- `hrms` → `payroll` → `iclaims` is a real, intentional dependency chain (payroll needs HRMS's employee/compensation data; iClaims needs HRMS's employee context) — but none of them writes to `accounting`'s tables directly. They post through a defined integration contract, which is `accounting`'s to define and own.
- `data-vault` depends on `identity`, `organisation`, `documents`, `audit` — never on `hrms`/`payroll` internals.

This mirrors the "SYSTEM ADMINISTRATION vs. BUSINESS DATA ACCESS" separation required in `SVEGIP_ENTERPRISE_ASSESSMENT.md` and detailed in `security-architecture.md`: a service boundary is also a permission boundary, not merely a folder boundary.

## Multi-entity model

The platform must support multiple legal entities from the start, not as a later retrofit — SVEGIP's current flat `unit` string (`"SVE"` / `"SKL"` / `"Group"`, with `"SVE / SKL"` handled as an ad hoc split string in `apps/svegip/netlify/functions/portal-data.mts`) is exactly the anti-pattern being replaced. The canonical shape lives in `packages/types/src/entity-context.ts`:

```
Group
 └─ Legal Entity        (SVE International Sdn. Bhd. — MY, SVE International Pte. Ltd. — SG, SK Lai & Partners — MY)
     └─ Business Unit
         └─ Department / Team
```

Separately from this structural hierarchy:

- **User** — an authenticated identity (`platform-services/identity`).
- **Employee** — an organisational record linked to a user (`platform-services/organisation` for structure, `platform-services/hrms` for the full HR record).
- **Role** — what a user is permitted to *do* (`packages/security`'s `Role`).
- **Permission** — a specific granted capability (`packages/security`'s `Permission`).
- **Entity access** — *where* a user may act (`packages/types`'s `EntityAccessGrant`) — independent of role. A role does not imply entity access, and entity access does not imply a role; both must be checked (see `security-architecture.md`).

No production users, employees, or entities are hard-coded anywhere in this scaffolding.

## How SVEGIP migrates into shared services

This is a description of intended direction, not a schedule commitment. `apps/svegip` is not touched by this PR and is expected to keep running unmodified for some time:

1. **Identity first.** `apps/svegip`'s `_auth-core.mts`/`login.mts`/`session.mts` logic is real and working; a future `platform-services/identity` would be designed to fit its actual behaviour (live per-request re-authorization, PBKDF2, signed sessions) rather than replace it speculatively, then SVEGIP would be migrated to call it.
2. **Shared services next** (`documents`, `audit`, `workflow`) — SVEGIP already has working, well-formed analogues (`controlled_documents`, four separate audit tables, `management_decisions`) that are realistic templates, not blank slates, for these.
3. **New business domains** (`hrms`, `payroll`, `iclaims`, `accounting`, a rebuilt `data-vault`) are net-new — SVEGIP has no working analogue for these beyond `employee_accounts`, which is identity/RBAC only and is not extended into an employee master in place (see `SVEGIP_ENTERPRISE_ASSESSMENT.md` §Y).

Each of those migrations is its own future PR with its own verification pass, not a side effect of this one.

## Presentation layer

SVEGIP remains web-first, responsive, and PWA-ready in intent (see `SVEGIP_ENTERPRISE_ASSESSMENT.md` §U/§V for current state). A future native mobile app is expected to consume the same secured `/api/v1` layer described in `api-conventions.md` — never a separate, parallel API, and never direct database access. Regardless of client (web, PWA, native), sensitive HR/payroll/legal/accounting/Data Vault data must not be cached insecurely offline on any device — see `security-architecture.md` "Sensitive-data handling."

## Deferred tooling (intentional, not an oversight)

`platform-services/*` and `packages/*` in this PR are directories, `README.md` files, and interface-only `.ts` files — there is no root `package.json`, no npm workspaces configuration, no `tsconfig.json`, and no build step wired up anywhere in this PR. This is deliberate: wiring up real build/workspace tooling before any module has actual implementation to compile would be dead configuration. That wiring is expected to land alongside the first module that actually needs to import from `packages/*` at runtime (most likely `platform-services/identity`), not in this architecture-only PR. `apps/svegip`'s own `package.json`/CI are completely separate and untouched.
