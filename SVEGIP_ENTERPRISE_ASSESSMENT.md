# SVEGIP → SVE Group Enterprise Management Platform
## Repository Assessment (Initial Deliverable)

**Date:** 12 September 2026
**Scope assessed:** `chermaineccyee-sve/svegip` (private repo, `main` @ `af02ba7`) — this is the only repository containing SVEGIP code. `chermaineccyee-sve/sve-enterprise-platform` (this repo) had zero commits at session start.
**Method:** Every claim below is based on reading the actual source (Netlify Functions, migrations, `app.js`, `data-vault/index.html`, config files) — not on the repo's own `.txt`/`.md` progress notes, which were cross-checked against code rather than taken at face value.

Per instruction, this is an **assessment only**. No implementation has been started. Stopping here for review.

---

## 0. What this repository actually is today

SVEGIP is a **single small hand-built application**, not an enterprise platform yet:

- **Frontend:** vanilla JS, no framework, no build step, no bundler.
  - `app.js` (663 lines) — main portal: string-template rendering, a `go(page)` client router, in-memory `db` object hydrated from `/api/portal-data`.
  - `data-vault/index.html` (2,841 lines) — a second, entirely separate single-file app (own embedded `<style>`/`<script>`) for "SVE Data Vault" (strategy/intelligence/matters module).
  - `styles.css` (201 lines) for the main portal.
- **Backend:** Netlify Functions (`.mts`, Deno runtime) — 9 routable functions + 2 shared (underscore-prefixed) modules + 1 Edge Function.
- **Database:** Netlify DB (managed Postgres/Neon) via `@netlify/database` tagged-SQL, no ORM. 4 migrations, ~10 tables total.
- **Deployment:** Netlify only. A `vercel.json` also exists but is a **leftover from an earlier, pre-backend, pure-static Vercel build** — it cannot run the current app (Vercel doesn't execute Netlify Functions/Edge Functions/DB), and should be treated as dead config, not a real second deployment target.
- **No package manager lockfile, no test suite, no CI, no Docker, no `.env.example`, no linter config.**

Total application code: **~3,750 lines** across the whole system (functions + migrations + frontend). This is a solid, security-conscious *portal prototype* for a single business unit's internal comms/governance/document-registry use case — it is **not yet** HRMS, payroll, accounting, or an identity platform in any form. Treat everything below as measured against that reality.

---

## 1. Verified current functionality (what's real, not just described)

| Area | Verified implementation |
|---|---|
| Auth | Email + PBKDF2-SHA256 (210,000 iterations, random salt) password check. Hand-rolled HMAC-SHA256 signed cookie (`svegip_session`), `HttpOnly; Secure; SameSite=Lax`, 8h expiry. |
| Live authorization | `_auth-core.mts` re-queries `employee_accounts` **on every protected request** (not just at login) and requires `status='Active'` — good: a deactivated account or revoked entitlement takes effect immediately, not just at next login. Verified this is actually wired into `admin-users`, `portal-data`, `documents`, `decisions`, `vault-authorize`. |
| RBAC | 5 free-text roles + a JSONB permission-string array (`accounts.manage`, `vault.admin`, `vault.audit`, `decisions.manage`). Enforced server-side in every function reviewed, not just hidden in the UI. |
| Data Vault gating | Edge Function calls back to `/api/vault-authorize` (204/redirect), which itself re-checks the live DB — edge doesn't open its own DB connection. Sound pattern. |
| Document registry | `controlled_documents` + `_versions` + `_access` (ACL) + `_audit`, with per-document view grants by user/role/unit and deny-by-default for "Restricted". Real and reasonably designed **as a metadata registry**. |
| Decision tracker | `management_decisions` + audit table, single-stage status field, sequential codes `SVE-DEC-####`. |
| Portal content | `portal_records` — one generic `(module, record_id) → JSONB` table for announcements/projects/policies/documents/meetings/actions. Flexible, not relational. |
| Bootstrap | One-time first-admin creation gated by a header secret + "table must be empty" check; self-disables. Reasonable for a pre-launch bootstrap flow. |
| Mobile CSS | 22 `@media` rules (main portal) + 56 (`data-vault`) — real, iterated-on responsive work (see §2). |

---

## U. Mobile Responsiveness

**Verified, not inferred:** viewport meta present on both apps; `styles.css` and `data-vault/index.html` both carry real `@media(max-width:...)` breakpoints implementing a slide-in sidebar drawer + overlay, mobile record-card views (`.mobile-record-card`) as alternatives to desktop tables, sticky mobile nav toggle, and safe-area handling. The repo's own progress notes (V25/V26.1/V26.2) describe successive rounds specifically fixing mobile scroll isolation, sign-out reachability, and modal safe-areas — consistent with what's in the CSS.

**Issues found:**
- Two independent, hand-rolled responsive implementations (main portal CSS vs. Data Vault's embedded `<style>`) with no shared design tokens/breakpoints — every future layout change has to be made twice and can drift.
- No component library or CSS methodology (BEM/utility framework) — pure ad hoc classes. Fine at this scale, a maintenance risk beyond it.
- No automated visual/responsive regression testing — all mobile fixes so far are described as manual walkthroughs.
- Financial/admin-heavy screens (Employee Accounts, Controlled Documents, Decision Tracker) already have mobile card fallbacks — better than the target spec requires at this stage.

**Verdict:** Real and better than typical "we'll fix mobile later" prototypes. Foundation is usable; needs a shared design-token layer before HRMS-scale screen count arrives.

## V. PWA Readiness

**Verified: zero.** No `manifest.json`, no service worker, no `<link rel="manifest">`, no install-related meta tags, no icon set (favicon reuses the JPEG logo). Nothing to build on yet — this is a clean "not present," not a "broken existing attempt."

## W. MFA Readiness

**Verified: zero.** Grepped the entire codebase for TOTP/otpauth/WebAuthn/2FA — no hits in actual code (one incidental substring match inside a base64 image blob, not real). Findings relevant to future MFA work:

- Session is a single flat HMAC-signed cookie with no session-ID/session-table — there is nowhere today to attach an "MFA verified" flag or step-up state to a session.
- No concept of "primary auth passed, MFA pending" intermediate state.
- No rate limiting or lockout on `/api/login` — necessary to add alongside MFA, not just MFA itself.
- Positive: because `_auth-core.mts` already re-resolves identity live from the DB on every request, adding an `mfa_enrolled`/`mfa_verified_at` column and checking it centrally is architecturally straightforward — the live-context pattern is exactly the right place to add it.

## X. HRMS Readiness

**Verified: effectively none, reusable pieces are identity-adjacent only.** There is no organisation/department/position/employment-lifecycle/leave/attendance/performance/training code or schema anywhere. What *is* reusable:

- `employee_accounts` — but it is an **identity/RBAC table**, not an employee master (see §Y).
- The audit-table pattern (`*_audit` tables keyed to a domain table) is a good template to replicate for HR domains.
- The live-authorization resolver pattern (`resolveLiveSecurityContext`) is a good template for HR field-level permission checks (item 50's employee/manager/HR/finance separation).
- The `portal_records` generic-JSONB pattern should **not** be reused for HRMS — HR/finance data explicitly needs typed relational columns and effective-dating (item 38), which a generic JSONB blob table cannot support safely.

## Y. Employee Master Readiness

**Verified via migration 001:** `employee_accounts` contains only `email, name, role, unit, status, data_vault_access, permissions, password_*`. There is no `employee_number`, `legal_entity`, `department`, `position`, `grade`, `manager`, `employment_type`, `joining_date`, `work_location`, or any personal/sensitive-data separation. This table is doing one job — login identity + coarse RBAC — and doing it reasonably well. It is **not** an Employee Master and should not be extended in place into one; item 10/50 both require separating identity from sensitive HR data, which argues for a **new, separate HRMS employee domain** that references `employee_accounts.email`/id rather than growing this table's column count indefinitely.

## Z. Accounting Integration Readiness

**Verified: SVE Accounting Pro does not exist in any repository in scope.** SVEGIP has no accounting code, no ledger/journal concepts, no payroll code. The only relevant existing pattern is the document-storage abstraction (`_document-storage.mts`) and the "interim backend, swappable later" framing used consistently across the notes and confirmed in code (`storage_provider` column, `registerExternalObject()` is a literal pass-through stub today — no real file storage is wired up, contrary to what a reader might assume from the "controlled document repository" name). The same "controlled contract now, swap the backend later" pattern is the right template to reuse for a future Payroll→Accounting integration boundary, but none of it exists yet.

## AA. Shared Workflow Engine Readiness

**Verified: no generic workflow/approval engine exists.** What exists is one **specific, hardcoded, single-stage** decision log (`management_decisions`, statuses `Decision Required → Direction Given → Implementation → Closed`), with authorization checks (`canRead`/`canWrite`) hardcoded per-role in `decisions.mts`. There is no `workflow_instances`/`workflow_steps`/`approvals` schema, no multi-step approver chain, no delegation-of-authority/threshold table (item 31), no maker-checker separation (item 43). This is a decision-tracking log, not an approval engine — leave/claims/payroll approvals described in the target architecture would each need their own bespoke logic today, exactly the anti-pattern item 25 warns against ("avoid hard-coding every workflow independently").

## AB. Multi-Entity Readiness

**Verified: not modeled.** The only entity-like concept is a free-text `unit` column with observed values `SVE`, `SKL`, `Group` (and `"SVE / SKL"` as a literal joint-value string in seed data, handled by ad hoc string-splitting in `portal-data.mts`'s `sameUnit()`). There is:
- No separate legal-entity table (SVE International Sdn Bhd vs. Pte Ltd are not distinguished anywhere — both would presumably collapse into `"SVE"`).
- No jurisdiction, currency, or holiday-calendar concept.
- No timezone-aware architecture — the home-page clock hardcodes the label `"MYT/SGT"` as display text (`app.js` `updateGroupHomeClock`), it does not compute per-entity local time.

This is the single biggest structural gap relative to items 47–49 (multi-jurisdiction, multi-currency, timezone), because it's not just "missing modules" — the *existing* `unit` field and its string-matching logic would need to be replaced, not extended, once SVE MY / SVE SG / SKL need to be genuinely distinguished (e.g., for payroll or statutory leave rules).

## AC. Private Server Portability

**Verified: not portable today.** Every backend file directly imports `@netlify/database` and reads secrets via the global `Netlify.env.get(...)`; the edge auth guard is written against `@netlify/edge-functions`' `Context` type. There is no database-access abstraction layer, no config/env abstraction, and no generic HTTP handler shape — business logic (RBAC checks, SQL) is inline in the same file as the Netlify-specific plumbing in every function. Moving to SVE's own Nginx+containers+Postgres stack would require rewriting all 11 function files' transport layer, not just redeploying.

## AD. AWS Portability

**Verified: not prepared, but not contradicted either.** Nothing here is AWS-incompatible in principle (plain Postgres, plain HMAC/PBKDF2 — no Netlify-proprietary crypto), but nothing is AWS-ready either — same root cause as §AC: the coupling is to the Netlify Functions/DB/Edge SDKs specifically, not to any feature Netlify uniquely provides. The fix for AC and AD is the same piece of work: introduce a thin platform-adapter layer (session/cookie handling, `db.sql` wrapper, secret access) so the ~11 function files call *that* instead of `@netlify/*` directly.

## AE. Security Gap Assessment

| Severity | Finding | Evidence |
|---|---|---|
| **CRITICAL** | SVE Data Vault's actual business content (`sveRecords` — matters/evidence/risks/tasks/deliverables/insights) is stored **entirely in browser `localStorage`**, not the database, despite the module being described as holding "privileged," "SK Lai" client-sensitive strategy intelligence with RBAC/classification. `data-vault/index.html:2112`: `let data=JSON.parse(localStorage.getItem('sveRecords')||'null')\|\|seed;`. All server-side RBAC/edge-gating only controls *who can load the page* — once loaded, the confidential content is unencrypted, per-browser, inspectable via devtools, not backed up, and not access-logged. This directly contradicts the classification requirements in item 36/AE for "PRIVILEGED" data. |
| **CRITICAL** | No MFA anywhere, including for the Administrator role that can create other admins, reset any password, and grant Data Vault/decision-management permissions. |
| **HIGH** | No rate limiting / brute-force protection on `/api/login` or `/api/bootstrap-admin` (bootstrap does compare a static header secret with no attempt-limiting either). |
| **HIGH** | No server-side session store — `svegip_session` is a stateless signed cookie with no session ID. Consequences: (a) "revoke this one session/device" and "view active sessions" (item 8) are structurally impossible without adding a session table; (b) the *only* way to invalidate all sessions at once is rotating `SVEGIP_SESSION_SECRET`, which logs out every user, not a targeted user. |
| **HIGH** | `_document-storage.mts`'s `registerExternalObject()` is a stub that just echoes back whatever `storageReference` string the client sends — there is no actual file upload, no server-side validation that a reference resolves to a real, permission-checked object. Any manager-role user can currently type an arbitrary string into "File / Storage Reference" and it will be recorded as if it were a verified document. |
| **MEDIUM** | No CSRF token defense-in-depth (relies solely on `SameSite=Lax` + same-origin fetch conventions — acceptable baseline, but not defense-in-depth for a system that will carry payroll/salary data). |
| **MEDIUM** | Password policy is minimal (8 chars via admin UI, 12 chars only for the one-time bootstrap) — no complexity/breach-list checking. |
| **MEDIUM** | Roles and permission strings are free text with no canonical roles/permissions table — typos or inconsistent naming (`"SKL User"` in `app.js`'s legacy `specs.people` vs. `"SKL User / Legal Reviewer"` used everywhere else) can silently create authorization gaps. |
| **LOW** | `vercel.json` is stale/misleading — a static-only deployment config left in a repo whose app now requires Netlify Functions/DB; should be removed to avoid a future accidental broken deploy attempt. |
| **LOW** | No structured logging/monitoring; `console.error` only. Fine pre-production, insufficient for the "suspicious login detection" target in item 41. |
| **FUTURE HARDENING** | Step-up authentication (item 7), delegation-of-authority/approval-matrix (item 31), maker-checker (item 43), data classification enforcement beyond ad hoc `classification` string comparisons (item 36) — all correctly deferred, none started, consistent with current phase. |

## AF. Recommended Enterprise Architecture (near-term, buildable increment — not the full target diagram)

The 61-item target architecture in the brief is the right *destination*. Given the actual starting point (~3,750 LOC, one module, one Netlify project, no identity layer, no HRMS), the responsible next increment is:

```
                    SVE IDENTITY & ACCESS (NEW)
        users · roles · permissions · sessions · mfa · entities
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   SVEGIP (existing,      SVE HRMS (new,        Future: Payroll /
   refactored onto         Phase B)              Accounting / iClaims
   the new identity
   layer)
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                     SHARED SERVICES (mostly new)
        documents (extend existing registry) · audit (consolidate
        the 4 existing per-domain audit tables into one audit_events
        schema) · notifications (new) · workflow/approvals (new)
                              │
                        DATA LAYER
              PostgreSQL (already Netlify-hosted;
           keep, behind a portability adapter — §AC/AD)
```

Concretely: (1) extract a platform-adapter module so business logic stops importing `@netlify/*` directly; (2) replace the flat signed cookie with a `sessions` table (id, user_id, device info, issued_at, revoked_at) so item 8 becomes possible; (3) introduce canonical `roles`/`permissions` tables instead of free-text role strings before any HRMS/payroll role is added; (4) do **not** put Data Vault content back on the roadmap as "done" — its localStorage persistence is a rebuild, not a hardening pass.

## AG. Development Roadmap — Component Mapping

| Phase-A target component | State | Notes |
|---|---|---|
| Repository assessment | **DONE** (this document) | |
| Responsive web/mobile architecture | **EXISTS AND RETAIN** | Genuinely iterated; needs a shared token layer, not a rebuild. |
| API / Application layer | **EXISTS BUT REFACTOR** | Real `/api/*` contract exists; needs the platform-adapter decoupling from Netlify SDKs. |
| PostgreSQL foundation | **EXISTS AND RETAIN** | Real schema, real migrations, sound `IF NOT EXISTS` pattern. |
| Authentication | **EXISTS BUT REFACTOR** | PBKDF2 + HMAC session is sound cryptographically; needs a session table and rate limiting. |
| MFA | **NOT PRESENT** | Clean slate; live-authorization pattern makes it a natural add. |
| Sessions | **NOT PRESENT** | Stateless cookie only; no session table/revocation. |
| RBAC | **PARTIAL** | Role/permission *checks* are real and server-enforced; role/permission *storage* is free-text, needs canonical tables. |
| Permissions | **PARTIAL** | Ad hoc string flags work today; not table-driven. |
| Entity access | **NOT PRESENT** | `unit` string only; no legal-entity model. |
| Audit | **PARTIAL** | 4 separate, well-formed per-domain audit tables; not centralized. |
| Storage abstraction | **PARTIAL** | Interface (`_document-storage.mts`) exists; implementation is a stub, no real object storage wired up. |
| Organisation / employee master / ESS / MSS / leave / onboarding-offboarding | **NOT PRESENT** | Zero HRMS code. |
| Workflow/approval engine | **NOT PRESENT** | Only a single-purpose decision log exists. |
| Attendance / probation / performance / training / recruitment / compensation | **FUTURE** | Correctly out of scope for now. |
| Payroll / payslips / iClaims | **FUTURE** | Correctly out of scope for now. |
| SVE Accounting Pro / integrations / multi-entity finance | **FUTURE / NOT PRESENT** | No accounting system exists anywhere in scope. |
| Management Command Centre | **EXISTS BUT REFACTOR** | Real, reads live from portal/documents/decisions APIs — matches item 33's "consume from API layer, don't duplicate data" intent already. Needs permission review once real payroll/HR data exists behind it. |
| SVE Data Vault | **EXISTS BUT REQUIRES REBUILD (not refactor)** | UI/navigation/mobile work is real; **underlying record storage is client-side localStorage** — this is a data-layer rebuild, not a polish pass, before any confidential content should go near it. |
| Private server deployment package | **NOT PRESENT** | No Docker/Nginx config exists. |
| AWS deployment package | **NOT PRESENT** | No AWS-specific config exists; no blocker in principle once the adapter layer exists. |
| Monitoring / backup / hardening / pen-test readiness | **FUTURE** | Correctly out of scope for now. |

---

## Summary for review

SVEGIP is a real, working, single-purpose portal with above-average security hygiene for its size (live re-authorization, PBKDF2, signed HttpOnly cookies, server-enforced RBAC, real audit trails) and genuinely iterated mobile CSS. It is **not** close to being an HRMS, identity platform, or accounting-integrated system yet, and one component — the Data Vault's actual data storage — is weaker than its UI and documentation suggest (localStorage, not the database) and should be treated as a rebuild item, not a "Phase 1 limitation" footnote.

Recommend Phase A start with, in order: (1) platform-adapter extraction, (2) session table + rate limiting, (3) canonical roles/permissions tables, (4) Data Vault storage migration off localStorage — before any HRMS/Phase B work begins, since HRMS will inherit whatever identity/session/RBAC foundation exists at that point.

**Stopping here per instruction. Awaiting authorisation before starting Phase A implementation.**
