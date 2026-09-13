# Identity Access Revocation & Offboarding Security Integration (PR #10)

Closes the security gap left open by design at the end of PR #9: HRMS
offboarding completion recorded an `identity_deactivation_requested`
event and stopped there — no Identity account was ever actually disabled,
no session was ever revoked, and (a genuinely separate finding, surfaced
during PR #9's own review) `rbacService.authorize()` never consulted
`users.status` at all. This PR closes both, and is explicitly about
**access revocation, not user deletion**.

## 1. Threat / security objective

```
HRMS offboarding completed
        ↓
identity_deactivation_requested (durable event + durable request row)
        ↓
controlled Identity revocation (accountSecurityService.disableAccount)
        ↓
account disabled + active sessions revoked, atomically
        ↓
new authentication denied; existing sessions immediately unusable
        ↓
audit/history preserved (users/roles/grants/sessions/audit rows all kept)
        ↓
deactivation completion recorded (durable request row -> COMPLETED)
```

The concrete threat this closes: a departed employee (or anyone who
compromises their still-live session/credentials) retaining working
access to every system gated by Identity, indefinitely, because
"offboarding completed" was previously observable only as a business
event with no enforced security consequence.

## 2. Account-state model

`users.status: 'active' | 'disabled'` (migration 001) is unchanged and
sufficient. No new states (`departed`/`suspended`/`locked`/`revoked`) were
introduced: this schema has never modelled authentication lockout
(failed-login throttling) as an account-status concept — that already
lives entirely in `authentication_attempts`/the rate limiter, a separate
axis — so there is nothing to conflate. `active`/`disabled` cleanly means
exactly one thing: can this account authenticate and act at all, right
now. Employment departure maps onto this SAME axis, deliberately: there
is no meaningful third state between "can act" and "cannot act" that this
foundation's scope requires.

## 3. Central active-account invariant

**Invariant**: a non-active Identity account must not be able to
authenticate, create a new session, use an existing session, perform an
RBAC-authorised operation, complete MFA/recovery authentication, or
decide/complete a Workflow task.

Enforced at four authoritative points, never scattered as ad-hoc
`if (user.status !== 'active')` checks throughout business modules:

1. **`rbacService.authorize()`** (`platform-services/identity/src/services/rbacService.ts`) — checks the ACTOR's own account status, live, before any role/permission/entity-access evaluation, denying immediately if disabled. Every package's own permission checks (HRMS, Organisation, Workflow, Data Vault) already call this one function, so this single change reaches all of them with no per-package edits.
2. **`sessionService.validateSession()`** — the one function every authenticated HTTP request resolves its actor through (`requireSession` in every package's own `authContext.ts`-equivalent middleware). Re-checks status on every call, independent of #1.
3. **`sessionService.createSession()`** — locks the target user row and re-verifies status *inside the same transaction* as the session INSERT, closing the login/session-creation race (§9 below) that #1/#2 alone cannot close.
4. **`taskService.checkEligibility` → `requireActiveAccount()`** (Workflow) — a genuinely separate gap found and closed during this PR (§13below): Workflow's own task-decision eligibility deliberately does **not** re-run `authorize()` at decide time (candidate/role membership is intentionally snapshotted at step-activation time — see `workflow-approval-foundation.md`'s "Role-change semantics after activation" — so a later role/permission change never silently alters who may act on an already-activated task). Account status is a different axis entirely, not a role/permission grant, so a dedicated, minimal check was added at the one place both `decide()` and `completeTask()` share.

**Distinguishing actor status from target status** (brief §30's explicit
requirement): `authorize()`'s `userId` is always the ACTOR asking to be
authorised, never a "target" business object. An active administrator
calling `accountSecurityService.disableAccount()`/`enableAccount()` on a
target user is authorised as *themselves* — the target's own current
status never blocks a legitimate administrative action on it. Verified
directly: `identity/test/integration/accountSecurity.test.ts`, "manual
disable requires identity.security.manage_account, and a DISABLED actor
cannot manage any account" proves both halves — an active admin can
enable/disable a disabled target; a disabled admin is refused regardless
of target.

### Why the "user not found" carve-out is safe (not a fail-open)

`authorize()` and `validateSession()`/`createSession()` deny when the
actor's `users` row exists AND is disabled — but do **not** deny merely
because no such row exists. This is a **temporary, explicitly documented
legacy test-compatibility boundary**, not a production fail-open:

- `user_role_assignments.user_id` and `entity_access_grants.user_id` are
  both `NOT NULL REFERENCES users(id)` in the real schema — Postgres
  itself refuses to grant a role or entity access to a nonexistent user.
  Proven directly:
  `identity/test/integration/postgres.test.ts`, "a role assignment or
  entity-access grant for a nonexistent user id is rejected by the real
  schema (FK-enforced)".
- Every real caller resolves `userId` from either a live session
  (`sessions.user_id` is the identical kind of NOT-NULL FK) or an
  explicit `users.findById`/`findByEmail` lookup that itself throws first
  if the user doesn't exist (e.g. HRMS's `resolveHrOwnerActor`). There is
  no code path in this codebase that calls `authorize()` with a
  fabricated, unpersisted userId in production.
- The ONLY thing this carve-out preserves is this repository's own
  in-memory unit-test convention — granting a role to a bare
  `randomUUID()` actor with no backing `users` row is the *dominant*
  pattern across Identity/Organisation/Data Vault/most of Workflow/HRMS's
  existing unit-test suites (surveyed exhaustively before this change:
  on the order of a hundred call sites). The in-memory repositories
  enforce no FK-like integrity, so nothing there ever required a real
  user before `authorize()` gained this check. Migrating that whole
  convention to always create a real backing user was assessed and
  rejected as disproportionate to this PR's actual security scope.

## 4. Disable / enable operation

`platform-services/identity/src/services/accountSecurityService.ts` —
Identity's own, generic, HRMS-agnostic domain operation:

- `disableAccount(actor, targetUserId, {reason, sourceSystem?, sourceRequestId?})` — sets `status='disabled'`, revokes every active session, records ONE `account.disabled` audit entry, all in one transaction. Idempotent: an already-disabled target is a no-op (no error, no duplicate audit).
- `enableAccount(actor, targetUserId, {reason, ...})` — the mirror, for `status='active'`. Never touches sessions (see §11 reactivation).

Gated by a single, flat, non-entity-scoped permission,
`identity.security.manage_account` — no base/privileged tiering was
introduced, because Identity has no employee → legal-entity lookup of its
own (only `OrganisationRepository`'s LegalEntity-level reads) to hang a
classification ceiling on; see §17 for this accepted scope boundary. Not
HRMS-specific: `disableUser()` lives in Identity, and HRMS's own
integration calls it exactly like a manual administrative caller would —
see `identity/src/api` for the shape a future
`POST /api/v1/users/:id/disable` administrative endpoint would take (not
built in this PR — see §18, Explicitly out of scope discipline: no new
HTTP surface was added, since nothing in this PR's own scope needed one
yet — the processor and tests call the service directly).

## 5. Session revocation

`sessions.revokeAllForUser(userId, 'account_disabled')` — inside the SAME
transaction as the status change. `validateSession()` ALSO independently
re-checks status (defense-in-depth, §3), so even a session that somehow
was never explicitly revoked (a future bug, a direct `setStatus()` call
bypassing the service — exactly what this PR's own pre-existing test
fixtures did) still cannot be used.

## 6. MFA / recovery-code behaviour

Unchanged secrets/codes — disablement never deletes `mfa_methods` or
`mfa_recovery_codes` rows. A future reactivation does not need to re-run
MFA enrolment (the method rows survive), though a security-conscious
operator MAY choose to require re-enrolment as **policy**, not something
this code silently does. Both MFA-verify and recovery-code-verify routes
already defensively re-check `user.status === 'active'` immediately
before issuing a session (pre-existing, from PR #4's own review) — this
PR adds two regression tests that force disablement via the REAL
`accountSecurityService.disableAccount()` (not a raw `setStatus()` call)
between challenge issuance and completion, for both the TOTP and the
recovery-code path, each asserting the completion is denied AND that no
session was created (`identity/test/integration/http.test.ts`).

## 7. Role / entity-grant treatment

**Preserved historically, never revoked or deleted by disablement.**
`user_role_assignments`/`entity_access_grants` are untouched by
`disableAccount()` — account status is the primary, sole kill switch. This
was a deliberate choice, not an oversight: since the central invariant
(§3) makes a disabled account's authorization checks fail regardless of
what it still holds, revoking grants would add no additional security
value while destroying the historical record of what that person was
actually authorised to do while employed (useful for later audit,
dispute, or a legitimate future reactivation). These tables were already
append-only/soft-revoke by design (`revoked_at`, never a hard delete) —
disablement simply never touches them at all, in either direction.

## 8. Deactivation request lifecycle

A durable, HRMS-owned table — NOT Identity's schema, and Identity has
zero knowledge it exists (see §12, dependency direction):

```sql
hr_identity_deactivation_requests (
  id, case_id UNIQUE, employee_id, target_user_id, requested_by,
  reason_category, status ('REQUESTED'|'COMPLETED'|'FAILED'),
  requested_at, completed_at, failure_reason, attempt_count
)
```

The smallest model that distinguishes requested / completed /
failed-and-retryable (brief §15) — deliberately **not** a generic
job-processing table: no queue semantics, no worker-lease columns, no
priority/backoff schedule, no "processing" state (the transaction either
fully commits or fully rolls back — there is never an observable durable
"in progress" state worth persisting). `reason_category` is a short,
generic string (`"hrms_offboarding"`) — never HR case content, never SK
Lai & Partners privileged legal-case material (§16).

Created **once**, inside offboarding's OWN completion transaction
(`offboardingService.ts`'s `completeOffboarding` `additionalWrites`
callback — the same hook that already appends the
`identity_deactivation_requested` event) — atomically alongside the case
completion, so a committed request EVENT never exists without a
corresponding durable ROW to process; extending `LifecycleTransaction`'s
repos set (`TxRepos`/`LifecycleTransaction` in `repositories/types.ts`)
was the minimal, in-pattern way to make this possible, mirroring exactly
how PR #9 extended the same transaction for `workflow_instance_id`. Only
created when the employee currently has an ACTIVE Identity link
(`users.findActiveLinkByEmployeeId`) — a contractor/employee who never
had an Identity account has nothing to revoke, and no request is created
with no real target (`hrms/test/integration/identityDeactivation.test.ts`,
"creates NO deactivation request when the employee has no linked Identity
user").

## 9. Transaction boundary

Two genuinely different boundaries, mirroring PR #9's own §3a/§3b split
exactly:

**Submission** (offboarding completion → durable request row): part of
the SAME transaction as the case's own COMPLETED write — this is HRMS's
OWN table, no cross-package transaction concern, so there is no reason to
split it the way HRMS↔Workflow submission had to be split.

**Processing** (`identityDeactivationProcessor.ts`'s `processOne`): a
DELIBERATELY SEPARATE, LATER, independently-retryable transaction —
per brief §13's own explicit guidance, this PR does **not** blindly
extend offboarding's own transaction to include Identity revocation. Each
processing attempt is instead one shared Postgres transaction spanning
BOTH the request-row lock/completion write (HRMS's own
`LifecycleTransaction`) AND Identity's `disableAccount()` (bound to the
SAME `tx` via `createAccountSecurityServiceForTransaction` — Identity's
own PR #9-style transaction-scoped composition helper,
`identity/src/transactionScope.ts`):

```
processOne(requestId):
  BEGIN (HRMS's LifecycleTransaction, tx)
    lock request row (FOR UPDATE)
    if already COMPLETED: return (idempotent no-op)
    re-verify case is still COMPLETED (defensive; nothing in this
      foundation ever reverses a completed offboarding)
    accountSecurity(tx).disableAccount(...)   -- Identity, SAME tx
      (locks target user row, sets disabled, revokes sessions, audits)
    mark request COMPLETED
  COMMIT  -- or ROLLBACK, all of it, together
```

Never claims completion while any step failed (brief §12's explicit
invariant) — proven directly:
`hrms/test/integration/identityDeactivation.test.ts`, "Failure/rollback:
if the referenced case is not (or no longer) COMPLETED, processing fails
cleanly... without disabling anything", and
`identity/test/integration/accountSecurity.test.ts`, "Rollback: a
failure anywhere inside the shared transaction rolls back the account
status change together with everything else".

Why this two-transaction split is *safe*, unlike a naive one: unlike the
HRMS↔Workflow submission gap PR #9 found (a crash between two writes with
no natural retry trigger), a FAILED disableAccount attempt here is always
independently retryable — nothing about the request depends on "the
moment offboarding completed" remaining true; the request row itself IS
the durable retry anchor.

## 10. Retries / idempotency

```
process(request)
process(request)
process(request)
      ↓
one effective deactivation outcome
```

`disableAccount()` itself is idempotent (an already-disabled target
returns `alreadyInState: true`, no error, no duplicate audit).
`processOne()` layers a second idempotency check on top (an already
`COMPLETED` request is a no-op before even touching Identity). Verified
directly with three consecutive `processOne()` calls against the same
request: exactly one `account.disabled` audit row, one completion.
A `FAILED` request remains retryable (status is not terminal) — proven by
the failure/rollback test above, which corrects the underlying condition
and retries successfully.

## 11. Concurrency

All against real, separate Postgres connections, re-run 5× consecutively
with zero flakes:

- **Race A** (two workers process the SAME deactivation request
  concurrently) — exactly one committed completion, the loser blocked on
  the request row's `FOR UPDATE` lock until the winner commits, then
  observing `COMPLETED` and returning `already_completed`.
  `hrms/test/integration/identityDeactivation.test.ts`.
- **Race B/login-creation race** (user attempts authentication —
  concretely, session creation — while `disableAccount()` commits) —
  `createSession()` locks the SAME user row `disableAccount()` locks, so
  the two transactions serialize: whichever acquires the lock first
  commits first. If disable wins, session creation is denied outright
  (`AccountDisabledError`). If session-creation wins, it commits first —
  and `disableAccount()`'s own `revokeAllForUser` (which only runs after
  ITS lock acquisition succeeds, i.e. strictly after the session
  transaction already committed) sees and revokes the just-created
  session too. Either way: no session issued during or immediately after
  disablement ever survives usable. Proven directly, 8 iterations per
  run: `identity/test/integration/accountSecurity.test.ts`, "Login/
  session-creation race".
- **Race C** (user uses an existing session while revocation commits) —
  proven as a direct, non-racy assertion (a session validated
  successfully, then `disableAccount()` runs, then the SAME still-
  unexpired token is immediately rejected) rather than a timing race,
  since `validateSession()`'s own status check makes the outcome
  deterministic regardless of exact interleaving once the disable
  transaction has committed.
- **Race D** (duplicate offboarding/deactivation request) — a case can
  only ever complete once (HRMS's own state machine), and
  `hr_identity_deactivation_requests.case_id` is `UNIQUE` as a defensive
  backstop; "duplicate request" in practice reduces to Race A (the SAME
  request processed twice), covered above.

## 12. HRMS / Workflow boundary — dependency direction

Mirrors PR #9's own HRMS→Workflow precedent exactly, one integration
further:

```
Identity  <──  Organisation  <──  HRMS  ──>  Workflow
   ^                                 |
   └─────────────────────────────────┘
   (the ONE new edge this PR adds: HRMS -> Identity's
    accountSecurityService, via identityDeactivationProcessor.ts)
```

Identity remains completely domain-blind: it has no knowledge of HRMS
cases, `hr_identity_deactivation_requests`, or offboarding at all — it
exposes only the generic `disableAccount`/`enableAccount` operations any
caller could use. `platform-services/hrms/src/integrations/
identityDeactivationProcessor.ts` is the ONE file, alongside PR #9's own
`workflowIntegration.ts`, that imports something outside HRMS's own
domain. Never a generic event bus, never Identity polling HRMS tables —
the smallest clean boundary assessed (brief §11's own option list): a
durable request row HRMS itself owns, consumed by an explicit HRMS-side
processor that calls INTO Identity, never the reverse.

The Workflow-triggered path (a SYSTEM_ACTION handler completing an
offboarding case via `createOffboardingServiceForTransaction`) and the
direct-call path (`container.offboarding.completeOffboarding()`) share
the exact same `additionalWrites` logic, so both create the request row
identically — proven end-to-end through the full Workflow approval flow
in `hrms/test/integration/workflowIntegration.test.ts`'s extended
"Offboarding: full approval flow" test, which now also processes the
resulting request and confirms the account ends up disabled.

## 13. Workflow boundary — the task-eligibility gap found and closed

While proving the central invariant against every listed surface (brief
§29), a REAL, previously-unguarded gap was found: `taskService.decide()`
and `completeTask()`'s own `checkEligibility()` deliberately never calls
`rbac.authorize()` live — ROLE-mode candidacy is resolved once, at
step-activation time, and intentionally never re-evaluated afterward (see
`workflow-approval-foundation.md`'s "Role-change semantics after
activation" — a documented PR #8 design choice so a later role/permission
change never silently alters who may act on an already-activated task).
This is correct for role/permission DRIFT, but account STATUS is a
different, more severe axis — a disabled account should never be able to
decide a task regardless of how eligibility was resolved.

Reproduced first (a test proving a disabled approver's `decide()` call
was **not** rejected, confirming the gap was real), then fixed: a new
`requireActiveAccount()` check was added to `taskService.ts`, called
right after `checkEligibility()` in both `decide()` and `completeTask()`
— the one authoritative point both share, never duplicated per caller.
This required adding a `users: UserRepository` dependency to
`createTaskService`; `platform-services/workflow/src/composition/
container.ts` and both its test setups were updated to pass it. Verified:
`workflow/test/integration/postgres.test.ts`, "a Workflow approver whose
Identity account has been disabled cannot decide a task, even though
their role assignment/candidacy is untouched".

## 14. Audit / attribution

`security_audit_events` (Identity's own table, unchanged schema) records,
per disable/enable action:

| Field | Meaning |
|---|---|
| `actor_user_id` | who/what EXECUTED the action — an administrator, OR the system principal (see §15) |
| `resource_id` | the TARGET user being disabled/enabled |
| `change_after.reason` | a short, generic category (e.g. `"hrms_offboarding"`) — never HR case content |
| `change_after.sourceSystem` | which integration initiated it, e.g. `"hrms-offboarding"` |
| `change_after.sourceRequestId` | cross-reference to HRMS's own `hr_identity_deactivation_requests.id` — resolvable back to the case by whoever is authorised to see it there; Identity itself stores only the reference |
| `change_after.sessionsRevoked` | count, for observability |

Never a confidential HR termination detail — Identity receives and
stores only this minimal set. Cross-referencing (never duplicating)
mirrors PR #9's own `decisionActorUserId`/`initiatedBySystem` pattern
exactly.

## 15. System principal

A real, narrowly-scoped `users` row (`accountType: 'service'` — already
anticipated by the domain model, `entities.ts`'s `AccountType` union)
holding ONLY `identity.security.manage_account`, nothing else — not a
null/anonymous actor, not broad impersonation. `authorize()`'s central
invariant applies to it identically to any human actor: if this
principal's own account were ever disabled, its automated deactivation
calls would themselves be refused (the actor-status check has no special
case for service accounts, by design — see the accountSecurity.test.ts
"a DISABLED actor cannot manage any account" test, which exercises this
exact case). Distinguished explicitly from: the business approval actor
(`workflow_decisions.actor_user_id`, PR #9, unchanged), the HR execution
principal (the case's `hrOwnerUserId`, PR #9's own `executionContext`,
unchanged), and the target Identity user (`resource_id` above) — four
separate identities, never conflated, all cross-referenced by id.

## 16. SK Lai & Partners

`hr_identity_deactivation_requests.reason_category`/`failure_reason` are
short, generic, non-sensitive strings by construction — never HR
termination detail, never legal-case content, regardless of which legal
entity the case belongs to. A general SVE technical administrator with
`identity.security.manage_account` can see that an SKL employee's account
was disabled "due to hrms_offboarding" and which case/request id it
cross-references — never the SKL case's own privileged content, which
stays entirely inside HRMS's own access-controlled records. No new
entity-scoped permission tier was introduced for `manage_account` itself
(see §17's accepted scope boundary) — SKL segregation for THIS
capability rests on: (a) it being a narrowly-scoped, rarely-granted
permission at all, and (b) the automated path never exposing HR content
regardless of who holds it.

## 17. Reactivation boundary

**Not implemented as an automatic behaviour, by design.** HRMS creating a
new employment record for a previously-offboarded person never
automatically re-enables their old Identity account — reactivation is a
separate security decision, always requiring an explicit
`enableAccount()` call by an authorised administrator holding
`identity.security.manage_account`. This PR:

- Defines the boundary (`enableAccount()` exists, generic, in Identity).
- Preserves everything needed for a future reactivation (the `users` row,
  `user_employee_links`, MFA method rows, historical role/grant records —
  nothing is deleted).
- Does NOT implement a rehire/reactivation Workflow, an HRMS-triggered
  auto-enable, or a new HTTP endpoint for it (all explicitly out of
  scope, §18).

**Sessions on reactivation**: `enableAccount()` never touches
`sessions` — every session the account ever had was already revoked (by
`disableAccount`, or otherwise) and stays revoked permanently. A
reactivated account must authenticate completely fresh. Verified
directly: `identity/test/integration/accountSecurity.test.ts`,
"enableAccount: idempotent, and does NOT restore/unrevoke any
previously-revoked session".

## 18. Explicitly out of scope

User deletion; automatic rehire/reactivation Workflow; password reset
redesign; MFA redesign; SSO; passkeys; AWS Cognito; Leave; Payroll;
Payslips; iClaims; Accounting Pro; recruitment; performance; SVEGIP UI;
mobile UI; a generic event bus; a generic job-processing framework;
distributed transactions; deployment/Netlify cutover/AWS/server
infrastructure; escrow. Also, deliberately not built even though closely
related: an `identity.security.manage_account.privileged`
entity/classification tier (see §17's boundary above), and a
`POST /api/v1/users/:id/disable` HTTP endpoint (nothing in this PR's own
scope calls it over HTTP — the processor and administrative callers use
the service directly; adding an unused endpoint "because the capability
exists" is exactly what brief item 14's convention across this codebase
already avoids elsewhere).

## 19. Migration

`database/migrations/007_identity-offboarding-revocation/migration.sql` —
additive only, one new table
(`hr_identity_deactivation_requests`) plus two indexes. Migrations
`001`–`006` are unedited, already-merged history. No real
employees/users seeded. Verified idempotent (re-run twice cleanly) and
applies fresh after `001`–`006`.

## 20. Regression

Baseline immediately before this PR (substantive `test()` counts):

```
Identity       95
Data Vault     45
Organisation   65
Workflow       60
HRMS           77
```

After this PR, on a fresh CI-equivalent Postgres database:

```
Identity      104   (+9: FK-carve-out proof, 6 accountSecurityService
                      tests including the login/session-creation race,
                      2 MFA/recovery-then-disable regression tests)
Data Vault     46   (+1: SVEGIP-cookie disabled-user test)
Organisation   65   (unchanged — mechanical `users` param threading only)
Workflow       61   (+1: disabled-approver-cannot-decide, the gap found
                      and closed in §13)
HRMS           83   (+6: identityDeactivation.test.ts's full request-
                      lifecycle/idempotency/Race-A/rollback suite, plus
                      one extended end-to-end assertion on the existing
                      Workflow-approval offboarding test)
```

All green, zero weakened or deleted tests. Concurrency-sensitive suites
(`accountSecurity.test.ts`, `identityDeactivation.test.ts`) re-run 5×
consecutively with zero flakes.

## 21. Remaining risks

- **No scheduled trigger for `identityDeactivationProcessor.processAllPending()`** — the capability exists and is fully tested, but nothing in this PR calls it on a timer (mirrors the identical, already-documented `expireDueSessions` gap from PR #4: "the function exists and is tested, but nothing calls it on a schedule" — a housekeeping/operational gap, not a security one, since the durable request row means a later run always converges; deployment/scheduling infrastructure is explicitly out of scope for this PR).
- **No entity/classification-scoped tier for `identity.security.manage_account`** — see §17's explicit, accepted boundary. A holder of this permission can disable/enable ANY account, regardless of legal entity. Given how narrowly this permission is meant to be granted (one system principal, plus whichever human security administrators are explicitly trusted), this is judged acceptable for this foundation, but is a real gap relative to the fine-grained entity segregation the rest of this codebase enforces everywhere else.
- **Workflow's own instance-level READ access (`resolveReadAccess` in `instanceService.ts`) was not audited/hardened for disabled actors** — only the MUTATING paths (`decide`/`completeTask`) were confirmed and fixed. A disabled user who was previously assigned a task could, in principle, still read (not act on) that instance's metadata. Judged materially lower severity than a mutation gap and left as a known, documented boundary rather than expanding this PR's scope further.
- **`disableAccount`'s permission model has no way to express "only for employees I manage"** — any holder of `identity.security.manage_account` can target any user. Combined with the entity-scoping gap above, this means the permission itself is the whole access boundary — grant it narrowly.
- **The FK-based "not found" carve-out (§3) is a documented, temporary trade-off, not a permanent architectural position.** If this codebase's own test-fixture conventions are ever migrated to always back actors with real `users` rows, the carve-out could be removed for a strictly stronger invariant. Not attempted in this PR (assessed as disproportionate — see §3's own reasoning).
