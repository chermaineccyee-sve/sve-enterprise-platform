# SVE HRMS ↔ Workflow Integration Foundation (PR #9)

This is the first real business-domain integration with
`platform-services/workflow` (PR #8). It wires HRMS's Employment Change
and Offboarding lifecycle types to Workflow's approval engine, preserving
every domain's existing ownership and PR #7's atomic-completion invariant.

## 1. Domain ownership (unchanged, explicitly reaffirmed)

```
HRMS         lifecycle case / status / HR decision & outcome / HR lifecycle events
Organisation Employee Master / employment assignments / assignment history / reporting
Workflow     definition/version / instance / routing / tasks / approval decisions / workflow history
Identity     users / authentication / MFA / roles-permissions / entity access / sessions / security audit
```

Workflow never becomes authoritative for HR employment state. HRMS never
writes Workflow tables. Workflow never writes HRMS or Organisation
tables. All cross-domain calls go through services/ports, never raw
repository access into another package.

## 2. Dependency direction

PR #8 kept Workflow independent of every business domain. That is
**preserved**: `platform-services/workflow/src/**` still imports nothing
from HRMS, and its own tests/composition root are completely unaware this
integration exists.

The one new dependency edge is **HRMS → Workflow**, and it is isolated to
a single file:

```
platform-services/hrms/src/integrations/workflowIntegration.ts
```

This file is the ONLY place in the repository that imports
`platform-services/workflow`. Everywhere else in HRMS's own service layer
(`approvalService.ts`) depends only on a narrow port interface
(`services/workflowPort.ts`) it defines itself — never a concrete Workflow
type. This mirrors the existing repository-interface convention used
throughout this codebase (services depend on interfaces, concrete
Postgres/in-memory implementations are wired at the composition root).

**Boundary choice — why `platform-services/hrms/src/integrations/`, not
`platform-services/workflow/src/integrations/` or a new
`platform-services/integration` package:**
Workflow must never import a business domain (see above), so
`workflow/integrations` was never a valid option — it would require
importing HRMS's services to build the handler. A dedicated
`platform-services/integration` package was assessed and rejected as
disproportionate: it would be a new deployable unit, a new CI surface,
and a new set of composition-root wiring for a boundary that fits
entirely inside one existing package with zero new infrastructure. HRMS
already depends on Identity and Organisation by source path; adding
Workflow to that list is the same, already-established pattern, not a new
one. This is "the smallest clean composition boundary required for these
two HRMS workflows" — not a generic enterprise integration framework.

```
HrmsContainer (composition/container.ts)
  ├── existing: users, organisation, rbac, audit, orgContainer, lifecycle,
  │             onboarding, probation, employmentChange, offboarding
  ├── workflow: WorkflowContainer          (NEW — createWorkflowContainer(db), same db)
  └── approval: ApprovalService            (NEW — depends on WorkflowSubmissionPort only)
                    │
                    └── implemented by createHrmsWorkflowIntegration()
                        in integrations/workflowIntegration.ts, which is
                        also where the two SYSTEM_ACTION handlers are
                        registered into workflow.systemActions.
```

## 3. Transaction boundary

Two genuinely different consistency requirements exist in this
integration, and they get two different, honestly-documented mechanisms.

### 3a. Submission (HRMS → Workflow): idempotent two-phase handoff, NOT one shared transaction

`approvalService.submitForApproval()`:

1. **Phase 1** (one HRMS transaction, row-locked): transitions the case
   `IN_PROGRESS → PENDING_DECISION`, stores `pendingCompletionInput`, and
   appends an `approval_submitted` event. A concurrent second caller
   blocks on the row lock, then sees the now-`PENDING_DECISION` case and
   returns early — no second transition, no second event.
2. **Phase 2**: calls `WorkflowSubmissionPort.submit()` to start the
   Workflow instance, then stamps `hr_lifecycle_cases.workflow_instance_id`
   with a separate, small update.

This is **not** one shared Postgres transaction — `WorkflowTransaction`
opens its own real transaction independently of HRMS's, and forcing the
two into one shared transaction for a mere reference-stamping operation
would require a much heavier mechanism for very little benefit. Instead,
the design is **retry-convergent**: if Phase 2 fails (network blip,
process restart), the case is left at `PENDING_DECISION` with
`workflow_instance_id = NULL` — a safe, visibly-incomplete state.
`submitForApproval()` treats exactly that state as resumable: a retry
skips Phase 1 (already done) and re-attempts Phase 2 only. If two callers
both reach Phase 2 concurrently, Workflow's own natural
`UNIQUE(definition_id, subject_type, subject_id) WHERE status='ACTIVE'`
constraint prevents a second instance; the loser's `submitForApproval()`
call catches that specific failure, re-reads the case, and returns the
winner's now-linked reference instead of propagating an error.

This is a deliberate, disclosed choice, not a hidden consistency gap: the
worst-case failure mode is "case says PENDING_DECISION but not yet
visibly linked to a workflow instance", which is always safely retryable
and never produces a duplicate instance or a lost submission.

**Review correction (PR #9 review): a genuine gap in that retry path.**
The review asked for an explicit real-Postgres proof of the SEQUENTIAL
(not concurrent) crash case: Phase 2's `WorkflowSubmissionPort.submit()`
call itself succeeds — a real, `ACTIVE` Workflow instance commits — but
the SEPARATE, subsequent `linkWorkflowInstance()` write never commits
(process crash, network failure). A single caller then retries. Before
this correction, this was **not** actually handled: `submitForApproval`'s
own `catch` block only reconciles when a CONCURRENT winner already linked
the case (`reconciled.workflowInstanceId` set) — here nobody ever did, so
`instanceService.startWorkflow`'s own `UNIQUE(definition_id, subject_type,
subject_id) WHERE status='ACTIVE'` constraint would reject the retry's
attempt to start a SECOND instance, and the resulting `InvalidStateError`
would propagate straight out, leaving the case permanently stuck at
`PENDING_DECISION` with no linkage and no way forward short of manual
database intervention.

**Fixed**, entirely inside the ONE integration adapter
(`integrations/workflowIntegration.ts`'s `WorkflowSubmissionPort.submit()`
implementation — Workflow's own package is untouched, preserving its
independence): catching that specific `InvalidStateError` and, instead of
propagating it, querying `instances.listInstances(actor, { subjectType:
'hrms.lifecycle', subjectId: caseId, status: 'ACTIVE' })` to discover the
orphaned instance and return its reference, which `submitForApproval`
then links exactly as if Phase 2 had succeeded the first time. The
existing `requesterUserId === actor.userId` fast path in
`resolveReadAccess` (unchanged) makes this instance visible to the
retrying actor regardless of their Workflow read permissions, since they
were also the ORIGINAL requester. This keeps the two-phase design intact
— no cross-domain transaction was introduced to avoid this gap — and
closes it with a small, adapter-local reconciliation step consistent with
the design's own existing "catch a specific failure, re-discover, return
the winner's reference" pattern.

Proven by a new real-Postgres test
(`test/integration/workflowIntegration.test.ts`, "Two-phase submission
crash recovery"): a genuine successful submission, followed by manually
nulling `hr_lifecycle_cases.workflow_instance_id` to reproduce the exact
end state a crash between the two writes would leave (never fault
injection into production code), then a retry proving exactly one
Workflow instance ever exists, the case converges to the SAME
`workflowInstanceId`, and the recovered linkage remains fully functional
through to a normal approval completion.

### 3b. Approval decision → completion (Workflow → HRMS → Organisation): ONE shared Postgres transaction

This is the invariant PR #7 established and PR #9 must not weaken. It is
achieved like this:

```
taskService.decide() opens ONE Postgres transaction (WorkflowTransaction.run)
  │
  ├─ persist the Workflow decision row
  ├─ applyDecisionTransition → advancePastStep → activateStep
  │     (still the SAME transaction, SAME connection `tx`)
  │
  └─ step 2 is SYSTEM_ACTION → executeSystemActionStep
        │
        └─ deps.systemActions.execute(handlerKey, { instance, step, tx, recordedBy })
              │
              └─ HRMS's registered handler (integrations/workflowIntegration.ts)
                    │
                    ├─ reads the HRMS case via a repo bound to the SAME `tx`
                    ├─ createEmploymentChangeServiceForTransaction(tx, rbac)
                    │     (composition/transactionScope.ts — NEVER calls
                    │      tx.transaction() again; binds repos directly to `tx`)
                    │
                    └─ completeChange()/completeOffboarding() run on `tx`:
                          Organisation's createAssignment/endAssignment
                          (via Organisation's OWN
                          createEmploymentAssignmentServiceForTransaction,
                          reused unchanged from PR #7)
                          + HRMS's own case completion + HRMS's own events
                                              │
COMMIT (or ROLLBACK — see §3c) ───────────────┘
```

Every write in this chain — the Workflow decision, the task transition,
the system-action execution record, the HRMS case completion, HRMS's own
events, and Organisation's assignment mutation — runs on the **same**
`DatabaseProvider` connection, inside the **same** `BEGIN…COMMIT`. There
is no second, nested `db.transaction()` call anywhere in this chain
(which would throw — see §4).

### 3c. Review finding: PR #8's SYSTEM_ACTION failure handling was unsafe for a real handler

Inspecting the ACTUAL merged `executeSystemActionStep` (PR #8) revealed
that a handler failure was caught, recorded as a `FAILED` execution/
instance status, and then the function returned **normally** — meaning
the enclosing transaction still **committed**. For PR #8's own trivial
test handlers (no real writes) this was harmless. For a real,
transactional handler like this PR's, it would be exactly the hazard
this PR must prevent: *"Workflow says approved / COMMIT / call HRMS /
HRMS fails / and pretend the operation is complete."* A handler that had
already issued some of its writes on the shared `tx` before failing
would have those partial writes silently committed alongside a
misleadingly-terminal Workflow state.

**Fixed** (in `platform-services/workflow/src/services/instanceEngine.ts`,
this PR): `executeSystemActionStep` no longer catches a handler failure —
it re-throws, letting the WHOLE transaction roll back: the decision, the
task transition, the system-action execution row, and every write the
handler itself made. After rollback, the task remains `PENDING` and the
instance remains at its prior step — safely retryable by a new
`decide()`/`completeTask()` call, with no special "FAILED" state to
manage. This is a **review correction to PR #8's own code**, covered by:
new/rewritten Workflow-package tests
(`test/unit/instanceService.test.ts`, `test/integration/postgres.test.ts`)
and this PR's own HRMS-level rollback test (§10). See
`docs/architecture/workflow-approval-foundation.md` §22a for the
corrected failure-semantics write-up in Workflow's own doc.

### 3d. Review correction (PR #9 review): execution principal & authority revalidation

**The finding**: the registered SYSTEM_ACTION handler resolves the case's
`hrOwnerUserId` as the actor for the authoritative HRMS/Organisation
completion write (§9 explains why it is the HR owner, not the deciding
approver). That actor's authority must hold **now**, at the moment the
handler actually executes — which can be arbitrarily later than
submission, after an async human approval — never merely because it held
at case-creation/submission time. A stored `hrOwnerUserId` must never
become a privilege trampoline: if the HR owner's account is deactivated,
or their HRMS permission, Organisation `manage_assignment` permission,
legal-entity access, or SK Lai & Partners privileged-tier access is
revoked after submission but before approval, the authoritative mutation
must not execute, and the Workflow decision/task transition triggering it
must roll back too.

**What was already correct, unchanged**: `completeCaseWithAuthoritativeWrite`
(`lifecycleCaseService.ts`, unchanged since PR #7) already calls
`checkAccess(deps.rbac, actor.userId, permission.base, permission.privileged,
{ legalEntityId, recordClassification })` **fresh**, live, against
whatever `actor` is passed, every single time `completeChange()`/
`completeOffboarding()` runs — never a value cached from submission.
Because `resolveHrOwnerActor` re-resolves the HR owner from the database
on every handler invocation (never a value captured at submission time),
and `rbac.authorize()` reads current role assignments and entity-access
grants live, this ONE call already re-validates, at execution time:

- HRMS permission (`manage_employment_change`/`manage_offboarding`, base
  or `.privileged`) — requirement 3;
- legal-entity access covering the case's own `legalEntityId` —
  requirement 2;
- classification ceiling, including SK Lai & Partners' `.privileged`
  requirement — requirement 5.

Organisation's own `createAssignment()`/`endAssignment()` (unchanged since
PR #7) independently re-run the identical `checkAccess()` pattern against
`employee_master.manage_assignment`, inside the SAME transaction —
requirement 4. None of this needed duplicating; it was already the
authoritative, live re-check the review asked to be proven.

**What was genuinely missing**: existence and *active status*
(requirement 1). `resolveHrOwnerActor`'s `findById` only proved the
account still exists — nothing anywhere checked `status === 'active'`.
This is a real, previously-unguarded gap: `rbacService.authorize()`
itself never consults account status (it only reads role
assignments/entity grants), so a disabled account whose role assignments
were never explicitly revoked would otherwise still pass every permission
check.

**The fix** — added once, at the single authoritative domain boundary
both the Workflow-triggered path and the pre-existing direct-HTTP
completion routes (`POST .../complete`) already share:
`completeCaseWithAuthoritativeWrite` now fetches the execution principal's
own `User` row (`deps.users.findById(actor.userId)`) and throws
`ForbiddenError` unless it exists and `status === 'active'`, immediately
before its (unchanged) permission check. This is deliberately **not**
duplicated inside `integrations/workflowIntegration.ts` — the adapter
still only resolves the actor; it performs no authorization logic of its
own, exactly as the review asked ("add it at the authoritative domain/
service boundary rather than implementing a parallel security model
inside the integration adapter").

**Rollback**: because this check throws inside
`completeCaseWithAuthoritativeWrite`, which the SYSTEM_ACTION handler
calls on the shared transaction `tx`, the error propagates exactly the
same way any other handler failure does (§3c) — the WHOLE transaction
rolls back: no committed Workflow decision, no task transition, no
Organisation mutation, no HRMS completion.

**Audit/history attribution**: `completeCaseWithAuthoritativeWrite` gained
an optional `executionContext: { decisionActorUserId, initiatedBySystem }`
parameter, threaded from `workflowIntegration.ts`'s handlers using
`ctx.recordedBy` (the Workflow decision's own deciding-actor id, already
correctly attributed on `workflow_decisions.actor_user_id` — untouched)
and the registered handler key. It is merged into the completion event's
`eventData` and the audit entry's `changeAfter` alongside an explicit
`executionPrincipalUserId` (restating `actor.userId`, the audit row's own
existing `actor_user_id`). No new columns, no new tables, no sensitive
payload duplication — three plain user-id/string fields recorded once,
distinctly:

| Field | Meaning |
|---|---|
| `workflow_decisions.actor_user_id` (unchanged) | who APPROVED |
| `hr_lifecycle_events.recorded_by` / `security_audit_events.actor_user_id` on the completion row | whose authority EXECUTED the mutation (the execution principal) |
| `eventData.decisionActorUserId` / `changeAfter.decisionActorUserId` | cross-reference to who approved, on the execution's own record |
| `eventData.initiatedBySystem` / `changeAfter.initiatedBySystem` | which system/integration initiated it, e.g. `workflow:hrms.workflow.employment_change.complete` |

A reader of either record alone can never misattribute the mutation to
the approver, nor the approval to the HR owner. For a case completed
directly (the pre-existing HTTP routes, no Workflow decision involved),
`executionContext` is simply omitted — `decisionActorUserId`/
`initiatedBySystem` are absent, exactly as before this PR.

**Tests** (`test/integration/workflowIntegration.test.ts`, real Postgres,
each proving the actual committed/rolled-back database state, not just
"the call throws"): a control case (HR owner distinct from both the
creating/submitting actor and the approver, active and fully authorised
→ succeeds, with attribution assertions on all three records above); HR
owner loses the HRMS permission after submission but before approval;
loses Organisation `manage_assignment`; loses legal-entity access;
becomes inactive; loses SK Lai & Partners privileged-tier access — each
proves zero committed `workflow_decisions` rows, the task back at
`PENDING`, the case still `PENDING_DECISION`, and no new Organisation
assignment; and a retry-after-restoration test proving the earlier
rejected attempt never partially applied and exactly one business
completion occurs once authority is legitimately restored.

**Explicitly not done** (scope discipline, per the review's own
instruction): no HR-ownership redesign, no service-account/impersonation
concept, no Identity deactivation implementation, no new HR module, no
generic "revalidate everything" framework — this is the one check
(active status) the existing model was missing, added at the one place
it belongs.

## 4. Avoiding nested transactions

`DatabaseProvider.transaction()` throws `"Nested transactions are not
supported."` if called on an already-open `tx`. PR #7 solved this for
Organisation with a "ForTransaction" composition helper
(`createEmploymentAssignmentServiceForTransaction`) that binds repositories
directly to an externally-supplied `tx` and never calls `.transaction()`
again. PR #9 needed the SAME pattern one layer further up the stack, for
HRMS's own lifecycle-completion primitive, and applies it identically:

- `platform-services/workflow/src/repositories/types.ts`'s
  `WorkflowTransaction.run(fn)` now passes the raw, transaction-scoped
  `DatabaseProvider` as `fn`'s second parameter (additive — every existing
  caller that destructures only `(repos)` is unaffected; the in-memory
  implementation passes a stub that throws if actually used, exactly
  mirroring HRMS's own `NO_REAL_CONNECTION` convention).
- `SystemActionContext` (`domain/systemActionRegistry.ts`) gained `tx`
  and `recordedBy` fields.
- `platform-services/hrms/src/composition/transactionScope.ts` (new)
  exposes `createLifecycleCaseServiceForTransaction(tx, rbac)` and its
  two thin wrappers `createEmploymentChangeServiceForTransaction` /
  `createOffboardingServiceForTransaction` — built from a new
  `createPgLifecycleTransactionScoped(tx)` (in
  `repositories/postgres/pgLifecycleTransaction.ts`) that, like
  Organisation's own scoped variant, never calls `.transaction()` again.

No operation in this integration ever opens a transaction inside another
already-open transaction.

## 5. Workflow submission: `submitForApproval`

Only `employment_change` and `offboarding` cases are submittable in this
foundation (onboarding/probation completion remains manual, entirely
unaffected). Required behaviour, all implemented in
`services/approvalService.ts`:

- caller must hold the SAME permission that gates direct completion
  (`manage_employment_change`/`manage_offboarding`, base or `.privileged`,
  entity/classification-checked) — submitting for approval is not a
  lesser-privileged action than completing directly;
- case must be `IN_PROGRESS` (fresh) or `PENDING_DECISION` with
  `workflow_instance_id` still `NULL` (a safe resume, §3a);
- `completionInput` (the employment-change assignment terms, or the
  offboarding end-date/status/reason) is validated for its required
  shape and stored on the case as `pendingCompletionInput` — captured
  once, at submission time, not at case-creation time, so the existing
  `createChangeCase`/`createOffboardingCase` signatures and their PR #7
  tests are completely unaffected;
- the correct, already-published Workflow definition is resolved by a
  fixed key per lifecycle type (§6);
- starting the instance is idempotent (§3a);
- HRMS records the linkage (`workflow_instance_id`) as a REFERENCE.

## 6. Workflow definition installation strategy

Two definitions are needed: `hrms.employment_change` and
`hrms.offboarding` (final keys, matching the codebase's existing
`hrms.lifecycle.*` naming convention and Workflow's own already-registered
`hrms.lifecycle` subject type).

Assessed against the brief's own options:

- **Seeded by migration** — rejected. A workflow definition/version/step
  is mutable application data with its own DRAFT→PUBLISHED→RETIRED
  lifecycle, not schema; `workflow_definitions.created_by` is a `NOT NULL`
  FK to a real `users.id`, and no fixed, safe-to-hardcode "system user"
  exists to attribute a migration-time INSERT to (the same reasoning
  migration `005` itself gives for seeding nothing).
- **Automatic installation inside `createHrmsContainer`'s own
  construction** — rejected. Composition-root construction has no
  authenticated actor to attribute the definition to, and installing
  mutable application data as an implicit side effect of every process
  start is exactly the kind of hard-to-audit behaviour this foundation
  avoids elsewhere.
- **Chosen: an idempotent bootstrap service, invoked through an explicit
  administrative command.** `integrations/workflowIntegration.ts` exports
  `installHrmsWorkflowDefinitions(workflow, actor)` — checks whether a
  definition with the given key already has a PUBLISHED version (no-op if
  so), otherwise creates it, adds its two steps, and publishes it.
  `platform-services/hrms/scripts/installWorkflowDefinitions.ts` is a
  thin CLI wrapper (mirrors `identity/scripts/migrate.ts`'s own
  convention) run once per environment, given the email of an
  already-provisioned, already-permissioned admin user. Tests call the
  same function directly with their own admin fixture.

Both definitions are structurally identical:

```
Step 1 — APPROVAL, assignmentMode: ROLE
         assignedPermissionKey:           hrms.lifecycle.manage_employment_change   (or manage_offboarding)
         assignedPermissionKeyPrivileged: hrms.lifecycle.manage_employment_change.privileged (or .manage_offboarding.privileged)
         allowSelfApproval: false
         permittedDecisions: [APPROVE, REJECT]      (no RETURN — see §8)
Step 2 — SYSTEM_ACTION
         systemActionHandlerKey: hrms.workflow.employment_change.complete (or .offboarding.complete)
```

Future versioning (a different approval policy, additional steps) is a
new DRAFT version + publish — the existing Workflow definition-versioning
machinery from PR #8, unmodified.

## 7. Approval routing — no hard-coded approvers

ROLE-mode routing on the exact SAME permission that already gates direct
completion was chosen as "the smallest defensible generic approval
strategy" (brief §10), for two reasons:

1. It invents no new SVE-specific business rule (no assumption about
   org-chart-based approval, no named individual, no new permission
   namespace).
2. It is **self-consistent with HRMS's own existing authorisation model**:
   `completeChange()`/`completeOffboarding()` (unchanged since PR #7)
   require their caller to hold BOTH the HRMS `manage_*` permission AND
   Organisation's own `employee_master.manage_assignment` — see §9 for
   why the completion handler therefore acts as the case's **HR owner**,
   not as the deciding approver.

Production configuration is purely an Identity RBAC grant (who holds
`manage_employment_change`/`manage_offboarding`, at what entity scope and
classification tier) — no code or definition change is ever needed to
adjust who may approve.

## 8. Rejection / RETURN semantics

- **REJECT**: the Workflow instance completes with `outcome: 'REJECTED'`
  (Workflow's own existing engine behaviour, unmodified). HRMS does not
  learn this synchronously (REJECT never reaches the SYSTEM_ACTION step –
  it short-circuits `applyDecisionTransition` before advancing). Instead,
  `approvalService.getApprovalStatus()` performs **lazy, row-locked,
  exactly-once reconciliation** the next time anyone reads the case's
  approval status: if the live Workflow outcome is `REJECTED` and the
  case is still `PENDING_DECISION`, it transitions the case back to
  `IN_PROGRESS` (editable, resubmittable) and appends an
  `approval_rejected` event. **Never `CANCELLED`** — that would conflate
  "this specific submission needs rework" with "abandon this case
  entirely" (the existing, unrelated `cancelCase()` operation remains the
  only way to reach `CANCELLED`). This is a clean terminate-and-resubmit
  model, not a loop.
- **RETURN**: not offered by either definition (`permittedDecisions:
  [APPROVE, REJECT]`) — Workflow's own engine cannot RETURN from the
  first step (there is no step 0 to return to), and both of this PR's
  definitions have their APPROVAL step first. Attempting RETURN is
  refused the same way any not-permitted decision is (a plain
  `ValidationError` from `taskService.decide()`), verified directly by a
  test. This is the brief's own suggested fallback (§16): "a clean
  terminate-and-resubmit model may be preferable" — REJECT already IS
  that model; a second RETURN mechanism would be redundant complexity for
  zero additional capability at this foundation's current scope.

## 9. Employment Change

```
HR creates the case, still IN_PROGRESS (unchanged, PR #7)
       │
HR calls submitForApproval(caseId, completionInput)   ← NEW
       │  (case → PENDING_DECISION; completionInput stored; Workflow instance starts)
       ▼
a ROLE-eligible approver decides APPROVE
       │  (still inside ONE shared Postgres transaction — §3b)
       ▼
registered handler: resolveHrOwnerActor (the case's hrOwnerUserId, NOT
the deciding approver — see below) → completeChange() → Organisation's
createAssignment() → HRMS case COMPLETED + employment_change_completed event
```

**Why the HR owner, not the approver, is the completion's actor**:
`completeChange()`'s existing (PR #7) authorisation requires its caller
to hold BOTH `manage_employment_change` AND Organisation's
`employee_master.manage_assignment`. Requiring every ROLE-eligible
Workflow approver to ALSO personally hold that raw Organisation-level
write permission would conflate "authorised to approve" with "authorised
to directly mutate Employee Master data" — two distinct things this
foundation's domain boundary deliberately keeps separate (mirroring §20's
"approval authority ≠ unrestricted HR record access"). The case's
`hrOwnerUserId` — already a real, established user, required at
case-creation time, operationally the person responsible for seeing the
case through — is the correct actor for this specific write. They must
hold both permissions, exactly like completing directly today. **Who
approved** remains correctly and separately attributed on
`workflow_decisions.actor_user_id`. That authority is re-validated LIVE,
at the moment of execution, never trusted merely because it held at
submission time — see §3d for the full review correction and its tests.

Organisation only changes after this full chain succeeds and commits —
never merely because the case was submitted.

## 10. Offboarding

```
HR creates the case (unchanged, PR #7) → submitForApproval(caseId, {endDate, status, changeReason})
       │
approver decides APPROVE (same ROLE/permission/transaction model as §9)
       ▼
registered handler → completeOffboarding() →
   Organisation's endAssignment() (assignment ended)
   + HRMS case COMPLETED + separation_effective event
   + identity_deactivation_requested event
       (the SAME durable REQUEST-only event PR #7 established — this PR
       changes nothing about its meaning: still never an Identity
       mutation, still never performed automatically)
```

### Identity deactivation-request boundary (unchanged by design)

Per brief §18, this PR chose **option A**: preserve and expose
`identity_deactivation_requested` as a durable follow-up request only.
Identity itself exposes **no** deactivation mutation to call — there is
nothing for a "controlled system-action integration boundary" (option B)
to invoke yet, so building one now would be speculative. Actual access
revocation is explicitly left to a future, separate, security-focused PR.

### Security risk this PR does NOT resolve — stated plainly

Between offboarding completion and any future, separately-authorised
deactivation, the system is in a state where:

```
employment ended (Organisation: assignment RESIGNED/TERMINATED, effective_to set)
Identity account: still ACTIVE, still able to authenticate
```

This is **not** a completed security revocation, and this PR does not
claim it is. `container.users.findById(...)` after offboarding completion
correctly shows `status: 'active'` — verified directly by tests (§13,
§14) precisely to keep this visible and honest rather than silently
assumed away.

## 11. Idempotency

| Requirement | Mechanism |
|---|---|
| submit case twice → one active Workflow instance | §3a's row-locked Phase 1 + Workflow's own natural `UNIQUE(definition_id, subject_type, subject_id) WHERE status='ACTIVE'` backstop |
| retry approved action → no duplicate Organisation assignment | the conditional task-status transition (PR #8) — a second `decide()` on an already-`COMPLETED` task is rejected before the handler ever runs |
| retry offboarding completion → no duplicate end-assignment | same mechanism |
| no duplicate HRMS lifecycle completion | same mechanism (HRMS's own case-completion write is in the SAME transaction as the decision) |
| no duplicate `identity_deactivation_requested` | same mechanism — it is appended inside the SAME single completion transaction, exactly once |
| no duplicate Workflow decision | PR #8's `UNIQUE(task_id)` on `workflow_decisions`, unchanged |
| no duplicate Workflow completion | PR #8's conditional `updateProgress`, unchanged |
| a crashed submission (instance started, linkage write lost) converges to exactly one instance/linkage on retry | §3a's review correction: discover-and-reuse via `listInstances`, backstopped by Workflow's own `UNIQUE(...) WHERE status='ACTIVE'` |
| retry after the execution principal's authority is revoked-then-restored → exactly one business completion | §3d's review correction: the rejected attempt rolls back entirely (§3c), leaving the task retryable with nothing partially applied |

## 12. Concurrency — tests and results

All verified against real, separate Postgres connections
(`test/integration/workflowIntegration.test.ts`), each re-run 5×
consecutively with zero flakes:

- **Race A** (two concurrent `submitForApproval` calls for the same
  case): exactly one Workflow instance/linkage — every successful caller
  observes the SAME `workflowInstanceId`.
- **Race B** (two eligible ROLE candidates decide the same task
  concurrently): exactly one committed decision AND exactly one
  Organisation assignment — proven by a direct row count, not just "no
  error".
- **Race C** (an approval decision racing an instance cancellation):
  resolves deterministically to exactly one of two fully-consistent
  outcomes (approved-and-completed, or cancelled-and-untouched) — never a
  mixed/split-brain state, enforced by Postgres row-level locking on the
  shared `workflow_instances`/`workflow_tasks` rows (no new locking
  primitive was needed).

## 13. Rollback guarantees and tests

A forced, REAL failure (an employment-change `completionInput` carrying a
nonexistent `positionId` — a genuine Organisation-side foreign-key
validation failure, not fault injection into production code) proves:
no committed Workflow decision, the task remains `PENDING`, the instance
remains `ACTIVE` at its prior step, the HRMS case remains
`PENDING_DECISION` (never falsely `COMPLETED`), and no Organisation
assignment exists — then a retry with corrected input succeeds cleanly,
proving the rollback left a genuinely clean, retryable state. This
exercises the review-corrected engine behaviour from §3c end-to-end
through a real cross-package handler. The equivalent proof at the
Workflow-package level alone (a handler that also writes, via `ctx.tx`,
to a throwaway fixture table, then fails) lives in
`platform-services/workflow/test/integration/postgres.test.ts` and
additionally proves the handler's OWN write rolls back, not just
Workflow's own tables.

**Review correction (PR #9 review) — execution-principal revocation
rollbacks**: six further forced-failure tests (§3d) prove the identical
guarantee for every one of the five required live re-checks (HRMS
permission, Organisation `manage_assignment`, legal-entity access,
account active-status, SK Lai & Partners privileged-tier access), each
revoked from the HR owner AFTER a genuine submission but BEFORE the
approver's `decide()` call — proving zero committed `workflow_decisions`
rows, the task back at `PENDING`, the case still `PENDING_DECISION`, and
no Organisation mutation, in every case.

## 14. Entity / SK Lai & Partners

Verified end-to-end through the integration, not merely at the
Workflow-package level in isolation:

- a group-scoped, non-privileged holder of `manage_employment_change`
  does **not** resolve as a ROLE candidate for an SK Lai & Partners case
  (its classification ceiling is RESTRICTED; only the `.privileged`
  permission tier, also unioned into the same ROLE step via
  `assignedPermissionKeyPrivileged`, resolves);
- System Administrator (Organisation-only technical-administration
  permissions, no HRMS permission at all) is never implicitly a ROLE
  candidate for ANY entity;
- MY-scoped access does not imply SG eligibility (inherited unchanged
  from PR #8's own ROLE-routing correctness, exercised again here through
  the real integration).

## 15. Subject-data minimisation

The Workflow instance for an HRMS case carries only
`subjectType: 'hrms.lifecycle'` and `subjectId: <caseId>` — never the
case's `pendingCompletionInput`, employee name, or any other HR content.
Verified directly: a test dumps the instance's `context` and every one of
its events' `eventData` and asserts none of the case's own completion
content (e.g. `employmentType`, dates) appears anywhere in Workflow's own
tables. Approval authority (being a ROLE candidate) grants no additional
HRMS case-read access beyond what the approver's own HRMS permissions
already allow — the integration provides Workflow only the minimum
reference it needs to route and record a decision.

## 16. Event / audit separation (unchanged three-way split, extended)

- **Workflow events** (`workflow_events`) — orchestration history only:
  `instance_started`, `task_created`, `decision_recorded`,
  `system_action_executed`, `instance_completed`, etc. Never HR content.
- **HRMS lifecycle events** (`hr_lifecycle_events`) — HR business
  history, gained two new types this PR: `approval_submitted` (recorded
  at Phase 1, §3a) and `approval_rejected` (recorded by the reconciliation
  in §8). The existing `employment_change_completed` /
  `separation_effective` / `identity_deactivation_requested` types are
  reused unchanged for a successful approval's own completion.
- **Identity security audit** (`security_audit_events`) — unchanged;
  `approvalService.submitForApproval()` records one
  `hrms.lifecycle.approval_submitted` audit entry, matching the existing
  convention of auditing state-changing HRMS operations.

No payload is duplicated verbatim across all three — each records only
what it owns, cross-referenced by id (`caseId`, `workflowInstanceId`)
where useful.

**Review correction (PR #9 review, §3d)**: the completion event/audit row
itself (`employment_change_completed`/`separation_effective` on
`hr_lifecycle_events`, and its matching `security_audit_events` row) now
also cross-references `decisionActorUserId` (who approved, on
`workflow_decisions`, a different table/domain entirely) and
`initiatedBySystem`, alongside the existing `recorded_by`/`actor_user_id`
(whose authority executed it). This is a cross-reference by id, not a
payload copy — no HR content, no Workflow orchestration content, and no
security-audit content crosses into another domain's own record because
of it.

## 17. Migration

`database/migrations/006_hrms_workflow_integration/migration.sql` — purely
additive: `ALTER TABLE hr_lifecycle_cases ADD COLUMN IF NOT EXISTS
workflow_instance_id` (+ a `UNIQUE` constraint and index) and `... ADD
COLUMN IF NOT EXISTS pending_completion_input JSONB`; `hr_lifecycle_events`'
`event_type` CHECK constraint is widened via DROP + re-ADD under its
existing auto-generated name (the standard, idempotent-safe way to widen
a column CHECK list in Postgres) to add `approval_submitted` and
`approval_rejected`. Migrations `001`–`005` are untouched. No employee,
legal entity, Workflow instance, or Workflow decision row is duplicated
anywhere.

## 18. API

```
POST /api/v1/hrms/lifecycle/cases/:id/submit-for-approval   { completionInput }
GET  /api/v1/hrms/lifecycle/cases/:id/approval
```

Both are HRMS-owned routes, following this package's existing envelope/
error-handling conventions exactly. No business-specific Workflow
endpoint was added (no `/api/v1/workflow/complete-hr-case` or similar) —
Workflow's own task-decision routes remain entirely Workflow-owned and
untouched; an approver decides through Workflow's own API, exactly as
before this PR.

**PR #13 note**: the deactivation-request boundary described in §10 above
is unchanged by PR #13 — no write path was added or altered. PR #13 adds
one read-only projection, `GET /api/v1/hrms/lifecycle/cases/:id/
deactivation-status`, so SVEGIP's Offboarding screen can show a
humanized status (not requested / requested / retry pending / completed)
without exposing the raw `hr_identity_deactivation_requests` row. Full
detail (including how it composes with PR #10's actual processor, which
postdates this doc) is in `hrms-employee-lifecycle.md` §15 and
`hrms-application-shell.md` §14.6; `identity-offboarding-revocation.md`
remains the authoritative doc for the processor itself.

## 19. Tests

`platform-services/hrms` — 77 substantive tests (44 pre-existing PR #7 +
25 from the initial PR #9 build + 8 from the PR #9 review correction):

- `test/unit/approvalService.test.ts` (12 tests, in-memory, against a
  fake `WorkflowSubmissionPort`) — authorisation, entity isolation,
  completionInput validation, state-machine gating, idempotent
  submission, REJECTED reconciliation (including "exactly once"),
  graceful degradation when the port can't see the instance, IDOR-safe
  denial, onboarding/probation correctly rejected as non-submittable.
- `test/integration/workflowIntegration.test.ts` (19 tests, real
  Postgres, via the REAL `createHrmsContainer` composition root) — full
  employment-change approval flow; full offboarding approval flow
  (including the Identity-untouched assertion); REJECT reconciliation;
  RETURN refused; SK Lai & Partners + System-Administrator-not-approver;
  Race A/B/C; the forced-failure rollback proof; subject-data
  minimisation; retry-after-success non-duplication; **review correction
  (§3d, 7 tests)**: execution-principal success-with-attribution control
  case, HRMS-permission revocation, Organisation-permission revocation,
  legal-entity-access revocation, account-inactive revocation, SK Lai &
  Partners privileged-tier revocation, retry-after-restoration; **review
  correction (§3a, 1 test)**: two-phase submission crash recovery.
- `test/integration/http.test.ts` (+2 tests) — unauthenticated
  submit-for-approval denied; a full submit→decide→complete flow over
  real HTTP plus an IDOR-safe 404 for an unrelated caller.

`platform-services/workflow` — 60 substantive tests, unchanged by the
review correction (58 pre-existing PR #8 + 2 from the initial PR #9
build's §3c fix): the superseded SYSTEM_ACTION-failure test rewritten to
assert rejection-not-false-completion, plus one real-Postgres test
proving full-transaction rollback including the handler's own write.

Fictional fixtures only throughout.

## 20. Regression

Canonical substantive-test baselines immediately before PR #9's initial
build:

```
Identity       95
Data Vault     45
Organisation   65
HRMS           44
Workflow       58
```

After PR #9's initial build: Identity 95/95, Data Vault 45/45,
Organisation 65/65 (all three unchanged, untouched), Workflow 60/60 (58 +
2 from §3c), HRMS 69/69 (44 + 25 new).

After this review correction ("Execution Principal & Authority
Revalidation"), re-run on a fresh CI-equivalent Postgres database (raw
`npm test` count / substantive `test()`-case count, per this codebase's
established convention — the difference is each package's own
non-`.test.ts` helper files, e.g. `testDb.ts`, swept up as trivial
zero-assertion pseudo-subtests by the bare `node --test` CI runs):
Identity 96/95, Data Vault 46/45, Organisation 66/65, Workflow 62/60 (all
four entirely unchanged and untouched by this correction — identical to
their PR #9 initial-build figures above), **HRMS 79/77 (69 substantive +
8 new: 6 revocation-rollback tests + 1 success/attribution control test +
1 two-phase crash-recovery test)** — all green, zero weakened or deleted
tests. `workflowIntegration.test.ts` and `postgres.test.ts` (the two
files touched or most load-bearing for this correction) were additionally
re-run 5× consecutively each, zero flakes.

## 21. CI

The existing `validate-hrms` job is extended with one additional
dependency-install step (`platform-services/workflow`, since HRMS's
integration layer now imports it by source path) — no eighth job was
added; this integration has no independent package/service of its own
that would justify one. All seven jobs remain otherwise unchanged.
Migrations `001` through `006` run via the same shared migration runner
against a clean database on every CI run.

## 22. Explicitly out of scope (unchanged from the brief)

Leave, Attendance, Payroll, Payslips, iClaims, Accounting Pro,
recruitment, performance/appraisal, policy acknowledgement, full
onboarding/probation Workflow integration, actual Identity account
deletion, automatic Identity access revocation, Notifications delivery,
Lark/Teams/email integration, SVEGIP UI, mobile UI, BPMN, a visual
workflow designer, parallel/quorum approvals, a generic integration bus,
distributed transactions, a production scheduler, AWS deployment,
Netlify cutover, server deployment, escrow.

**Static SVEGIP UI note**: `apps/svegip/app.js`'s "Insight to Implementation"
/ "Management Command Centre" / "Onboarding — Planned production module"
content was inspected and confirmed to be entirely disconnected,
front-end-only mock content for an unrelated management-decision-tracker
feature — it implies no real backend behaviour and was not treated as
authoritative. No SVEGIP file was changed by this PR.

## 23. Future integration boundaries

- **Onboarding/probation Workflow integration**: the same
  `submitForApproval`/port/handler pattern generalises directly — not
  built here, per explicit scope.
- **A real Identity deactivation worker**: once Identity exposes an
  actual, safely-authorised deactivation mutation, a THIRD registered
  SYSTEM_ACTION handler (or a scheduled worker reading
  `identity_deactivation_requested` events) can consume this PR's
  existing, unchanged durable request — the boundary is already in
  place, unexploited.
- **Richer approval policy** (multi-step, MANAGER routing for
  employment changes, a dedicated approval permission distinct from
  direct-completion authority): a new DRAFT version of the same
  definition — no schema change, no code change to this integration
  layer.
