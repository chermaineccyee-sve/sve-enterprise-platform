# platform-services/iclaims

**Status: scaffolding only — no implementation.**

Future home of employee claims: submission, manager approval, finance review, final approval, and hand-off to accounting as an expense/payable, with an end-to-end correlation ID preserved from submission through to the posted accounting transaction.

**Depends on:** `platform-services/identity`, `platform-services/hrms` (employee/claim-entitlement context), `platform-services/workflow` (approval chain).
**Must not depend on:** `accounting` internal schemas directly — claims post through a defined integration contract, the same one payroll uses, not a bespoke second path.
**Planned API namespace:** `/api/v1/claims`.
**Typical data classification:** CONFIDENTIAL to RESTRICTED depending on claim type and amount.
