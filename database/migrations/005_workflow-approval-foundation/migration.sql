-- SVE Enterprise Platform — Workflow & Approval Foundation (PR #8)
-- Follows docs/architecture/data-and-database-conventions.md (UUID keys,
-- created/updated metadata, archive-not-delete/append-only history,
-- idempotent CREATE TABLE IF NOT EXISTS). Builds on 001_identity-foundation
-- (users, legal_entities), 003_organisation-employee-master (employees),
-- and 004_hrms-employee-lifecycle — alters none of those migrations, only
-- references their tables by foreign key.
--
-- Scope: a reusable orchestration/approval ENGINE (definitions, versions,
-- steps, instances, tasks, decisions, business history, system-action
-- executions) — never a business domain's own record. Workflow references
-- a business subject by (subject_type, subject_id) — a plain, un-keyed
-- UUID pair validated against a CODE-level registry (see
-- src/domain/subjectType.ts), never a foreign key onto a business
-- domain's own table. See docs/architecture/workflow-approval-foundation.md
-- for the full domain-boundary rationale.

-- ============================================================
-- workflow_definitions — the logical, reusable definition (identified by
-- a stable `key`); its actual, versioned content lives in
-- workflow_definition_versions below. A definition row itself carries no
-- status: DRAFT/PUBLISHED/RETIRED is a VERSION's own state, since editing
-- happens on one version at a time and publishing must not silently
-- change a version already bound to running instances.
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- workflow_definition_versions — one immutable-once-published version per
-- definition. version_number is assigned under an application-held row
-- lock on the parent workflow_definitions row (never a bare
-- SELECT MAX(version_number)+1 without that lock — see
-- pgWorkflowDefinitionRepository.ts's publish/createDraftVersion), backed
-- here by UNIQUE(definition_id, version_number) as a hard guarantee even
-- if that discipline were ever violated.
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_definition_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
  version_number INT NOT NULL CHECK (version_number >= 1),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
  allow_parallel_steps BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (definition_id, version_number),
  -- published_at is set exactly when status leaves DRAFT, and stays set
  -- once a version is later retired (it WAS published).
  CONSTRAINT workflow_definition_versions_published_at_consistent CHECK ((status = 'DRAFT') = (published_at IS NULL)),
  CONSTRAINT workflow_definition_versions_retired_at_consistent CHECK ((status = 'RETIRED') = (retired_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS workflow_definition_versions_definition_idx ON workflow_definition_versions(definition_id);

-- allow_parallel_steps is stored for forward-compatibility only — PR #8's
-- engine always executes steps sequentially (brief item 11) and this
-- column is not read anywhere in this PR; a future PR may use it to opt a
-- version into parallel-step execution without a schema change here.

-- ============================================================
-- workflow_steps — one row per defined stage in a DRAFT version (editable
-- only while its parent version is DRAFT; frozen once PUBLISHED/RETIRED,
-- enforced in application code under the same version row lock used for
-- publishing).
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES workflow_definition_versions(id),
  sequence_number INT NOT NULL CHECK (sequence_number >= 1),
  step_type TEXT NOT NULL CHECK (step_type IN ('APPROVAL', 'TASK', 'SYSTEM_ACTION')),
  name TEXT NOT NULL,
  -- APPROVAL/TASK only (NULL for SYSTEM_ACTION):
  assignment_mode TEXT CHECK (assignment_mode IN ('USER', 'ROLE', 'MANAGER')),
  -- ROLE mode only: the permission key (and an optional privileged-tier
  -- sibling, mirroring the base/.privileged pattern used throughout this
  -- codebase) whose current holders are resolved into a fixed candidate
  -- set (workflow_task_candidates) at STEP-ACTIVATION time — never a
  -- live, per-decision re-check, so a later role change cannot silently
  -- alter who may act on an already-activated task. See docs
  -- "Actor resolution" and "ROLE routing semantics".
  assigned_permission_key TEXT,
  assigned_permission_key_privileged TEXT,
  allow_self_approval BOOLEAN NOT NULL DEFAULT FALSE,
  -- APPROVAL only: the decisions this step permits, a subset of
  -- APPROVE/REJECT/RETURN — validated at publish time (application code),
  -- not by this CHECK alone (a CHECK can bound individual array elements
  -- but not "non-empty for APPROVAL steps" cleanly across step types).
  permitted_decisions TEXT[],
  -- SYSTEM_ACTION only: a registered application handler key (e.g.
  -- 'identity.request_deactivation') — never executable code of any kind.
  -- See src/domain/systemActionRegistry.ts.
  system_action_handler_key TEXT,
  due_after_minutes INT CHECK (due_after_minutes IS NULL OR due_after_minutes > 0),
  escalate_after_minutes INT CHECK (escalate_after_minutes IS NULL OR escalate_after_minutes > 0),
  escalation_target_mode TEXT NOT NULL DEFAULT 'NONE' CHECK (escalation_target_mode IN ('NONE', 'REASSIGN_TO_ASSIGNEE_MANAGER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, sequence_number),
  CONSTRAINT workflow_steps_system_action_handler_required CHECK (step_type <> 'SYSTEM_ACTION' OR system_action_handler_key IS NOT NULL),
  CONSTRAINT workflow_steps_assignment_mode_required CHECK (step_type = 'SYSTEM_ACTION' OR assignment_mode IS NOT NULL),
  CONSTRAINT workflow_steps_role_permission_required CHECK (assignment_mode <> 'ROLE' OR assigned_permission_key IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS workflow_steps_version_idx ON workflow_steps(version_id);

-- ============================================================
-- workflow_instances — one execution of a PUBLISHED version for a
-- particular business subject. subject_type/subject_id reference a
-- business record WITHOUT a foreign key (subject_type is validated
-- against a code-level registry — see src/domain/subjectType.ts — never
-- an arbitrary table/SQL reference). legal_entity_id/subject_employee_id
-- DO reference this platform's own foundational identity/org tables
-- (needed for entity/classification enforcement and manager routing),
-- never a business-transaction table.
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
  version_id UUID NOT NULL REFERENCES workflow_definition_versions(id),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
  data_classification TEXT NOT NULL DEFAULT 'INTERNAL' CHECK (data_classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'PRIVILEGED')),
  -- The employee this instance's approval chain concerns (manager
  -- routing/self-approval), when applicable — nullable because not every
  -- future subject type is employee-centric.
  subject_employee_id UUID REFERENCES employees(id),
  requester_user_id UUID NOT NULL REFERENCES users(id),
  -- The Identity user this workflow is ABOUT (for self-approval checks) —
  -- may differ from requester_user_id (e.g. HR starts a probation
  -- workflow on behalf of the employee being reviewed).
  subject_actor_user_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED')),
  outcome TEXT,
  failure_category TEXT CHECK (failure_category IN ('ROUTING_FAILURE', 'SYSTEM_ACTION_FAILURE', 'INFRASTRUCTURE_FAILURE')),
  current_step_id UUID REFERENCES workflow_steps(id),
  idempotency_key TEXT,
  context JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workflow_instances_completed_at_consistent CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
  CONSTRAINT workflow_instances_cancelled_at_consistent CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
  CONSTRAINT workflow_instances_failure_category_consistent CHECK ((status = 'FAILED') = (failure_category IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS workflow_instances_legal_entity_idx ON workflow_instances(legal_entity_id);
CREATE INDEX IF NOT EXISTS workflow_instances_subject_idx ON workflow_instances(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS workflow_instances_status_idx ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS workflow_instances_requester_idx ON workflow_instances(requester_user_id);

-- Idempotency (brief item 20): a caller-supplied key, unique per
-- definition when present.
CREATE UNIQUE INDEX IF NOT EXISTS workflow_instances_idempotency_key_idx
  ON workflow_instances(definition_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Natural uniqueness invariant, independent of any caller-supplied key:
-- at most one non-terminal instance of a given definition may exist for a
-- given business subject at a time. This is the default safety net every
-- caller gets for free, even one that never passes an idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS workflow_instances_one_active_per_subject_idx
  ON workflow_instances(definition_id, subject_type, subject_id) WHERE status = 'ACTIVE';

-- ============================================================
-- workflow_tasks — an actionable item spawned by an APPROVAL/TASK step
-- activation (SYSTEM_ACTION steps never create a task — see
-- workflow_system_action_executions below).
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  step_id UUID NOT NULL REFERENCES workflow_steps(id),
  task_type TEXT NOT NULL CHECK (task_type IN ('APPROVAL', 'TASK')),
  assignment_mode TEXT NOT NULL CHECK (assignment_mode IN ('USER', 'ROLE', 'MANAGER')),
  -- Fixed at task-creation time (USER/MANAGER). NULL for ROLE mode, whose
  -- eligible actors are instead resolved ONCE, at this same activation
  -- moment, into workflow_task_candidates below — assigned_permission_key
  -- here is retained only as a historical record of which key(s) were
  -- used for that resolution, never re-checked live at decision time.
  assigned_user_id UUID REFERENCES users(id),
  assigned_permission_key TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  due_at TIMESTAMPTZ,
  escalate_after TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalation_target_mode TEXT NOT NULL DEFAULT 'NONE' CHECK (escalation_target_mode IN ('NONE', 'REASSIGN_TO_ASSIGNEE_MANAGER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT workflow_tasks_completed_at_consistent CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
  CONSTRAINT workflow_tasks_cancelled_at_consistent CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
  CONSTRAINT workflow_tasks_role_permission_required CHECK (assignment_mode <> 'ROLE' OR assigned_permission_key IS NOT NULL),
  CONSTRAINT workflow_tasks_fixed_assignee_required CHECK (assignment_mode = 'ROLE' OR assigned_user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS workflow_tasks_instance_idx ON workflow_tasks(instance_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_assignee_idx ON workflow_tasks(assigned_user_id, status);
CREATE INDEX IF NOT EXISTS workflow_tasks_role_pool_idx ON workflow_tasks(assignment_mode, assigned_permission_key, status);
CREATE INDEX IF NOT EXISTS workflow_tasks_escalation_idx ON workflow_tasks(escalate_after) WHERE status = 'PENDING' AND escalated_at IS NULL;

-- ============================================================
-- workflow_task_candidates — the ROLE-mode routing fix. At the moment a
-- ROLE-mode step activates, EVERY currently-eligible actor (already
-- passed permission + classification ceiling + entity-access-grant
-- coverage, and — when the step disallows self-approval — already
-- excluding the instance's own subject actor) is resolved ONCE via
-- Identity's actorResolutionService and recorded here. This is the
-- historical, immutable record of "who could act on this task the
-- moment it activated" — a later role grant/revocation never rewrites
-- it (see docs "Role-change semantics after activation"). Decision-time
-- eligibility for a ROLE task is a plain existence check against this
-- table, never a fresh RBAC re-check. UNIQUE(task_id, user_id) is
-- defensive (recordCandidates is called at most once per task, but this
-- guarantees no duplicate row is ever possible).
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_task_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES workflow_tasks(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS workflow_task_candidates_task_idx ON workflow_task_candidates(task_id);
CREATE INDEX IF NOT EXISTS workflow_task_candidates_user_idx ON workflow_task_candidates(user_id);

-- ============================================================
-- workflow_decisions — one immutable, insert-only row per DECIDED
-- approval task. UNIQUE(task_id) is the concurrency-safety mechanism
-- (brief item 19): two simultaneous decision attempts on the same task
-- race to INSERT here — Postgres guarantees at most one succeeds, the
-- other gets a unique-violation, never two committed decisions.
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL UNIQUE REFERENCES workflow_tasks(id),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'REJECT', 'RETURN')),
  comment TEXT,
  resulting_transition TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workflow_decisions_instance_idx ON workflow_decisions(instance_id);

-- ============================================================
-- workflow_events — append-only BUSINESS history, distinct from
-- Identity's security_audit_events (see docs "Audit vs workflow
-- history"). recorded_by is nullable for system-initiated events
-- (escalation sweeps have no human actor).
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'instance_started', 'step_activated', 'task_created', 'decision_recorded',
    'step_completed', 'instance_completed', 'instance_cancelled', 'instance_failed',
    'routing_failed', 'system_action_executed', 'system_action_failed',
    'escalation_triggered', 'task_reassigned'
  )),
  event_data JSONB,
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS workflow_events_instance_idx ON workflow_events(instance_id, occurred_at);

-- ============================================================
-- workflow_system_action_executions — one row per SYSTEM_ACTION step
-- activation. UNIQUE(instance_id, step_id) is the idempotency mechanism
-- (brief item 21): a step can never execute twice for the same instance.
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_system_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  step_id UUID NOT NULL REFERENCES workflow_steps(id),
  handler_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  UNIQUE (instance_id, step_id),
  CONSTRAINT workflow_system_action_executions_executed_at_consistent CHECK ((status IN ('SUCCEEDED', 'FAILED')) = (executed_at IS NOT NULL))
);
