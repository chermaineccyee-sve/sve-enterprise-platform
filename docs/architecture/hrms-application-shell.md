# SVEGIP HRMS Application Shell & UI/UX Foundation (PR #11)

## 1. Role of HRMS within SVEGIP

People/HRMS is a native functional area of the existing SVE Group Portal
(`apps/svegip`) — not a separate HR portal, not a separate login, not a
second application shell. An authenticated SVEGIP user moves between
"My Workspace," "People / HRMS," "Group Management," "Group Resources,"
and "Business Units" inside the same session, the same sidebar, the same
visual identity. This PR replaces the previous static "People & HR" stub
(two cards explicitly labelled "Planned production module") with a real
presentation layer over the domain services already built in PRs #6–#10
(`platform-services/organisation`, `hrms`, `workflow`, `identity`).

```
SVEGIP Presentation Layer   (apps/svegip/app.js — this PR)
        ↓
Netlify proxy functions     (apps/svegip/netlify/functions/*-api.mts — this PR)
        ↓
Organisation / HRMS / Workflow / Identity HTTP APIs   (already built)
        ↓
Repositories
        ↓
PostgreSQL
```

The frontend never becomes authoritative for HR records: every screen
reads through the proxy functions to the real services, and the one
write path implemented (Workflow task decisions) calls the real
`POST /workflow/tasks/:id/decide` endpoint — never a client-side status
flip.

## 2. Critical existing-architecture finding (read before extending further)

`apps/svegip` is **not** a modern SPA framework app. It is a hand-written,
framework-free static site (`app.js`, one script; `styles.css`, one
stylesheet) served by Netlify, backed by Netlify Functions + Netlify DB
(Neon Postgres) — a completely separate stack and schema from
`platform-services`. Before this PR, **no** `platform-services` HTTP API
was reachable from the deployed SVEGIP site: each service
(`identity`/`organisation`/`hrms`/`workflow`) is its own standalone Node
HTTP server on its own port, with no gateway/proxy/redirect wired from
Netlify. This is a pre-existing, shared gap across the whole platform —
Data Vault's own backend is documented elsewhere as "implemented, PR
draft, not deployed" for the same reason.

This PR closes that gap for Organisation/HRMS/Workflow using the exact
precedent Data Vault already established for Identity: a transitional
SVEGIP session-cookie bridge (`identity/src/services/
svegipSessionBridge.ts`), now wired into three more services (see §6).

## 3. Information architecture

```
SVE GROUP PORTAL / SVEGIP
        │
        ├── My Workspace
        │     ├── My SVE        (Overview / My Profile / My Employment / My Tasks)
        │     └── My Tasks      (real Workflow tasks assigned to the caller)
        │
        ├── People  (internally "hrms" — own sidebar mode, peer to SVE/SKL)
        │     ├── HR Dashboard
        │     ├── Employee Directory  →  Employee Profile
        │     ├── Onboarding
        │     ├── Probation & Confirmation
        │     ├── Employment Changes
        │     ├── Offboarding
        │     └── Approvals      (Workflow approval tasks, HR-lifecycle framed)
        │
        ├── Group Management & Intelligence   (unchanged)
        ├── Intelligence (Data Vault)          (unchanged)
        ├── Group Resources                    (unchanged)
        ├── Business Units (SVE Intl / SKL)    (unchanged)
        └── System (Administration)            (unchanged)
```

Employee Master / Employee Profile is **not** a separate top-level nav
item — it is reached by selecting a row in Employee Directory (mirrors
the existing "Employee Accounts → View Profile" pattern already in this
codebase). The four HR-lifecycle nav items (Onboarding / Probation &
Confirmation / Employment Changes / Offboarding) all render through one
shared list/detail pair parameterised by `lifecycleType`, since HRMS
models all four as one generic case with a `lifecycleType` discriminator
— building four near-identical screens would duplicate, not clarify.

**Notifications** (listed under My Workspace in the brief) is
deliberately **not built or shown** — no backend capability exists for
it, and a generic notification framework is explicitly out of scope
(brief item 20). Per the brief's own instruction ("should preferably
remain hidden until implemented rather than displaying fake data"), it
is simply absent from the nav rather than shown as a disabled/placeholder
item.

## 4. Personas

Implemented via `SVEGIP_ACCESS_POLICY` (existing pattern, extended, not
replaced):

| Persona | mysve/mytasks | hrms (People/HRMS) | admin |
|---|---|---|---|
| Employee | ✓ | ✗ | ✗ |
| Employee + `hr.access` permission | ✓ | ✓ | ✗ |
| HR / Management | ✓ | ✓ | ✓ |
| Executive Office | ✓ | ✓ | ✗ |
| Manager/Approver | ✓ (sees own tasks/approvals via Workflow's own candidate resolution) | role-dependent | role-dependent |
| SKL User / Legal Reviewer | ✓ | ✗ | ✗ |
| Administrator (SVEGIP portal role) | ✓ | ✓ | ✓ |
| System Administrator (platform `service` principal) | n/a — not a portal login | n/a | n/a |
| Finance | not part of this PR — no Finance role exists in SVEGIP's own role table, and none of this PR's screens infer HR access from a Finance-shaped role | | |

`Administrator` here is SVEGIP's own existing pilot-access "portal
super-admin" role (already sees Admin/CMS, Data Vault access grants,
etc. — a pre-existing concept, not introduced by this PR) and must not be
confused with the platform's `service`-type system principal from PR
#10, which holds only `identity.security.manage_account` and gets no HR
access of any kind. SK Lai & Partners' stronger legal-entity/
classification segregation and the fact that Singapore Group HQ status
implies no automatic unrestricted access are both enforced entirely at
the `platform-services/organisation`/`hrms` RBAC layer (PRs #6–#10,
unchanged by this PR) — this frontend adds no exception to either.

## 5. Navigation model / authorization

`portalAllowed(page)` (existing function, extended) remains the single
source of truth for nav visibility: role → allowed page-key list, plus
narrowly-granted boolean flags (`accounts.manage`, `hr.access`, ...) —
the same mechanism already used for `accounts.manage`/`vault.audit`/
`vault.admin`/`decisions.manage`. `permittedNav()` renders nothing (not a
disabled button) for a disallowed page; `go()` re-checks `portalAllowed`
on every navigation attempt, not just at render time.

**Hiding a menu item is not treated as security** (brief item 15,
respected exactly): every People/HRMS screen calls the real
`organisation`/`hrms`/`workflow` HTTP APIs through the proxy functions,
and each of those independently re-verifies the caller's identity and
RBAC permissions via its own `requireActor` + `rbac.authorize()` chain
(PRs #6–#10, unchanged). A user who could somehow reach a People/HRMS
screen despite the nav hiding it would still be correctly denied by the
backend — proven by the existing, unmodified integration test suites for
those services, which all remain green (§12).

## 6. Frontend/backend boundary — the SVEGIP↔platform-services bridge

Three new pieces, all following an established precedent rather than
inventing a new one:

1. **SVEGIP session-cookie bridge, extended to Organisation/HRMS/
   Workflow** (`src/api/middleware/actor.ts` in each package): tries a
   native Identity bearer session first, then falls back to verifying
   the SVEGIP `svegip_session` cookie via the SAME
   `identity/src/services/svegipSessionBridge.ts` capability Data Vault
   already depends on — extracting only a verified email, never the
   cookie's own role/unit/permissions claims. A CSRF/Origin check runs
   before any user lookup on state-changing requests under the cookie
   path (mirrors Data Vault's `requireDataVaultActor` exactly, including
   its `CsrfOriginRejectedError`). Each package's own
   `config/trustedOrigins.ts` (`SVE_ORGANISATION_TRUSTED_ORIGINS`,
   `SVE_HRMS_TRUSTED_ORIGINS`, `SVE_WORKFLOW_TRUSTED_ORIGINS`) is
   deployment configuration, never a hard-coded domain.
2. **Netlify proxy functions** (`apps/svegip/netlify/functions/
   {organisation,hrms,workflow}-api.mts`, sharing `_platform-proxy.mts`):
   same-origin from the browser's perspective (no CORS concern), verify
   the caller's SVEGIP session first (`resolveLiveSecurityContext`, the
   same check every other authenticated Netlify function in this app
   already uses), then forward the request — Cookie/Origin/Referer
   headers unmodified — to the target service's real HTTP API via an
   env-configured base URL (`SVE_ORGANISATION_API_BASE`,
   `SVE_HRMS_API_BASE`, `SVE_WORKFLOW_API_BASE`; default to each
   service's own dev-mode port). The proxy never asserts an identity of
   its own accord — the target service independently re-verifies the
   same cookie and makes its own authorization decision.
3. **One narrow backend addition**: `GET /api/v1/employees/me`
   (`platform-services/organisation`), resolving the caller's own linked
   Employee Master record via the existing `user_employee_links` lookup
   and the already-existing self-view bypass in `employeeService`. No
   new permission, no new access model — the caller could already fetch
   this via `GET /employees/:id` once told their own id; this exposes it
   under one, correct, self-service path. This is the one legitimate
   source for "My Profile"/"My SVE" and any future header display-name
   work, since `identity`'s own `/users/me` deliberately stays
   domain-blind to Organisation.

**Explicit, documented precondition, not solved by this PR**: production
reachability of `platform-services` (i.e., those services actually
deployed somewhere the Netlify proxy functions' outbound `fetch` can
reach) is a deployment concern, identical to Data Vault's own current
"implemented, not deployed" state. Building that deployment is
explicitly out of scope (brief item 20: "AWS infrastructure," "SVE
private-server deployment," "Netlify production cutover"). Locally/in CI,
the proxy functions default to each service's own `server.ts` port
(4003/4004/4005), matching how the existing integration test suites
already run these services.

## 7. Backend capability mapping / API gap assessment

| UI need | Classification | Detail |
|---|---|---|
| Employee directory list | **Available now** | `GET /api/v1/employees` — returns BU/dept/position **ids** only; directory/profile screens resolve names client-side against `GET /organisation/{business-units,departments}` (fetched once, cached for the session) |
| Employee profile (Overview/Employment/Position/Lifecycle/History) | **Available now** | `GET /employees/:id` + `GET /employees/:id/assignments` (history) + `GET /hrms/lifecycle/cases?employeeId=` (lifecycle) — three calls, no server-side join |
| My Profile / My SVE overview | **Small gap, closed in this PR** | new `GET /employees/me` (§6.3) |
| HR lifecycle list/detail (all 4 types) | **Available now** | `platform-services/hrms`'s existing routes, three-tier classification respected as-is |
| My Tasks / Approvals list | **Available now**, needs client-side join | `GET /workflow/tasks` returns no subject/process/stage — this UI joins each task to its instance (`GET /workflow/instances/:id`) and, when `subjectType==="hrms.lifecycle"`, the underlying HRMS case (`GET /hrms/lifecycle/cases/:id`), bounded by the size of one user's own task list |
| Approve/Reject/Return a task | **Available now** | real `POST /workflow/tasks/:id/decide` — this UI does not pre-fetch a step's `permittedDecisions` (would need a further `GET /workflow/versions/:id/steps` join); an impermissible decision is surfaced as the backend's own honest error rather than pre-validated client-side. Documented small gap. |
| "Submitted by" display name on a task/instance | **Future module** | no endpoint resolves an arbitrary `userId` to a display name; this UI shows a shortened id, explicitly labelled, rather than a name |
| HR Dashboard counts (active employees, onboarding/probation/employment-change/offboarding in progress) | **Available now**, computed from real (unpaginated) list calls | not a fabricated number — each tile reflects a real `GET /employees` or `GET /hrms/lifecycle/cases?...` response, filtered by the browser. Not a substitute for a real aggregation endpoint at scale (see §9) |
| "Pending HR Tasks" / "Probation Reviews Due" dashboard tiles | **Future module — shown as "Not available in this release,"** never a fabricated number | no filter/endpoint exists for either; building the N+1 fetch-and-filter needed for "reviews due" was judged not worth doing for a dashboard tile in this PR |
| Legal Entity / Business Unit / Department / Position reference lists | **Available now** | `platform-services/organisation`'s reference-data routes, including `GET /organisation/positions` (used from the polish pass to resolve Position on Employee Directory/Profile/My SVE) — flagged, unchanged by this PR: gated only by "has a session," not an RBAC permission |
| "What can I do" (permission list for nav) | **Does not exist** | RBAC only exposes per-key `authorize()`; nav visibility is instead driven by SVEGIP's own role/permission model (§5) — a UX narrowing, not a substitute for backend RBAC |
| Employee documents | **Out of scope** | no employee document store exists in this domain; the Documents tab renders an explicit "Not available in this release" state |

Nothing above was solved automatically beyond the one narrow addition in
§6.3, per the brief's own instruction not to solve every gap
automatically.

## 8. Responsive approach

Reuses the existing, already-working mobile drawer (off-canvas sidebar +
overlay + hamburger, 820px breakpoint) and the existing table→card
transformation (`.mobile-record-list`) for every new data table
(Employee Directory, My Tasks/Approvals, HR Lifecycle lists). New
People/HRMS-specific CSS (`.hrms-*` classes in `styles.css`) follows the
same tokens (`--sve-purple`, `--sve-orange`, `--muted`, `--line`,
`--radius`, `--shadow`) already defined for the rest of the shell — no
new color palette, no illustrations, no oversized cards, no decorative
avatars. Filter controls (Employee Directory's 4 dropdowns + search)
stack to one column on narrow viewports, matching the existing
`.account-tools` pattern's own responsive behaviour.

## 9. Security model

- No sensitive localStorage persistence — confirmed by a static test
  (`apps/svegip/test/noLocalStorage.test.mjs`) that `app.js` contains no
  `localStorage`/`sessionStorage` API usage at all.
- No frontend-authoritative RBAC — every screen's data and every write
  action is re-authorized server-side; nav visibility is UX only (§5).
- No hard-coded privileged access — the one narrowly-granted flag added
  (`hr.access`) follows the exact existing convention for
  `accounts.manage`/`vault.audit`/`vault.admin`/`decisions.manage`.
- No direct browser-to-database access, no bypass around entity access
  or classification controls — this frontend adds no new data path that
  doesn't already go through `organisation`/`hrms`/`workflow`'s existing,
  unmodified RBAC/classification enforcement.
- No bypass around PR #10's disabled-account protections — the SVEGIP
  bridge resolves to a real `users` row and is subject to the exact same
  central active-account invariant (`rbacService.authorize()`,
  `sessionService.validateSession()`) as a native bearer session; a
  disabled Identity user is denied via the bridge exactly as a bearer
  caller would be (already proven for Data Vault's own bridge tests,
  replicated for Organisation/HRMS/Workflow in this PR's own
  `test/unit/actorBridge.test.ts` files).
- No fake Workflow approval state, no client-side-only lifecycle/
  offboarding completion — Approve/Reject/Return calls the real decide
  endpoint; no lifecycle case is ever marked complete from the browser
  (this PR's lifecycle case-detail screen is read-only by design — see
  §10).
- HR Dashboard counts are real (computed from real list responses), not
  invented; unavailable counts render an explicit "Not available"
  state, never a fabricated number (§7).

## 10. What PR #11 intentionally does not implement

- Leave/Attendance/Claims/Payslips/Performance/Training/Documents/
  Policies & Acknowledgements modules under My SVE — shown as inert
  "Planned" cards with no backend calls, never fake data.
- Compensation/Payroll tabs on the Employee Profile — not even a
  placeholder tab, since no such data exists in the Employee Master
  domain at all (by that domain's own design).
- Writing a lifecycle case's stage/decision/completion from the browser
  — HR Lifecycle case-detail is read-only in this PR; the four
  type-specific completion endpoints
  (`probation-decision`/`employment-change/complete`/
  `offboarding/complete`/`submit-for-approval`) each have distinct
  payload shapes, and wiring all four correctly was judged a follow-up
  rather than something to rush into this shell PR.
- A dashboard aggregation endpoint — HR Dashboard's real-but-client-
  computed counts (§7) are a stand-in, not a permanent design; a proper
  fix needs either count-only queries or pagination totals on the
  underlying list endpoints, deliberately not built here.
- Resolving `permittedDecisions` before showing Approve/Reject/Return —
  the backend's own validation is treated as sufficient rather than
  pre-fetching a step's definition to hide invalid buttons.
- A user-display-name lookup service — "Submitted by" shows a
  shortened user id, not a name, until such an endpoint exists.
- Any new authentication architecture, SSO, or passkeys — the SVEGIP
  cookie bridge is transport-only and reuses Identity's own existing,
  already-accepted transitional bridge capability (§6.1), never a new
  identity/session model.
- Any of: Leave engine, Attendance engine, Payroll, Payslip generation,
  iClaims, Accounting Pro, Performance engine, Training engine,
  Recruitment/ATS, native mobile app, AWS/SVE-private-server/Netlify
  production deployment, a generic notification framework, escrow, an
  AI HR assistant, a client-facing HR product, or a commercialisation
  layer.

## 11. Regression baseline

Backend regression (substantive `test()` counts) immediately before this
PR (i.e. after PR #10): Identity 104, Data Vault 46, Organisation 65,
Workflow 61, HRMS 85 — all unaffected by this PR's UI work and unchanged
in count for Identity/Data Vault. This PR adds:

- Organisation: 65 → 73 (+8: `test/unit/actorBridge.test.ts` ×7,
  `test/integration/http.test.ts`'s new `/employees/me` test ×1).
- HRMS: 85 → 92 (+7: `test/unit/actorBridge.test.ts` ×7).
- Workflow: 61 → 68 (+7: `test/unit/actorBridge.test.ts` ×7).
- `apps/svegip`: 0 → 8 (`test/navigation.test.mjs` ×7,
  `test/noLocalStorage.test.mjs` ×1) — this package had zero tests
  before this PR.

All packages green on a fresh CI-equivalent Postgres database. No
existing test was weakened, skipped, or deleted.

## 12. Post-review polish pass

A follow-up, presentation-only pass over the same screens (no
architecture, API, backend, or responsive-behaviour change):

- Removed developer/architecture wording from user-facing copy (e.g. "the
  HRMS service remains authoritative," "counts require a dedicated
  aggregation endpoint" — this reasoning now lives only in this doc).
- Added `hrmsLabel()`/`hrmsStatusBadge()` to render raw backend enums
  (`full_time`, `IN_PROGRESS`, `ON_LEAVE`) as proper display labels
  everywhere they appear, without changing the values `statusBadge`'s
  colour logic evaluates.
- HR Dashboard's two "not available" tiles (Pending HR Tasks, Probation
  Reviews Due) were removed rather than shown as gaps — the remaining
  five tiles are all real counts.
- My SVE now leads with a personal profile summary card (name, resolved
  position/department, status, employment type, tenure) instead of an
  Employee-Master-styled metrics grid.
- Employee Directory gained a Position column (resolved via the existing
  `GET /organisation/positions` reference endpoint) and an explicit
  "View Profile →" affordance on every row, matching the existing
  Employee Accounts admin table's own convention.
- Internal identifiers are no longer shown raw: My Tasks/Approvals masks
  the requester as "An SVE employee" (no id fragment) and prefers the
  underlying HR case's own human-readable `currentStage` over Workflow's
  internal step id; the Employee Profile's "Reports To" field shows
  "Assigned"/"Not assigned" rather than a partial assignment id.
- Mobile breadcrumbs drop the "SVE Group" root segment (`.crumb-root`,
  hidden ≤820px) — the page's own `<h1>` and the "⌂ Group Home" button
  already cover that context, so the crumb keeps only the immediate
  parent (if any) plus the current page.
- The user-facing nav label "People / HRMS" is now "People"; `hrms*`
  remains the internal function/route naming throughout the codebase and
  this document.

No new API calls were introduced except resolving `positions` through
the reference-data endpoint already documented in §7 as available now.

## 13. PR #12: Employee Master & My SVE operational foundation

A follow-up focused on making Employee Directory/Profile/My SVE correct and
complete against the real Employee Master, rather than adding new screens.
Full backend rationale (the effective-dating fix, manager display
resolution, the cross-entity guard) lives in
`docs/architecture/organisation-employee-master.md` §21 — this section
covers only the SVEGIP-side presentation changes.

- **Employee Profile is now a real Employee Master view**: a header
  (name, preferred name, employee number, resolved position/department/
  legal entity, status) plus real tabs — Overview, Employment,
  Organisation & Reporting, Lifecycle, History — switched client-side
  (`hrmsSwitchProfileTab()`) from data already fetched for the screen,
  never a re-fetch per tab. Employment and History are omitted entirely
  (not shown empty) for a viewer without restricted-tier access to that
  employee, since every field either tab shows is restricted-tier; the old
  single decorative "Overview" tab button and the "Documents — Not
  available in this release" section are both removed.
- **"Reports To" now shows a resolved name and title** (e.g. "Eric Tang —
  Chief Strategic & Planning Officer") via the new `managerDisplay` field,
  or "Not assigned" — never the previous "Assigned"/"Not assigned"
  placeholder, and never a raw assignment id.
- **History is a merged, human-readable timeline** — the employee's
  assignment history plus completed/cancelled HR lifecycle cases, sorted
  chronologically (`hrmsProfileHistoryEvents()`) — built entirely from data
  the Profile screen already fetches; see the architecture doc §21.4 for
  why this is deliberately not a full event-sourced timeline.
- **My SVE's identity summary now includes the legal entity** (e.g. "Jane
  Tan · Strategic Business Management Consultant · SVE International Sdn.
  Bhd. · Kuala Lumpur"), and My Employment gained Employment Type, Status,
  Department, and Manager (via the same `managerDisplay` resolution) —
  matching the brief's target employee-facing summary. My SVE remains
  read-only: no field here was ever editable, and none was made editable
  by this PR.
- **Employee Directory, search, and reference-data loading are unchanged**
  — PR #11's implementation (search by name/employee number, Legal
  Entity/Business Unit/Department/Status filters, the Position column, the
  "View Profile →" affordance, and PR#11's mobile-card responsive layout)
  already met PR #12's brief in full; it automatically inherited the
  effective-dating fix (§21.1) since it consumes the same `listEmployees()`
  service call.
- No new SVEGIP↔platform-services API surface was added beyond the fields
  already present on the existing `/employees/:id` and `/employees/me`
  responses (`managerDisplay`); no new Netlify proxy routes were needed.

## 14. PR #13: HR Lifecycle & Approval Experience

Closes the two gaps §10 explicitly deferred: HR Lifecycle case-detail was
read-only, and none of the four type-specific completion/decision
endpoints were wired to a real UI action. This PR turns the four
lifecycle areas into a genuine operational process — Submit/Prepare →
Workflow Approval → Approve/Reject/Return → HR Completion → Organisation
mutation where applicable → Employee Profile/History reflects the result
— using only `organisation`/`hrms`/`workflow`'s existing capabilities.
Domain ownership is unchanged and non-negotiable: HRMS owns cases/events/
milestones/probation; Workflow owns approval orchestration; Organisation
owns the Employee Master and effective-dating; Identity owns account
deactivation. SVEGIP remains presentation/integration only — no new
workflow engine, no duplicated validation.

### 14.1 Visible vs authoritative — the UI boundary

Every field this PR shows is read from a backend response at the moment
of rendering; nothing is computed, cached across a decision, or assumed.
Concretely:

- The case-detail screen's data (`loadHrmsCaseDetailData`) is fetched
  fresh on every `goHrmsCase()` navigation and after every action that
  changes state (a decision, a probation outcome) — never patched
  optimistically in the DOM. `hrmsCaseDataCache` holds only the last
  fetch for the currently-open case, purely to avoid a second network
  round-trip when switching tabs.
- The Employment Change case's "Current" position/department/entity
  comes from `/employees/:id`'s `currentAssignment`, which is already
  effective-dated as of today (PR #12's fix, `organisation-employee-
  master.md` §21.1) — this PR added no new date logic. "Proposed" comes
  from the new `proposedChange` projection (§14.6) and is never merged
  into "Current" regardless of how close its effective date is; it moves
  to "Current" only once the underlying assignment actually takes effect,
  observed the next time `/employees/:id` is fetched.
- A probation, employment-change, or offboarding decision/completion
  action always calls the real backend endpoint and re-renders from its
  response (or from a follow-up `GET`) — there is no "optimistic complete"
  anywhere in this PR.

### 14.2 Lifecycle list and case detail

The existing shared list/detail pair (§3) is extended, not replaced,
across all four `lifecycleType`s:

- **List columns** (`renderHrmsLifecycleList`) are limited to what the
  backend actually returns per case: Employee (resolved via
  `hrmsEmployeeNameLookup`, never a raw id), Process (humanized
  `lifecycleType`), Current Status/Stage, Initiated Date, and — only for
  `employment_change`/`offboarding` (the two `SUBMITTABLE_TYPES`, unchanged
  from PR #9) — an Approval Status column via `hrmsApprovalStatusLabel`,
  itself a live read of `GET /hrms/lifecycle/cases/:id/approval`, never a
  cached or inferred value. Onboarding/probation never show a fabricated
  Approval Status, since neither type is ever submitted to Workflow.
- **Case detail tabs are type-aware** (`HRMS_CASE_TABS_BY_TYPE`), not a
  one-size-fits-all set — Approvals appears only for the two submittable
  types (the only ones with a real Workflow relationship); Milestones
  appears only for onboarding/offboarding (the only types with a real
  milestone concept in HRMS's own domain model). No empty decorative tab
  is ever rendered, per the brief's explicit instruction.
  - **Onboarding**: Overview / Process Details (milestones checklist +
    manual complete) / Milestones / History.
  - **Probation & Confirmation**: Overview / Process Details (period,
    reviewer, review status, decision, recommendation, decision date) /
    History — the strongest flow, as the brief required, driven entirely
    by `HrProbationReview` records already modelled in PR #7
    (`hrms-employee-lifecycle.md` §7).
  - **Employment Change**: Overview / Process Details (Current vs
    Proposed, §14.1) / Approvals / History.
  - **Offboarding**: Overview / Process Details (last working day,
    assignment end-state, Identity deactivation status, §14.6) /
    Approvals / Milestones / History.
- **History** (`hrmsCaseHistoryTab`) is a human-readable chronological
  merge of the case's own lifecycle events and milestones (`GET .../
  events`, `GET .../milestones`) — humanized via the same `hrmsLabel()`
  enum-to-title-case convention already used across Employee Profile
  (§13), never a raw `eventType`/internal event name. No new event store
  was introduced; this reuses exactly what PR #7 already records.

### 14.3 Probation review — the real decision action

`recordHrmsProbationDecision` is the one genuinely operational action this
PR wires for onboarding/probation cases: it calls the real
`POST /cases/:id/probation-decision`, then re-fetches the case (never a
client-side "recorded" flip). Decision controls (confirm/extend/
unsuccessful) render only while the current review's `reviewStatus` is
`PENDING` (per HRMS's own state machine, `hrms-employee-lifecycle.md`
§7) — once decided, the UI reflects the backend's own resulting state
(confirmed/extended-with-a-new-period/unsuccessful-and-completed) rather
than implying a decision is still open.

### 14.4 Approval experience — real Workflow tasks, never optimistic

Approvals (the existing nav item) and each case's Approvals tab both
render live Workflow task/decision data — no duplicated authority model.
`decideHrmsTask` (existing from PR #11, hardened in this PR):

- Calls the real `POST /workflow/tasks/:id/decide` and always re-renders
  from the backend afterward (`renderSection()`), including on failure —
  a task the backend reports as already decided, cancelled, or otherwise
  stale is reflected honestly rather than left showing a stale "Pending"
  state or forcing a browser-held status.
- Gained a duplicate-submission guard (`hrmsPendingDecisions`, a `Set`
  keyed by task id): a second click on the same task while the first
  request is still in flight is a client-side no-op, purely a UX
  courtesy — the authoritative guard against a genuine double-decision
  remains Workflow's own compare-and-swap `transitionStatus` (proven
  under real concurrency in `platform-services/workflow`'s
  "two concurrent decisions on the same task produce exactly one
  committed decision" test).
- Never pre-validates `permittedDecisions` client-side (unchanged
  from PR #11, §7) — an impermissible decision surfaces as the backend's
  own error text.
- **My Tasks** stays a personal cross-process queue (existing screen,
  unchanged authority model) — it does not duplicate Approvals' own
  candidate/eligibility resolution; it lists exactly what
  `GET /workflow/tasks` (candidate-scoped to the caller) returns, and
  refreshes the same way after a decision.

### 14.5 HR execution principal vs decision actor vs business approver vs target employee

PR #9's distinction (`hrms-workflow-integration.md` §3d) is never
collapsed in this UI. Concretely:

- The Approvals tab and Approvals/My Tasks screens show only the
  **decision** (who approved/rejected/returned, and when, is available
  from Workflow's own decision record) framed as a process outcome —
  never the internal **execution principal** (the HR user whose
  authority the completion write runs under, re-resolved fresh server-
  side at execution time) and never the **target employee** conflated
  with either. A reviewer sees "Approved" / "Rejected" / "Returned" with
  a timestamp, not a security-principal identifier.
- No screen in this PR ever asks the browser to assert which principal a
  write should run as — every completion call identifies only the case
  id; HRMS resolves `hrOwnerUserId` and revalidates authority live at its
  own authoritative boundary (`completeCaseWithAuthoritativeWrite`),
  exactly as before this PR.

### 14.6 Employment Change and Offboarding — no direct Organisation/Identity mutation

Both screens are strictly a view over cases already flowing through
HRMS→Workflow→HRMS-completion→Organisation-mutation
(`hrms-workflow-integration.md` §3b) — this PR adds no button that calls
Organisation or Identity directly.

- **Employment Change**: "Current" vs "Proposed" (§14.1) is built from
  two small, additive backend read paths, both allowlisted rather than
  exposing HRMS's internal free-form completion-input bag verbatim:
  `HrLifecycleCase.pendingCompletionInput` is now serialized as
  `proposedChange` on the case's restricted-tier response, through an
  explicit `PROPOSED_CHANGE_ALLOWED_KEYS` allowlist (`hrms/src/api/
  routes/lifecycle.ts`) that deliberately excludes
  `reportsToAssignmentId` and any unrecognized key — defense-in-depth
  against a caller having stuffed something internal into that bag. A
  case not yet submitted shows an honest "not yet submitted" state
  rather than inventing values.
- **Offboarding**: deactivation status is a new read-only projection,
  `GET /cases/:id/deactivation-status` (`offboardingService
  .getDeactivationStatus`, gated by the exact same `lifecycle.getCase`
  access check as the case itself), humanized in the UI as one of
  **not requested / requested / retry pending / completed** — never the
  raw `hr_identity_deactivation_requests.status` enum, never sensitive
  free-text. This is a pure read over PR #10's existing
  offboarding-completed→deactivation-request→Identity-processor→
  disable+revoke+audit chain (`identity-offboarding-revocation.md`); no
  code path in this PR calls Identity, and none creates or resolves a
  deactivation request — that remains exclusively `completeOffboarding`'s
  job, unchanged.

Both of these are the only two backend additions in this PR (see
`hrms-employee-lifecycle.md` §15 and `hrms-workflow-integration.md` §18
for their exact route/service documentation) — every other screen in
this PR consumes routes that already existed.

### 14.7 Permissions, self-view, and sensitive content

No new permission or access model was introduced; every screen continues
to rely on `organisation`/`hrms`/`workflow`'s own existing RBAC/
classification enforcement (§9), extended only insofar as it now renders
write actions, not just reads. In particular:

- **Self-view stays conservative**: an employee viewing their own record
  does not gain visibility into every case, decision note, or event —
  HRMS's own `resolveAccess` self-view bypass (unchanged) already limits
  self-access to base+restricted tiers, never the decision tier
  (`hrms-employee-lifecycle.md` §12); this PR invents no broader
  self-view than that. My SVE continues to show employment outcomes only
  through the Employee Master, post-completion — this PR added no
  employee-facing case/decision feed.
- **Manager/Approver** sees only assigned-decision information (their own
  Workflow tasks) — never the fuller HR administrative view of a case.
- **No sensitive free-text** (termination/disciplinary/probation notes)
  is rendered in any list or the Approvals tab; only structured,
  already-classification-controlled fields the backend serializes for
  the caller's tier are shown, unchanged from HRMS's existing
  three-tier model (§12 of `hrms-employee-lifecycle.md`).
- Entity/SK Lai & Partners segregation, Group-HQ non-implication, and the
  System-Administrator/Finance-get-no-automatic-lifecycle-access rules
  are all enforced identically to §4/§9 above — this PR adds no
  exception.

### 14.8 Stale/concurrent behaviour

The UI treats the backend as authoritative in every case, per §14.1/
14.4: an already-decided task, an already-completed case, a returned
task, a lost permission, or an actor disabled mid-screen are handled
entirely by `hrms`/`workflow`'s existing checks
(`requireActiveAccount`, the CAS `transitionStatus`, `resolveAccess`)
and surfaced to the user as the backend's own honest response — this PR
adds no client-side prediction of any of those outcomes, and the
`hrmsPendingDecisions` guard (§14.4) is UX-only, not a substitute for
that server-side compare-and-swap.

### 14.9 Mobile and accessibility

Reuses the existing responsive/table-to-card and drawer-nav conventions
(§8) for every new lifecycle list, case-detail tab set, and approval
action — no squeezed desktop table. Case-detail tabs use the existing
accessible tab pattern from Employee Profile (§13): keyboard-navigable,
labelled, with visible focus states; status is always paired with text
(never colour alone), and every decision control (Approve/Reject/Return,
probation decision buttons) is a real `<button>`, operable without a
mouse.

### 14.10 What PR #13 intentionally does not implement

- No new workflow engine, no generic event bus, no generic notification
  framework — unchanged exclusions from §10, still out of scope.
- No new aggregation API for HR Dashboard — the dashboard's lifecycle-
  area links (added in this PR) reuse the same client-computed counts
  approach as §7, never a fabricated total.
- No "Submitted by"/decision-actor display-name resolution beyond what
  already existed (§10) — Approvals still shows a decision outcome, not
  a resolved approver name, consistent with §14.5's masking.
- Leave, Attendance, Payroll, Payslips, iClaims, Accounting Pro,
  Performance Management, Training, Recruitment/ATS, salary/compensation
  data, native mobile app, SSO/passkeys, AWS/server deployment, or a
  Netlify production cutover — none of this PR's screens assume or
  depend on any of them; a future Leave/Attendance module would extend
  HRMS's own case model the same way this PR extended its UI, not
  require any change here.

### 14.11 Regression

`platform-services/hrms`: 92 → 97 (+5: `getDeactivationStatus`
projection tests and `proposedChange` allowlist assertions in
`test/integration/identityDeactivation.test.ts` and `http.test.ts`).
`platform-services/identity` (105), `data-vault` (47), `organisation`
(84), and `workflow` (70) are unaffected by this PR and unchanged in
count. `apps/svegip`: 8 → 29 (+21: `test/employeeMaster.test.mjs`
unaffected at 9; `test/hrLifecycleUI.test.mjs` new, 12 tests covering HR
Dashboard, lifecycle list, all four case-detail tab sets, probation
decision-button visibility, Employment Change Current/Proposed
separation, offboarding deactivation status, Approvals-tab actor
masking, and the duplicate-submission guard). All packages green against
a real Postgres database (`--test-concurrency=1` for every
`platform-services/*` integration suite, per the shared-database
convention documented in `hrms-employee-lifecycle.md` §18/§19 and
reaffirmed here — running these suites' files in parallel against one
physical database causes cross-file interference from each file's own
reset-on-start `withTestDb`, which is a known artifact of that shared-
schema convention, not an application defect). No existing test was
weakened, skipped, or deleted.
