# Architecture documentation

Established by the Platform Architecture Foundation PR and extended by the Identity & Access Foundation PR. `platform-services/identity` is implemented and tested; every other `platform-services/*` module remains documentation and contracts only. `apps/svegip` is unaffected by any of it.

- [`platform-architecture.md`](./platform-architecture.md) — layered architecture, service boundaries, dependency direction, the multi-entity model, and how SVEGIP is expected to migrate into shared services over time.
- [`api-conventions.md`](./api-conventions.md) — the `/api/v1` namespace, response envelope, pagination, correlation IDs, and authentication/authorization expectations.
- [`security-architecture.md`](./security-architecture.md) — RBAC, entity/record-level access, the System Admin ≠ HR ≠ Finance ≠ Management rule, MFA/step-up readiness, data classification, and the audit event contract.
- [`data-and-database-conventions.md`](./data-and-database-conventions.md) — PostgreSQL conventions: migrations, effective-dating, IDs, audit columns, entity scoping, transactional integrity.
- [`deployment-portability.md`](./deployment-portability.md) — SVE private server vs. AWS target components, the portability principle, and environment conventions.
- [`data-vault-rebuild-assessment.md`](./data-vault-rebuild-assessment.md) — a read-only assessment of the preserved `reference/svegip-feature-data-vault-rebuild` branch: what it contains, what's reusable, what isn't, and how it should inform the dedicated future Data Vault remediation.
- [`identity-foundation.md`](./identity-foundation.md) — the implemented SVE Identity & Access Foundation: the Group/HQ/entity model, User vs. Employee, RBAC, sessions, password security, login protection, TOTP MFA, recovery codes, step-up readiness, audit, and portability — plus an explicit note that SVEGIP's own authentication is unmigrated and untouched.

See also `SVEGIP_ENTERPRISE_ASSESSMENT.md` (repo root) for the original, code-verified assessment these documents build on, and `CONTRIBUTING.md` for the day-to-day workflow.
