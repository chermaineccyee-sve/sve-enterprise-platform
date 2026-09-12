# platform-services/data-vault

**Status: scaffolding only — no implementation. Data Vault remediation is explicitly out of scope for this PR.**

Future home of a server-backed SVE Data Vault, intended to eventually replace `apps/svegip/data-vault/index.html`'s current architecture, which stores its actual confidential business content (`sveRecords` — matters, evidence, risks, tasks, deliverables) in **browser `localStorage`, not a database** — recorded as a CRITICAL finding in `SVEGIP_ENTERPRISE_ASSESSMENT.md` and confirmed still present and unresolved as of this PR. See `docs/architecture/data-vault-rebuild-assessment.md` for what was found on the preserved `reference/svegip-feature-data-vault-rebuild` branch and how it should (and should not) inform the eventual remediation.

This folder intentionally contains no code. Building it out is a dedicated future PR, not this one.

**Depends on (planned):** `platform-services/identity`, `platform-services/organisation`, `platform-services/documents`, `platform-services/audit`.
**Must not depend on:** `hrms`/`payroll` internal schemas.
**Planned API namespace:** `/api/v1/datavault`.
**Typical data classification:** CONFIDENTIAL to PRIVILEGED.
