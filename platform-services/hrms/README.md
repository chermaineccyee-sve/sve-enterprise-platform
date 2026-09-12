# platform-services/hrms

**Status: scaffolding only — no implementation. HRMS implementation is explicitly out of scope for this PR.**

Future home of the SVE HRMS: employee master, ESS/MSS, leave, attendance, performance, learning & development, recruitment, onboarding/offboarding, and effective-dated compensation history. `apps/svegip`'s `employee_accounts` table is identity/RBAC only (email, name, role, unit, permissions) — it is not an employee master and is not extended in place; see `SVEGIP_ENTERPRISE_ASSESSMENT.md` §Y for why a separate domain is the intended design.

**Depends on:** `platform-services/identity`, `platform-services/organisation`, `platform-services/workflow` (approvals), `platform-services/documents` (employee documents).
**Must not depend on:** `payroll`/`accounting` internal schemas — HRMS feeds them through a defined integration contract, never writes to their tables directly.
**Planned API namespace:** `/api/v1/hr`, `/api/v1/employees`, `/api/v1/leave`, `/api/v1/attendance`, `/api/v1/performance`.
**Typical data classification:** CONFIDENTIAL (profile, employment record) to RESTRICTED (compensation history).
