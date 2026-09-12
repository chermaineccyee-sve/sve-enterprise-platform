# platform-services/payroll

**Status: scaffolding only — no implementation.**

Future home of multi-jurisdiction payroll (e.g. SVE Malaysia, SVE Singapore payroll as separate configurations, not one hard-coded ruleset): payroll periods, runs, items, and payslips, with immutable/finalised periods and controlled adjustment/reversal for corrections.

**Depends on:** `platform-services/hrms` (employee/compensation/leave data via a defined contract), `platform-services/identity`, `platform-services/workflow` (approval).
**Must not depend on:** reaching directly into `accounting`'s ledger — payroll posts through a defined integration contract; accounting owns its own tables exclusively.
**Planned API namespace:** `/api/v1/payroll`, `/api/v1/payslips`.
**Typical data classification:** RESTRICTED. Payroll permissions must be substantially stricter than general HR permissions (see `docs/architecture/security-architecture.md`).
