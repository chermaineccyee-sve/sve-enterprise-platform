# SVE Workflow & Approval Foundation (PR #8)

## 1. Domain boundary

```
Identity        authentication / authorization / sessions / MFA
Organisation    employees / assignments / reporting relationships
HRMS            HR lifecycle business state
Workflow        orchestration / tasks / approvals / routing / escalation
Business domains remain authoritative for their own records and outcomes
```

Workflow is a **reusable orchestration/approval engine**, not a business
domain. It never owns employee status, employment assignments, probation
decisions, HR lifecycle cases, claims, payroll, accounting entries, or
Data Vault records — it may only *coordinate* actions concerning those
domains, through a registered SYSTEM_ACTION handler that calls the
authoritative domain service (§9, §21).

Workflow depends on Identity (users/RBAC/audit) and Organisation
(`EmploymentAssignmentService.resolveDirectManagerUserId()` for MANAGER
routing). It does **not** depend on HRMS, or any other business domain —
domains plug into Workflow; Workflow never plugs into a domain. This is
deliberate: a future PR that has HRMS start/consume Workflow instances
must never create a dependency cycle, and Workflow's own correctness must
never depend on knowledge of any one domain's business rules.

## 2. Existing code inspected before designing this PR

- `platform-services/workflow/README.md` — scaffolding only, described a
  "configurable delegation-of-authority / approval-matrix" engine. No
  implementation existed.
- `apps/svegip`'s `management_decisions` table (migration
  `004_management-decisions`) — a flat, single-purpose decision log
  (`decision_code`, `status`, `owner_email` as free text, one audit
  table). No step/task/approval routing model, no versioning, no actor
  resolution — confirmed this is unrelated prior art, not something to
  extend or migrate.
- `platform-services/notifications/README.md` — scaffolding only. No
  delivery mechanism exists; Workflow's own notification boundary (§14)
  is a pure extension point, nothing to integrate against yet.
- `platform-services/audit/README.md` — scaffolding only; the *real*
  audit mechanism is Identity's own `auditService`/`security_audit_events`
  (unchanged, reused directly — see §12).
- `platform-services/hrms` (PR #7) — the full lifecycle-case/event
  model, its three-tier classification pattern, and its
  `identity_deactivation_requested` EVENT (not an Identity mutation) —
  confirmed as the template for "coordinate, never own" that Workflow's
  own SYSTEM_ACTION boundary (§21) follows.
- `platform-services/organisation`'s `EmploymentAssignmentService` (PR
  #6/#7) — `isDirectManagerOf(actorUserId, employeeId): boolean` existed;
  no method returned a manager's own identity. This PR adds exactly one
  new read-only method (§4) rather than duplicating the reporting-line
  walk.
- Migrations `001`–`004` — the full existing schema (users, RBAC,
  sessions, legal entities, employees, employment_assignments, HRMS
  lifecycle tables). None altered; `005` only references them by FK.
- The transaction architecture PR #6/#7 established
  (`DatabaseProvider.transaction()`, no nesting, transaction-scoping
  composition helpers like
  `createEmploymentAssignmentServiceForTransaction`) — informed §24's
  analysis of what Workflow does and does not need for PR #8.
- CI (`.github/workflows/ci.yml`) had six jobs after PR #7
  (`validate-svegip`, `validate-platform-contracts`, `validate-identity`,
  `validate-data-vault`, `validate-organisation`, `validate-hrms`).

**Reusable existing capability:** Identity's RBAC/audit/session model,
Organisation's entity/classification ceilings, the repository +
composition-root pattern, the transaction-scoping precedent.
**Prototype/static UI:** SVEGIP's `management_decisions` page — a
decision log, not an approval engine; unaffected.
**Missing capability (built by this PR):** everything else — definitions,
versions, steps, instances, tasks, decisions, business history, system
action registry, escalation processing.

## 3. Module ownership and dependency direction

```
platform-services/
├── identity/         users/sessions/RBAC/audit — no dependency on this PR
├── organisation/      Employee Master/assignments — one additive method (§4)
├── hrms/              HR lifecycle — untouched; no dependency on Workflow
└── workflow/          this package — depends on identity + organisation only
```

`platform-services/workflow/src/composition/container.ts` mirrors HRMS's
own composition root exactly: it imports Identity's Postgres
repositories/session/RBAC/audit services directly, and consumes
**Organisation as a whole container** (`createOrganisationContainer(db)`)
rather than reaching into its repositories — Workflow only ever calls
Organisation's *service*-level contract
(`assignments.resolveDirectManagerUserId`).

## 4. One additive change to Organisation

`EmploymentAssignmentService` gained one new, read-only, side-effect-free
method: `resolveDirectManagerUserId(employeeId): Promise<string | null>`
— resolves the Identity `userId` of an employee's current direct manager
(via the same assignment-level `reportsToAssignmentId` / position-level
`reportsToPositionId` walk `isDirectManagerOf` already performs), or
`null` if none can be resolved. This is the concrete-identity counterpart
to `isDirectManagerOf`'s boolean check — MANAGER routing needs "who is
the manager," not merely "is X the manager of Y." Organisation's own full
test suite (66/66) was re-verified unaffected.

## 5. Lifecycle case model — Core concepts

- **Workflow Definition** (`workflow_definitions`): a thin, status-free
  header identified by a stable `key` (e.g. `hrms.probation_confirmation`).
- **Workflow Definition Version** (`workflow_definition_versions`): the
  actual, versioned, editable content. `DRAFT` → `PUBLISHED` → `RETIRED`.
  Only a `DRAFT` version may be edited; publishing freezes it forever
  (§8, §36).
- **Workflow Instance** (`workflow_instances`): one execution of a
  **published** version for a particular business subject.
- **Workflow Step** (`workflow_steps`): a defined, sequentially-ordered
  stage — `APPROVAL`, `TASK`, or `SYSTEM_ACTION` (§10).
- **Workflow Task** (`workflow_tasks`): the actionable item an
  APPROVAL/TASK step spawns when it activates.
- **Approval Decision** (`workflow_decisions`): `APPROVE`/`REJECT`/`RETURN`,
  immutable once committed (§12).
- **Workflow Event** (`workflow_events`): append-only business history
  (§26).

No abstraction exists without a concrete use in this PR: delegation is
deliberately **not** a table (§16); "PENDING" is deliberately **not** a
separate instance/task status distinct from "ACTIVE" (§9, §18) — see
those sections for the reasoning.

## 6. Onboarding (a definition author's perspective, not a built module)

A definition author creates a definition (`createDefinition`), adds steps
to its initial DRAFT version (`addStep`), and publishes it
(`publish`). No onboarding-specific business logic exists in this
package — "onboarding approval" is simply a definition some future
integration creates and publishes, exercising the exact same generic
engine as every other workflow.

## 7. Probation, confirmation, and extension — none implemented

No HR-specific concept exists in this package. A future PR modelling
"probation confirmation" as a Workflow definition would create steps
(e.g. a MANAGER approval, then a ROLE-gated HR decision) using the
primitives this PR provides — this PR builds no HR-aware code.

## 8. Definition lifecycle

`DRAFT → PUBLISHED → RETIRED`, terminal at `RETIRED`. Publishing
validates the DRAFT version's steps (§35) and assigns its permanent
`versionNumber` — see §33 for the concurrency-safety mechanism.
`createDraftVersion()` opens a *new* version for editing after a prior
one has published; the old version remains `PUBLISHED` (or later
`RETIRED`, a separate explicit action) and completely untouched. A
`DRAFT` version's steps may be added/updated/deleted; once `PUBLISHED`,
every step-mutation endpoint rejects with `InvalidStateError` — verified
directly by a unit test that publishes a version and then asserts
`addStep`/`updateStep`/`deleteStep` all reject.

## 9. Workflow instance state

Final state set: **`ACTIVE` | `COMPLETED` | `CANCELLED` | `FAILED`** — a
deliberate reduction from the brief's candidate
`PENDING/ACTIVE/COMPLETED/CANCELLED/FAILED`. `PENDING` was dropped: this
engine resolves and activates step 1 synchronously, inside the same
transaction that creates the instance (§24) — there is no observable
window where an instance exists but has not yet been routed, so a
`PENDING` status would be an abstraction with no current use (brief item
6). `startWorkflow()` returns an instance already `ACTIVE` (routing
succeeded) or `FAILED` (routing failed — §15).

`COMPLETED`/`CANCELLED`/`FAILED` are all terminal — `assertValidTransition`-
style state-machine code is unnecessary here because the ENGINE (not a
caller) is the only thing that ever changes `status`, and every one of
its own code paths already only transitions non-terminal → terminal (or
`ACTIVE` → `ACTIVE`, a same-status "step advanced" no-op) once. Cancel and
decide both re-check the current status under a lock before acting (§18,
§19), so no separate generic transition table is needed. `failureCategory`
(`ROUTING_FAILURE` | `SYSTEM_ACTION_FAILURE` | `INFRASTRUCTURE_FAILURE`,
§22) distinguishes *why* an instance is `FAILED` without needing four
separate terminal statuses.

## 10. Step model

Three step types, exactly as the brief's minimum: `APPROVAL`, `TASK`,
`SYSTEM_ACTION`. A `SYSTEM_ACTION` step stores only a `handlerKey`
string (e.g. the brief's own illustrative `identity.request_deactivation`
— not implemented by this PR, since Identity itself exposes no
deactivation mutation to call, mirroring HRMS's own
`identity_deactivation_requested` **event**-not-mutation design). No
executable JavaScript, SQL, shell command, or arbitrary HTTP URL is ever
stored, interpreted, or invoked anywhere in this package — a handler is a
plain TypeScript function registered at composition time (§21) via
`SystemActionRegistry`, a factory (not a module-level singleton) so each
composition root — and each test file — has its own independent,
code-controlled set of handlers.

## 11. Sequential routing first

Every workflow executes its steps strictly in `sequenceNumber` order — no
DAG, no parallel branches. `workflow_definition_versions.allow_parallel_steps`
is persisted (default `false`) as a forward-compatibility column a
future PR could use to opt a version into parallel execution without a
migration, but nothing in this PR's engine reads it.

## 12. Approval model

An `APPROVAL` step's `permittedDecisions` (a subset of `APPROVE`/`REJECT`/
`RETURN`) is validated at publish time (§35) and enforced again at
decision time — `decide()` rejects a decision the step does not permit
with `ValidationError`. Every decision records `taskId`, `actorUserId`,
`decision`, `decidedAt`, an optional `comment`, and `resultingTransition`
(a small structured label like `advanced_to_step_2` or
`instance_completed:REJECTED`) — see §5's `workflow_decisions` table.
**Immutable once committed**: no UPDATE/DELETE code path exists anywhere
for this table; `task_id UNIQUE` makes a second decision for the same
task a database-level impossibility (§19), not merely an application
convention.

## 13. Assignment / routing

Three assignment modes: `USER`, `ROLE`, `MANAGER`. `ENTITY_ROLE` was
assessed and **not** added — every current routing need is expressible as
`ROLE` (a permission key already scoped by the instance's own
`legalEntityId`/`dataClassification` target) or `MANAGER`; a fourth mode
would be an abstraction with no current use.

- **`MANAGER`**: calls
  `EmploymentAssignmentService.resolveDirectManagerUserId(subjectEmployeeId)`
  (§4) — never a duplicated reporting-line lookup.
- **`ROLE`**: the step stores `assignedPermissionKey` (any permission key
  in the system — Workflow's own, or a business-specific one like a
  future `hrms.lifecycle.manage_probation`); eligibility is checked
  **live**, at listing/decision time, via
  `rbac.authorize({userId, permissionKey, target: {legalEntityId,
  recordClassification}})` — never materialised into a stored list of
  users. System Administrator is never implicitly a role-holder: a
  System-Admin-only actor without the specific permission key is denied,
  verified directly by a unit test.
- **`USER`**: the workflow-start caller supplies an explicit
  `stepAssignments: {sequenceNumber: {userId}}` map (persisted in
  `workflow_instances.context`, the same JSONB column used for other
  small routing context) — a definition never hard-codes a specific
  person.

## 14. Actor resolution timing

**Step-activation time**, not instance-start time (brief item 14's
recommended default) — `resolveAssignment()` runs fresh every time
`activateStep()` runs, whether that is step 1 at `startWorkflow()` or
step N+1 after a decision. `MANAGER` routing therefore always reflects
the CURRENT reporting line, even for a long-running, multi-step
instance. Once a task is created, its `assignedUserId` is fixed — no
code path silently reassigns it except the explicit, audited
`reassignTask()`/escalation paths (§16, §17).

## 15. No self-approval

`allow_self_approval` (default `false`) is a per-step column. Enforcement
is layered:

1. **At routing time** (`MANAGER`/`USER` modes): if the resolved/assigned
   user equals the instance's `subjectActorUserId`, the step never
   creates a task — the instance fails immediately with
   `failureCategory: 'ROUTING_FAILURE'`, verified directly by two unit
   tests (MANAGER-resolves-to-subject-actor; USER-assigned-to-subject-actor).
2. **At decision time** (all modes, but the ONLY enforcement point for
   `ROLE` mode, whose actual decider cannot be known at routing time):
   `decide()` refuses a decision from the subject actor with
   `ForbiddenError`, verified directly by a unit test.

**No eligible approver** (a resolvable-in-principle mode with no
resolvable target — `MANAGER` with no current manager, `USER` with no
`stepAssignments` entry) fails the SAME way: `ROUTING_FAILURE`, never a
silent auto-approval or insecure fallback. **Known limitation**: `ROLE`
mode's eligibility is checked lazily (§13), so a `ROLE` step can activate
with zero currently-eligible approvers without that being caught as a
routing failure — building a "who currently holds permission X" reverse
index was assessed and rejected as a fourth Identity/RBAC capability this
foundation does not need yet (see §37 remaining risks).

## 16. Delegation — explicitly deferred

**Not built.** A minimal delegation foundation was assessed against the
brief's own "if full delegation materially expands PR #8, model the
extension point and defer implementation" guidance. Any delegation
mechanism must be explicit, time-bounded, auditable, and scoped, and must
never bypass entity/classification/permission restrictions — the natural
extension point is a future `workflow_delegations` table plus a
`DELEGATE` assignment mode consulted inside `checkEligibility()`
(`taskService.ts`), added without touching the routing/decision engine
itself. `reassignTask()` (§13's `TASK_REASSIGN` permission) is the only
reassignment mechanism this PR provides — explicit, single-use, and
audited, not an ongoing substitution.

## 17. Escalation

Persisted per-task metadata: `dueAt`, `escalateAfter`, `escalationTargetMode`
(`NONE` | `REASSIGN_TO_ASSIGNEE_MANAGER` — the only supported non-`NONE`
strategy). One deterministic service method,
`escalationService.processDueEscalations()`, that a future scheduler
(cron, queue worker, manual trigger) calls — **no AWS/EventBridge/cron
infrastructure exists in this package**. For each task past its
`escalateAfter` with `escalatedAt IS NULL`: resolves the current
assignee's manager via Organisation (§4) and reassigns if found; always
stamps `escalatedAt` and appends an `escalation_triggered` event
regardless (never a silent no-op, never an insecure grant). Guarded by
`escalated_at IS NULL` in the same conditional-UPDATE style as decisions
(§19), so two concurrent sweeps can never both escalate the same task —
verified directly by a unit test asserting a second sweep processes zero
tasks.

## 18. Task states

Final state set: **`PENDING` | `COMPLETED` | `CANCELLED`** — a deliberate
reduction from the brief's candidate
`PENDING/ACTIVE/COMPLETED/CANCELLED/EXPIRED`. The same "no observable
activation window" reasoning as §9 collapses `PENDING`/`ACTIVE` into one
status; `EXPIRED` was assessed and dropped — this foundation's only
due-date mechanism is escalation (§17), which reassigns rather than
expires, so a distinct `EXPIRED` status would have no code path that ever
sets it. `transitionStatus(id, expectedStatus, ...)` is a conditional
UPDATE guarded by the CURRENT status (mirrors HRMS's
`recordDecision`/`transitionStatus` guard pattern) — the mechanism behind
"prevent double decision" and "prevent decision after cancellation" (§19).

## 19. Concurrency

**Required invariant**: one actionable task → at most one committed
decision. Enforced at TWO layers:

1. `workflow_tasks.transitionStatus(taskId, 'PENDING', {status:
   'COMPLETED', ...})` — a single conditional `UPDATE ... WHERE id=$1 AND
   status=$2`. Two concurrent decision attempts race this UPDATE;
   Postgres row-locks the first, and the second's WHERE clause no longer
   matches once the first commits — it affects zero rows and `decide()`
   throws `InvalidStateError`.
2. `workflow_decisions.task_id UNIQUE` — belt-and-suspenders: even if
   some future code path bypassed the guarded UPDATE, a second INSERT for
   the same `task_id` is a database-level impossibility, not merely an
   application convention.

Verified against **real, separate Postgres connections**
(`Promise.allSettled`, not mocks): three concurrent `decide()` calls on
the same task produce exactly one commit and two rejections, and
`SELECT count(*) FROM workflow_decisions WHERE task_id=$1` confirms
exactly one row. The same real-connection technique verifies concurrent
`createDraftVersion()` calls never produce duplicate version numbers
(§33).

## 20. Idempotency

Two independent mechanisms, so a retry is safe even without special
client behaviour:

- **Caller-supplied `idempotencyKey`**: `UNIQUE(definition_id,
  idempotency_key) WHERE idempotency_key IS NOT NULL`.
  `startWorkflow()` checks for an existing instance with the same key
  FIRST and returns it unchanged rather than creating a second one —
  verified directly.
- **Natural uniqueness invariant** (the default every caller gets, with
  or without a key): `UNIQUE(definition_id, subject_type, subject_id)
  WHERE status = 'ACTIVE'` — a second `startWorkflow()` call for a
  subject that already has an ACTIVE instance of the same definition
  fails cleanly with `InvalidStateError`, verified directly (and mirrored
  in the in-memory repository for unit tests, since Postgres's own unique
  index cannot be exercised without a real connection).

Duplicate task creation and duplicate system-action execution are
covered by §18/§19 (task decisions) and §21 (system actions) respectively
— idempotency is not a single mechanism here but a property of every
write path.

## 21. System actions — the critical boundary

A `SYSTEM_ACTION` step's `handlerKey` is validated against
`SystemActionRegistry.isRegistered()` at **publish time** — an
unregistered key can never even be published, let alone executed
(verified directly). At execution time, `workflow_system_action_executions`
(`UNIQUE(instance_id, step_id)`) is the idempotency mechanism: `findOrCreate`
uses `INSERT ... ON CONFLICT (instance_id, step_id) DO NOTHING RETURNING
...`, falling back to a `SELECT` of the existing row on conflict — a
step's handler is invoked **at most once** across any number of retried
activation attempts (a `SUCCEEDED` execution short-circuits straight to
advancing the workflow; a `FAILED` one leaves the instance `FAILED`
without re-invoking the handler). `attempts`/`lastError` are persisted
for a future bounded-retry policy this PR does not implement (§22: no
automatic retry loop). **No handler registered by this PR's own
production composition root** — no business domain is integrated yet;
tests register their own fictional handlers (`test.echo`,
`test.alwaysfails`) directly against their own registry instance.

## 22. Failure semantics

`workflow_instances.failureCategory` distinguishes:

- **Business rejection** — NOT a failure at all: `status='COMPLETED',
  outcome='REJECTED'`. A rejected approval is a normal, meaningful
  outcome (§12).
- **Routing failure** — no eligible/resolvable approver (§15).
- **System-action failure** — a registered handler threw (§21).
- **Infrastructure failure** — reserved for a future PR's use (e.g. a
  scheduler or delivery-layer failure outside this engine's own control);
  no code path in this PR currently sets it, since every failure this
  foundation can itself produce is already categorised as one of the
  other two.

Retry semantics for system actions are deliberately minimal: one
attempt per activation, no automatic retry loop (avoiding the brief's
explicitly-warned-against infinite-retry failure mode) — `attempts` is
persisted so a future PR can add bounded retry without a schema change.

## 23. Workflow completion vs business completion

**`Workflow COMPLETED` ≠ automatically `Business Record COMPLETED`.**
This PR integrates no business domain, so there is no code path today
that could conflate the two — but the boundary is structural, not
incidental: a `SYSTEM_ACTION` handler is the ONLY way this package could
ever touch another domain's data, and a handler is a plain function this
package's own composition root registers — Workflow itself contains no
HRMS/Organisation/iClaims/Payroll table names, write paths, or business
rules anywhere. A future handler that mutates a domain record must call
that domain's own authoritative service (mirroring how HRMS's own
`employmentChangeService` calls Organisation's `createAssignment()`
rather than writing `employment_assignments` directly) — this package
enforces that boundary by simply never having any other way to reach
another domain's data.

## 24. Cross-domain transactions

PR #7 established a genuine shared-Postgres-transaction pattern
(`createEmploymentAssignmentServiceForTransaction`) for a REAL need: HRMS
calling Organisation's authoritative mutation atomically. This PR
introduces **no such port**, deliberately: no SYSTEM_ACTION handler
registered by this PR calls another domain's mutating service, so there
is nothing to make atomic yet (brief item 24: "do not automatically wrap
every external action in one giant transaction"). `WorkflowTransaction`
does not expose its raw Postgres connection for the same reason HRMS's
did — a future PR that DOES register a handler needing real
cross-package atomicity should extend `WorkflowTransaction.run(fn)` to
pass the raw connection through (exactly as PR #7's `LifecycleTransaction`
was extended), then have that handler call a transaction-scoping
composition helper on the target domain — the identical, already-proven
pattern, not a new one.

**Documented split**, per brief item 24:
- **Same-database atomic operations** (a future need): a registered
  handler calling another `platform-services/*` domain's mutating
  service — extend `WorkflowTransaction` as above when this is real.
- **Operations requiring idempotent eventual execution** (today's
  reality): the system-action registry's own `UNIQUE(instance_id,
  step_id)` — a handler may be re-invoked after a process crash between
  "handler ran" and "execution row marked SUCCEEDED," so a handler should
  itself be safe to run twice if its own domain lacks an idempotency key;
  this PR's own zero registered handlers means this is not yet exercised
  by real code, only documented as a requirement for whoever registers
  the first one.
- **Future external integrations** (notifications, third-party systems):
  never wrapped in a database transaction at all — see §14.

## 25. Notifications boundary

Workflow does **not** own email/SMS/Teams/Lark delivery, and does not
implement any of it. No notification EVENT/request type or port is
defined in this PR beyond the general-purpose `workflow_events` business
history — a future PR that wants Workflow to REQUEST a notification (e.g.
"task assigned" → notify the assignee) would add a dedicated event type
or a thin port consumed by the (currently scaffolding-only)
`platform-services/notifications`, following the same "coordinate, never
own" boundary as §9/§23. Workflow's own correctness (routing, decisions,
state transitions) never depends on any notification actually being
delivered — nothing in this engine blocks on, retries for, or fails
because of a notification.

## 26. Audit vs workflow history

**Business lifecycle history** (`workflow_events`, append-only,
reconstructable) is distinct from **Identity's security audit**
(`security_audit_events`, security-relevant actions, redacted) — the same
split HRMS established. Every write path (`definitionService`,
`instanceService`, `taskService`) calls `audit.record()` with small,
structured `changeBefore`/`changeAfter` objects
(`{status: 'ACTIVE'} → {status: 'COMPLETED', outcome: 'APPROVED'}`); the
actual narrative content (a decision's `comment`) lives ONLY in
`workflow_decisions.comment`/`workflow_events.notes`, never duplicated
into the generic audit log — verified directly by a unit test asserting a
fictional confidential decision comment never appears anywhere in
`JSON.stringify()` of the accumulated audit events.

## 27. Sensitive data

Workflow stores: subject reference (`subjectType`/`subjectId`, opaque),
routing metadata (assignment mode, assigned user/permission key),
decisions (`APPROVE`/`REJECT`/`RETURN`, an optional comment), and
workflow state (status, current step). It does **not** copy: full HR
files, salary, bank details, medical information, claim receipts, or
privileged Data Vault contents — there is structurally nowhere in this
schema such content could go (no free-form "business data" column exists
beyond the small `context` JSONB, documented as routing metadata only).

## 28. Entity and classification security

Every instance carries `legalEntityId` and `dataClassification`
(defaulting to, and never permitted below, the entity's own ceiling via
`entityCeiling()` — reused unchanged from Organisation's
`classificationCeilingForEntity`). `checkAccess()` (the same
base/`.privileged` two-tier pattern Organisation/HRMS established) gates
`INSTANCE_START`, `INSTANCE_READ`, `INSTANCE_CANCEL`, `APPROVAL_DECIDE`
against that target. A user assigned a task receives only that task's
own minimal fields (§27) — approval assignment never grants unrestricted
access to the underlying business record, because Workflow never stores
one.

## 29. SK Lai & Partners

Treated identically to Organisation/HRMS: `entityCeiling()` caps an SKL
instance's classification at `RESTRICTED`, requiring the `.privileged`
permission tier even for an otherwise Group-wide administrator — verified
directly (unit test and a real-Postgres end-to-end test). System
Administrator (Organisation permissions only, no Workflow permission) is
never implicitly a Workflow definition administrator, instance starter,
or approver — verified directly.

## 30. Workflow administration

Distinct permissions for distinct personas (§31) — no single super-role:
a **definition administrator** (`workflow.definition.*`) need not be an
**approver** (`workflow.approval.decide`) or **operator**
(`workflow.operation.process_escalations`); a **requester**
(`workflow.instance.start`) need not be able to read every instance
(`workflow.instance.read` is separate, though a requester may always read
their own). Publishing requires the specific `workflow.definition.publish`
permission, distinct from `create`/`update` — an editor need not be a
publisher.

## 31. Permissions

Implemented (a trimmed version of the brief's candidate list — see
inline rationale in `src/services/access.ts`):

```
workflow.definition.read
workflow.definition.create
workflow.definition.update
workflow.definition.publish
workflow.definition.retire

workflow.instance.start(.privileged)
workflow.instance.read(.privileged)
workflow.instance.cancel(.privileged)

workflow.task.read.assigned
workflow.task.complete.assigned(.privileged)
workflow.task.reassign(.privileged)

workflow.approval.decide(.privileged)

workflow.operation.process_escalations
```

Definitions are entity-agnostic templates (no `.privileged` variant
needed for `DEFINITION_*` — see §28's "security belongs at the instance
level" reasoning). `TASK_READ_ASSIGNED` has no `.privileged` variant: a
task is only ever visible because its own assignment already passed an
entity/classification-aware check (USER/MANAGER at routing time, ROLE at
read/decision time). Default-deny throughout; every check is server-side
via Identity's existing `rbacService.authorize()`, never re-implemented.

## 32. Database

`database/migrations/005_workflow-approval-foundation/migration.sql` —
the next migration after HRMS's `004`. **No prior migration file is
altered.**

- `workflow_definitions` / `workflow_definition_versions` — §8's model;
  `UNIQUE(definition_id, version_number)`; CHECK constraints enforce
  `published_at`/`retired_at` consistency with `status`.
- `workflow_steps` — `UNIQUE(version_id, sequence_number)`; CHECK
  constraints enforce step-type-specific field requirements
  (`SYSTEM_ACTION` requires a handler key; `APPROVAL`/`TASK` require an
  assignment mode; `ROLE` requires a permission key).
- `workflow_instances` — FKs to `workflow_definitions`,
  `workflow_definition_versions`, `legal_entities`, `employees` (nullable,
  §27's subject-employee reference), `users`; **no FK to any business
  table** for `subject_type`/`subject_id` (§7). Two partial unique
  indexes implement idempotency (§20). CHECK constraints enforce
  `completed_at`/`cancelled_at`/`failure_category` consistency with
  `status`.
- `workflow_tasks` — CHECK constraints enforce `ROLE` mode requires a
  permission key and non-`ROLE` modes require a fixed assignee.
- `workflow_decisions` — `task_id UNIQUE` (§12, §19's core mechanism).
- `workflow_events` — append-only, CHECK-constrained `event_type`.
- `workflow_system_action_executions` — `UNIQUE(instance_id, step_id)`
  (§21's idempotency mechanism).

No Employee, Legal Entity, or business-domain table is created — every
reference to those concepts is a foreign key onto PR #1's/PR #6's
existing tables.

**Seed data:** none.

## 33. Definition version concurrency

`createDraftVersion()` (and the initial version created alongside a new
definition) locks the PARENT `workflow_definitions` row
(`findByIdForUpdate` — `SELECT ... FOR UPDATE`) before computing
`MAX(version_number) + 1` and inserting — never a bare `MAX()+1` without
that lock. `publish()` locks the SPECIFIC version row being published,
which also serializes it against a concurrent step edit on the same
version (both `addStep`/`updateStep`/`deleteStep` and `publish` acquire
the same lock before writing) — a step can never be added to a version
publish just froze. Verified against real Postgres: 5 concurrent
`createDraftVersion()` calls for the same definition produce version
numbers 2–6 exactly, no duplicates, no gaps.

## 34. API

```
/api/v1/workflow/definitions            GET (list) / POST (create)
/api/v1/workflow/definitions/:id        GET
/api/v1/workflow/definitions/:id/versions   POST (open a new DRAFT version)
/api/v1/workflow/versions/:id           GET (with its steps)
/api/v1/workflow/versions/:id/steps     POST (add a step)
/api/v1/workflow/versions/:id/steps/:stepId   PATCH / DELETE
/api/v1/workflow/versions/:id/publish   POST
/api/v1/workflow/versions/:id/retire    POST
/api/v1/workflow/instances              GET (list, filtered) / POST (start)
/api/v1/workflow/instances/:id          GET
/api/v1/workflow/instances/:id/events   GET (business history)
/api/v1/workflow/instances/:id/cancel   POST
/api/v1/workflow/tasks                  GET (assigned to me / ROLE-eligible)
/api/v1/workflow/tasks/:id              GET
/api/v1/workflow/tasks/:id/decide       POST
/api/v1/workflow/tasks/:id/complete     POST (TASK-type only)
/api/v1/workflow/tasks/:id/reassign     POST
/api/v1/workflow/operations/process-escalations   POST
```

Every route allowlists exactly the client fields it accepts —
`id`/`status`/`createdBy` are always server-assigned, verified by a
mass-assignment integration test. No generic "update any workflow
object" endpoint exists.

## 35. Definition validation

Publishing validates (application code, in `definitionService.ts`):
at least one step exists; sequence numbers are contiguous from 1 with no
gaps/duplicates; every non-`SYSTEM_ACTION` step has an `assignmentMode`;
`ROLE` mode has an `assignedPermissionKey`; every `APPROVAL` step has at
least one permitted decision; `RETURN` is never permitted on the first
step (there is no previous step to return to); every `SYSTEM_ACTION`
step's `handlerKey` is registered. Terminal behaviour needs no explicit
per-definition field: the engine's own last-step-completes-the-instance
rule (§11) applies uniformly. An invalid definition never publishes —
verified directly by seven distinct unit tests, one per validation rule.

## 36. Instance snapshot integrity

An instance's `versionId` is fixed at `startWorkflow()` time and never
changes. If v2 is published while v1 instances are running: v1 instances
continue using v1 (their own `versionId`, `workflow_steps` immutably tied
to that version row); new instances started after v2's publish use v2
(§8: "the latest PUBLISHED version" resolution always picks the highest
`version_number` with `status='PUBLISHED')`; historical decisions remain
attributable to v1 (`workflow_decisions`/`workflow_events` reference the
instance, whose `versionId` never changes). Verified directly by a unit
test: `createDraftVersion` opens v2 while re-fetching v1 confirms it
remains `PUBLISHED`, structurally unaffected.

## 37. Requester and subject actor

Distinguished explicitly: `requesterUserId` (who called `startWorkflow`),
`subjectEmployeeId`/`subjectActorUserId` (who/what the workflow concerns
— resolved from the employee link when not explicitly supplied),
`assignedUserId` (a task's fixed assignee, when applicable), and
`actorUserId` (who actually decided, recorded on `workflow_decisions`).
These are never assumed to be the same person — the self-approval checks
(§15) exist precisely because the subject actor and the assignee can
otherwise coincide.

## 38. API security / IDOR

`getInstance`/`getTask` return the identical `NotFoundError` for "exists
but you may not see it" and "does not exist" — verified directly (unit
and real-HTTP). List endpoints (`listInstances`, `listAssignedTasks`)
filter server-side by re-checking access per candidate row, never trusting
a client-supplied filter as an authorization boundary. Approval comments
are visible only through the same read-access check as the rest of the
instance — no separate, laxer path exposes them.

## 39. Tests

**Workflow package** (`platform-services/workflow/`) — 51 tests total:

- `test/unit/definitionService.test.ts` (14 tests, in-memory) — permission
  denial (including System-Admin-is-not-Workflow-Admin); definition
  creation; every one of §35's seven publish-validation rules (zero
  steps, sequence gap, no permitted decisions, RETURN-on-first-step,
  unregistered/registered system action, valid publish); PUBLISHED-
  version immutability (add/update/delete all rejected); `createDraftVersion`
  + v1-unaffected-by-v2 (§36); retire-only-from-PUBLISHED; NotFoundError
  for nonexistent ids.
- `test/unit/instanceService.test.ts` (21 tests, in-memory) — permission
  denial; unregistered subject type; no-published-version; successful
  start + first-task creation; MY-does-not-imply-SG; SG-HQ-does-not-imply-
  SKL; idempotency-key replay; natural-uniqueness-invariant; MANAGER
  routing via Organisation (real reporting-line fixture) + decide;
  MANAGER-no-resolvable-manager routing failure; USER self-approval
  routing failure; non-assignee cannot decide; decision outside permitted
  set rejected; decision immutability (double-decide rejected); REJECT
  completes as REJECTED; RETURN reactivates the previous step with full
  history reconstructable (3 decisions across the return cycle); cancel
  protects the pending task + terminal-instance protection; IDOR; plain
  TASK-type completion (no decision row); SYSTEM_ACTION success (handler
  invoked exactly once) and failure (`SYSTEM_ACTION_FAILURE`, never
  falsely `COMPLETED`).
- `test/unit/roleRoutingAndEscalation.test.ts` (4 tests, in-memory) — ROLE
  eligibility (holder can decide, non-holder sees nothing); ROLE
  self-approval refused at decision time; `processDueEscalations`
  reassigns to the assignee's manager exactly once (second sweep is a
  no-op); decision-comment audit redaction.
- `test/integration/postgres.test.ts` (5 real-Postgres tests) — CHECK
  constraints (`status`, `failure_category` consistency); 5 concurrent
  `createDraftVersion` calls produce version numbers 2–6 with zero
  duplicates; 3 concurrent `decide()` calls on one task produce exactly
  one committed decision (verified via `SELECT count(*)`); a full
  definition→publish→start→decide flow committing real rows across every
  table, including JSONB `context` round-tripping; SK Lai & Partners
  privileged-tier end-to-end. The two concurrency tests were re-run five
  times consecutively with zero flakes.
- `test/integration/http.test.ts` (6 real-HTTP tests) — unauthenticated/
  invalid-token denial; a full definition-to-decision flow over real HTTP
  including history reconstruction; mass-assignment rejection; IDOR/
  existence-leak check; malformed-input rejection.

**Organisation package**: one additive capability
(`resolveDirectManagerUserId`, §4) — full suite (66/66) re-verified
unaffected.

**Identity, Data Vault, HRMS packages**: untouched by this PR — full
suites (96/96, 46/46, 46/46 respectively) pass unchanged.

All fixture users/employees across every test file use invented, clearly-
labelled fictional identities — never a real SVE staff member.

## 40. Regression testing

Identity (96/96), Data Vault (46/46), Organisation (66/66), and HRMS
(46/46) were all re-run on a fresh CI-equivalent Postgres database after
this PR's changes, alongside Workflow's own 51/51 — all green, zero
weakened tests.

## 41. CI

`.github/workflows/ci.yml` gained one new job, `validate-workflow`,
mirroring `validate-hrms`'s exact pattern (real Postgres service, install
Identity's dependencies, then Organisation's (Workflow imports its
manager-routing service), then Workflow's own, typecheck/migrate/test).
All six pre-existing jobs (`validate-svegip`, `validate-platform-
contracts`, `validate-identity`, `validate-data-vault`,
`validate-organisation`, `validate-hrms`) remain unmodified. Final job
count: 7.

## 42. Future integration boundaries (explicitly not built here)

- **HRMS**: a future PR would have HRMS `startWorkflow()` for
  onboarding/probation/employment-change/offboarding approvals, using
  `subject_type='hrms.lifecycle'` (already registered, illustratively,
  in `src/domain/subjectType.ts`) and a registered SYSTEM_ACTION handler
  calling HRMS's own case-completion service — never Workflow writing to
  `hr_lifecycle_cases` directly.
- **Identity deactivation**: `identity.request_deactivation` remains
  illustrative only, per HRMS's own established "request via event, never
  mutate" boundary.
- **iClaims / Payroll / Data Vault**: same pattern — a future PR
  registers a handler calling that domain's own authoritative service.
- **Notifications**: §25 — a thin request/port, not delivery
  infrastructure.
- **Delegation**: §16 — the extension point is documented, not built.
- **Scheduler infrastructure**: `processDueEscalations()` is
  scheduler-agnostic; no AWS/EventBridge/cron exists in this PR.

## 43. Explicitly out of scope

A visual workflow designer, BPMN, arbitrary DAG/parallel-branch execution,
arbitrary scripting or an expression-language engine, arbitrary HTTP
callbacks, a distributed transaction manager, Kafka/event-bus
infrastructure, an AWS scheduler, full Notifications delivery, a full
delegation framework, HRMS business rules, Leave, Attendance, Payroll,
Payslips, iClaims, Accounting Pro, performance/appraisal, recruitment,
document storage, a policy-management system, production deployment,
Netlify cutover, and escrow. None of these exist anywhere in this PR's
diff.

## 44. Remaining risks / open questions

- **ROLE-mode "no eligible approver" is not detectable at routing time**
  (§15) — a documented, deliberate limitation rather than building a
  reverse role-membership index this foundation does not yet need.
- **Escalation's only supported target strategy is
  `REASSIGN_TO_ASSIGNEE_MANAGER`** — a richer strategy set (e.g. escalate
  to a specific role) can be added to the `EscalationTargetMode` enum
  without a schema migration once a real use case demands it.
- **No administrative correction/reopen mechanism** exists for a terminal
  instance/task, matching the brief's own "not required in this PR"
  guidance — the same open item HRMS recorded for its own lifecycle
  cases.
- **`INFRASTRUCTURE_FAILURE` is defined but never set** by any code path
  in this PR — reserved for a future scheduler/delivery-layer integration.
- **Cross-package atomic system actions are a documented pattern, not
  built code** (§24) — the extension point is proven (PR #7's
  precedent), but nothing in this PR exercises it, since zero real
  handlers are registered.
- **List authorization runs in application code, per candidate row**, not
  pushed into the SQL `WHERE` clause — the same open item already
  recorded for Data Vault, Organisation, and HRMS, now shared by a fourth
  package.
- **Cross-package source imports remain a documented, intentional
  coupling** — the same open item already recorded for the three
  packages before it.
- **`USER`/`MANAGER`-mode deciders need no separate RBAC permission
  beyond being the fixed assignee** — `checkEligibility()` only checks
  `assignedUserId === actor.userId` for these two modes; there is no
  additional `workflow.approval.decide` check layered on top (unlike
  `ROLE` mode, which IS gated by a live permission check, §13). This
  mirrors Organisation's own `read.team` design (being someone's manager
  is itself the authorization, not a substitute for one) and is safe
  under this PR's data model specifically because a task carries only
  minimal fields (§27, §28) — but a future integration that needs
  finer-grained control over WHO may act as a MANAGER/USER-mode assignee
  (e.g. requiring they also hold a business permission) would need an
  explicit additional check at that integration's own definition/step
  level, not a change to this foundation's routing engine.
