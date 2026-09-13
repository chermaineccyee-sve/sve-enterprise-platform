# platform-services/workflow

**Status: Workflow & Approval Foundation implemented (PR #8).** See
`docs/architecture/workflow-approval-foundation.md` for the full design.

## What this package owns

A reusable **orchestration/approval engine**: workflow definitions
(versioned, DRAFT→PUBLISHED→RETIRED), instances, sequential steps
(APPROVAL/TASK/SYSTEM_ACTION), tasks, and immutable approval decisions.
It does **not** own the business records it orchestrates — a workflow
instance references a business subject by `(subjectType, subjectId)`, a
plain, code-registered-allowlist pair, never a foreign key onto a
business domain's own table.

No business domain is integrated by this PR. This is the reusable
foundation a future PR would have HRMS (onboarding/probation/employment-
change/offboarding approvals), iClaims, Payroll, or Data Vault plug their
own approval needs into — see the architecture doc's "Future integration
boundaries".

## Depends on

- `platform-services/identity` — users, sessions, RBAC, security audit
  (imported by source path, same as Organisation/HRMS before it).
- `platform-services/organisation` — legal entity lookups and
  `EmploymentAssignmentService.resolveDirectManagerUserId()` for MANAGER
  routing/escalation. Imported via its composition root
  (`createOrganisationContainer`), never via its repositories directly.

**Must not depend on:** any specific business domain (`hrms`, `iclaims`,
`payroll`, `accounting`, etc.) — domains plug into this engine, this
engine never plugs into a domain. In particular this package does **not**
depend on `platform-services/hrms`, so a future HRMS-consumes-Workflow
integration can never create a dependency cycle.

**Must not implement:** BPMN, a visual workflow designer, arbitrary
DAG/parallel-branch execution, an expression-language/scripting engine, a
distributed event bus, or Temporal/Camunda-style infrastructure — see the
architecture doc "Explicitly out of scope" for the complete list.

## Database

Migration `005_workflow-approval-foundation` (after HRMS's `004`, none of
which are modified): `workflow_definitions`, `workflow_definition_versions`,
`workflow_steps`, `workflow_instances`, `workflow_tasks`,
`workflow_decisions`, `workflow_events`, `workflow_system_action_executions`.
No new Employee, Legal Entity, or business-domain table.

## API namespace

`/api/v1/workflow` — `/definitions`, `/versions`, `/instances`, `/tasks`,
`/operations/process-escalations`. See the architecture doc for the full
route table.

## Typical data classification

An instance carries its own `dataClassification`, defaulting to (and
never permitted below) its `legalEntityId`'s own ceiling — reusing
Organisation's existing entity/classification model unchanged, so SK Lai
& Partners' RESTRICTED cap applies identically here. Workflow stores only
subject references, routing metadata, decisions, and minimal comments —
never a copy of the underlying business record (no HR files, salary,
bank details, medical information, or claim receipts).
