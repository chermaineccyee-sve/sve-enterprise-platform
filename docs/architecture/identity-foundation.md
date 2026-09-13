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

**Review correction (PR #10 — identity-offboarding-revocation)**:
`authorize()` did not itself consult `users.status` — a disabled account
whose role assignments were never explicitly revoked would still pass
every permission check. Fixed centrally: `authorize()` now denies
immediately, before any role/permission/entity-access evaluation, when
the ACTOR's own account exists and is `disabled` (never merely because no
`users` row exists — see docs/architecture/identity-offboarding-
revocation.md §3's carve-out reasoning). This reaches every package's own
permission checks through this one function, with no per-package edits —
see that doc's "Central active-account invariant" for the full write-up,
including the one place (Workflow's task-decision eligibility) that
deliberately bypasses `authorize()` and needed its own, separate fix.

## Permissions and record-classification-aware authorization

Every `permission` carries a `max_classification` (`PUBLIC` ≤ `INTERNAL` ≤ `CONFIDENTIAL` ≤ `RESTRICTED` ≤ `PRIVILEGED`, matching `docs/architecture/security-architecture.md`'s levels). This is what makes "System Admin ≠ HR ≠ Finance ≠ Management" enforceable rather than just documented: a permission meant for system administration would typically be capped at `INTERNAL`, so even if an Administrator somehow held a payroll-shaped permission by mistake, that permission's own ceiling — not a role check — would need to explicitly allow `RESTRICTED` for a salary record to be reachable. The ceiling lives on the permission, not on the role, so it can't be bypassed by inventing a new role that reuses an existing under-scoped permission.

This foundation does not create any HRMS/Payroll/Accounting-specific permissions — those are for the modules that will actually need them to define, using this same `max_classification` mechanism.

## Sessions

`sessions` table: id, user_id, `token_hash`, created_at, last_active_at, expires_at, revoked_at, revoked_reason, mfa_verified, ip, user_agent. This is the gap `apps/svegip`'s stateless signed cookie has today (documented in `SVEGIP_ENTERPRISE_ASSESSMENT.md` — no server-side session table means no per-device "view active sessions" or "revoke one session," only a global secret rotation) — this foundation closes it from day one.

**Session tokens**: a 256-bit random bearer token (`crypto.randomBytes(32)`, base64url-encoded) is generated at login and returned to the client exactly once. Only its SHA-256 hash is stored (`sessions.token_hash`), so a database read alone can never yield a usable session token — this mirrors the same "hash, don't store raw" principle recovery codes use, and means a leaked database backup does not equal leaked live sessions. Validation looks up by hash and constant-time-compares are not needed for the lookup itself (an indexed equality lookup), but `crypto.timingSafeEqual` is used wherever a stored hash is compared against a freshly computed one for a match decision (see `src/crypto/token.ts`).

Implemented operations (`src/services/sessionService.ts`, all tested against both an in-memory fake and real Postgres): `createSession`, `validateSession` (rejects not-found/expired/revoked, each verified by a dedicated test), `revokeSession`, `revokeAllSessionsForUser`, `listActiveSessions`, `expireDueSessions`.

**PR #10 addition**: both `createSession` and `validateSession` now also
check the owning account's status, inside a transaction that locks the
same `users` row `accountSecurityService.disableAccount()` locks — this
closes the login/session-creation race against a concurrent disable (a
session must never become usable if it is created concurrently with, or
immediately after, a disable transaction commits) and gives
`validateSession()` a defense-in-depth backstop independent of session
revocation actually having run. See docs/architecture/
identity-offboarding-revocation.md §3, §9, §11 for the full design and
the real-Postgres race test that proves it.

**Known foundation-scope limitation**: `expireDueSessions` is a function to call (e.g. from a scheduled job), not a background timer this PR runs itself — no scheduler/cron was introduced, to avoid infrastructure this PR doesn't need yet.

## Password security

**Algorithm: scrypt** (RFC 7914), via Node's built-in `node:crypto` — no external dependency, no invented cryptography. Parameters: `N=16384, r=8, p=1`, 64-byte derived key, random 16-byte salt per password (`src/crypto/password.ts`). These are Node's own documented example parameters, chosen deliberately over inventing custom tuning for a first foundation. Parameters are stored per-row (`user_credentials.password_params`, JSONB) rather than only in code, so a future parameter increase does not invalidate already-stored hashes until they are next rehashed.

**Why scrypt and not apps/svegip's existing PBKDF2-SHA256 (210,000 iterations)?** SVEGIP's choice is a reasonable, modern PBKDF2 parameterisation and is left completely unchanged as the compatibility/reference implementation. scrypt is memory-hard (expensive to parallelise on GPU/ASIC hardware), which PBKDF2 fundamentally is not regardless of iteration count — this foundation uses scrypt because it is starting fresh and can pick the stronger default, not because SVEGIP's existing choice was a mistake for its own context.

Passwords are never stored in plaintext, never logged (grep the codebase: no `console.log`/audit call anywhere passes a raw password), never included in audit metadata (`auditService.ts`'s `redact()` strips any field whose name contains "password", structurally, not by call-site discipline), and never returned by any API (`GET /api/v1/users/me` and `GET /api/v1/auth/session` both return hand-picked field lists that do not include credential data — verified by `test/integration/http.test.ts`'s explicit assertion that a login/me response never contains a `password` field).

**Account enumeration resistance**: an unknown email and a wrong password for a real account both throw the identical `InvalidCredentialsError`, mapped to the identical HTTP 401 body (`{"error":{"code":"INVALID_CREDENTIALS","message":"Invalid email or password."}}`) — verified by a dedicated test asserting the two response bodies are `deepEqual`, not just "both errors." For an unknown email, `authService.login` still runs a full scrypt verification against a fixed dummy hash before failing, so the response time is comparable to a real password check and does not itself leak account existence via timing.

## Login protection

`src/services/rateLimiter.ts`: every login attempt (success or failure, known or unknown account) is recorded in `authentication_attempts`, keyed by both email and IP. Thresholds escalate (5 failures → 30s backoff, 8 → 5 minutes, 12 → 30 minutes) rather than jumping straight to a long lockout, and there is **no permanent lockout** — a permanent lockout is itself a denial-of-service vector (an attacker can lock out a real user indefinitely just by deliberately failing their password a few times). Throttling is keyed on IP as well as email specifically so a distributed attempt against many different email addresses from one source is still caught, not just repeated attempts against one target.

## Rate-limit semantics — what counts as a failure

`countRecentFailures` (the query the throttle threshold is evaluated against) only ever counts rows where `succeeded = FALSE`. This is the mechanism, and it draws an explicit line between two things that look similar but are not:

- **A correct password followed by an MFA challenge is not a failure.** When `authService.login` finds the password correct and an active MFA method exists, it calls `rateLimiter.recordSuccess({ ..., reason: "mfa_required" })` — `succeeded = true`, so it is structurally excluded from the failure count, while still being recorded (with a distinguishing `reason`) for the attempt log/audit trail. A user who hasn't yet completed their MFA step and keeps re-submitting the correct password is never throttled for that alone — verified by a dedicated test (`test/unit/auth.test.ts`, "repeated legitimate password -> MFA-challenge flows do NOT trigger brute-force throttling") that runs 20 consecutive correct-password logins and asserts none of them are throttled, plus an HTTP-level equivalent in `test/integration/http.test.ts`.
- **An invalid password, invalid MFA code, invalid recovery code, throttled attempt, and unknown account are all genuine failures** and are recorded with `succeeded = false`. The MFA-verify and MFA-recovery HTTP routes (`/api/v1/auth/mfa/verify`, `/api/v1/auth/mfa/recovery`) now check and record throttling themselves, keyed on the challenge's account email — this closes a gap in the original implementation, where guessing a 6-digit TOTP code or a recovery code had no rate limit of its own at all. Verified by dedicated tests asserting repeated wrong codes on each endpoint eventually return `429`.

**A related bug found and fixed while adding these tests**: the pending-challenge lookup (`authService`) originally consumed the challenge on every call, including a failed verification — so a single mistyped code (or an attacker's first guess) invalidated the challenge, forcing a fresh password login for the next attempt, and made it structurally impossible to ever accumulate enough failures on one challenge to test throttling at all. This is now split into `peekChallenge` (non-destructive — used to look up the pending challenge before verifying) and `consumeChallenge` (destructive — called only after a successful verification, so a completed challenge can never be replayed for a second session). A wrong code can now be retried against the same challenge, bounded by its own 5-minute expiry and by the throttling described above.

**Successful authentication is recorded at the point authentication actually completes**, not only at the password step: the "no MFA enrolled" path records `reason: "success"` immediately (unchanged), and the MFA-verify/MFA-recovery routes now also call `rateLimiter.recordSuccess` at the point the challenge is completed — previously, a successful MFA completion recorded nothing in `authentication_attempts` at all, only an audit event.

## MFA — TOTP foundation

**Standards-based TOTP** (RFC 6238, built on RFC 4226 HOTP), SHA-1 HMAC, 6 digits, 30-second step, ±1 step clock-drift tolerance — implemented directly against Node's `node:crypto` HMAC primitive (`src/crypto/totp.ts`), with zero external authenticator libraries. **Verified against the official RFC 4226 Appendix D test vectors**, not just self-consistency (`test/unit/totp.test.ts`'s first test checks all 10 published vectors byte-for-byte).

SHA-1 here is a deliberate standards-compliance choice, not a general hashing recommendation: it's what RFC 6238 specifies and what every mainstream authenticator app (Google Authenticator, Authy, 1Password, etc.) expects for interoperability. Base32 encoding (needed for the secret and the `otpauth://` URI) has no Node built-in, so a small, standard RFC 4648 implementation is included (`src/crypto/base32.ts`) — an encoding, not a cipher, so this is not "custom cryptography" in the sense the PR brief warns against.

**Enrolment requires verification before activation**: `mfaService.beginEnrolment` creates a `pending` method and returns the secret/QR info exactly once; `completeEnrolment` requires a valid TOTP code before flipping status to `active` — verified by a dedicated test that an invalid code during enrolment leaves the method `pending`, not silently activated.

**Extension boundary for WebAuthn/passkeys/hardware keys**: `mfa_methods.method_type` is already a column (currently constrained to `'totp'` only) rather than an assumption baked into the table shape, and `MfaRepository`'s interface (`createMethod`, `findActiveOrPendingByUser`, `activateMethod`, `disableMethod`) has no TOTP-specific method names — a future `webauthn` method type extends the `CHECK` constraint and adds its own credential-storage columns/table without redesigning the enrol → verify-before-activate → challenge → disable shape. SMS was not implemented and is explicitly not the intended primary mechanism, per the PR brief.

## MFA secret encryption at rest

The stored TOTP secret is **AES-256-GCM ciphertext**, not plaintext. This was a review finding on the first version of this PR — `mfa_methods.secret_encrypted` was, despite its name, a plain column value — and is fixed in this revision before merge, not deferred.

**Design**: `src/crypto/mfaSecretCipher.ts` implements `encryptTotpSecret`/`decryptTotpSecret` via Node's built-in `node:crypto` (`createCipheriv`/`createDecipheriv`, algorithm `aes-256-gcm`) — no external dependency, no invented cryptography. Each encryption uses a fresh random 96-bit nonce (`crypto.randomBytes(12)`, the standard IV size for GCM); the resulting authentication tag is stored alongside the ciphertext. `mfa_methods` stores four columns — `secret_ciphertext`, `secret_iv`, `secret_auth_tag`, `secret_key_id` (base64-encoded, except `secret_key_id` which is a plain identifier) — rather than one opaque blob, so the nonce and tag are always available for decryption without a separate encoding/parsing step. GCM's tag verification means a wrong key or a tampered ciphertext/tag is rejected automatically by `decryptTotpSecret` throwing — this is not something the application has to detect itself.

**Key handling**: the raw 256-bit key is never hard-coded or committed. `src/crypto/mfaSecretCipher.ts`'s `loadMfaEncryptionKey` resolves it through `packages/security`'s `SecretsProvider` contract, decodes it from base64, and validates it is exactly 32 bytes before use. `src/config/envSecretsProvider.ts` is the concrete implementation for local development and SVE's private server — it reads `SVE_IDENTITY_MFA_ENCRYPTION_KEY` from the environment (documented, placeholder-only, in `platform-services/identity/.env.example`; generate one with `openssl rand -base64 32`). A future AWS deployment supplies the same key through Secrets Manager/KMS behind a different `SecretsProvider` implementation — `mfaService`, `container.ts`, and every repository are unaffected by which one is in use. `secret_key_id` (currently a single fixed value, `"v1"`) identifies which key encrypted a given row, laying the groundwork for a future key-rotation mechanism; rotation itself (re-encrypting existing rows under a new key) is **not implemented** in this foundation.

**What callers never see**: the plaintext secret is returned exactly once, from `beginEnrolment`, for the QR code — every other operation (`completeEnrolment`, `verifyChallenge`) takes only `userId`/`methodId`/`code` and decrypts the stored ciphertext internally. No HTTP route, and no caller outside `mfaService` itself, ever receives or passes around a decrypted secret. Callers who previously had to echo a `secretBase32` value back to the server (`completeEnrolment`, and the `/api/v1/auth/mfa/enrol/verify` request body) no longer do — removed as an unnecessary trust-the-client round trip once the server holds its own decryptable copy.

**Tests** (`test/unit/mfaSecretCipher.test.ts`, plus `test/integration/postgres.test.ts` against real Postgres): encrypt-then-decrypt recovers the exact original secret; the stored ciphertext is never equal to the plaintext (checked both as a raw string and after base64-decoding, to rule out "just re-encoded" rather than genuinely encrypted); two encryptions of the same secret produce different ciphertext and IV (proving the nonce is actually randomized per call, not reused); decryption with the wrong key is rejected; decryption of a tampered ciphertext byte is rejected; decryption of a tampered authentication tag is rejected; a real Postgres round-trip through the four dedicated columns preserves the ciphertext/IV/tag exactly and still decrypts correctly with the right key and fails with a wrong one; key-loading rejects a missing or wrong-length key.

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

A focused security review was performed before opening this PR, and repeated after two rounds of review corrections (SQL injection, auth bypass, broken access control, session fixation, token/password/MFA-secret/recovery-code leakage, account enumeration, brute force, privilege escalation, cross-entity access, insecure defaults, committed secrets). Issues found were fixed, not deferred:

- **Fixed**: the MFA-challenge-completion routes did not re-check that the account was still active before issuing a session. Both routes now re-check `user.status === "active"` immediately before verifying the code (`test/integration/http.test.ts`, "a disabled account cannot complete a pending MFA challenge").
- **Fixed**: `mfa_methods.secret_encrypted` was, despite its name, a plaintext column. Stored TOTP secrets are now AES-256-GCM ciphertext — see "MFA secret encryption at rest" above.
- **Fixed**: primary-password-correct-then-MFA-required was being recorded as a rate-limiter failure, and repeated legitimate login attempts while a user hadn't yet completed MFA could self-throttle a real user. It is now recorded as a non-failure (`succeeded=true, reason="mfa_required"`) and structurally excluded from the failure count — see "Rate-limit semantics" above. Fixing this surfaced and also fixed a related bug: the pending-challenge lookup consumed the challenge on every call including failed ones, making a wrong code impossible to retry and making the MFA/recovery endpoints' own throttling untestable; challenges are now peeked (non-destructive) during verification and consumed only on success.
- **RBAC is implemented and thoroughly tested, but no HTTP route in this PR is permission-gated** — `login`/`logout`/`session`/`sessions`/`mfa/*`/`users/me` are all self-service actions requiring only "is this a valid session for this user," not a specific permission or entity check. `rbacService.authorize()` is exercised directly by 9 unit tests and 2 Postgres integration tests, but has no live HTTP demonstration yet, since nothing in this minimal API surface needed it. The first business module (or an Identity administration endpoint) that needs a permission check will be the first real caller.
- **In-process MFA challenge storage does not survive a restart or scale beyond one instance.** `authService`'s pending-challenge map (`Map<challengeId, {userId, expiresAt}>`) is process-local. A multi-instance deployment needs this moved to shared storage (the database, or Redis) before it can run behind a load balancer with more than one instance. The same is true of the in-process rate-limiter's underlying `authentication_attempts` reads — those already go through the database, so this specific concern is limited to the challenge map.
- **No CORS configuration** — this service has no browser-facing frontend yet, so no CORS policy was added. One is needed before any browser-based client (including a future SVEGIP integration) calls this API cross-origin.
- **TLS termination is assumed to happen upstream** (a reverse proxy / load balancer), consistent with `docs/architecture/deployment-portability.md`'s component lists — this service's own `http.createServer` does not terminate TLS itself, matching normal practice for a backend service sitting behind Nginx/ALB.
- **MFA encryption key rotation is not implemented.** `secret_key_id` exists on every row for this purpose, but there is no mechanism yet to re-encrypt existing rows under a new key and retire an old one. Losing the current key makes existing enrolled TOTP secrets undecryptable — back it up with the same care as a database credential.
- **No scheduled job runs `expireDueSessions`** — the function exists and is tested, but nothing in this PR calls it on a timer. Expired-but-not-yet-revoked sessions are still correctly rejected by `validateSession`'s own expiry check, so this is a housekeeping gap (stale rows accumulate) rather than a security gap.

---

## Existing SVEGIP Authentication Migration — Not Performed in PR #4

To state this as explicitly as the PR brief requires: **no code, configuration, cookie, table, or behaviour belonging to `apps/svegip`'s existing authentication was changed, replaced, wrapped, or migrated by this PR.** `apps/svegip/netlify/functions/{_auth-core,login,session,logout,admin-users}.mts`, its `employee_accounts`/`employee_account_audit` tables, its `svegip_session` cookie format, and its RBAC (`SVEGIP_ACCESS_POLICY` in `app.js`) are all byte-for-byte unchanged — verified as part of this PR's pre-merge checklist (`git diff` against `main` for `apps/svegip/` is empty). The two systems run side by side, unconnected, until a future, separate, deliberately-scoped migration PR is reviewed and approved.
