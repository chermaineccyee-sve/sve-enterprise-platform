# platform-services/core

**Status: scaffolding only — no implementation.**

Not a business domain. This is the future composition root and cross-cutting layer that every other `platform-services/*` module will sit on top of once real implementation begins:

- Wiring concrete provider implementations (see `packages/security`, `packages/shared`) to the abstract contracts they satisfy — e.g. binding a real `DatabaseProvider` for Netlify DB vs. AWS RDS at startup, not scattered per-module.
- Building the request context every API handler receives: authenticated identity, entity context (group/legal entity/business unit), correlation ID, permissions — see `packages/types`.
- Shared error types and the `/api/v1` response envelope (see `docs/architecture/api-conventions.md`).

**Depends on:** `packages/types`, `packages/security`, `packages/shared`.
**Must not depend on:** any specific business domain (`hrms`, `payroll`, `accounting`, etc.). Domains depend on `core`, never the reverse.
**API namespace:** none of its own — it underlies every other namespace.
