-- SVE Enterprise Platform — Organisation + Employee Master Foundation (PR #6)
-- Follows docs/architecture/data-and-database-conventions.md (UUID keys,
-- created/updated metadata, archive-not-delete, idempotent
-- CREATE TABLE IF NOT EXISTS + guarded ALTERs). Builds on
-- 001_identity-foundation's groups/legal_entities/users/entity_access_grants/
-- user_employee_links and 002_data-vault-foundation's data_vault_records —
-- alters neither migration's file, only adds new tables/constraints via
-- plain ALTER TABLE statements against 001's tables (both explicitly
-- anticipated this: entity_access_grants' business_unit_id/department_id
-- and user_employee_links' employee_id were left without foreign keys
-- specifically "until platform-services/organisation owns those tables'
-- future schema" — see 001_identity-foundation/migration.sql's own
-- comments).
--
-- Scope: organisation structure (business units, departments, positions)
-- and the employee master (employees, employment assignments) only. No
-- leave/attendance/performance/compensation/payroll schema — those are
-- explicitly deferred to platform-services/hrms and platform-services/
-- payroll, later, separately-scoped work. legal_entities/groups remain
-- owned by 001_identity-foundation; this migration only references them
-- by foreign key.

-- ============================================================
-- Organisation structure: Business Unit -> Department -> Position
-- ============================================================

-- A business unit belongs to exactly one legal entity. Business units are
-- genuinely optional in the hierarchy (see departments below) — some
-- legal entities (e.g. SK Lai & Partners, a single Malaysian law firm)
-- may never need one.
CREATE TABLE IF NOT EXISTS business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (legal_entity_id, code)
);
CREATE INDEX IF NOT EXISTS business_units_legal_entity_idx ON business_units(legal_entity_id);

-- department.legal_entity_id is always populated (even when business_unit_id
-- is also set, where it must match that business unit's own legal entity —
-- enforced in the service layer, not a DB trigger, per this foundation's
-- "avoid overengineering" guidance) so a department's entity scope for
-- RBAC/query purposes never requires an extra join through business_units.
-- business_unit_id is nullable specifically so a legal entity that has no
-- business-unit layer (e.g. SK Lai & Partners) can attach departments
-- directly to itself — PR brief item 5: "Do not force empty business-unit
-- layers where a legal entity directly contains departments."
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
  business_unit_id UUID REFERENCES business_units(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (legal_entity_id, code)
);
CREATE INDEX IF NOT EXISTS departments_legal_entity_idx ON departments(legal_entity_id);
CREATE INDEX IF NOT EXISTS departments_business_unit_idx ON departments(business_unit_id);

-- A position is a job/role slot within a department — distinct from the
-- employee who currently holds it (an employment_assignment references a
-- position; the position itself persists across who holds it or whether
-- anyone currently does). reports_to_position_id is the STRUCTURAL
-- reporting line (this position's role reports to that position's role,
-- regardless of who fills either) — see docs/architecture/
-- organisation-employee-master.md "Reporting line model" for how this
-- combines with employment_assignments.reports_to_assignment_id (the
-- per-assignment override for temporary/exception reporting).
-- cost_centre_code is a placeholder reference only — no cost-centre
-- master table or accounting logic is implemented here; future Payroll/
-- Accounting Pro will formalise it.
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  reports_to_position_id UUID REFERENCES positions(id),
  cost_centre_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positions_no_self_report CHECK (reports_to_position_id IS DISTINCT FROM id)
);
CREATE INDEX IF NOT EXISTS positions_department_idx ON positions(department_id);
CREATE INDEX IF NOT EXISTS positions_reports_to_idx ON positions(reports_to_position_id);

-- ============================================================
-- Employee Master
-- ============================================================

-- Human-readable employee numbers are assigned from one shared sequence
-- so concurrent creates can never collide — see src/domain/
-- employeeNumber.ts. The format below (EMP-000001) is a foundation
-- placeholder, not a fixed policy: no evidence in the current codebase
-- (apps/svegip's employee_accounts table has no employee-number concept
-- at all) establishes a real SVE numbering convention, so this is
-- documented as configurable/future-policy-dependent rather than assumed
-- — see docs/architecture/organisation-employee-master.md "Employee
-- number generation".
CREATE SEQUENCE IF NOT EXISTS employee_number_seq START WITH 1;

-- Employee identity only — NOT the employment relationship (that is
-- employment_assignments, below) and NOT payroll/compensation/statutory
-- data (explicitly out of scope for this PR; see PR brief item 6). `status`
-- mirrors the employee's current/latest employment_assignment.status (the
-- source of truth for history), kept in sync by the service layer on every
-- assignment transition — see the architecture doc's "Employee vs.
-- Employment Assignment status" section for why both exist.
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  preferred_name TEXT,
  work_email TEXT UNIQUE,
  -- Justified minimal inclusion: needed to reach a former employee during
  -- offboarding once their work_email is deactivated. Not a general
  -- personal-contact store — see PR brief item 6's caution.
  personal_email TEXT,
  employment_country TEXT NOT NULL, -- ISO 3166-1 alpha-2, e.g. 'MY', 'SG' — jurisdiction readiness, no hard-coded single country
  status TEXT NOT NULL DEFAULT 'PRE_HIRE' CHECK (
    status IN ('PRE_HIRE', 'ACTIVE', 'PROBATION', 'NOTICE', 'SUSPENDED', 'TERMINATED', 'RESIGNED', 'INACTIVE')
  ),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(status);
CREATE INDEX IF NOT EXISTS employees_employment_country_idx ON employees(employment_country);

-- The effective-dated employment history: "Employee -> Employment
-- Assignment -> Effective From/To" (PR brief item 8). A change that
-- preserves history (transfer, promotion, department/manager/title/
-- location change) NEVER updates an existing row's business fields —
-- application code closes the current row (sets effective_to) and inserts
-- a new one. True employment end (termination/resignation) closes the
-- current row and sets end_date, with no successor row. See
-- docs/architecture/organisation-employee-master.md "Effective-dated
-- records" for the exact write pattern and why this is not a full
-- temporal database (only one axis — effective time — is tracked; there
-- is no bitemporal "as recorded on" dimension).
--
-- is_primary + the partial unique index below is what "only one primary
-- active employment assignment at a time" (item 9) enforces, while still
-- allowing secondary/concurrent assignments (secondment, dual-entity
-- arrangements) to coexist as is_primary = false rows.
--
-- reports_to_assignment_id is an explicit per-assignment override of the
-- position-structural reporting line in `positions.reports_to_position_id`
-- — used for temporary/exception reporting changes that should not require
-- a position change. See the architecture doc's "Reporting line model".
CREATE TABLE IF NOT EXISTS employment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),
  business_unit_id UUID REFERENCES business_units(id),
  department_id UUID REFERENCES departments(id),
  position_id UUID REFERENCES positions(id),
  employment_type TEXT NOT NULL, -- e.g. 'full_time' | 'part_time' | 'contract' | 'intern' | 'secondment' — free text, not CHECK-constrained: current SVEGIP has no employment-type taxonomy to derive a closed set from, and future jurisdictions may need values this foundation cannot anticipate
  status TEXT NOT NULL CHECK (
    status IN ('PRE_HIRE', 'ACTIVE', 'PROBATION', 'NOTICE', 'SUSPENDED', 'TERMINATED', 'RESIGNED', 'INACTIVE')
  ),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  start_date DATE NOT NULL,
  confirmation_date DATE,
  probation_end_date DATE,
  end_date DATE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  work_location TEXT,
  work_arrangement TEXT, -- placeholder, e.g. 'onsite' | 'remote' | 'hybrid' — not enforced, future HRMS policy
  reports_to_assignment_id UUID REFERENCES employment_assignments(id),
  change_reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employment_assignments_no_self_report CHECK (reports_to_assignment_id IS DISTINCT FROM id),
  CONSTRAINT employment_assignments_end_after_start CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT employment_assignments_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS employment_assignments_employee_idx ON employment_assignments(employee_id);
CREATE INDEX IF NOT EXISTS employment_assignments_legal_entity_idx ON employment_assignments(legal_entity_id);
CREATE INDEX IF NOT EXISTS employment_assignments_department_idx ON employment_assignments(department_id);
CREATE INDEX IF NOT EXISTS employment_assignments_position_idx ON employment_assignments(position_id);
CREATE INDEX IF NOT EXISTS employment_assignments_current_idx ON employment_assignments(employee_id) WHERE effective_to IS NULL;
-- Only one OPEN (effective_to IS NULL) PRIMARY assignment per employee at a time.
CREATE UNIQUE INDEX IF NOT EXISTS employment_assignments_one_open_primary
  ON employment_assignments(employee_id) WHERE effective_to IS NULL AND is_primary = TRUE;

-- ============================================================
-- Integration back into 001_identity-foundation's tables
-- ============================================================

-- entity_access_grants.business_unit_id/department_id were deliberately
-- left without foreign keys in 001_identity-foundation, pending this
-- package's schema. Adding them now; existing rows (none exist yet — no
-- real users/grants have been seeded in any PR to date) are unaffected.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entity_access_grants_business_unit_fk'
  ) THEN
    ALTER TABLE entity_access_grants
      ADD CONSTRAINT entity_access_grants_business_unit_fk FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entity_access_grants_department_fk'
  ) THEN
    ALTER TABLE entity_access_grants
      ADD CONSTRAINT entity_access_grants_department_fk FOREIGN KEY (department_id) REFERENCES departments(id);
  END IF;
END $$;

-- user_employee_links (001_identity-foundation) evolves from "exactly one
-- link for the lifetime of a user row" (PRIMARY KEY on user_id, no way to
-- unlink) to a proper active/inactive history, so PR brief item 11's
-- "controlled linkage/unlinkage" is possible without losing the audit
-- trail of a past link. Safe to restructure in place: no production rows
-- exist (no real users have been seeded in any merged PR).
ALTER TABLE user_employee_links ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE user_employee_links SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE user_employee_links ALTER COLUMN id SET NOT NULL;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_employee_links_pkey' AND table_name = 'user_employee_links'
  ) THEN
    ALTER TABLE user_employee_links DROP CONSTRAINT user_employee_links_pkey;
  END IF;
END $$;
ALTER TABLE user_employee_links ADD PRIMARY KEY (id);
ALTER TABLE user_employee_links ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMPTZ;
ALTER TABLE user_employee_links ADD COLUMN IF NOT EXISTS unlinked_by UUID REFERENCES users(id);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_employee_links_employee_id_key' AND table_name = 'user_employee_links'
  ) THEN
    ALTER TABLE user_employee_links DROP CONSTRAINT user_employee_links_employee_id_key;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_employee_links_employee_fk'
  ) THEN
    ALTER TABLE user_employee_links
      ADD CONSTRAINT user_employee_links_employee_fk FOREIGN KEY (employee_id) REFERENCES employees(id);
  END IF;
END $$;
-- Replaces the old always-on UNIQUE(user_id)/UNIQUE(employee_id): only one
-- ACTIVE (unlinked_at IS NULL) link per user and per employee, while a
-- historical (unlinked) link row is kept for audit rather than deleted.
CREATE UNIQUE INDEX IF NOT EXISTS user_employee_links_active_user_idx ON user_employee_links(user_id) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_employee_links_active_employee_idx ON user_employee_links(employee_id) WHERE unlinked_at IS NULL;

-- ============================================================
-- Seed: confirmed SVE Group organisation structure (reference data only)
-- ============================================================
-- No real employees, users, or business units/departments are seeded here
-- beyond what is needed to establish the confirmed legal-entity structure
-- already seeded by 001_identity-foundation (groups, legal_entities).
-- Business units/departments/positions are genuinely optional per entity
-- (item 5) and are left for real HR data entry, not fabricated here.
