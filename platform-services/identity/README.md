# platform-services/identity

**Status: scaffolding only — no implementation. Identity/MFA implementation is explicitly out of scope for this PR.**

Future home of the SVE Identity & Access Management layer: authentication, session issuance/revocation, MFA enrolment and verification, and the canonical roles/permissions model — the "one SVE identity" every application (SVEGIP, HRMS, Payroll, iClaims, Accounting, Data Vault) is meant to share, per the target architecture in `SVEGIP_ENTERPRISE_ASSESSMENT.md`.

`apps/svegip/netlify/functions/{_auth-core,login,session,logout,admin-users}.mts` is today's real, working identity logic for SVEGIP alone. It is **not moved or modified by this PR** — this folder is where a shared successor will eventually live, once a dedicated Identity/MFA PR designs it deliberately.

**Depends on:** `packages/types`, `packages/security`, `database/` conventions.
**Must not depend on:** `hrms`, `payroll`, `iclaims`, `accounting`, `data-vault`, or any other business domain — identity is upstream of everything else in the dependency graph, nothing business-specific should be upstream of it.
**Planned API namespace:** `/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`, `/api/v1/permissions`.
**Typical data classification:** RESTRICTED (credentials, sessions, MFA secrets), CONFIDENTIAL (profile data).
