-- SVE Enterprise Platform — HRMS Employee Lifecycle Foundation (PR #7)
-- Follows docs/architecture/data-and-database-conventions.md (UUID keys,
-- created/updated metadata, archive-not-delete/append-only history,
-- idempotent CREATE TABLE IF NOT EXISTS). Builds on 001_identity-foundation
-- (users, legal_entities), 002_data-vault-foundation, and
-- 003_organisation-employee-master (employees, employment_assignments) —
-- alters none of those migrations, only references their tables by
-- foreign key, exactly as 003 referenced 001's tables.
--
-- Scope: the HR lifecycle-case backbone (onboarding, probation,
-- employment-change, offboarding) — never a second Employee or Legal
-- Entity table, never payroll/compensation/leave/attendance/performance
-- schema. See docs/architecture/hrms-employee-lifecycle.md for the full
-- domain-boundary rationale.

-- ============================================================
-- Case numbers: concurrency-safe, server-generated (never SELECT MAX()+1)
-- ============================================================
-- Format placeholder only (HR-000001), mirroring employee_number_seq
-- (003) and data_vault_record_seq (002) — not an assumed real SVE
-- case-numbering convention, since none is documented anywhere in the
-- current codebase.
CREATE SEQUENCE IF NOT EXISTS hr_lifecycle_case_seq START WITH 1;

-- ============================================================
-- hr_lifecycle_cases — the universal case header
-- ============================================================
-- One table for every lifecycle type (not one table per type): the brief
-- explicitly asks whether confirmation/extension should be probation
-- OUTCOMES rather than independent lifecycle types — the same reasoning
-- generalises to the case model itself. A case's identity (who, which
-- entity, when initiated, current status/stage, HR owner) is universal
-- across onboarding/probation/employment_change/offboarding; only a
-- handful of fields are type-specific, and those are either reused
-- generic slots (case_subtype, effective_date, reason_category) or a
-- small number of offboarding-only nullable columns — never a satellite
-- table for two columns. See the architecture doc "Lifecycle case model".
--
-- No case-level free-text notes column: substantive/decision-bearing
-- narrative content lives ONLY in hr_lifecycle_events.notes (append-only),
-- never in a mutable column here — see "Business lifecycle history" in
-- the architecture doc for why this is a single source of truth rather
-- than two.
CREATE TABLE IF NOT EXISTS hr_lifecycle_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
  lifecycle_type TEXT NOT NULL CHECK (
    lifecycle_type IN ('onboarding', 'probation', 'employment_change', 'offboarding')
  ),
  -- Free text, not CHECK-constrained: valid values depend on lifecycle_type
  -- (e.g. 'promotion'/'transfer' for employment_change, 'resignation'/
  -- 'termination' for offboarding) and future entities/jurisdictions may
  -- need values this foundation cannot anticipate — same reasoning as
  -- employment_assignments.employment_type (003). Validated server-side
  -- per lifecycle_type, not by a database CHECK.
  case_subtype TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT', 'IN_PROGRESS', 'PENDING_DECISION', 'COMPLETED', 'CANCELLED')
  ),
  -- Free text, service-validated per lifecycle_type (e.g. 'documentation'/
  -- 'orientation' for onboarding, 'clearance' for offboarding) — a finer-
  -- grained progress indicator than `status`, not itself a state machine.
  current_stage TEXT,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Meaning depends on lifecycle_type: onboarding start date / probation
  -- confirmation effective date / employment-change effective date /
  -- offboarding actual separation date. Reused rather than adding a
  -- separate "actual_end_date" column for offboarding specifically.
  effective_date DATE,
  hr_owner_user_id UUID NOT NULL REFERENCES users(id),
  -- Set on completion; meaning varies by type (e.g. 'confirmed'/
  -- 'extended'/'unsuccessful' for probation, 'resigned'/'terminated' for
  -- offboarding). Coarse outcome only — decision rationale/notes belong to
  -- hr_lifecycle_events.notes or hr_probation_reviews' own fields, not here.
  outcome TEXT,
  -- A coarse, non-sensitive-ish category (e.g. 'resignation category:
  -- career change') — NOT the detailed reason/rationale, which is
  -- decision-tier content living in hr_lifecycle_events.notes.
  reason_category TEXT,
  -- Offboarding-only (NULL for every other lifecycle_type) — kept as
  -- nullable columns on the shared table rather than a satellite table,
  -- since only two columns are involved and no multi-version history is
  -- needed for them (unlike probation, which genuinely needs its own
  -- effective-dated table — see hr_probation_reviews below).
  notice_date DATE,
  intended_last_working_date DATE,
  -- Set once an employment_change or offboarding case invokes
  -- platform-services/organisation to create the authoritative transition
  -- (a new employment_assignments row, or the closed one for offboarding).
  -- This is a cross-package reference FK, not a duplication: Organisation
  -- remains the sole owner of employment_assignments' own data — see the
  -- architecture doc "Employment change" / "Offboarding" for the
  -- transaction-boundary design this column supports.
  resulting_assignment_id UUID REFERENCES employment_assignments(id),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  -- Database-enforced consistency between `status` and its terminal
  -- timestamp columns — a case cannot claim COMPLETED without
  -- completed_at set, or vice versa, and likewise for CANCELLED.
  CONSTRAINT hr_lifecycle_cases_completed_at_consistent CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
  CONSTRAINT hr_lifecycle_cases_cancelled_at_consistent CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS hr_lifecycle_cases_employee_idx ON hr_lifecycle_cases(employee_id);
CREATE INDEX IF NOT EXISTS hr_lifecycle_cases_legal_entity_idx ON hr_lifecycle_cases(legal_entity_id);
CREATE INDEX IF NOT EXISTS hr_lifecycle_cases_type_idx ON hr_lifecycle_cases(lifecycle_type);
CREATE INDEX IF NOT EXISTS hr_lifecycle_cases_status_idx ON hr_lifecycle_cases(status);
CREATE INDEX IF NOT EXISTS hr_lifecycle_cases_hr_owner_idx ON hr_lifecycle_cases(hr_owner_user_id);
CREATE INDEX IF NOT EXISTS hr_lifecycle_cases_resulting_assignment_idx ON hr_lifecycle_cases(resulting_assignment_id);

-- ============================================================
-- hr_lifecycle_events — append-only business lifecycle history
-- ============================================================
-- Distinct from Identity's security_audit_events (which continues to
-- record security-relevant actions — see the architecture doc "Audit
-- model"). This table is the reconstructable BUSINESS record of a case's
-- lifecycle: never updated or deleted by application code once inserted.
-- `notes` carries the one place substantive/sensitive narrative content
-- (a recommendation, a decision's rationale, a termination reason
-- detail) is stored — gated at the "decision" classification tier,
-- distinct from `event_data`'s small, non-sensitive structured fields.
CREATE TABLE IF NOT EXISTS hr_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES hr_lifecycle_cases(id),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'case_opened', 'stage_changed', 'milestone_completed', 'review_recorded',
      'recommendation_recorded', 'decision_recorded', 'probation_extended',
      'confirmation_completed', 'employment_change_authorised', 'employment_change_completed',
      'offboarding_initiated', 'separation_effective', 'identity_deactivation_requested',
      'case_completed', 'case_cancelled'
    )
  ),
  event_data JSONB,
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS hr_lifecycle_events_case_idx ON hr_lifecycle_events(case_id);
CREATE INDEX IF NOT EXISTS hr_lifecycle_events_type_idx ON hr_lifecycle_events(event_type);

-- ============================================================
-- hr_lifecycle_milestones — onboarding tasks AND offboarding clearance
-- items share this one table (same shape: a typed checklist item with a
-- status and an optional external reference) rather than two near-
-- identical tables. `reference` is metadata only (e.g. a future Document
-- Service or policy-acknowledgement-service record id) — never a binary
-- or base64 blob; see the architecture doc "Documents" / "Policy
-- acknowledgements" boundary.
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_lifecycle_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES hr_lifecycle_cases(id),
  milestone_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_lifecycle_milestones_completed_at_consistent CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
  UNIQUE (case_id, milestone_type)
);
CREATE INDEX IF NOT EXISTS hr_lifecycle_milestones_case_idx ON hr_lifecycle_milestones(case_id);

-- ============================================================
-- hr_probation_reviews — the effective-dated probation-period history
-- ============================================================
-- One row per probation PERIOD (the original period, plus one additional
-- row per extension) — an extension INSERTs a new row with the next
-- sequence_number rather than overwriting the prior period's dates,
-- exactly mirroring 003's employment_assignments effective-dating
-- pattern. "Current" is the row with the highest sequence_number for a
-- case; no redundant is_current flag is stored (avoiding a second source
-- of truth that could drift from sequence_number ordering).
--
-- A review's decision fields (decision/decision_notes/decision_date/
-- decided_by) are set exactly ONCE, by the service layer, guarded by
-- `review_status = 'PENDING'` at write time — see "probation decision
-- recorded once" in the architecture doc and its test.
--
-- No single hard-coded probation duration/terms: period_start and
-- expected_review_date are whatever the caller supplies when opening the
-- case or recording an extension — this schema stores the applicable
-- terms, it does not compute or assume them (item 7's explicit
-- instruction: do not assume one universal probation duration).
CREATE TABLE IF NOT EXISTS hr_probation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES hr_lifecycle_cases(id),
  sequence_number INTEGER NOT NULL CHECK (sequence_number >= 1),
  period_start DATE NOT NULL,
  expected_review_date DATE NOT NULL,
  responsible_manager_user_id UUID REFERENCES users(id),
  responsible_hr_owner_user_id UUID NOT NULL REFERENCES users(id),
  review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'COMPLETED')),
  recommendation TEXT,
  decision TEXT CHECK (decision IN ('CONFIRMED', 'EXTENDED', 'UNSUCCESSFUL')),
  decision_notes TEXT,
  decision_date DATE,
  decided_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_probation_reviews_review_range CHECK (expected_review_date >= period_start),
  CONSTRAINT hr_probation_reviews_decision_consistent CHECK ((review_status = 'COMPLETED') = (decision IS NOT NULL)),
  CONSTRAINT hr_probation_reviews_decision_date_requires_decision CHECK (decision_date IS NULL OR decision IS NOT NULL),
  UNIQUE (case_id, sequence_number)
);
CREATE INDEX IF NOT EXISTS hr_probation_reviews_case_idx ON hr_probation_reviews(case_id);

-- ============================================================
-- Seed: none. No lifecycle cases are seeded — every case in this
-- foundation concerns a specific employee's specific HR process, and no
-- real employees or real HR processes exist in any migration to date.
-- ============================================================
