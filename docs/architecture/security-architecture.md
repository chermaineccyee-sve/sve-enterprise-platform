# Security Architecture

Status: architecture documentation only. No Identity/MFA implementation, no RBAC storage, no encryption tooling is built by this PR. Where a claim below is about `apps/svegip`'s *current* behaviour, it has been verified against its actual code (see `SVEGIP_ENTERPRISE_ASSESSMENT.md`), not assumed.

## Zero-trust frontend

No client (web, PWA, or future native app) is trusted with authority. The frontend never embeds database credentials, API master keys, cloud secret-manager keys, or privileged service credentials — `apps/svegip`'s frontend already follows this today (verified: no secrets found in `app.js` or `data-vault/index.html`). Every authorization decision is re-derived server-side on every request; a client hiding a button or a menu item is a UX convenience, never a security boundary. `apps/svegip`'s own `PORTAL_WIDE_RBAC_MATRIX.txt` states this same principle for its Data Vault and account-administration routes today, and it holds true for every future module.

## Server-side authorization

Every domain service, on every request, resolves the current session live (not trusting a claim embedded in a token/cookie from login time) — this is exactly the pattern `apps/svegip/netlify/functions/_auth-core.mts` already implements (`resolveLiveSecurityContext` re-queries the account on every protected call and requires `status = 'Active'`), and it is the template future services should follow, via `packages/security`'s `AuthProvider.resolveSession`.

## RBAC and granular permissions

See `packages/security/src/rbac.ts` for the contract shapes (`Role`, `Permission`, `SessionContext`, `PermissionChecker`). Canonical, table-driven roles/permissions replace SVEGIP's current free-text role strings and JSONB permission-string array — functional today, but not the long-term shape (see `SVEGIP_ENTERPRISE_ASSESSMENT.md` §AE "Roles and permission strings are free text with no canonical roles/permissions table").

## Entity-level and record-level access

Two distinct checks, both required, neither substitutes for the other:

- **Entity-level**: does the session's entity access cover the legal entity/business unit/department the record belongs to (`EntityAccessGrant` in `packages/types`)?
- **Record-level**: within an entity the session can access, does this specific record's classification and any explicit access grant (analogous to SVEGIP's `controlled_document_access` ACL table today) permit this session? A Restricted record is deny-by-default even to users who can otherwise see the entity's other records — the same rule `apps/svegip/netlify/functions/documents.mts` already enforces (`canSee()`), which future services should generalize rather than reinvent per module.

## Explicit separation: System Admin ≠ HR ≠ Finance ≠ Management

This is a mandatory, non-negotiable architectural rule, not a convention to be tightened later:

- A **System Administrator** manages accounts, roles, and system configuration. This does **not** automatically grant access to salaries, payroll, payslips, privileged legal files, or Restricted/Privileged Data Vault content. System administration is infrastructure access; business data access is a separate grant.
- **HR** may see broader employment information than a manager, but does not automatically receive Finance's compensation/payroll processing access, or vice versa.
- **Finance** does not automatically receive access to every HR record merely because payroll depends on HR data — payroll consumes HR data through `hrms`'s published contract (see `platform-architecture.md`), not by browsing HR's full record set.
- **Management** dashboards aggregate information (see `platform-architecture.md`'s Management Command Centre migration note) but aggregation must not become a backdoor to individual-level Restricted data merely because the aggregate is visible to Management.

Every future permission model must let these four be independently true or false for the same person — a person can validly be a System Administrator with zero HR/Finance access, or an HR user with zero system-administration rights.

## Segregation of duties (maker / checker / approver)

For financial and other sensitive workflows (accounting journals, payroll, payment, compensation changes, high-value claims), the same person should not be able to perform incompatible stages of the same transaction (e.g. create and approve the same payroll run). `platform-services/workflow`'s configurable approval chains are the mechanism; this is a requirement on how domains configure that engine, not something the engine can silently guarantee on its own — each domain that needs segregation of duties must configure it explicitly.

## Secure session model

- Sessions are signed and validated server-side on every request (see "Server-side authorization" above), not merely at login.
- `SessionContext` (see `packages/security/src/rbac.ts`) carries an explicit `mfaVerified` flag and `expiresAt` — a session without recent MFA verification can still exist for basic access while being denied step-up-gated actions (see below).
- **Session management gap being addressed by design, not yet closed in code**: SVEGIP's current session is a stateless signed cookie with no server-side session table, so per-device "view active sessions" / "revoke this one session" (rather than revoking all sessions by secret rotation) is not yet possible — `AuthProvider`'s `revokeSession(sessionId)` vs. `revokeAllSessions(userId)` distinction in `packages/security` exists specifically so a future implementation closes this gap rather than repeating it.

## MFA readiness

No MFA is implemented by this PR. The contracts are shaped so it can be added without a redesign:

- `AuthChallenge`/`completeLogin` in `AuthProvider` (`packages/security`) model the "primary auth passed, MFA pending" intermediate state that SVEGIP's current single-step signed cookie has no room for today.
- Phase 1 target mechanism: standards-compatible TOTP authenticator apps — not one proprietary app. Phase 1 also generates cryptographically random recovery codes, shown once, stored hashed, invalidated on use — never stored in plaintext.
- Future: WebAuthn/passkeys, hardware security keys, an approved identity provider's MFA. SMS is explicitly not the preferred primary mechanism.
- **Step-up authentication**: `StepUpRequirement` (`packages/security/src/rbac.ts`) models actions that demand MFA re-verification even on an already-authenticated session — payroll approval, salary amendments, accounting posting, bank-detail changes, employee termination, administrator permission changes, MFA reset, privileged Data Vault access, and export of sensitive datasets are the baseline list to configure once MFA exists.

## Secrets handling

See `packages/security/src/SecretsProvider.ts`. No secret value is ever committed to this repository (verified: this PR's own `.env.example` files contain placeholders only, and were grepped for credential patterns before commit). Production secrets are never required by CI (see `apps/svegip`'s existing CI, which needs none, and this PR's own CI additions, which likewise need none).

## Encryption expectations

- In transit: HTTPS/TLS everywhere, no exceptions, on every environment including local development where practical.
- At rest: any future database holding RESTRICTED or PRIVILEGED data (compensation, bank details, privileged legal content) should use encryption at rest at the storage layer (PostgreSQL-level or disk/volume-level depending on hosting), and column-level/application-level encryption should be evaluated per field for the most sensitive columns (e.g. bank account numbers) rather than assumed to be covered by storage-level encryption alone.
- MFA secrets and recovery codes: never plaintext (see "MFA readiness" above).

## File-upload controls

Once `platform-services/documents`/`data-vault` accept real uploads (they do not today — see each module's README), uploads must: validate MIME type and extension server-side (never trust a client-supplied content-type alone), enforce a size limit, scan or otherwise constrain executable content, and store the resulting object via `StorageProvider` with an access-controlled reference — never a public, guessable URL for anything above `INTERNAL` classification.

## Rate limiting

Not implemented anywhere today — `apps/svegip`'s `/api/login` and `/api/bootstrap-admin` currently have no brute-force protection (`SVEGIP_ENTERPRISE_ASSESSMENT.md` §AE, HIGH finding). This is called out here as a requirement for any future authentication surface (`platform-services/identity` included) from the start, not an afterthought: failed-attempt throttling and lockout on authentication endpoints, and general rate limiting on write-heavy or expensive endpoints.

## Input validation

Every API boundary validates and normalizes input server-side, regardless of client-side validation. This is already broadly true in `apps/svegip`'s functions (e.g. explicit `String(...)`/`Number(...)` coercion before use) and is the expected baseline going forward, formalized rather than ad hoc per handler.

## CSRF / XSS / SQL injection protection

- **SQL injection**: `DatabaseProvider.query` (`packages/shared`) is parameterised-only by contract — no implementation may accept raw string-concatenated SQL. `apps/svegip` already avoids this via tagged-template `db.sql` queries.
- **XSS**: any HTML-rendering surface must escape user-controlled content before interpolating it into markup — `apps/svegip`'s `esc()` helper in `app.js` is a working example of this for its own rendering; future services rendering to HTML should follow the same discipline, and API-only services returning JSON are not exempt from validating that stored strings can't later be misused by *some* future renderer.
- **CSRF**: session cookies should use `SameSite` appropriately (as `apps/svegip` does today — `SameSite=Lax`) plus same-origin request conventions; a defense-in-depth CSRF token is recommended before any future service handles RESTRICTED-or-above state-changing actions (see `SVEGIP_ENTERPRISE_ASSESSMENT.md` §AE, MEDIUM finding — SVEGIP itself does not yet have this defense-in-depth layer either).

## Sensitive-data handling

- Logs must never contain secret values, full session tokens, or PRIVILEGED-classified field values (see `LoggingProvider` in `packages/shared`).
- Notification bodies must reference a record, not repeat its sensitive content (see `platform-services/notifications`).
- Offline/local caching (mobile, PWA) of HR/payroll/legal/accounting/Data Vault data must be selective and never store RESTRICTED/PRIVILEGED content unencrypted on-device — see `platform-architecture.md` "Presentation layer".

## Data classification levels

| Level | Examples |
|---|---|
| PUBLIC | Nothing in-scope today; reserved for genuinely public content. |
| INTERNAL | General announcements, non-sensitive internal references. |
| CONFIDENTIAL | Employee profile, general HR records, general accounting/financial records. |
| RESTRICTED | Salary/compensation, payroll, bank information, audit trails, most claims. |
| PRIVILEGED | SK Lai & Partners privileged client/legal material, the most sensitive Data Vault content. |

Access decisions must consult a record's actual classification (see "Entity-level and record-level access" above) — classification is a property of the data, not an inference from which module happens to store it.

## Auditability — the future audit event contract

See `packages/types/src/audit-event.ts` for the shape (`actor`, `action`, `resource`, `timestamp`, `entityContext`, `sessionId`, `change` before/after, `source` IP/device metadata) and `platform-services/audit`'s README for the service boundary. Sensitive event types (authentication, permission changes, Restricted/Privileged record access, MFA resets) must be handled as append-only — no update or delete path should exist for these event rows at the application layer, regardless of hosting environment.
