# platform-services/accounting

**Status: scaffolding only — no implementation.**

Future integration boundary with SVE Accounting Pro: general ledger, accounts payable/receivable, journals, multi-entity/multi-currency financial reporting. No accounting system exists anywhere in scope today (verified in `SVEGIP_ENTERPRISE_ASSESSMENT.md` §Z) — this folder is a placeholder for the boundary, not the accounting system itself.

**Depends on:** `platform-services/identity`, `platform-services/organisation` (entity/currency scoping). Receives structured postings from `payroll` and `iclaims` via a defined integration contract — it does not reach into their tables, and they do not reach into its ledger directly.
**Must not depend on:** `hrms`/`payroll` internal schemas — only their published integration contracts.
**Planned API namespace:** `/api/v1/accounting`.
**Typical data classification:** CONFIDENTIAL to RESTRICTED.
