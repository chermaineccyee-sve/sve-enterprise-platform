-- SVE Enterprise Platform — HRMS <-> Workflow Integration Foundation (PR #9)
-- Follows docs/architecture/data-and-database-conventions.md. Builds on
-- 004_hrms-employee-lifecycle (hr_lifecycle_cases/events) and
-- 005_workflow-approval-foundation (workflow_instances) — ALTERS neither
-- of those migration files (both are already-merged history); every
-- change here is additive: new nullable columns, a new index, and an
-- expanded CHECK constraint (DROP + re-ADD under the same name, the only
-- way Postgres allows widening a column CHECK list). See docs/architecture/
-- hrms-workflow-integration.md "Migration".
--
-- Scope: a durable REFERENCE from an HRMS lifecycle case to the Workflow
-- instance approving it, plus the deferred completion input a SYSTEM_ACTION
-- handler needs once approved. Never a copy of Workflow's own state (no
-- status/outcome column here — that is read live from Workflow, see
-- docs "HRMS <-> Workflow linkage"), never a duplicate Employee/Legal
-- Entity/Workflow table.

-- ============================================================
-- hr_lifecycle_cases: Workflow linkage + deferred completion input
-- ============================================================
-- workflow_instance_id is a REFERENCE only, not a second copy of Workflow
-- state — HRMS never stores its own copy of the instance's status/outcome
-- (see approvalService.getApprovalStatus, which reads it live from
-- Workflow on every call). NULL until submitForApproval() first succeeds;
-- overwritten on a later resubmission after a rejection (the OLD,
-- now-terminal instance remains independently inspectable by its own id
-- via Workflow's own history — this column tracks only the CURRENT/most
-- recent submission). UNIQUE: two different HRMS cases must never
-- reference the same Workflow instance.
ALTER TABLE hr_lifecycle_cases ADD COLUMN IF NOT EXISTS workflow_instance_id UUID REFERENCES workflow_instances(id);
-- DROP + re-ADD (same idempotent-safe pattern as the CHECK constraint
-- below — Postgres UNIQUE constraints have no ADD-if-missing shorthand).
ALTER TABLE hr_lifecycle_cases DROP CONSTRAINT IF EXISTS hr_lifecycle_cases_workflow_instance_unique;
ALTER TABLE hr_lifecycle_cases ADD CONSTRAINT hr_lifecycle_cases_workflow_instance_unique UNIQUE (workflow_instance_id);
CREATE INDEX IF NOT EXISTS hr_lifecycle_cases_workflow_instance_idx ON hr_lifecycle_cases(workflow_instance_id);

-- The employment-change assignment terms / offboarding separation terms a
-- case's approval, once granted, will apply — captured once at
-- submitForApproval() time (never at case-creation time, so the EXISTING
-- employment-change/offboarding case-creation inputs/tests are unaffected)
-- and read back by the registered SYSTEM_ACTION handler at approval time,
-- since approval may happen long after — and by a different request than
-- — the one that submitted. Never copied into Workflow's own instance/
-- task/event payloads (see docs "Subject-data minimisation"); stays
-- entirely inside HRMS's own case row, which is the correct owner of HR
-- process/decision content.
ALTER TABLE hr_lifecycle_cases ADD COLUMN IF NOT EXISTS pending_completion_input JSONB;

-- ============================================================
-- hr_lifecycle_events: widen the event_type CHECK list
-- ============================================================
-- Postgres has no ALTER-in-place for a column CHECK list — DROP + re-ADD
-- under the SAME constraint name (its default auto-generated name from
-- 004's inline CHECK) is the standard, idempotent-safe way to widen one
-- without touching 004's own migration file. Every one of 004's original
-- values is preserved unchanged; only 'approval_submitted' and
-- 'approval_rejected' are new (see docs/architecture/
-- hrms-workflow-integration.md "Rejection/return semantics" for why no
-- separate 'approval_returned'/'approval_approved' value is needed: RETURN
-- is not offered by either of this PR's Workflow definitions, per §16's
-- "clean terminate-and-resubmit model", and a successful approval already
-- has its own established completion event —
-- employment_change_completed/separation_effective).
ALTER TABLE hr_lifecycle_events DROP CONSTRAINT IF EXISTS hr_lifecycle_events_event_type_check;
ALTER TABLE hr_lifecycle_events ADD CONSTRAINT hr_lifecycle_events_event_type_check CHECK (
  event_type IN (
    'case_opened', 'stage_changed', 'milestone_completed', 'review_recorded',
    'recommendation_recorded', 'decision_recorded', 'probation_extended',
    'confirmation_completed', 'employment_change_authorised', 'employment_change_completed',
    'offboarding_initiated', 'separation_effective', 'identity_deactivation_requested',
    'case_completed', 'case_cancelled',
    'approval_submitted', 'approval_rejected'
  )
);

-- ============================================================
-- Seed: none, and no Workflow definition rows are inserted here either.
-- The two Workflow definitions this integration needs
-- (hrms.employment_change / hrms.offboarding) are installed by an
-- idempotent application-level bootstrap
-- (platform-services/hrms/src/integrations/workflowIntegration.ts),
-- never by migration SQL — see docs/architecture/
-- hrms-workflow-integration.md "Workflow definition installation
-- strategy" for why: a definition/version/step is mutable application
-- data with its own versioning lifecycle (DRAFT/PUBLISHED/RETIRED),
-- not schema, and workflow_definitions.created_by is a NOT NULL FK to a
-- real users.id — no such fixed, safe-to-hardcode system user exists to
-- attribute a migration-time INSERT to (mirrors why 005 seeds nothing
-- either).
-- ============================================================
