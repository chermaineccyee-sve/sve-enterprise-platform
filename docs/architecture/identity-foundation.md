# SVE Enterprise Platform — Identity & Access Foundation

Status: **implemented, running in parallel with `apps/svegip`'s existing authentication.** This is the first PR in the platform with real, tested, running code (`platform-services/identity/`) rather than contracts and documentation only. It does not touch `apps/svegip` — see "Existing SVEGIP Authentication Migration — Not Performed in PR #4" at the end of this document.

## SVE Group / HQ / entity model

The confirmed organisational structure, seeded by `database/migrations/001_identity-foundation/migration.sql`:

```
SVE Group
├── SVE International Pte. Ltd.   — Singapore — Group Headquarters
├── SVE International Sdn. Bhd.   — Malaysia  — Regional/operating entity
└── SK Lai & Partners             — Malaysia  — Registered law firm
```

**Why SK Lai & Partners is modelled as its own legal entity, not a business unit of SVE International Sdn. Bhd.**: SKL must remain capable of stronger information segregation than an ordinary business unit of another entity would allow. Modelling it as a peer legal entity (not nested under SVE International Sdn. Bhd.) means SVE International Malaysia's entity-level access grants never implicitly reach SKL's records — reaching SKL always requires its own, explicit grant. A business-unit relationship would have made that boundary softer than it needs to be.

**Group and HQ authority are not access grants.** `legal_entities.is_group_headquarters` (true only for SVE International Pte. Ltd.) is a descriptive, organisational fact — used for things like defaulting a reporting view or an org chart later. It is **never read by `rbacService.authorize()`** (see `src/services/rbacService.ts` — grep it; the field name does not appear there). Access is driven entirely by explicit `entity_access_grants` rows. This is a structural guarantee, not a policy that could be forgotten: there is no code path by which being the HQ entity grants access to anything.

The distinct axes required by the PR brief are modelled as follows:

| Axis | Where it lives |
|---|---|
| Group-level authority | `entity_access_grants.scope_type = 'group'` — an explicit, auditable grant, never implied |
| HQ-level authority | `legal_entities.is_group_headquarters` — descriptive only, not consulted for access |
| Legal-entity membership | `entity_access_grants.scope_type = 'legal_entity'` + `legal_entity_id` |
| Business-unit membership | `entity_access_grants.scope_type = 'business_unit'` (column present; `platform-services/organisation` will own the `business_units` table itself) |
| Department/team membership | `entity_access_grants.scope_type = 'department'` (same note as business unit) |
| Functional authority | A `permission` — "functional authority" and "permission" are treated as the same concept in this model, to avoid a redundant parallel axis |
| Role | `roles` / `user_role_assignments` — Group-wide ("what you can do"), independent of entity |
| Permission | `permissions`, with a `max_classification` ceiling (see below) |
| Entity access | `entity_access_grants` — independent of role ("where you can do it") |
| Record-level access | The `recordClassification` parameter to `authorize()`, checked against the matched permission's `max_classification` |

## User vs. Employee

**Not every User is an Employee.** `users.account_type` is one of `employee | contractor | external | service` — an authentication identity exists independently of any employment relationship. `user_employee_links` is the minimal hook for a future Employee Master (`platform-services/hrms`, not built in this PR) to attach to: `(user_id, employee_id, linked_at, linked_by)`, with `employee_id` deliberately carrying **no foreign key yet**, since no `employees` table exists. Add that FK when `hrms.employees` lands.

This is also how "a former employee's employment record must remain while login access is disabled" works: `users.status = 'disabled'` blocks login (checked in `authService.login`), while `user_employee_links` and the future employee record are untouched — disabling login and severing employment are two different, independently-controlled facts.

Administrators, consultants, service identities, and external users are not separate `account_type`-like categories layered on top of this — an "Administrator" is simply a `User` (of whatever `account_type`) holding the `administrator` role via `user_role_assignments`. Modelling "administrator" as an account type would have conflated *what kind of person/thing this identity represents* with *what it's permitted to do*, which is exactly the role/permission axis's job.

## Identity lifecycle

```
User created (status: active)
   │
   ├── Credential set (password hash) — see "Password security"
   ├── [optional] Employee link established
   ├── [optional] Role(s) assigned + Entity access grant(s) — see "RBAC"
   ├── [optional] MFA enrolled — see "MFA"
   │
   ▼
Active use: login → session → (MFA challenge if enrolled) → authorised session
   │
   ▼
[optional] Account disabled (status: disabled) — blocks login; all other records persist
```

No state machine library or workflow engine was introduced for this — the lifecycle above is enforced by which operations exist on `UserRepository`/`RbacRepository`/`MfaRepository`, not by a separate status-transition framework. That is deliberately proportionate to the size of this foundation (see item 16 of the PR brief, "no unnecessary microservices/Kubernetes complexity").

## RBAC — the authorization model

`src/services/rbacService.ts`'s `authorize()` implements exactly the evaluation the PR brief specifies:

```
User + session (userId)
  + permissionKey
  + target { legalEntityId?, businessUnitId?, departmentId?, recordClassification? }
          ↓
  1. Does any ACTIVE role assignment grant this permission?         → no: DENY
  2. Does the matched permission's max_classification cover the
     target's recordClassification (if any)?                        → no: DENY
  3. If the target carries entity context, does any ACTIVE entity
     access grant's scope cover it?                                  → no: DENY
          ↓
        ALLOW
```

**Default-deny at every step** — a user with zero role assignments is denied before any entity-access lookup even happens; a target with no matching grant is denied even if the permission itself would allow the classification. This is verified directly: `platform-services/identity/test/unit/rbac.test.ts` has a dedicated test for a user with no assignments at all, and the cross-entity/HQ/administrator tests below.

**Verified behaviours** (all passing, `test/unit/rbac.test.ts` + `test/integration/postgres.test.ts` against real Postgres):
- SVE Malaysia entity access does **not** grant SVE Singapore access, or vice versa.
- Singapore's HQ status does **not** grant SK Lai & Partners access without an explicit grant.
- A Group-scope entity access grant covers every legal entity *for entity-matching purposes*, but a permission capped at `CONFIDENTIAL` still cannot reach a `PRIVILEGED` SKL record — classification is checked independently of scope breadth.
- An Administrator role holding only `system.users.manage` does **not** automatically gain `payroll.salary.view` merely by being Administrator and having Group-wide entity access — the permission was simply never granted to that role.
- Revoking a role assignment or an entity access grant takes effect immediately (both are re-queried, never cached, on every `authorize()` call).

## Permissions and record-classification-aware authorization

Every `permission` carries a `max_classification` (`PUBLIC` ≤ `INTERNAL` ≤ `CONFIDENTIAL` ≤ `RESTRICTED` ≤ `PRIVILEGED`, matching `docs/architecture/security-architecture.md`'s levels). This is what makes "System Admin ≠ HR ≠ Finance ≠ Management" enforceable rather than just documented: a permission meant for system administration would typically be capped at `INTERNAL`, so even if an Administrator somehow held a payroll-shaped permission by mistake, that permission's own ceiling — not a role check — would need to explicitly allow `RESTRICTED` for a salary record to be reachable. The ceiling lives on the permission, not on the role, so it can't be bypassed by inventing a new role that reuses an existing under-scoped permission.

This foundation does not create any HRMS/Payroll/Accounting-specific permissions — those are for the modules that will actually need them to define, using this same `max_classification` mechanism.

## Sessions

`sessions` table: id, user_id, `token_hash`, created_at, last_active_at, expires_at, revoked_at, revoked_reason, mfa_verified, ip, user_agent. This is the gap `apps/svegip`'s stateless signed cookie has today (documented in `SVEGIP_ENTERPRISE_ASSESSMENT.md` — no server-side session table means no per-device "view active sessions" or "revoke one session," only a global secret rotation) — this foundation closes it from day one.

**Session tokens**: a 256-bit random bearer token (`crypto.randomBytes(32)`, base64url-encoded) is generated at login and returned to the client exactly once. Only its SHA-256 hash is stored (`sessions.token_hash`), so a database read alone can never yield a usable session token — this mirrors the same "hash, don't store raw" principle recovery codes use, and means a leaked database backup does not equal leaked live sessions. Validation looks up by hash and constant-time-compares are not needed for the lookup itself (an indexed equality lookup), but `crypto.timingSafeEqual` is used wherever a stored hash is compared against a freshly computed one for a match decision (see `src/crypto/token.ts`).

Implemented operations (`src/services/sessionService.ts`, all tested against both an in-memory fake and real Postgres): `createSession`, `validateSession` (rejects not-found/expired/revoked, each verified by a dedicated test), `revokeSession`, `revokeAllSessionsForUser`, `listActiveSessions`, `expireDueSessions`.

**Known foundation-scope limitation**: `expireDueSessions` is a function to call (e.g. from a scheduled job), not a background timer this PR runs itself — no scheduler/cron was introduced, to avoid infrastructure this PR doesn't need yet.

## Password security

**Algorithm: scrypt** (RFC 7914), via Node's built-in `node:crypto` — no external dependency, no invented cryptography. Parameters: `N=16384, r=8, p=1`, 64-byte derived key, random 16-byte salt per password (`src/crypto/password.ts`). These are Node's own documented example parameters, chosen deliberately over inventing custom tuning for a first foundation. Parameters are stored per-row (`user_credentials.password_params`, JSONB) rather than only in code, so a future parameter increase does not invalidate already-stored hashes until they are next rehashed.

**Why scrypt and not apps/svegip's existing PBKDF2-SHA256 (210,000 iterations)?** SVEGIP's choice is a reasonable, modern PBKDF2 parameterisation and is left completely unchanged as the compatibility/reference implementation. scrypt is memory-hard (expensive to parallelise on GPU/ASIC hardware), which PBKDF2 fundamentally is not regardless of iteration count — this foundation uses scrypt because it is starting fresh and can pick the stronger default, not because SVEGIP's existing choice was a mistake for its own context.

Passwords are never stored in plaintext, never logged (grep the codebase: no `console.log`/audit call anywhere passes a raw password), never included in audit metadata (`auditService.ts`'s `redact()` strips any field whose name contains "password", structurally, not by call-site discipline), and never returned by any API (`GET /api/v1/users/me` and `GET /api/v1/auth/session` both return hand-picked field lists that do not include credential data — verified by `test/integration/http.test.ts`'s explicit assertion that a login/me response never contains a `password` field).

**Account enumeration resistance**: an unknown email and a wrong password for a real account both throw the identical `InvalidCredentialsError`, mapped to the identical HTTP 401 body (`{"error":{"code":"INVALID_CREDENTIALS","message":"Invalid email or password."}}`) — verified by a dedicated test asserting the two response bodies are `deepEqual`, not just "both errors." For an unknown email, `authService.login` still runs a full scrypt verification against a fixed dummy hash before failing, so the response time is comparable to a real password check and does not itself leak account existence via timing.

## Login protection

`src/services/rateLimiter.ts`: every login attempt (success or failure, known or unknown account) is recorded in `authentication_attempts`, keyed by both email and IP. Thresholds escalate (5 failures → 30s backoff, 8 → 5 minutes, 12 → 30 minutes) rather than jumping straight to a long lockout, and there is **no permanent lockout** — a permanent lockout is itself a denial-of-service vector (an attacker can lock out a real user indefinitely just by deliberately failing their password a few times). Throttling is keyed on IP as well as email specifically so a distributed attempt against many different email addresses from one source is still caught, not just repeated attempts against one target.

## MFA — TOTP foundation

**Standards-based TOTP** (RFC 6238, built on RFC 4226 HOTP), SHA-1 HMAC, 6 digits, 30-second step, ±1 step clock-drift tolerance — implemented directly against Node's `node:crypto` HMAC primitive (`src/crypto/totp.ts`), with zero external authenticator libraries. **Verified against the official RFC 4226 Appendix D test vectors**, not just self-consistency (`test/unit/totp.test.ts`'s first test checks all 10 published vectors byte-for-byte).

SHA-1 here is a deliberate standards-compliance choice, not a general hashing recommendation: it's what RFC 6238 specifies and what every mainstream authenticator app (Google Authenticator, Authy, 1Password, etc.) expects for interoperability. Base32 encoding (needed for the secret and the `otpauth://` URI) has no Node built-in, so a small, standard RFC 4648 implementation is included (`src/crypto/base32.ts`) — an encoding, not a cipher, so this is not "custom cryptography" in the sense the PR brief warns against.

**Enrolment requires verification before activation**: `mfaService.beginEnrolment` creates a `pending` method and returns the secret/QR info exactly once; `completeEnrolment` requires a valid TOTP code before flipping status to `active` — verified by a dedicated test that an invalid code during enrolment leaves the method `pending`, not silently activated.

**Extension boundary for WebAuthn/passkeys/hardware keys**: `mfa_methods.method_type` is already a column (currently constrained to `'totp'` only) rather than an assumption baked into the table shape, and `MfaRepository`'s interface (`createMethod`, `findActiveOrPendingByUser`, `activateMethod`, `disableMethod`) has no TOTP-specific method names — a future `webauthn` method type extends the `CHECK` constraint and adds its own credential-storage columns/table without redesigning the enrol → verify-before-activate → challenge → disable shape. SMS was not implemented and is explicitly not the intended primary mechanism, per the PR brief.

## Recovery codes

Ten single-use codes per generation (`src/crypto/token.ts`'s `generateRecoveryCode`, drawn from a 32-character alphabet excluding visually ambiguous characters), returned to the client exactly once — immediately after successful MFA enrolment verification, and again if explicitly regenerated. Stored as SHA-256 hashes only (`mfa_recovery_codes.code_hash`), consumption is single-use (`used_at` set on first use, checked before allowing reuse), and **regenerating deletes the previous generation's rows entirely** (`replaceRecoveryCodes` runs inside a database transaction — verified both by a unit test against the in-memory fake and an integration test against real Postgres asserting the old codes stop working and the new ones work). Recovery codes are never logged and are stripped from audit metadata by the same structural redaction as passwords/tokens.

## Step-up authentication — foundation only, not wired to any business module

`packages/security/src/rbac.ts`'s `StepUpRequirement` type (`{ action, reason }`) and `SessionContext.mfaVerified` are the only pieces built in this PR. **No business module calls into this** — HRMS/Payroll/Accounting/Data Vault don't exist yet, so there is nothing to gate. The intended future shape: a sensitive action (salary/compensation changes, payroll approval, accounting posting, bank-detail changes, employee termination, role/permission changes, MFA reset, privileged Data Vault access, sensitive exports) checks `session.mfaVerified` **and** how recently MFA was verified, and if insufficient, returns a step-up challenge rather than the resource — using the exact same TOTP challenge/verify mechanism logins already use, not a second parallel MFA implementation.

## Security audit

`security_audit_events` is Identity's own append-only sink today (no `UPDATE`/`DELETE` path exists anywhere in this codebase for that table), storing the shape `packages/types/src/audit-event.ts`'s `AuditEvent` contract describes. This is **not** the future central `platform-services/audit` service (still just a README, unbuilt) — it's Identity's own log until that service exists and Identity is migrated to publish to it instead, consistent with `platform-architecture.md`'s phased migration language.

Every action listed in item 12 of the PR brief is emitted where implemented: `auth.login.success`, `auth.login.failure`, `auth.login.throttled`, `auth.logout`, `session.created`, `session.revoked`, `session.revoked_all`, `mfa.enrolment_started`, `mfa.enrolment_verified`, `mfa.challenge_verified`, `mfa.challenge_failed`, `mfa.disabled`, `mfa.recovery_code_used`, `mfa.recovery_codes_regenerated` (see `src/services/auditService.ts`'s `IdentitySecurityAction` union for the exhaustive list — role/permission-change and account enable/disable actions are typed and ready, not yet called anywhere because no route in this PR performs those operations).

**Redaction is structural, not per-call-site discipline**: `auditService.record()` is the *only* path to the audit repository, and it strips any `changeBefore`/`changeAfter` field whose key contains "password," "token," "secret," "recoveryCode," "totpSecret," or "codeHash" before the write happens — verified by a dedicated test asserting the raw serialized stored event contains none of the injected secret values.

## Provider and deployment portability

`platform-services/identity` depends on `packages/shared`'s `DatabaseProvider` contract, not on `pg` directly, except in exactly one file: `src/repositories/postgres/pgDatabaseProvider.ts`. Every repository (`pgUserRepository.ts`, etc.) takes a `DatabaseProvider` and only ever calls `.query()`/`.transaction()` — swapping to AWS RDS PostgreSQL later is a connection-string change plus, if ever needed, a different `DatabaseProvider` implementation, not a rewrite of business logic. No AWS SDK, Cognito, or Netlify Identity dependency exists anywhere in this service. No AWS resource was provisioned and no Netlify configuration was touched by this PR.

**Why plain `.ts` files, no build step**: this Node runtime (22.6+) strips TypeScript syntax natively (`node file.ts` and `node --test` both work directly, verified in this session) — no `tsc` compile step, no bundler, no `ts-node`, is needed to *run* the code. `npm run typecheck` (`tsc --noEmit`, TypeScript 5.9.3, pinned) is a separate, additional verification step for full type-checking; it is not required to execute the service. This is why the code avoids TypeScript syntax that requires runtime transformation rather than mere erasure (parameter-property shorthand in constructors, `enum`, namespaces) — Node's type-stripping only erases, it doesn't transform, so those constructs would fail at runtime even though `tsc` might otherwise accept them.

**Why no HTTP framework**: with roughly a dozen routes, Node's built-in `http` module plus a small manual path table (`src/api/http.ts`) is simpler than adding Express/Fastify as a dependency, and keeps the dependency surface to exactly `pg` (plus dev-only `typescript`/`@types/*`).

## Future SVEGIP migration — proposal only (see final report for the concrete plan)

Nothing in this PR migrates SVEGIP. The two systems are intentionally disconnected today: `apps/svegip` keeps using its own `employee_accounts`/`svegip_session` cookie/PBKDF2 implementation, unmodified; `platform-services/identity` is a separate, independently runnable service with its own database schema, exercised only by its own tests and (optionally) a local `npm run dev`. A concrete, phased migration proposal is given in the PR's final report — it is a proposal to be reviewed, not something this PR performs.

## Remaining risks and open items

A focused security review was performed before opening this PR (SQL injection, auth bypass, broken access control, session fixation, token/password/MFA-secret/recovery-code leakage, account enumeration, brute force, privilege escalation, cross-entity access, insecure defaults, committed secrets). One real issue was found and fixed in this PR (see below); the rest are scope limitations, documented rather than hidden:

- **Fixed in this PR**: the MFA-challenge-completion routes (`/api/v1/auth/mfa/verify`, `/api/v1/auth/mfa/recovery`) did not re-check that the account was still active before issuing a session — only `authService.login` checked this, before the challenge was created. A account disabled in the window between primary-auth and MFA completion could otherwise still complete the challenge. Both routes now re-check `user.status === "active"` immediately before verifying the code, with a regression test (`test/integration/http.test.ts`, "a disabled account cannot complete a pending MFA challenge").
- **RBAC is implemented and thoroughly tested, but no HTTP route in this PR is permission-gated** — `login`/`logout`/`session`/`sessions`/`mfa/*`/`users/me` are all self-service actions requiring only "is this a valid session for this user," not a specific permission or entity check. `rbacService.authorize()` is exercised directly by 9 unit tests and 1 Postgres integration test, but has no live HTTP demonstration yet, since nothing in this minimal API surface needed it. The first business module (or an Identity administration endpoint) that needs a permission check will be the first real caller.
- **In-process MFA challenge storage does not survive a restart or scale beyond one instance.** `authService`'s pending-challenge map (`Map<challengeId, {userId, expiresAt}>`) is process-local. A multi-instance deployment needs this moved to shared storage (the database, or Redis) before it can run behind a load balancer with more than one instance.
- **No CORS configuration** — this service has no browser-facing frontend yet, so no CORS policy was added. One is needed before any browser-based client (including a future SVEGIP integration) calls this API cross-origin.
- **TLS termination is assumed to happen upstream** (a reverse proxy / load balancer), consistent with `docs/architecture/deployment-portability.md`'s component lists — this service's own `http.createServer` does not terminate TLS itself, matching normal practice for a backend service sitting behind Nginx/ALB.
- **`mfa_methods.secret_encrypted` is not actually encrypted at the application layer** — despite the column name (kept for forward compatibility), this foundation stores the base32 TOTP secret as a plain column value, never logged and never re-returned by any API after enrolment, but not encrypted at rest by the application itself. Production deployment should add column-level encryption via a `SecretsProvider`/KMS-backed mechanism (see `packages/security/src/SecretsProvider.ts`) before handling real MFA enrolments.
- **No scheduled job runs `expireDueSessions`** — the function exists and is tested, but nothing in this PR calls it on a timer. Expired-but-not-yet-revoked sessions are still correctly rejected by `validateSession`'s own expiry check, so this is a housekeeping gap (stale rows accumulate) rather than a security gap.

---

## Existing SVEGIP Authentication Migration — Not Performed in PR #4

To state this as explicitly as the PR brief requires: **no code, configuration, cookie, table, or behaviour belonging to `apps/svegip`'s existing authentication was changed, replaced, wrapped, or migrated by this PR.** `apps/svegip/netlify/functions/{_auth-core,login,session,logout,admin-users}.mts`, its `employee_accounts`/`employee_account_audit` tables, its `svegip_session` cookie format, and its RBAC (`SVEGIP_ACCESS_POLICY` in `app.js`) are all byte-for-byte unchanged — verified as part of this PR's pre-merge checklist (`git diff` against `main` for `apps/svegip/` is empty). The two systems run side by side, unconnected, until a future, separate, deliberately-scoped migration PR is reviewed and approved.
