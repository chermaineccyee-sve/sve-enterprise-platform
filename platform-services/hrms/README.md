# platform-services/hrms

**Status: HRMS Employee Lifecycle Foundation implemented (PR #7).** See
`docs/architecture/hrms-employee-lifecycle.md` for the full design.

## What this package owns

The HR **process/lifecycle** layer: onboarding, probation (review →
confirmation/extension/unsuccessful), employment-change authorisation, and
offboarding — as a sequence of cases, decisions, and append-only business
events. It does **not** own who an employee is or where they sit in the
org chart.

**Employee Master (identity of the employee: legal entity, department,
position, reporting line, effective-dated assignment history) lives in
`platform-services/organisation`, established by PR #6.** HRMS consumes
that data and, for employment changes/offboarding, asks Organisation's own
services to create the authoritative assignment transition — it never
writes to `employees` or `employment_assignments` directly and never
duplicates assignment history.

`apps/svegip`'s `employee_accounts` table remains identity/RBAC only and is
unrelated to either Employee Master or this package.

## Depends on

- `platform-services/identity` — users, sessions, RBAC, security audit
  (imported by source path, same as Organisation and Data Vault before it).
- `platform-services/organisation` — Employee Master reads, legal
  entity/classification rules, and the assignment services used to
  complete employment-change/offboarding cases (`createAssignment`,
  `endAssignment`, `isDirectManagerOf`). Imported via its composition root
  (`createOrganisationContainer`), never via its repositories directly.

**Must not depend on:** `payroll`/`accounting`/`iclaims`/`escrow` internal
schemas or logic. This package does not calculate salary, notice pay, or
statutory severance, and does not implement leave, attendance, performance,
recruitment, or a general workflow/approval engine — see
`docs/architecture/hrms-employee-lifecycle.md` "Explicitly out of scope".

## Database

Migration `004_hrms-employee-lifecycle` (after Organisation's `001`-`003`,
none of which are modified): `hr_lifecycle_cases`, `hr_lifecycle_events`,
`hr_lifecycle_milestones`, `hr_probation_reviews`. No new Employee or Legal
Entity table.

## API namespace

`/api/v1/hrms/lifecycle` — see the architecture doc for the full route
table.

## Typical data classification

Three tiers layered on top of Organisation's entity/classification model:
base case existence/status, restricted process detail (subtype, stage,
outcome, milestone notes), and decision-level detail (probation
recommendations, decision notes, offboarding reasons) — the last of these
is never exposed through self-service, and System Administrator access
does not imply HR access. See the architecture doc "Data sensitivity".
