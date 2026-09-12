# SVE Group Enterprise Platform

This repository is the master codebase for the **SVE Group Enterprise Management Platform** — the long-term, consolidated home for SVEGIP and the shared enterprise services planned to grow alongside it (identity, HRMS, payroll, iClaims, accounting, workflow, audit, and Data Vault).

It currently contains one working application and architecture scaffolding (contracts and documentation, no implementation) for the shared services planned to grow alongside it — see [Current status](#current-status) for exactly what exists today.

## Repository layout

```
sve-enterprise-platform/
├── apps/
│   └── svegip/            ← the existing SVE Group Internal Portal (current status: working, deployed)
├── platform-services/     ← scaffolded service boundaries (README/contracts only, no implementation)
│   ├── core/  identity/  organisation/  workflow/  documents/
│   ├── notifications/  audit/  data-vault/  hrms/  payroll/
│   └── iclaims/  accounting/
├── packages/               ← shared contracts consumed by platform-services/* once implemented
│   ├── types/     entity/API/audit-event shapes
│   ├── security/  AuthProvider, SecretsProvider, RBAC contracts
│   ├── shared/    DatabaseProvider, StorageProvider, LoggingProvider, NotificationProvider
│   └── config/    environment conventions
├── database/               ← future shared PostgreSQL migrations (none created yet)
├── infra/                  ← future deployment config: local/, sve-server/, aws/ (nothing provisioned yet)
├── docs/
│   ├── architecture/       ← platform architecture, API, security, database, deployment, Data Vault assessment
│   └── migration/          ← records of how this repository was assembled
└── SVEGIP_ENTERPRISE_ASSESSMENT.md   ← baseline architecture assessment
```

### `apps/svegip/`

The existing SVEGIP application — a Netlify-hosted portal (static frontend + Netlify Functions + Postgres via Netlify DB) covering employee authentication, role-based portal navigation, group announcements/projects/policies/documents/meetings, a controlled document registry, a management decision tracker, and the SVE Data Vault module. It was imported into this repository with its full Git history via `git subtree` (see `docs/migration/2026-09-12-svegip-history-import.md`) and remains structurally unchanged and independently deployable from its own subdirectory.

### `platform-services/` and `packages/` (scaffolded, not yet implemented)

Future shared enterprise capabilities have their service boundaries, dependency rules, and provider contracts documented — see `docs/architecture/platform-architecture.md` and each module's own `README.md`. **No business logic is implemented in either directory** — this is architecture scaffolding, not a shipped capability. Escrow / source-code custody functionality is explicitly out of scope and not represented anywhere in this scaffolding.

## The original `svegip` repository

`chermaineccyee-sve/svegip` (private) is the original, pre-existing SVEGIP repository. It is being **preserved unchanged** as a rollback/reference copy throughout this transition — nothing in this repository's setup has modified, merged into, or pushed to it. Its own Netlify staging and production deployments continue to run from that repository directly. Once this repository (`sve-enterprise-platform`) is validated as the platform's long-term source, a separate, deliberate decision will be made about repointing deployment to `apps/svegip` here; that has not happened yet.

## Current status

| Capability | Status |
|---|---|
| SVEGIP portal (auth, RBAC, portal content, document registry, decision tracker, Data Vault UI) | **Exists** — see `apps/svegip/` |
| SVE Identity & Access (shared identity, MFA, sessions) | Planned — not started |
| HRMS (organisation, employee master, ESS/MSS, leave, onboarding) | Planned — not started |
| Payroll / iClaims | Planned — not started |
| SVE Accounting Pro | Planned — not started |
| Shared workflow / approval engine | Planned — not started |
| Central audit service | Planned — not started (SVEGIP has its own separate per-domain audit tables today) |
| Server-backed Data Vault | Planned — the current Data Vault module stores its actual records in browser `localStorage`, not a database; this is a known, recorded issue, not a design decision. See `SVEGIP_ENTERPRISE_ASSESSMENT.md`. |
| Private-server / AWS deployment portability | Planned — the current application is coupled directly to Netlify's SDKs. |

For the detailed, code-verified assessment behind this table — including a security gap list and a phased roadmap — see [`SVEGIP_ENTERPRISE_ASSESSMENT.md`](./SVEGIP_ENTERPRISE_ASSESSMENT.md). For the architecture that `platform-services/*` scaffolding above follows, see [`docs/architecture/`](./docs/architecture/README.md).

## Working in this repository

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the branch/PR workflow, environment variable conventions, and where new code should go.
