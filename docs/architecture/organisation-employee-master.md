# SVE Organisation + Employee Master Foundation (PR #6)

Status: **implemented, PR draft, not deployed.** This document records what
was built, why, and what is deliberately still open. **This PR is not the
full HRMS.** It establishes the organisation structure and Employee Master
data layer that future HRMS/Payroll/Payslips/iClaims/Accounting modules will
build on — none of those modules are implemented, connected, or deployed by
this PR.

## 1. Scope and what this PR is not

Built: organisation structure (Group → Legal Entity → Business Unit →
Department → Position), the Employee Master (employee identity + effective-
dated employment assignments), Identity↔Employee linkage, a minimum RBAC
permission set, and the `/api/v1/organisation/*` + `/api/v1/employees/*`
APIs.

Explicitly **not** built, and out of scope for this PR:
- Onboarding/probation-workflow/leave/attendance/documents/policy-
  acknowledgement/performance/training/offboarding-workflow (future
  `platform-services/hrms`).
- Payroll, compensation, salary amounts, bank details, tax numbers,
  statutory contribution numbers, medical information (future
  `platform-services/payroll`; Employee Master stores no such fields).
- A full organisation-chart UI, or a full Self-Service/Manager-Self-Service
  UI — only the permission boundary they will need is tested here.
- Escrow, source-code custody, or SK Lai & Partners code-holding
  functionality — a separate, unrelated future project.
- Any production deployment, AWS provisioning, Netlify repointing, or real
  SVE employee/user-account creation.

## 2. Current-code inventory (verified before writing any code)

Read directly from `main` at merge commit `7393199` (PR #5) before designing
this PR, not assumed from prior documentation:

- `platform-services/identity/src/repositories/types.ts`'s
  `OrganisationRepository` only ever covered `groups`/`legal_entities` —
  no business unit, department, position, or employee concept existed
  anywhere in Identity.
- `platform-services/organisation/README.md` (PR #3 scaffold, unimplemented)
  already declared this package the intended home of "the organisational
  backbone ... and the employee-master *structure* (not the full HR record,
  which belongs to `hrms` once it exists)" — directly justifying building
  Organisation and Employee Master together in one package (§5).
- `platform-services/hrms/README.md` (PR #3 scaffold, unimplemented)
  confirmed HRMS remains scoped to full HR features (ESS/MSS/leave/
  attendance/performance/recruitment/onboarding-offboarding/effective-dated
  compensation), depending on — never duplicating — Organisation.
- `database/migrations/001_identity-foundation/migration.sql` already
  anticipated this PR twice: `user_employee_links.employee_id`'s comment
  says no FK exists "because no employee table exists — add the FK when
  hrms.employees lands"; `entity_access_grants.business_unit_id`/
  `department_id`'s comment says no FK exists "until platform-services/
  organisation owns those tables' future schema". Both FKs are added by
  this PR's migration (§4), neither by editing migration 001.
- The three seeded legal entities (unchanged from PR #1): `sve-
  international-sg` (SVE International Pte. Ltd., Singapore, Group HQ),
  `sve-international-my` (SVE International Sdn. Bhd., Malaysia), `sk-lai-
  partners-my` (SK Lai & Partners, Malaysia, a separate registered law
  firm). No new legal entities are added by this PR.

## 3. User vs. Employee — the core distinction

**A user account may exist without an employee record; an employee record
may exist before a user account is provisioned.** This is structural, not
incidental:

- `employees` (this PR) and `users` (Identity, PR #1) are separate tables
  with no required relationship. `user_employee_links` (introduced in PR
  #4, evolved by this PR — §7) is the only bridge, and it is optional in
  both directions.
- **Creating an Employee Master record never creates a login account.**
  `employeeService.createEmployee()` never calls anything in `UserRepository`
  that creates a user — verified by an HTTP integration test asserting the
  `users` row count is unchanged after a `POST /api/v1/employees`. Identity
  provisioning (creating the `users` row, assigning roles, granting entity
  access) remains a separate, explicit, administrative action.
- Identity has zero dependency on Employee Master: `platform-services/
  identity` has no import of, or reference to, anything under
  `platform-services/organisation`. The dependency runs the other way only
  (§5).

## 4. Database

`database/migrations/003_organisation-employee-master/migration.sql` —
next migration after 001 (Identity) and 002 (Data Vault). **No prior
migration file is altered**; new FKs onto 001's tables are added via plain
`ALTER TABLE` statements, guarded to be idempotent (`DO $$ ... IF NOT
EXISTS ... END $$`), exactly as 001 and 002's own comments already
anticipated.

New tables:
- **`business_units`** — belongs to one legal entity. Genuinely optional in
  the hierarchy: a legal entity may attach departments directly.
- **`departments`** — `legal_entity_id` always populated (even when
  `business_unit_id` is also set); `business_unit_id` nullable so entities
  with no business-unit layer (e.g. SK Lai & Partners, a single Malaysian
  law firm) are never forced to create an empty one.
- **`positions`** — a job/role slot, distinct from whoever currently holds
  it. `reports_to_position_id` is the *structural* reporting line
  (self-FK, `CHECK (reports_to_position_id IS DISTINCT FROM id)`).
  `cost_centre_code` is a placeholder column only — no cost-centre master
  table or accounting logic; future Payroll/Accounting Pro will formalise
  it.
- **`employees`** — identity only, never the employment relationship or any
  payroll/compensation/statutory data. `employee_number` is `UNIQUE`,
  server-generated (§8). `personal_email` is the one deliberately-included
  "extra" field, justified narrowly for reaching a former employee during
  offboarding once `work_email` is deactivated — not a general
  personal-contact store.
- **`employment_assignments`** — the effective-dated employment history
  (§6): `legal_entity_id`/`business_unit_id`/`department_id`/`position_id`/
  `employment_type`/`status`/`is_primary`/`start_date`/`confirmation_date`/
  `probation_end_date`/`end_date`/`effective_from`/`effective_to`/
  `work_location`/`work_arrangement`/`reports_to_assignment_id`/
  `change_reason`. Self-FK `CHECK` prevents self-reporting; a partial
  unique index (`employment_assignments_one_open_primary`, on
  `(employee_id) WHERE effective_to IS NULL AND is_primary = TRUE`) is the
  database-level guarantee of "only one open primary assignment at a time"
  (§6.2).

Altered (001's tables, via guarded `ALTER TABLE`, not by editing
`001_identity-foundation/migration.sql`):
- `entity_access_grants` gains FKs on `business_unit_id`/`department_id`
  onto this migration's new tables.
- `user_employee_links` evolves from "exactly one link for the lifetime of
  a user row" (a `PRIMARY KEY` on `user_id`, no way to unlink) into proper
  active/inactive history: an `id` primary key replaces it, `unlinked_at`/
  `unlinked_by` are added, the old always-on `UNIQUE(employee_id)` is
  dropped, an FK onto `employees` is added, and two partial unique indexes
  (`WHERE unlinked_at IS NULL`, on `user_id` and `employee_id` separately)
  enforce "one active link per user and per employee" while preserving
  unlinked rows as history rather than deleting them. Safe to restructure
  in place — no production rows exist in any merged PR to date.

**Seed data:** none beyond what 001 already seeds (the three legal
entities). No business units/departments/positions are seeded — they are
genuinely optional per entity and left for real HR data entry. **No real
employees are seeded** — all fixture/test employees across every test file
in this PR use invented names explicitly labelled "Fictional ... Test
Employee", never Ching Yee, Eric, Sophia, or any other real person, and
never real salary/personal-contact/employment information.

## 5. Module ownership and dependency direction

Organisation (structure) and Employee Master (identity + assignments) live
in **one package**, `platform-services/organisation` — not split into two —
because PR #3's own pre-existing scaffold README already declared this the
intended home for both (§2), and the two are tightly coupled at this stage
(an assignment always references both a legal entity/department/position
*and* an employee; splitting them now would mean two packages
cross-importing each other's domain types for every operation). This is a
deliberate minimum-coherent-structure choice, not package proliferation.

```
platform-services/
├── identity/          identity/access/session/MFA/audit only — no
│                       Organisation/Employee-Master import anywhere in it
│
└── organisation/       organisation structure + Employee Master: domain,
                         repositories, services, API/routes, tests —
                         depends on Identity's contracts/services, never
                         duplicates their implementation
```

- `platform-services/organisation/src/composition/container.ts` is this
  package's own composition root (on the dependent side, per the PR #5
  lesson — Data Vault's original mistake of placing a new business domain
  *inside* Identity is not repeated here). It imports Identity's Postgres
  repositories (`pgUserRepository`, `pgOrganisationRepository`,
  `pgRbacRepository`, `pgSessionRepository`, `pgAuditRepository`), its
  `sessionService`/`rbacService`/`auditService`, and its migration runner —
  all by relative source-path import, the same documented cross-package
  coupling Data Vault already established (see that package's README for
  the underlying rationale: no npm workspace exists yet between sibling
  `platform-services/*` packages, so Node resolves each imported file's own
  dependencies, e.g. `pg`, relative to *that file's* location — meaning
  Identity's own `node_modules` must be installed here too; this package's
  `package.json` therefore declares zero runtime dependencies).
- Unlike Data Vault, **this package includes no SVEGIP session-cookie
  bridge.** No existing `apps/svegip` page authenticates against Employee
  Master today, so the only authentication path implemented is a native
  Identity bearer session (`requireActor()` in `src/api/middleware/
  actor.ts`). A SVEGIP bridge remains straightforward to add later,
  following Data Vault's exact pattern, if a future PR wires an `apps/
  svegip` page into this API.
- `platform-services/organisation/src/services/*.ts` depend on Identity's
  `RbacService`/`AuditService`/`OrganisationRepository`/`UserRepository`
  *contracts* (imported types), never a copy of their logic. This
  package's own domain errors (`NotFoundError`, `ValidationError`) are
  Organisation/Employee-Master-specific; Identity's authentication/
  authorization errors (`SessionInvalidError`, `AccountDisabledError`,
  `ForbiddenError`) are imported from Identity.
- Identity was extended additively for this PR (§7): `UserEmployeeLink`
  gained `id`/`unlinkedAt`/`unlinkedBy`; `UserRepository` gained
  `findActiveLinkByUserId`/`findActiveLinkByEmployeeId`/`unlinkEmployee`
  and `linkEmployee`'s signature changed to `{userId, employeeId,
  linkedBy}`. No existing Identity test exercised `linkEmployee`/
  `UserEmployeeLink` before this change (verified by grep before making
  it); Identity's full suite (96/96) passes unchanged after it.
- In-memory test stores are separate, mirroring Data Vault: this package's
  own `src/repositories/memory/inMemoryStore.ts` holds only Organisation/
  Employee-Master data — it does not merge with Identity's `InMemoryStore`.

## 6. Employee Master model

### 6.1 Employee vs. Employment Assignment vs. user-account status

Three distinct statuses are kept, deliberately not collapsed into one:

- **`employees.status`** — the employee's current/latest status, kept in
  sync by the service layer on every assignment transition. It exists so a
  simple employee lookup doesn't require also querying assignments.
- **`employment_assignments.status`** — the *historical* status for that
  effective period; never silently out of sync with `employees.status` for
  the *current* primary assignment (the service updates both in the same
  transition), but a past assignment row correctly retains whatever status
  applied *then*.
- **Identity's `users.status`** (unchanged, Identity-owned) — the login
  account's own status. Deliberately independent: the PR brief's own
  example (a resigned employee's Identity account stays active temporarily
  for offboarding) is exactly why these must not be the same field. This PR
  does not implement any automatic Identity-account deactivation on
  employee termination/resignation — that remains a separate, explicit
  administrative action, consistent with "Identity provisioning remains a
  separate controlled action" (§3).

`EmploymentStatus` is `PRE_HIRE | ACTIVE | PROBATION | NOTICE | SUSPENDED |
TERMINATED | RESIGNED | INACTIVE` — not a mechanical copy of the brief's
example list. `CONFIRMED` was deliberately folded into `ACTIVE` plus a
populated `confirmation_date`, rather than kept as a distinct top-level
status: "confirmed" is a fact about an ongoing active assignment (when
confirmation happened), not a separate state an assignment moves through
and then leaves — nothing else changes about the assignment at the moment
of confirmation besides that one date being set.

### 6.2 Effective-dated records ("Employee → Employment Assignment →
Effective From/To")

A transition (transfer, promotion, department/manager/title/location
change) **never updates an existing assignment row's business fields.** The
service closes the current row (`effective_to = day before the new row's
effective_from`) and inserts a new row (`employmentAssignmentService.
createAssignment()`). A terminal end (termination/resignation) closes the
current row (`effective_to = end_date`, `status` set to the terminal value)
and inserts **no** successor row (`endAssignment()`).

This is deliberately **not a full temporal/bitemporal database** — only one
axis (effective time) is tracked; there is no separate "as recorded on"
dimension distinguishing when a change was entered from when it took
effect. That is a conscious scope decision ("avoid overengineering a
temporal database"), not an oversight.

`is_primary` plus the partial unique index `employment_assignments_
one_open_primary` (§4) is what enforces "only one primary active employment
assignment at a time" at the database level, while still allowing secondary/
concurrent assignments (secondment, dual-entity arrangements, an MY↔SG
transfer in progress) to coexist as `is_primary = false` rows — verified by
both a unit test and a real-Postgres constraint test that a second
`is_primary = true`, `effective_to IS NULL` row for the same employee is
rejected, while an `is_primary = false` row for the same employee succeeds
alongside an open primary.

### 6.3 Reporting line model

Two complementary mechanisms, matching the two places a reporting
relationship can live:

- **`positions.reports_to_position_id`** — the *structural* line: this
  role reports to that role, independent of who currently holds either.
- **`employment_assignments.reports_to_assignment_id`** — an explicit
  per-assignment *override*, for temporary/exception reporting that
  shouldn't require a position change (e.g. a temporary project lead).

Both are self-referencing FKs with a `CHECK (... IS DISTINCT FROM id)`,
rejecting the immediate self-report case at the database level for free.
Multi-hop cycles (A reports to B, B reports to A) cannot be caught by a
single-column `CHECK`, so `employmentAssignmentService.
reportingChainReachesEmployee()` walks the `reports_to_assignment_id` chain
upward from the proposed manager, bounded to `MAX_REPORTING_CHAIN_DEPTH =
50` hops, and rejects the assignment if the employee being assigned is ever
re-encountered. Positions have no update operation in this foundation, so a
true structural cycle among positions cannot form at all in this PR; only
assignment-level chains need runtime detection. Verified: self-reporting
rejected; a two-hop A→B→A cycle rejected; a valid non-circular manager
assignment succeeds; assigning a reporting line requires the distinct
`manage_reporting` permission, not just `manage_assignment`; an inactive/
already-superseded assignment cannot silently become someone's manager,
since `reportsToAssignmentId` must resolve to a real, current assignment
row.

**No organisation-chart UI is built in this PR** — only the data model and
its permission boundary.

## 7. Identity ↔ Employee linkage

Reuses and evolves PR #4's `user_employee_links` table rather than
introducing a second linkage table (§4's migration details the schema
change). Supported, and tested:

- An employee without any linked user account (the common case for a
  newly-created `PRE_HIRE` record).
- A user account without any linked employee (e.g. a service account, or an
  Identity user provisioned ahead of any Employee Master record).
- **One primary user-account per employee, and one employee per user
  account, at a time** — enforced by the two partial unique indexes in §4.
  Linking an employee already linked, or a user already linked, is
  rejected with a `ValidationError` before any write (verified by a unit
  test and an HTTP integration test).
- **Controlled linkage/unlinkage**: `employeeService.linkIdentity()`/
  `unlinkIdentity()` require the `employee_master.link_identity[.
  privileged]` permission, scoped to the employee's current legal entity —
  linking is not a side effect of any other operation.
- **Unlinking preserves history**: `unlinkEmployee()` sets `unlinked_at`/
  `unlinked_by` rather than deleting the row, so a past linkage remains
  auditable (verified directly against real Postgres: the row count for a
  user is 2, not 1, after link → unlink → relink to a different employee).
- **Audited**: every link/unlink is recorded via `employee_master.identity.
  {linked,unlinked}` audit events (§10).

## 8. Employee number generation

`employee_number_seq`, a dedicated Postgres `SEQUENCE`, is the sole source
of the numeric suffix — `employeeService.createEmployee()` always calls
`employees.nextEmployeeNumberSeq()` (which does `SELECT nextval(...)`,
never a row count or any client-supplied value) before constructing the
number. Verified concurrency-safe directly against real Postgres: ten
concurrent `nextval()` draws never collide.

**The format (`EMP-000001`, `src/domain/employeeNumber.ts`'s
`formatEmployeeNumber()`) is an explicit placeholder, not an assumed real
SVE policy.** No evidence in the current codebase establishes a real
numbering convention — `apps/svegip`'s `employee_accounts` table has no
employee-number concept at all — so this is documented as configurable/
future-policy-dependent, exactly per the brief's instruction not to
hard-code an unverified format.

## 9. Jurisdiction (MY/SG) readiness

No hard-coded single country, currency, employment-type taxonomy,
public-holiday regime, leave regime, payroll system, or statutory
contribution model:

- `employees.employment_country` is free-text ISO 3166-1 alpha-2 (`MY`,
  `SG`, or any future value), not a `CHECK`-constrained enum tied to
  today's two countries.
- `employment_assignments.employment_type` is free text (`full_time`,
  `part_time`, `contract`, `intern`, `secondment`, ...), not a closed
  `CHECK` set — current SVEGIP has no employment-type taxonomy to derive a
  closed set from, and a hard-coded one could not anticipate a future
  jurisdiction's categories.
- No leave/public-holiday/payroll/statutory table or logic exists anywhere
  in this PR — this foundation stores *context* (which legal entity, which
  country) for those future modules to consume; it implements none of
  their rules.
- Multi-employment/transfer readiness (an MY→SG transfer, a secondment, a
  rehire, multiple historical assignments, a promotion, a temporary
  reporting change) is exercised directly by tests: a transfer creates a
  new effective-dated row rather than overwriting the old one (§6.2); a
  cross-entity transfer requires `manage_assignment` authority over
  **both** the origin and destination legal entity (verified: MY-only
  authority is rejected for a transfer targeting Singapore); a secondary,
  non-primary assignment coexists with an open primary one.

## 10. SK Lai & Partners segregation

**HQ status does not automatically grant HR/employee-data access across
every entity, and Group-wide technical administration does not imply HR
authority over SK Lai & Partners specifically** — System Administrator ≠ HR
Administrator ≠ Group Management, exactly as the brief requires. Concretely:

- `src/services/entityClassification.ts`'s `classificationCeilingForEntity()`
  hardcodes **exactly one fact**: the legal-entity `key` string
  `"sk-lai-partners-my"` maps to a `RESTRICTED` classification ceiling;
  every other legal entity maps to `INTERNAL`. This is isolated to one
  file, in one function, and is explicitly documented as a confirmed
  *structural* fact about the SVE Group (which entity is the separate law
  firm) — not a jurisdiction-specific business *rule* (payroll/leave/tax
  regime), which the brief separately and correctly forbids hardcoding.
  Nothing else in this PR hardcodes SK Lai & Partners' identity.
- Every Employee Master and Organisation-structure permission check tries
  an ordinary permission key first, then a `.privileged` variant, exactly
  mirroring Data Vault's two-tier pattern (§11) — reusing Identity's
  existing `rbacService.authorize()` classification-ceiling mechanism
  unchanged, rather than modifying it.
- Because `classificationCeilingForEntity()` returns `RESTRICTED` for SK
  Lai & Partners, **both** directory-level and restricted-HR fields there
  require the `.privileged` tier — a Group-scoped administrator holding
  only the ordinary (`CONFIDENTIAL`-ceilinged) permission is denied,
  verified directly against real Postgres: creating an SK Lai & Partners
  employee fails for a Group-wide, non-privileged administrator, and
  succeeds only once the `.privileged` permission (ceilinged at
  `RESTRICTED`) is explicitly granted.
- This applies uniformly to organisation-structure writes too
  (`organisationStructureService`'s `organisation.manage[.privileged]`),
  so SK Lai & Partners' own departments/positions cannot be created or
  edited by a non-privileged Group administrator either.

## 11. Permissions model

A minimum, derived set — not a mechanical copy of the brief's example list
— all default-deny, all enforced server-side only (never a UI-visibility
boundary):

```
employee_master.read[.privileged]                  base directory-level read
employee_master.read.restricted[.privileged]        restricted-HR fields (§12)
employee_master.read.team                           direct-reports fallback (§12)
employee_master.create[.privileged]
employee_master.update[.privileged]
employee_master.manage_assignment[.privileged]       hire/transfer/promotion/status change
employee_master.manage_reporting[.privileged]        assigning a reports-to line — distinct from manage_assignment
employee_master.link_identity[.privileged]           link/unlink to a user account
organisation.manage[.privileged]                     business unit / department / position writes
```

`.privileged` is required whenever the *target* legal entity's
classification ceiling is `RESTRICTED` (today: SK Lai & Partners only,
§10) or when a specific field/action is deliberately gated above the
ordinary tier — holding the ordinary key never implies the privileged one,
exactly mirroring Data Vault's already-reviewed pattern (`checkAccess()`
tries the ordinary key, then the privileged key, against Identity's
unmodified `rbacService.authorize()`).

**Self/Manager/HR/Group-HR/Admin separation is prepared for, not fully
built**: an actor's own linked employee record is always fully visible to
them regardless of grants (`getEmployee()`'s self-access bypass, §12); a
direct manager gets directory-level visibility into their direct reports
via `employee_master.read.team`, without needing an entity grant; anything
beyond that (a full ESS/MSS UI, a Group-HR console) is future work — this
PR tests the permission *boundary*, not the UI.

## 12. Data sensitivity — directory vs. restricted fields

Rather than adding a per-row `classification` column to `employees` (as
Data Vault does for its own records), field-level sensitivity is enforced
by running **two separate RBAC checks against the same record**, both
derived live from the employee's current assignment's legal entity:

- **Directory-level** (`employee_master.read[.privileged]`, checked against
  the entity's base classification ceiling — `INTERNAL` or `RESTRICTED`
  for SKL): `legalName`, `preferredName`, `workEmail`,
  `employmentCountry`, and the current assignment's `legalEntityId`/
  `businessUnitId`/`departmentId`/`positionId`/`workLocation`/
  `workArrangement`.
- **Restricted-HR** (`employee_master.read.restricted[.privileged]`,
  checked one tier above the base ceiling — `CONFIDENTIAL`, or `RESTRICTED`
  again for SKL, since there is no tier above `RESTRICTED` in use here):
  `personalEmail`, `status`, and the current assignment's `employmentType`/
  `status`/`startDate`/`confirmationDate`/`probationEndDate`/`endDate`/
  `effectiveFrom`/`effectiveTo`/`reportsToAssignmentId`/`changeReason`.

A caller who can see an employee in a listing or via the directory-level
check is **not** thereby entitled to restricted fields — `serializeView()`
in `src/api/routes/employees.ts` only includes the `restricted` object when
`EmployeeView.canReadRestricted` is true, verified directly by an HTTP
integration test asserting a directory-only caller's response has
`restricted: null` and never contains the employee's `personalEmail`
string anywhere in the serialized JSON.

**Self-access bypass**: an actor reading their own linked employee record
(resolved via `user_employee_links`) sees everything — directory and
restricted — regardless of entity grants; this is the one deliberate
exception to the two-check model.

**Manager/"team" fallback**: bounded to *direct* reports only (via
`reportsToAssignmentId` or the position's `reportsToPositionId` — not a
full recursive/indirect-reports walk), granting directory-level visibility
only, via `employee_master.read.team`.

**Listing/search is server-side end-to-end**: `listEmployees()` runs the
same two checks per candidate row and silently omits any row the caller
can't pass, never "fetch all, hide client-side"; entity isolation is
verified directly over real HTTP (a legal-entity-scoped caller's list
never contains an out-of-scope employee, and directly requesting one by
UUID returns 404). **IDOR/existence-leak prevention**: a denied caller
requesting a real, existing employee UUID gets byte-identical 404
status/code/message to a genuinely nonexistent UUID (`getEmployee()`
throws the same `NotFoundError` in both cases) — verified by both the
in-memory unit suite and a real-HTTP integration test.

## 13. Audit behaviour

Every Employee Master and Organisation-structure write — plus a denied
direct-access attempt and a restricted-field view — goes through Identity's
existing `auditService.record()` into `security_audit_events`, the same
table Identity and Data Vault already use; no new, parallel audit table.
Actions recorded: `employee_master.employee.{created,updated,
restricted_viewed}`, `employee_master.assignment.{created,ended}`,
`employee_master.identity.{linked,unlinked}`, `employee_master.access.
denied`, `organisation.{business_unit,department,position}.created`.

**Audit entries never carry the full record.** `changeBefore`/`changeAfter`
on every call site above are small, explicit before/after objects — e.g.
`{legalName, workEmail}` on an employee update, `{legalEntityId,
departmentId, positionId, status}` on an assignment transition, `{userId}`
on a link/unlink — never the full employee or assignment row, and never
`personalEmail`. Verified directly by a unit test asserting a fictional
employee's personal-email string never appears anywhere in
`JSON.stringify()` of the accumulated audit events.

## 14. API

All routes are under `/api/v1/organisation/` and `/api/v1/employees/`,
following the existing `/api/v1` envelope conventions (`sendSuccess`/
`sendError`/`readJsonBody`, imported from Identity as generic HTTP
plumbing), served by this package's own standalone HTTP server
(`src/api/http.ts`, `src/server.ts`) — it neither mounts into, nor is
mounted by, Identity's or Data Vault's server. **Only routes justified by
this foundation exist** — no Payroll, Leave, Attendance, or Performance
routes.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/organisation/legal-entities` | Reference passthrough to Identity's legal entities; authentication only, no special permission |
| GET / POST | `/api/v1/organisation/business-units` | List (auth only) / create (`organisation.manage[.privileged]`, entity-scoped) |
| GET / POST | `/api/v1/organisation/departments` | Same pattern; a `businessUnitId` must belong to the given `legalEntityId` |
| GET / POST | `/api/v1/organisation/positions` | Same pattern; `reportsToPositionId` must resolve to a real position |
| GET / POST | `/api/v1/employees` | List (server-side filtered/masked per caller, §12) / create (bundles the initial hire's assignment — §6) |
| GET / PATCH | `/api/v1/employees/:id` | Read (masked per caller) / update (directory fields only) |
| GET / POST | `/api/v1/employees/:id/assignments` | List an employee's full effective-dated history / create a transition (§6.2) |
| POST | `/api/v1/employees/:id/end-assignment` | Terminal end of employment (§6.2) |
| POST | `/api/v1/employees/:id/link-identity` | Link to a user account (§7) |
| POST | `/api/v1/employees/:id/unlink-identity` | Unlink (§7) |

Every route allowlists exactly the client fields it accepts (`src/api/
routes/employees.ts`, `organisation.ts`) — `id`, `employeeNumber`, and the
initial `status`/`createdBy`/`updatedBy` are always server-assigned,
verified by a mass-assignment integration test that a spoofed `id`/
`employeeNumber` in a create request is never honoured.

## 15. Architecture diagram

```
Identity  (auth / session / MFA / roles / entity-access — upstream, owns no business data)
    │        (dependency: Organisation reads Identity's RBAC/session/audit contracts)
    ▼
Organisation + Employee Master  (this PR — structure + employee identity/
    │                            assignment/reporting; PRE_HIRE..INACTIVE)
    │        (dependency/context: HRMS reads Organisation/Employee Master
    │         identifiers and structure; it does not receive unrestricted
    │         data access merely by depending on this layer — every read
    │         still goes through this layer's own RBAC/masking, §11–§12)
    ▼
HRMS  (future — onboarding, leave, attendance, performance, documents;
    │   not built or connected by this PR)
    │        (dependency/context, not data access — same caveat as above)
    ▼
Payroll / iClaims / Accounting  (future — compensation, claims, ledger;
                                  not built, not connected, no salary/bank/
                                  tax data stored anywhere in this PR)
```

**The arrows above indicate dependency/context — which layer's identifiers
and structure a later layer builds on — not unrestricted data access.** A
future HRMS or Payroll module consuming Employee Master identifiers must
still pass through this layer's own RBAC/classification/masking rules
(§11–§12) for every read, exactly as Organisation itself must pass through
Identity's `rbacService.authorize()` rather than trusting anything about a
caller directly. Depending on a layer is not a grant of that layer's data.

## 16. Transactional employee creation (PR #6 review correction)

**Correction context:** the original version of this PR performed employee
creation as two independent, non-transactional writes (the `employees` row,
then the initial `employment_assignments` row), documented as an accepted
risk. Review correctly rejected this for authoritative Employee Master
data — a mid-operation failure between the two writes could leave an
orphan employee with no assignment, and "delete the employee afterward as
compensation" is not an acceptable substitute for atomicity. This has been
corrected.

**Design:** `EmployeeCreationTransaction` (`src/repositories/types.ts`) is
a small port with one method, `run(fn)`, that the real Postgres
implementation (`src/repositories/postgres/pgEmployeeCreationTransaction.ts`)
backs with a single call to `DatabaseProvider.transaction()` — the same
`BEGIN`/`COMMIT`/`ROLLBACK`-per-connection primitive already used elsewhere
in this codebase (e.g. `platform-services/identity/src/repositories/
postgres/pgMfaRepository.ts`'s `replaceRecoveryCodes()`), not a new
mechanism. Inside that one transaction, it constructs `employees`/
`assignments` repository instances scoped to the *same* connection
(`createPgEmployeeRepository(tx)`, `createPgEmploymentAssignmentRepository(tx)`)
and hands them to the caller:

```
BEGIN
  employee = employees.create(...)               -- INSERT INTO employees
  assignment = assignments.create(...)            -- INSERT INTO employment_assignments
  employee = employees.setStatus(employee.id, status, ...)  -- required related persistence
COMMIT
-- any thrown error at any step -> ROLLBACK, ordinary db.transaction() behaviour
```

`employeeService.createEmployee()` (`src/services/employeeService.ts`) now
performs exactly these three writes inside `deps.employeeCreation.run(...)`;
nothing outside that callback touches either table. The audit call
(`employee_master.employee.created`) happens strictly *after* `run()`
resolves successfully — so a thrown error inside the transaction, which
rolls back both the employee and assignment rows, is never followed by an
audit record claiming the creation completed. There is no
delete-afterward compensation logic anywhere in this path; the only
recovery from a failed initial assignment is the transaction's own
rollback.

The domain-layer/service code stays free of raw transaction mechanics: the
service calls `deps.employeeCreation.run(fn)`, not
`BEGIN`/`COMMIT`/`pg`-specific APIs — the same repository-ownership
boundary already used throughout this package. The in-memory implementation
(`src/repositories/memory/inMemoryEmployeeCreationTransaction.ts`) simply
invokes `fn` against the existing repositories; in-memory unit tests
exercise the RBAC/domain logic, not Postgres rollback behaviour, which is
covered separately below by real-Postgres tests.

`nextEmployeeNumberSeq()` (§8) is deliberately called *before* entering the
transaction — Postgres sequence advances are never transactional (this is
true of any `SEQUENCE`, including Data Vault's own record-code sequence),
so a rolled-back creation permanently consumes that sequence value. This is
an accepted, well-understood gap (a numbering gap, never a collision) and
is not something a transaction wrapper around the sequence draw could
prevent even if attempted.

**Verified** (`test/integration/postgres.test.ts`, real Postgres):
successful creation commits both the employee row and its initial
assignment together; a forced initial-assignment failure (an
`initialAssignment.positionId` that does not exist, violating the
`employment_assignments.position_id` foreign key) leaves neither the
employee nor any assignment row persisted; a duplicate `work_email`
(`employees.work_email`'s `UNIQUE` constraint) on a second create leaves no
partial second employee row; and a forced rollback is never followed by an
`employee_master.employee.created` audit event.

## 17. Reporting-cycle concurrency safety (PR #6 review correction)

**Correction context:** review asked whether two simultaneous reporting
changes could independently pass the existing service-layer cycle check
(§6.3) and jointly commit a cycle, and to introduce minimum-appropriate
Postgres concurrency control if so.

**Analysis.** `employment_assignments.reports_to_assignment_id` is set
exactly once, at row-creation time (`INSERT`), and is **never subsequently
updated** by any code path in this PR — `closeAssignment()` only ever
touches `effective_to`/`end_date`/`status`. The column is also a real
foreign key (`REFERENCES employment_assignments(id)`), so a value can only
ever be a row that *already exists* at insert time. Together these two
facts mean every edge in this graph points strictly "backward" to a row
created earlier — the graph induced by these pointers, restricted to any
prefix of the creation order, is therefore a DAG by construction. A cycle
would require some row's edge to point "forward" to a row that does not
yet exist at its own insertion time, which is impossible to submit (there
is no id to supply). This was checked exhaustively against several
concurrent-adversarial configurations — including two employees each
targeting the other's pre-existing, never-mutated primary assignment at
the same instant — and in every configuration the two new rows end up
pointing at two *different*, already-frozen historical/unrelated targets
that have no outgoing edge of their own; neither new row is ever a cycle
participant, regardless of commit order. **Conclusion: under the current
data model, two purely concurrent `createAssignment()` calls cannot form a
reporting cycle.** This is a structural property (write-once edges + a
FK that must pre-exist), not merely something observed to be true in
testing today — see `test/integration/postgres.test.ts`'s "Reporting-cycle
concurrency" tests for the empirical confirmation, and the code comment at
the top of `pgEmploymentAssignmentTransaction.ts` for the same argument
next to the code it justifies.

**Why a control was still added.** The structural guarantee above holds
only as long as `reports_to_assignment_id` remains write-once. A plausible
future feature — e.g. "reassign this assignment's manager in place without
creating a new effective-dated row" — would break that invariant and
reopen exactly the TOCTOU (time-of-check-to-time-of-use) race the review
was concerned about: two concurrent updates could each read the graph
before the other's write, each pass its own chain-walk check, and jointly
commit a cycle. Rather than leave that latent trap for whoever adds such a
feature later, `EmploymentAssignmentTransaction`
(`src/repositories/postgres/pgEmploymentAssignmentTransaction.ts`) adds a
`pg_advisory_xact_lock` on a single fixed key, taken inside a real
transaction whenever `createAssignment()` is about to introduce a new
`reportsToAssignmentId` edge:

```
BEGIN
  IF introducing a new reporting edge:
    SELECT pg_advisory_xact_lock(851102233)   -- blocks until any other holder commits/rolls back
  re-read reportsTo + walk the chain (reportingChainReachesEmployee) -- sees every earlier holder's committed writes
  re-read the current primary, close it if present
  INSERT the new assignment row
COMMIT   -- lock released automatically, no explicit unlock needed
```

A plain transition that sets no `reportsToAssignmentId` never contends for
this lock (it cannot introduce an edge, so it cannot participate in a
cycle) but still gets the transaction boundary, making its own
close-then-insert atomic as a side benefit. One fixed key serializing the
whole reporting hierarchy — rather than a per-employee or per-subtree key —
is the minimum mechanism sufficient at this modular-monolith's current
write volume; no graph-database engine, external lock service, or trigger
framework was introduced.

**Verified** (`test/integration/postgres.test.ts`, real Postgres, run
repeatedly for stability — 5 internal iterations per run, across 5
consecutive full test-suite runs, 25 total race attempts with zero
failures): two simultaneous, mutually-adversarial `createAssignment()`
calls (each targeting the other employee's pre-existing assignment) both
succeed and the resulting graph for both employees is confirmed acyclic by
walking every row's chain after commit; self-reporting remains rejected;
the ordinary sequential two-hop cycle-detection path still works correctly
through the now-transactional/locked code path; a valid, non-circular
reporting change still succeeds; and effective-dated assignment history
(the original row preserved, closed not deleted, after a rejected
circular-reporting attempt touches nothing) remains intact.

## 18. Current manager assignment integrity (PR #6 final review correction)

**Correction context:** the reporting-cycle concurrency analysis (§17) had
surfaced, as a noted-but-deferred gap, that `createAssignment()` never
checked whether `reportsToAssignmentId` pointed at a *currently open*
manager assignment — a caller could set a new assignment's live reporting
edge against a manager's already-closed, historical row. Review correctly
asked for this to be resolved as part of the foundation rather than carried
forward as an accepted limitation.

**Required behaviour, as implemented** (`employmentAssignmentService.
createAssignment()`, inside the same transaction/lock scope used for the
cycle check — §17): whenever `input.reportsToAssignmentId` is supplied,

1. **The referenced manager assignment must exist.**
2. **It must be current at the relevant effective date** — see below.
3. **It must not be the employee's own assignment** (self-reporting,
   unchanged from the original check).
4. **It remains subject to the existing multi-hop cycle check**
   (`reportingChainReachesEmployee`, unchanged).
5. **Entity/permission rules are untouched** — the existing
   `manage_assignment`/`manage_reporting` checks (§11) still run exactly as
   before this correction.

Checks 1 and 2 are combined into a single `ValidationError` ("... does not
refer to a current employment assignment.") so a nonexistent id and a
real-but-historical id are **indistinguishable to the caller** — the same
IDOR-safe principle already used for employee records (§12): a caller must
not learn, from the shape of the error alone, whether a UUID they don't
otherwise have visibility into exists at all.

**Effective-date semantics, assessed carefully rather than using wall-clock
time:** "current" is evaluated against the *new* assignment's own
`effectiveFrom` date — `manager.effectiveFrom <= newEffectiveFrom` AND
(`manager.effectiveTo IS NULL` OR `manager.effectiveTo >= newEffectiveFrom`)
— a plain date-range containment check (`isCurrentAt()` in
`employmentAssignmentService.ts`), never `NOW()`/today's wall-clock date.
This is deliberate: the model already supports future-dated transitions
cleanly (a promotion effective next quarter is created today with a future
`effectiveFrom`), and a manager assignment that is valid *as of that future
date* must not be rejected merely because today's wall-clock date falls
before it, nor should a manager assignment that will have already closed
*by* that future date be silently accepted. No trigger-heavy temporal
framework was introduced — this is a single, cheap, read-then-compare
check alongside the checks already present, following exactly the
"effective-dated read" pattern already used throughout this package
(`findCurrentPrimary`, `listAssignments`).

**Historical records are never rewritten.** This correction adds a
read-only *validation* gate on the value chosen for a NEW row's
`reports_to_assignment_id` at the moment that row is created — it changes
nothing about how existing rows are stored or read. A historical assignment
retains its own `reports_to_assignment_id` exactly as it was set when that
row was created, permanently: historical assignment A may continue to show
that it reported to historical assignment B during A's effective period,
even long after both have closed and the employees involved have since
been assigned to different managers. `closeAssignment()` (§6.2) already
never touches this column, and this correction adds no code path that
would.

**A genuine bug this correction surfaced and fixed alongside it:** while
building the real-Postgres tests for this check, `manager.effectiveFrom >
atEffectiveDate`-style comparisons were silently always false against real
Postgres (though correct in the in-memory unit tests) — `pg`'s default
type parser returns a `DATE` column as a JS `Date` object, not the plain
`'YYYY-MM-DD'` string every domain type in this codebase already declares
for these fields (`Employee`/`EmploymentAssignment`'s `startDate`/
`effectiveFrom`/`effectiveTo`/etc., and Data Vault's `checkedDate`). A
`Date`-vs-string relational comparison silently coerces to `NaN` on both
sides and is therefore always `false`, which made the new currency check
an unconditional no-op against real data specifically (never caught by the
in-memory unit suite, since the in-memory repository stores genuine JS
strings). Fixed at its root, once, in
`platform-services/identity/src/repositories/postgres/pgDatabaseProvider.ts`
— the single file in the codebase that imports `pg` directly — by
registering a pass-through type parser for the `date` OID (1082), making
every `DATE` column's runtime value match its already-declared TypeScript
type across all three packages (Identity, Data Vault, Organisation), not
just this one check. Verified: Identity's and Data Vault's full suites
remain green after this change (neither relied on the previous, incorrect
`Date`-object behaviour), and it incidentally fixes a latent, previously
untested defect in Data Vault's own `checkedDate` field (which would have
serialized as a full ISO timestamp instead of a plain date over HTTP).

**Verified** (`test/integration/postgres.test.ts`, real Postgres): a
current employee reporting to a current manager assignment succeeds; a new
current assignment referencing a manager's now-closed assignment is
rejected; a nonexistent manager assignment id and a real-but-closed one
produce byte-identical error messages; self-reporting remains rejected and
ordinary multi-hop cycle detection remains working alongside the new
check; a closed historical assignment retains its original manager
reference unchanged after later transitions for either the manager or the
report; and a transfer/promotion establishing a new current manager never
rewrites the previous assignment's own reporting history. The
reporting-cycle concurrency tests (§17) were re-run after this correction
and remain stable (5 consecutive full-suite runs, zero failures).

## 19. Remaining risks / open questions

- **Employee number format is an explicit placeholder** (§8) — no real SVE
  numbering convention could be verified from the current codebase.
- **List authorization runs in application code, per candidate row**, not
  pushed into the SQL `WHERE` clause — correct at this scale (verified by
  tests) but will not scale to a large employee volume; a future iteration
  should translate entity-access grants and classification ceilings into
  SQL predicates, mirroring the same open item already recorded for Data
  Vault.
- **Cross-package source imports remain a documented, intentional
  coupling** (§5), not a long-term architecture — the same open item
  already recorded for Data Vault, now shared by a third package.
- **No SVEGIP bridge exists for this API** (§5) — if a future PR surfaces
  Employee Master data inside `apps/svegip`, it will need Data Vault's
  cookie-bridge + CSRF/origin-check pattern added here.
- **The manager/"team" read fallback is direct-reports only** — no
  indirect/skip-level visibility is implemented; a future iteration may
  need a bounded recursive variant once a real management-chain use case
  emerges.
- **No automatic Identity-account deactivation on termination/resignation**
  (§6.1) — intentional per the brief's own offboarding example, but it
  means an administrator must remember to separately disable the Identity
  account when appropriate; no reminder/workflow exists yet (that belongs
  to future HRMS offboarding).
- **Employment-type and employment-country are unconstrained free text**
  (§9) — intentional for jurisdiction readiness, but means no server-side
  validation currently rejects a typo'd country/type value; a future
  iteration may want a lookup table without hard-coding today's two known
  jurisdictions.
- **The reporting-hierarchy advisory lock (§17) is defense-in-depth, not a
  fix for a currently-exploitable bug** — the analysis found no way to
  commit a cycle via concurrent creates under the present write-once-edge
  data model. It protects against a future feature that mutates an
  existing row's `reports_to_assignment_id` in place, which does not exist
  today. If no such feature is ever added, the lock remains inert overhead
  (one `pg_advisory_xact_lock` call) rather than dead weight to remove.
## 20. Tests

**Organisation package** (`platform-services/organisation/`):
- `test/unit/employeeService.test.ts` (20 tests, in-memory) — create/read/
  list/update, directory-vs-restricted masking, self-access bypass,
  manager/team fallback, entity isolation, IDOR-safe error identity,
  mass-assignment defence at the service layer, link/unlink identity
  (including the one-active-link-per-user/employee rule), audit-content
  redaction, and SK Lai & Partners' privileged-tier requirement.
- `test/unit/employmentAssignmentService.test.ts` (10 tests, in-memory) —
  hire records department/position; a transfer creates history rather than
  overwriting; an ended assignment is not returned as current; a transfer
  requires `manage_assignment` over both the origin and destination entity;
  self-reporting rejected; a two-hop circular reporting relationship
  rejected; a valid non-circular reporting assignment succeeds;
  `manage_reporting` is distinct from `manage_assignment`; termination
  closes the assignment with an end date, no successor row, and the
  assignment's own `status` updated to the terminal value; a secondary
  (non-primary) assignment coexists with the primary one.
- `test/integration/postgres.test.ts` (21 real-Postgres tests) —
  concurrency-safe employee-number sequence draws; the one-open-primary
  partial unique index enforced at the database level; a non-primary
  assignment coexisting with an open primary at the database level;
  self-reporting `CHECK` constraints on both `positions` and
  `employment_assignments`; an unknown `legal_entity_id` FK rejection; an
  invalid employment-status `CHECK` rejection; `user_employee_links`'
  one-active-link partial unique indexes with preserved unlinked history;
  a full end-to-end run proving a Group-wide, non-privileged administrator
  cannot create an SK Lai & Partners employee while a privileged one can;
  **four transactional-employee-creation tests** (§16) — a successful
  creation commits both rows together, a forced initial-assignment failure
  leaves neither row persisted, a duplicate `work_email` leaves no partial
  second employee, and a rollback is never followed by a completed-creation
  audit event; **two reporting-cycle concurrency tests** (§17) — two
  simultaneous, mutually-adversarial reporting changes both commit safely
  with the resulting graph confirmed acyclic (run 5 internal iterations per
  test execution), and self-reporting/ordinary multi-hop cycle
  detection/valid changes/effective-dated history all remain correct
  through the now-transactional, lock-aware code path; and **six current-
  manager-assignment-integrity tests** (§18) — reporting to a current
  manager assignment succeeds; reporting to a manager's closed assignment
  is rejected; a nonexistent id and a real-but-closed id produce an
  identical error; self-reporting and cycle detection remain correct
  alongside the new check; a closed historical assignment retains its
  original manager reference after later transitions for either party; and
  a transfer/promotion establishing a new current manager never rewrites
  the previous assignment's own reporting history.
- `test/integration/http.test.ts` (14 real-HTTP tests) — unauthenticated/
  invalid/revoked-session denial; the legal-entities reference endpoint; a
  full hire→read→transfer→end-of-employment flow proving history is
  preserved across a real HTTP transfer; mass-assignment rejection;
  malformed-input rejection; the IDOR/existence-leak check; entity
  isolation (a legal-entity-scoped caller cannot list or read employees
  outside their entity); directory-vs-restricted field masking (asserting
  a personal email never appears in an unauthorized response); identity
  link/unlink with an audit-trail check; the one-active-link-per-user
  rejection; proof that creating an employee never provisions an Identity
  login account; and organisation-structure write permission separate from
  read access.

**Identity package** (`platform-services/identity/`): the User↔Employee
linkage capability (`UserEmployeeLink`, `UserRepository.linkEmployee`/
`findActiveLinkByUserId`/`findActiveLinkByEmployeeId`/`unlinkEmployee`)
remains the only *feature* addition. One further, narrowly-scoped
correctness fix was made in `pgDatabaseProvider.ts` (§18) — registering a
pass-through type parser for the `date` OID so `DATE` columns return the
plain string every domain type already declares, rather than a `Date`
object — needed to make the current-manager-assignment check work
correctly against real Postgres at all. This is a one-line, single-file
bug fix, not a new capability; it changes no existing behavior any test
relied on (verified: 96/96 unaffected) and corrects a latent defect in
Data Vault's own `checkedDate` field as a byproduct (§18).

**Data Vault package** (`platform-services/data-vault/`): no source changes
in this package. Its full suite (46/46) passes unchanged after Identity's
date-parser fix, confirming that fix is a pure correctness improvement
with no regression — including for the one field (`checkedDate`) it
incidentally also corrects.

All three packages' full suites were run against a real Postgres database
(and a clean-install simulation — fresh test database, `npm ci`, typecheck,
migrate, test) before this PR was opened.
