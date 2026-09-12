# Architecture documentation

Established by the Platform Architecture Foundation PR. Documentation and contracts only — no `platform-services/*` module is implemented; `apps/svegip` is unaffected.

- [`platform-architecture.md`](./platform-architecture.md) — layered architecture, service boundaries, dependency direction, the multi-entity model, and how SVEGIP is expected to migrate into shared services over time.
- [`api-conventions.md`](./api-conventions.md) — the `/api/v1` namespace, response envelope, pagination, correlation IDs, and authentication/authorization expectations.
- [`security-architecture.md`](./security-architecture.md) — RBAC, entity/record-level access, the System Admin ≠ HR ≠ Finance ≠ Management rule, MFA/step-up readiness, data classification, and the audit event contract.
- [`data-and-database-conventions.md`](./data-and-database-conventions.md) — PostgreSQL conventions: migrations, effective-dating, IDs, audit columns, entity scoping, transactional integrity.
- [`deployment-portability.md`](./deployment-portability.md) — SVE private server vs. AWS target components, the portability principle, and environment conventions.
- [`data-vault-rebuild-assessment.md`](./data-vault-rebuild-assessment.md) — a read-only assessment of the preserved `reference/svegip-feature-data-vault-rebuild` branch: what it contains, what's reusable, what isn't, and how it should inform the dedicated future Data Vault remediation.

See also `SVEGIP_ENTERPRISE_ASSESSMENT.md` (repo root) for the original, code-verified assessment these documents build on, and `CONTRIBUTING.md` for the day-to-day workflow.
