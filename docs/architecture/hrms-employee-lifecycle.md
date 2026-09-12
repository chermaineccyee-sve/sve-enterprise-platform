# SVE HRMS Employee Lifecycle Foundation (PR #7)

Status: **implemented, PR draft, not deployed.** This document records what
was built, why, and what is deliberately still open. **This PR is not the
full HRMS.** It implements the lifecycle-case backbone (Onboarding →
Probation → Confirmation/Extension → Employment Change → Offboarding)
that governs *which HR process is currently happening* to an employee —
it consumes, and never duplicates, the Employee Master established by PR
#6.

## 1. Domain boundary

```
Identity                Who can access the platform?
    ↓ (dependency: HRMS reads Identity's session/RBAC/audit contracts)
Organisation /           Who is the employee? Where are they employed?
Employee Master          What entity/department/position/manager?
    ↓ (dependency: HRMS reads Employee Master identifiers and invokes its
    ↓  authoritative assignment-transition service; HRMS never owns or
    ↓  duplicates this data)
HRMS Employee            What HR lifecycle process is currently happening
Lifecycle (this PR)      to that employee? What decisions/milestones/
                         records govern that process?
```

**HRMS creates no Employee table, no Legal Entity table, and no
Employment Assignment table.** Every lifecycle case references an
`employee_id` (FK into PR #6's `employees`) and a `legal_entity_id` (FK
into PR #1's `legal_entities`) — it never stores a copy of employee
identity, employment dates, or assignment fields. Completing an
employment-change or offboarding case *invokes* Organisation's own
`employmentAssignmentService.createAssignment()`/`endAssignment()` — it
never writes to `employment_assignments` directly, bypasses Organisation's
integrity rules, or reimplements its effective-dating/reporting-cycle/
one-open-primary logic.

## 2. Existing code inspected before designing this PR

Verified directly against `main` at merge commit `3cf258fd670ce85d6c7e7c70ab4ee5c4b56b424c`
(PR #6), not assumed from prior documentation:

- `platform-services/organisation` already owns Employee Master in full:
  `employees`, `employment_assignments` (effective-dated, with the
  one-open-primary partial unique index and reporting-cycle/currency
  checks from PR #6's three review corrections), `business_units`/
  `departments`/`positions`, and `user_employee_links`. Its
  `EmploymentAssignmentService` exposes `createAssignment`/`endAssignment`/
  `listAssignments`/`isDirectManagerOf` — all four are consumed by this PR;
  none are reimplemented.
- `platform-services/organisation/src/services/entityClassification.ts`
  already isolates the one SK Lai & Partners structural fact
  (`classificationCeilingForEntity`/`restrictedFieldClassificationCeiling`)
  — reused directly by HRMS (§10), not re-derived.
- `platform-services/hrms/README.md` (PR #3 scaffold, unimplemented) had
  described itself as the future home of "employee master" — now stale
  relative to PR #6's decision that Employee Master lives in Organisation.
  Corrected in this PR's README update (§16).
- `database/migrations/001_identity-foundation` (users, legal_entities,
  RBAC tables), `002_data-vault-foundation` (untouched by this PR),
  `003_organisation-employee-master` (employees, employment_assignments,
  business_units/departments/positions, evolved `user_employee_links`) —
  all referenced by FK from this PR's new migration, none altered.
- `platform-services/identity`'s `rbacService.authorize()`,
  `auditService.record()`, `sessionService`, and `pgDatabaseProvider`'s
  `transaction()` (including the process-wide `date`-OID type-parser fix
  from PR #6's final correction) are reused unchanged.
- `apps/svegip/app.js`'s "People" page has purely static "Onboarding" and
  "Policy Acknowledgement" cards labelled "Planned production module" —
  no backend, no data model, nothing to migrate. `employee_accounts`
  (`apps/svegip/netlify/database/migrations/001_employee-accounts`) is
  identity/RBAC only (email/name/role/unit/status/permissions/password) —
  confirmed to carry no lifecycle concept of any kind.
- CI (`.github/workflows/ci.yml`) had five jobs after PR #6
  (`validate-svegip`, `validate-platform-contracts`, `validate-identity`,
  `validate-data-vault`, `validate-organisation`) — all preserved
  unmodified; one new job added (§15).

## 3. Module ownership and dependency direction

```
platform-services/
├── identity/        identity/access/session/MFA/audit only — no HRMS
│                     knowledge anywhere in it
├── organisation/     organisation structure + Employee Master — no HRMS
│                     knowledge anywhere in it; unchanged except one
│                     additive capability (§4)
└── hrms/             lifecycle case domain, repositories, services,
                       API/routes, tests — this package; depends on both
                       Identity's and Organisation's contracts, by source
                       import, exactly mirroring how Organisation already
                       depends on Identity's
```

`platform-services/hrms/src/composition/container.ts` is this package's
own composition root (on the dependent side, following the PR #5/#6
lesson): it imports Identity's Postgres repositories/session/RBAC/audit
services directly (the same pattern Organisation already established), and
consumes **Organisation as a whole container**
(`createOrganisationContainer(db)`) rather than reaching into
Organisation's repositories directly — HRMS only ever calls Organisation's
*service*-level contracts (`assignments.createAssignment`/`endAssignment`/
`isDirectManagerOf`, `employees.createEmployee` in tests only). No SVEGIP
session-cookie bridge exists here, for the same reason Organisation has
none: no existing `apps/svegip` page authenticates against this API today.

## 4. One additive change to Organisation

`EmploymentAssignmentService` gained one new, read-only, side-effect-free
method: `isDirectManagerOf(actorUserId, employeeId): Promise<boolean>` —
extracted from the private helper `employeeService.ts`'s `getEmployee()`
already used internally for its own `read.team` fallback, now exposed so
HRMS's own manager/"team" fallback (§11) can reuse Organisation's
authoritative reporting-line data rather than re-deriving it. Required
adding `users: UserRepository` to `createEmploymentAssignmentService`'s
dependencies (previously not needed by that service). This is the *only*
change to Organisation's public surface in this PR; its own full test
suite (66/66) was re-verified unaffected.

## 5. Lifecycle case model

One universal table, `hr_lifecycle_cases`, covers all four lifecycle
types — not a table per type. A case's identity (employee, legal entity,
initiated date, HR owner, current status/stage) is universal; the
handful of type-specific fields are either reused generic slots
(`caseSubtype`, `effectiveDate`, `reasonCategory`) or two offboarding-only
nullable columns (`noticeDate`, `intendedLastWorkingDate`) — never a
satellite table for two columns. See §21 for the full schema.

**Confirmation and probation extension are DECISION OUTCOMES of a
probation review, not independent lifecycle types** (PR brief item 5's
explicit question). A probation case's `recordDecision()` accepts
`CONFIRMED | EXTENDED | UNSUCCESSFUL` as the decision value on a review
row — there is no separate "confirmation case" or "extension case" type.
This is the cleaner model: confirmation/extension have no independent
existence outside the probation review they conclude, and modelling them
as separate lifecycle types would require synthetic cross-case linkage to
reconstruct what is naturally one continuous process.

**Business lifecycle history lives in `hr_lifecycle_events`, an
append-only table — never a mutable `notes` column on the case itself**
(the case row was deliberately given no free-text notes field at all).
Every substantive/decision-bearing piece of narrative content (a
recommendation, a decision's rationale, a termination reason detail) is
recorded as an event, timestamped and attributed to whoever recorded it —
this is what makes lifecycle history reconstructable (PR brief item 12),
and it is explicitly **not** the same store as Identity's
`security_audit_events` (§14).

## 6. Onboarding

The thinnest of the four types: a case plus a checklist of milestones
(`hr_lifecycle_milestones` — `milestoneType` is free text, not a fixed
enum; callers supply whichever of documentation/policy-acknowledgement/
employee-information/reporting-line-confirmation/system-access-request/
equipment/induction/approvals/completion — PR brief item 6's candidate
list — suit the case). Creating an onboarding case immediately moves it
`DRAFT → IN_PROGRESS` (milestones are already being tracked at that
point) and, optionally, seeds initial milestone rows atomically with the
case. Completing an onboarding case uses the generic `complete` action
(§9) — onboarding has no separate "decision" step the way probation does.

**This is not a workflow engine.** No approval chains, no conditional
branching, no due-date escalation, no notification dispatch exist in this
PR. `hr_lifecycle_milestones.reference` is a plain text field reserved for
a future service (a policy-acknowledgement-service record id, a
document-service reference) to populate — HRMS never stores or interprets
what that reference points to. If a future
`platform-services/workflow` engine is built, the intended integration is:
workflow owns approval routing/steps: a milestone becomes "the workflow's
own task record" is out of scope; the minimal domain model here (a
milestone with a status and an optional external reference) is what a
future orchestrator would read and write via this package's API, not
something HRMS needs to change to accommodate it.

## 7. Probation, confirmation, and extension

**No universal probation duration is assumed anywhere in this codebase.**
`hr_probation_reviews.period_start`/`expected_review_date` are always
supplied by the caller — never `3 months`, never `3+3 months`, never any
Malaysia/Singapore-specific default. Different legal entities/employment
arrangements may use different terms; the system records what it is told.

### Extension integrity (PR brief item 8)

One row per probation **period** — the original, plus one additional row
per extension, distinguished by `sequence_number` (1, 2, 3, ...). An
extension **inserts a new row**; it never updates the prior period's
`period_start`/`expected_review_date`. "Current" is simply the row with
the highest `sequence_number` for a case — no redundant `is_current` flag
is stored, avoiding a second source of truth that could drift from
sequence ordering. This exactly reconstructs the brief's own example:

```
sequence 1: period_start=2026-02-10, expected_review_date=2026-05-10,
            decision=EXTENDED, decision_date=2026-05-05
sequence 2: period_start=2026-05-10, expected_review_date=2026-06-10,
            decision=CONFIRMED, decision_date=2026-06-01
```

Both rows persist forever, in full, after the case completes — verified
directly (unit and real-Postgres tests) by reading the full review history
back after a CONFIRMED decision and asserting the first row's own
`decision` field still reads `EXTENDED`, never overwritten.

### Decision recorded exactly once (PR brief item 27's explicit test)

`pgProbationReviewRepository.recordDecision()`'s `UPDATE ... WHERE id = $1
AND review_status = 'PENDING'` guard means a second decision attempt on an
already-decided review returns zero rows, and the service layer treats
that as an error — never a silent overwrite. `recommendation`/
`decision`/`decision_notes`/`decision_date`/`decided_by` are set together,
exactly once, in one atomic write.

### Effective-date semantics

`recordDecision()`'s outcome:
- `CONFIRMED`/`UNSUCCESSFUL` — the case transitions to `COMPLETED`, with
  `outcome` set to the decision and `effectiveDate` set to the supplied
  `decisionDate`.
- `EXTENDED` — the case's status is a same-status no-op (it was already
  `IN_PROGRESS`; extension does not need a formal status transition — see
  §9's state-machine note on why a same-status "transition" is legal for
  non-terminal statuses), a new review row is created for the next period,
  and a `probation_extended` event is appended.

All three (review decision write, optional new-period row, event, and any
case-status change) commit in one real Postgres transaction
(`LifecycleTransaction`, §13).

## 8. Employment change

Represents the HR **process and decision** leading to a change — never
competing assignment-history logic. `createChangeCase()` opens a case with
`caseSubtype` set to the caller-supplied change type (promotion, transfer,
department_change, position_change, reporting_change, work-location
change, employment-type change, legal-entity transfer where structurally
appropriate — PR brief item 9's candidate list, stored as free text, not a
closed enum, for the same "future values this foundation cannot
anticipate" reasoning as `employment_assignments.employment_type`).
`completeChange()` invokes Organisation's own
`employmentAssignmentService.createAssignment()` unmodified — every
integrity rule PR #6 already enforces (effective-dating, one-open-primary,
reporting-cycle/currency checks, entity/permission checks) applies exactly
as before; this file adds no parallel validation of its own for those
concerns.

**Transaction boundary (see §13 for the full reasoning):** Organisation's
`createAssignment()` is called *before* any HRMS-side write; if it throws,
the case remains `IN_PROGRESS` and nothing else is recorded — verified
directly by a test that forces the call to fail and asserts the case is
never marked `COMPLETED`. Only once it succeeds does HRMS record its own
completion (case status, `outcome`, `effectiveDate`, and
`resultingAssignmentId` — a plain FK reference to the real
`employment_assignments` row Organisation created) in one atomic HRMS-side
transaction, alongside two events (`employment_change_authorised`,
`employment_change_completed`) capturing the decision and its execution as
distinct, timestamped history entries even though both happen within one
API call.

## 9. Offboarding

Neutral and jurisdiction-agnostic. `createOffboardingCase()` accepts a
free-text `separationType` (resignation/retirement/end_of_fixed_term/
termination/other), `noticeDate`, `intendedLastWorkingDate`, and an
optional list of clearance-milestone types (reusing the SAME
`hr_lifecycle_milestones` table as onboarding — access-removal,
asset-return, and final-documentation "clearance milestones" are simply
milestone rows with different `milestoneType` values, not a second table).
**No Malaysian/Singapore termination-law calculation, no final-salary
computation, no notice-pay computation, no statutory-severance
computation exists anywhere in this file** — those require future
jurisdiction/payroll/legal-policy layers this foundation deliberately does
not build.

### Consistency with Employee Master and Identity (PR brief item 11 — critical)

**Employment ended ≠ Identity record deleted.** `completeOffboarding()`:

1. Ends the authoritative employment assignment through Organisation
   (`orgAssignments.endAssignment()`) — same two-phase, no-false-completion
   transaction boundary as employment change (§8, §13).
2. Updates the case's own lifecycle status/outcome/effective date.
3. Records a `identity_deactivation_requested` **event** — a durable,
   auditable request that a human administrator (or a future Workflow/
   Approval service) should deactivate the departing employee's Identity
   account.

**It never calls any Identity mutation API, and never deletes anything.**
No code path in this package, or invoked by it, can delete a `users` row —
Identity's `UserRepository` interface exposes no delete method at all, so
this is a structural guarantee, not merely an intentional omission.
Verified directly: a real-Postgres/HTTP test links an Identity user to the
departing employee, completes offboarding, and asserts that user's row
still exists with `status: 'active'` afterward — completing offboarding
never itself disables the account, only records that it should be
reviewed. Full automated deactivation orchestration is left to a human
administrator today, or a future Workflow/Approval service — this event is
the safe, documented boundary such a service would consume.

## 10. Malaysia/Singapore/SK Lai & Partners

No hard-coded probation rules, statutory notice periods, leave
entitlements, retirement ages, termination benefits, tax, EPF, SOCSO,
CPF, or payroll formulas exist anywhere in this package.
`hr_lifecycle_cases.legal_entity_id` carries sufficient jurisdiction
context (via Organisation's own `LegalEntity.jurisdiction`) for a future
rules engine to consult — this PR consumes that context, it does not
interpret it.

SK Lai & Partners continues to be treated as a distinct, more strongly
segregated legal entity — never an ordinary SVE business unit.
`access.ts`'s `baseCeiling`/`restrictedCeiling`/`decisionCeiling` reuse
Organisation's `classificationCeilingForEntity`
(`sk-lai-partners-my` → `RESTRICTED`) **unchanged** — the SKL structural
fact is isolated to that one Organisation file, never duplicated here.
Every HRMS permission check (§11) follows the same ordinary/`.privileged`
two-tier pattern PR #6 already established, so a Group-wide HR
administrator holding only the ordinary (`CONFIDENTIAL`-ceilinged)
permission is denied access to an SKL lifecycle case — verified directly
against real Postgres (§18): creating an SKL onboarding case fails for a
non-privileged Group-wide HR user and succeeds only once the
`.privileged` permission (ceilinged at `RESTRICTED`) is explicitly
granted. **System Administrator ≠ HR Administrator** is exercised the
same way PR #6 exercised it for Employee Master: a user holding
Organisation's own permissions but zero HRMS permissions is denied every
HRMS read/write.

## 11. Permissions model

A minimum, derived set — not a mechanical copy of the brief's candidate
list. All default-deny, all enforced server-side, all reusing Identity's
unmodified `rbacService.authorize()`:

```
hrms.lifecycle.read[.privileged]                    base case metadata
hrms.lifecycle.read.team                             manager direct-report fallback (base tier only)
hrms.lifecycle.read.restricted[.privileged]          restricted HR fields (§12)
hrms.lifecycle.read.decision[.privileged]            highly-restricted decision/notes content (§12)
hrms.lifecycle.create[.privileged]                   open a new lifecycle case
hrms.lifecycle.manage_onboarding[.privileged]        onboarding milestones
hrms.lifecycle.manage_probation[.privileged]         probation reviews/decisions/extensions
hrms.lifecycle.manage_employment_change[.privileged] initiate + complete an employment change
hrms.lifecycle.manage_offboarding[.privileged]       initiate + complete offboarding
hrms.lifecycle.complete[.privileged]                 generic completion (onboarding) and cancellation of any case
```

Two deliberate simplifications from the brief's candidate list (both
documented here rather than silently applied):

- **No generic `update` permission.** Every mutation is already covered by
  a specific action (`manage_onboarding`'s milestone updates,
  `manage_probation`'s decision recording, `manage_employment_change`'s/
  `manage_offboarding`'s completion) — a generic `update` would be
  ambiguous about which fields it authorises and was dropped as
  redundant.
- **No standalone `record_decision` permission.** Each lifecycle type's
  own `manage_*` permission already covers recording decisions/milestones
  *within that type* — a cross-cutting `record_decision` key would only
  duplicate authority already granted by the type-specific permission.
- **`complete`/`cancel` share one permission.** Both are terminal,
  case-closing actions; no meaningful distinction was found between
  authorising one versus the other.

## 12. Data sensitivity — three tiers, not two

Employee Master (PR #6) uses two tiers (directory vs. restricted). HRMS
data is generally more sensitive than an employee directory (PR brief item
17), so a third tier was added:

- **Base** (`hrms.lifecycle.read[.privileged]`): case exists, `caseNumber`,
  `employeeId`, `legalEntityId`, `lifecycleType`, `status`, `initiatedAt`,
  `hrOwnerUserId`.
- **Restricted** (`hrms.lifecycle.read.restricted[.privileged]`, one tier
  above base — reuses Organisation's own `restrictedFieldClassificationCeiling`
  unchanged): `caseSubtype`, `currentStage`, `effectiveDate`, `outcome`,
  `reasonCategory`, `noticeDate`, `intendedLastWorkingDate`,
  `resultingAssignmentId`, milestone `notes`, probation review `decision`/
  `decisionDate`/`responsibleManagerUserId`/`responsibleHrOwnerUserId`, and
  event `eventData`.
- **Decision** (`hrms.lifecycle.read.decision[.privileged]`, one tier above
  restricted — `decisionCeiling()` in `access.ts`; stays capped at
  `RESTRICTED` for SK Lai & Partners, the same capping Organisation already
  applies, since there is no tier above `RESTRICTED` in use for SKL):
  event `notes`, probation review `recommendation`/`decisionNotes`. A
  caller who can see a case at all, and even one who can see its
  restricted fields, is **never** thereby entitled to decision-tier
  content — verified directly (unit and HTTP tests) that a directory-level
  viewer's serialized response never contains a fictional recommendation/
  decision-notes string anywhere in the JSON.

**No salary, bank details, tax identifiers, medical information,
government identifiers, or statutory contribution data exists anywhere in
this schema or codebase** (PR brief item 17).

## 13. Transaction boundaries

Following PR #6's own lesson (authoritative multi-record writes must be
atomic, never delete-after-failure compensation):

- **Case creation + initial event (+ any type-specific additional write)**:
  `LifecycleTransaction.run(fn)` — a real Postgres transaction (mirrors
  Organisation's `EmployeeCreationTransaction` exactly), constructing
  case/event/milestone/review repositories scoped to the same connection.
  A forced failure inside `additionalWrites` (verified: an invalid FK on a
  probation review's `responsibleHrOwnerUserId`) leaves no orphan case
  row.
- **Probation decision + optional extension row + event + case status**:
  same transaction wrapper, one atomic unit.
- **Employment-change/offboarding completion**: **two-phase**, not a
  single ACID transaction spanning both packages. `DatabaseProvider.
  transaction()` (the same primitive Identity/Data Vault/Organisation
  already use) explicitly does not support nesting
  (`pgDatabaseProvider.ts`'s transactional `tx.transaction()` throws
  "Nested transactions are not supported."), and Organisation's own
  `createAssignment()`/`endAssignment()` already open their own real
  transaction internally — so HRMS cannot wrap Organisation's write and
  its own case-completion write in one shared transaction without either
  modifying that shared, already-reviewed primitive (rejected — too broad
  a change for this PR) or duplicating Organisation's transaction logic
  inside HRMS (rejected — exactly the "competing assignment-history
  logic" the brief forbids). Instead: **call Organisation first; only on
  success does HRMS commit its own completion.** If Organisation's call
  throws, this method propagates immediately and writes nothing — the case
  is never left saying `COMPLETED` while the authoritative change failed.
  Verified directly (unit and real-Postgres tests): forcing Organisation's
  call to fail (an invalid legal entity for employment change; a missing
  Organisation permission for offboarding) leaves the case at
  `IN_PROGRESS` with `resultingAssignmentId` still `null`.

**Known residual risk of the two-phase design** (documented, not hidden):
if Organisation's write succeeds but the subsequent HRMS-side completion
write then fails (e.g. a transient database error), the authoritative
change has already happened but the case will not show `COMPLETED`. This
is the *safe* failure direction — never a false `COMPLETED` — but leaves a
recoverable inconsistency (the case under-reports its own true state)
rather than a fully atomic guarantee across both packages. See §22.

## 14. Audit model

Identity's existing `auditService.record()` (unchanged) continues to
receive every security-relevant HRMS action: `hrms.lifecycle.case_created`,
`hrms.lifecycle.access.denied`, `hrms.lifecycle.restricted_viewed`,
`hrms.lifecycle.milestone_completed`, and — via the generic
`transitionCase()` primitive — one `hrms.lifecycle.<event_type>` audit
action per state transition (`decision_recorded`, `probation_extended`,
`employment_change_completed`, `separation_effective`, `case_completed`,
`case_cancelled`, etc.).

**Audit entries never carry full probation comments, termination reasons,
or confidential HR notes.** Every audit call site passes only small,
structured `changeBefore`/`changeAfter` objects (e.g. `{status: 'IN_
PROGRESS'} → {status: 'COMPLETED', outcome: 'CONFIRMED'}`) — the actual
narrative content (recommendation text, decision rationale, termination
detail) lives *only* in `hr_lifecycle_events.notes`/`hr_probation_reviews.
recommendation`/`decisionNotes`, gated at the decision tier (§12), never
duplicated into `security_audit_events`. Verified directly by a unit test
asserting a fictional confidential decision-notes string never appears
anywhere in `JSON.stringify()` of the accumulated audit events.

**Business lifecycle history and security audit history are deliberately
different stores** (PR brief item 12): `hr_lifecycle_events` is the
reconstructable, queryable business record (who initiated onboarding, when
probation was extended, when a change was authorised); `security_audit_
events` remains the security-relevant action log Identity, Data Vault, and
Organisation already share. Neither is a substitute for the other.

## 15. API

All routes are under `/api/v1/hrms/lifecycle/`, following the established
`/api/v1` envelope conventions, served by this package's own standalone
HTTP server (not mounted into Identity's, Data Vault's, or Organisation's).
Only routes justified by this foundation exist — no Payroll, Leave,
Attendance, or Performance routes.

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/cases` | List (server-side filtered/masked per caller, §12) / create (dispatches to the appropriate type-specific service by `lifecycleType`) |
| GET | `/cases/:id` | Read a single case (masked per caller) |
| POST | `/cases/:id/complete` | Generic completion (onboarding; also usable for any type as a manual close) |
| POST | `/cases/:id/cancel` | Cancel |
| GET | `/cases/:id/events` | Business lifecycle history (masked per caller) |
| GET / POST | `/cases/:id/milestones` | List / add a milestone (onboarding or offboarding, resolved from the case's own `lifecycleType`) |
| PATCH | `/cases/:id/milestones/:milestoneId` | Update a milestone's status |
| GET | `/cases/:id/probation-reviews` | List a probation case's full review history (masked per caller) |
| POST | `/cases/:id/probation-decision` | Record a probation decision (confirm/extend/unsuccessful) |
| POST | `/cases/:id/employment-change/complete` | Execute the change through Organisation and complete the case |
| POST | `/cases/:id/offboarding/complete` | End the assignment through Organisation and complete the case |

Every route allowlists exactly the client fields it accepts — `id`,
`caseNumber`, and `status` are always server-assigned, verified by a
mass-assignment integration test that a spoofed `id`/`caseNumber`/`status`
in a create request is never honoured.

## 16. Manager and employee self-service boundaries

**Manager (`read.team`) access is base-tier only** — a manager can see
that a lifecycle case exists for a direct report (via Organisation's newly
-exposed `isDirectManagerOf()`, §4) and its status/stage, never its
restricted or decision-tier fields. This is deliberately narrower than a
full "manager can see everything about their team" model — a manager
needing to act on a probation review still requires an explicit
`manage_probation`/`read.restricted` grant, not merely being someone's
manager.

**Employee self-access is a partial bypass — base + restricted tiers,
never decision** (PR brief item 20). An employee whose linked record
(via `user_employee_links`, resolved through Identity's `UserRepository`)
matches a case's `employeeId` sees their own onboarding tasks, their
probation status "at an appropriate level" (the review's `decision`/
`decisionDate`, since those are restricted-tier), and their assigned
offboarding milestones — but never a manager's recommendation or HR's
internal decision notes about their own case, even though it concerns
them. Verified directly: a unit test links a fictional employee's Identity
user, records a CONFIRMED probation decision with recommendation/decision-
notes text, and asserts the self-linked user's `canReadRestricted` is
`true` while `canReadDecision` is `false`.

No full Employee Self-Service or Manager Self-Service interface is built
in this PR — only the API/domain boundary such an interface would need.

## 17. Documents and policy acknowledgements

No document storage, no binary/base64 blobs, anywhere in this schema.
`hr_lifecycle_milestones.reference` is a plain text field — a future
Document Service or policy-acknowledgement service's own record id — that
this package stores and returns but never interprets or validates the
shape of. No Lark-style acknowledgement workflow, no policy-management
system, exists here.

## 18. Tests

**HRMS package** (`platform-services/hrms/`):
- `test/unit/lifecycleCaseService.test.ts` (12 tests, in-memory) —
  permission-denied case creation; authorised creation; System-Admin-
  without-HRMS-permission denial; MY-does-not-imply-SG; SG-HQ-does-not-
  imply-SKL; IDOR-identical-error; self-access base+restricted-never-
  decision; manager read.team base-tier-only; invalid state transitions
  (including a completed case rejecting further completion/cancellation);
  mass-assignment defence; malformed-input rejection; audit-content
  redaction.
- `test/unit/probationService.test.ts` (4 tests, in-memory) — extension
  preserves original history while completing via the extended period;
  decision-recorded-exactly-once; an unsuccessful outcome completes with
  no successor review; no universal duration assumed (an unusual
  caller-supplied period is stored as-is).
- `test/unit/employmentChangeAndOffboarding.test.ts` (4 tests, in-memory)
  — a successful change creates the real Organisation assignment and
  completes the case; a forced Organisation failure leaves the case
  `IN_PROGRESS`, never falsely `COMPLETED`; a successful offboarding ends
  the real assignment, completes the case, and requests (never performs)
  Identity deactivation; a forced Organisation failure leaves the
  offboarding case `IN_PROGRESS`.
- `test/integration/postgres.test.ts` (6 real-Postgres tests) —
  concurrency-safe case-number sequence draws; case creation + initial
  event atomicity with a forced-failure no-orphan-row proof;
  `hr_lifecycle_cases` CHECK constraints (`lifecycle_type`, `status`,
  `completed_at` consistency); `hr_probation_reviews` CHECK constraints
  (date range, decision/review_status consistency, duplicate
  `sequence_number` rejection); a full SK-Lai-&-Partners privileged-tier
  end-to-end run; a completed employment-change case's
  `resultingAssignmentId` verified to reference a real, committed
  `employment_assignments` row.
- `test/integration/http.test.ts` (9 real-HTTP tests) — unauthenticated/
  invalid-token denial; a full onboarding flow (create → milestone →
  complete milestone → complete case) over real HTTP; a full probation
  flow (create → extend, with history verified reconstructable via the
  API → confirm); mass-assignment rejection; the IDOR/existence-leak
  check; malformed-input rejection; an unrecognised `lifecycleType`
  rejection; a full employment-change-then-offboarding flow proving the
  real Organisation assignment is created/ended and the departing
  employee's Identity user is never deleted or disabled.

**Organisation package**: one additive capability
(`isDirectManagerOf`, §4) — full suite (66/66) re-verified unaffected.

**Identity package**: untouched by this PR — full suite (96/96) passes
unchanged.

**Data Vault package**: untouched by this PR — full suite (46/46) passes
unchanged.

All fixture/test employees across every test file use invented names
explicitly labelled "Fictional ... Test" — never Ching Yee, Eric, Sophia,
or any other real SVE staff member, and never real salary/personal-
contact/employment information.

## 19. CI

`.github/workflows/ci.yml` gained one new job, `validate-hrms`, mirroring
`validate-organisation`'s exact pattern (real Postgres service, install
Identity's dependencies, then Organisation's (HRMS imports its Employee
Master/assignment services), then HRMS's own, typecheck/migrate/test).
All five pre-existing jobs (`validate-svegip`, `validate-platform-
contracts`, `validate-identity`, `validate-data-vault`, `validate-
organisation`) are preserved unmodified — `validate-organisation` already
runs unconditionally on every PR in this same workflow, which is what
regression-tests Organisation for HRMS's benefit; no duplicate job was
added for that purpose.

## 20. Future integration boundaries (explicitly not built here)

- **Workflow/Approval** (`platform-services/workflow`): a milestone's
  `reference` field and the plain `PENDING/IN_PROGRESS/COMPLETED/SKIPPED`
  status are the minimal shape a future orchestrator would read/write.
  This PR builds no approval routing, no delegation-of-authority matrix,
  no conditional branching.
- **Document Service** (`platform-services/documents`): milestone/case
  `reference`/metadata fields are where a document id would go — no
  binary storage, no version history, exists in this package.
- **Payroll** (`platform-services/payroll`): no compensation, salary,
  bank, tax, or statutory-contribution field exists anywhere in this
  schema; `legal_entity_id`/jurisdiction context is the only thing this
  PR provides for a future payroll integration to consume.
- **Identity account deactivation**: this PR requests it (§9) via an
  event; it does not orchestrate it. A future Workflow/Approval service,
  or a human administrator, performs the actual deactivation.

## 21. Database

`database/migrations/004_hrms-employee-lifecycle/migration.sql` — the
next migration after `003`. **No prior migration file is altered.**

- `hr_lifecycle_case_seq` — a Postgres `SEQUENCE`, the sole source of
  case-number suffixes (`nextCaseNumberSeq()`, never `SELECT MAX()+1`,
  never client-supplied). The format (`HR-000001`,
  `src/domain/caseNumber.ts`) is an explicit placeholder — no real SVE HR
  case-numbering convention is documented anywhere in the current
  codebase, mirroring the same honestly-placeholder approach already
  taken for employee numbers and Data Vault record codes.
- `hr_lifecycle_cases` — the universal case header (§5); FKs to
  `employees`, `legal_entities`, `users` (×3: `hr_owner_user_id`,
  `created_by`, `updated_by`), and `employment_assignments`
  (`resulting_assignment_id`, nullable). CHECK constraints enforce valid
  `lifecycle_type`/`status` values and `completed_at`/`cancelled_at`
  consistency with `status` (database-enforced invariants, not merely
  application-level ones).
- `hr_lifecycle_events` — append-only business history (§5, §14); FK to
  `hr_lifecycle_cases`, CHECK-constrained `event_type`.
- `hr_lifecycle_milestones` — onboarding tasks and offboarding clearance
  items share this one table (§6, §9); `UNIQUE(case_id, milestone_type)`
  prevents duplicate milestone rows per case; CHECK enforces
  `completed_at` consistency with `status`.
- `hr_probation_reviews` — the effective-dated probation-period history
  (§7); `UNIQUE(case_id, sequence_number)` prevents duplicate periods;
  CHECK constraints enforce `expected_review_date >= period_start` and
  `review_status`/`decision`/`decision_date` consistency.

No Employee table, no Legal Entity table, and no Employment Assignment
table are created — every reference to those concepts is a foreign key
onto PR #6's/PR #1's existing tables.

**Seed data:** none. No lifecycle cases are seeded — every case concerns a
specific employee's specific HR process, and no real employees exist in
any migration to date.

## 22. Remaining risks / open questions

- **The employment-change/offboarding transaction boundary is two-phase,
  not a single cross-package ACID transaction** (§13) — a residual,
  narrow inconsistency window exists if Organisation's write succeeds but
  HRMS's own completion write then fails. The safe direction (never a
  false `COMPLETED`) is guaranteed; full atomicity across both packages
  is not, given `DatabaseProvider.transaction()`'s no-nesting constraint. A
  future iteration could add a reconciliation job that detects a case with
  a `resultingAssignmentId` set but status still `IN_PROGRESS` and
  completes it, rather than solving this at the transaction-primitive
  level.
- **Case-number format is an explicit placeholder** (§21) — no real SVE
  convention could be verified from the current codebase.
- **`isDirectManagerOf`'s logic now exists in two places**
  (Organisation's own private `employeeService.ts` helper, and the newly
  exposed public method HRMS consumes) — a deliberate choice to avoid
  refactoring Organisation's already-reviewed, already-merged internal
  code for a cosmetic de-duplication; both implementations are identical
  today, but a future change to one must remember the other.
- **List authorization runs in application code, per candidate case**, not
  pushed into the SQL `WHERE` clause — the same open item already
  recorded for Data Vault and Organisation, now shared by a third
  package.
- **Cross-package source imports remain a documented, intentional
  coupling** — the same open item already recorded for Data Vault and
  Organisation, now shared by a third package; HRMS additionally depends
  on Organisation, not just Identity, deepening this coupling further.
- **No SVEGIP bridge exists for this API** — if a future PR surfaces HR
  lifecycle data inside `apps/svegip`, it will need Data Vault's
  cookie-bridge + CSRF/origin-check pattern added here.
- **The manager/"team" read fallback is direct-reports only**, and applies
  uniformly across all four lifecycle types rather than being scoped to
  probation specifically (the brief's "particularly probation" language)
  — a future iteration could narrow or broaden this per lifecycle type if
  a real use case requires it.
- **No explicitly-authorised correction/reopen mechanism exists** for a
  completed or cancelled case (PR brief item 25 permits, but does not
  require, one) — the state machine treats both as strictly terminal.
- **A full accounting of what happens when an offboarded employee is later
  rehired is not addressed** — Organisation's own multi-employment/rehire
  readiness (PR #6) is unaffected, but no HRMS-side "rehire" lifecycle
  concept exists in this foundation; a new onboarding case for the same
  `employee_id` would need to be created, which the schema and services
  already support (no uniqueness constraint prevents multiple cases per
  employee), but no dedicated rehire semantics were built or tested.
