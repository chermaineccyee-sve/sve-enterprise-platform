# platform-services/workflow

**Status: scaffolding only — no implementation.**

Future home of a reusable, domain-agnostic approval/workflow engine — requests, steps, approvals, and a configurable delegation-of-authority / approval-matrix (entity × transaction type × threshold × required role) — intended to replace the pattern of hand-coding a separate approval flow per feature. SVEGIP's current `management_decisions` table (in `apps/svegip`) is a single-purpose decision log, not this; it is unaffected by this PR.

**Depends on:** `platform-services/identity` (approver identity/roles), `platform-services/organisation` (entity/department-based routing).
**Must not depend on:** any specific business domain's rules. Domains (leave, claims, payroll, journals) plug their approval needs into this engine — this engine must never encode a specific domain's business rules itself.
**Planned API namespace:** `/api/v1/workflows`, `/api/v1/approvals`.
**Typical data classification:** inherits the classification of whatever it is routing (a payroll approval request carries RESTRICTED data even though the workflow engine itself is domain-agnostic).
