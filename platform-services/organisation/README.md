# platform-services/organisation

**Status: scaffolding only — no implementation.**

Future home of the organisational backbone every other module scopes its data against: group → legal entity → business unit → department/team → position, and the employee-master *structure* (not the full HR record, which belongs to `hrms` once it exists). This is what lets the platform distinguish SVE Group, SVE International Malaysia, SVE International Singapore, and SK Lai & Partners Malaysia as real, separate scoping boundaries rather than a single free-text field — see `docs/architecture/platform-architecture.md` for the entity model this replaces (SVEGIP's current flat `unit` string).

**Depends on:** `platform-services/identity` (linking a user to an employee record), `packages/types`.
**Must not depend on:** `hrms`, `payroll`, `accounting` business logic — those depend on `organisation` for entity/department context, not the other way round.
**Planned API namespace:** `/api/v1/entities`, `/api/v1/employees` (organisational-structure fields only).
**Typical data classification:** CONFIDENTIAL.
