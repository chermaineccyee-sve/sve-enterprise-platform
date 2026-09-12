-- SVE Enterprise Platform — Identity & Access Foundation
-- Follows docs/architecture/data-and-database-conventions.md: UUID keys,
-- created/updated metadata, entity scoping, archive-not-delete (revoked_at),
-- idempotent CREATE TABLE IF NOT EXISTS + guarded seed INSERTs.
--
-- Scope: identity, access control, sessions, MFA, and Identity's own
-- security-audit sink only. No HRMS/Payroll/iClaims/Accounting/Data Vault
-- business schema is created here. apps/svegip's own tables
-- (netlify/database/migrations/001-004) are separate and untouched.

-- ============================================================
-- Organisational backbone (minimal — only what entity-scoped
-- access control needs to reference today). Full organisation
-- modelling (business units, departments, positions) remains
-- platform-services/organisation's future scope; this migration
-- adds only `groups` and `legal_entities`.
-- ============================================================

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL, -- ISO 3166-1 alpha-2, e.g. 'SG', 'MY'
  currency TEXT NOT NULL,     -- ISO 4217, e.g. 'SGD', 'MYR'
  -- Descriptive/organisational fact only. Never consulted by the
  -- authorization service (see src/services/rbacService.ts) — HQ status
  -- must not imply cross-entity access. See docs/architecture/
  -- identity-foundation.md "Group and HQ authority are not access grants".
  is_group_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS legal_entities_group_idx ON legal_entities(group_id);

INSERT INTO groups(key, name)
SELECT 'sve-group', 'SVE Group'
WHERE NOT EXISTS (SELECT 1 FROM groups WHERE key = 'sve-group');

INSERT INTO legal_entities(group_id, key, name, jurisdiction, currency, is_group_headquarters)
SELECT g.id, 'sve-international-sg', 'SVE International Pte. Ltd.', 'SG', 'SGD', TRUE
FROM groups g WHERE g.key = 'sve-group'
  AND NOT EXISTS (SELECT 1 FROM legal_entities WHERE key = 'sve-international-sg');

INSERT INTO legal_entities(group_id, key, name, jurisdiction, currency, is_group_headquarters)
SELECT g.id, 'sve-international-my', 'SVE International Sdn. Bhd.', 'MY', 'MYR', FALSE
FROM groups g WHERE g.key = 'sve-group'
  AND NOT EXISTS (SELECT 1 FROM legal_entities WHERE key = 'sve-international-my');

-- Modelled as its own legal entity, not a business unit under
-- SVE International Sdn. Bhd., specifically because it must remain
-- capable of stronger information segregation than an ordinary business
-- unit of another entity would allow — see docs/architecture/
-- identity-foundation.md "Why SK Lai & Partners is a legal entity, not a
-- business unit".
INSERT INTO legal_entities(group_id, key, name, jurisdiction, currency, is_group_headquarters)
SELECT g.id, 'sk-lai-partners-my', 'SK Lai & Partners', 'MY', 'MYR', FALSE
FROM groups g WHERE g.key = 'sve-group'
  AND NOT EXISTS (SELECT 1 FROM legal_entities WHERE key = 'sk-lai-partners-my');

-- ============================================================
-- Identity: User accounts and credentials
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  -- Not every User is an Employee. See docs/architecture/
  -- identity-foundation.md "User vs. Employee".
  account_type TEXT NOT NULL DEFAULT 'employee'
    CHECK (account_type IN ('employee','contractor','external','service')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);

-- Minimal identity-side hook for a future Employee Master (platform-services/
-- hrms, not built in this PR) to link to. employee_id has no foreign key yet
-- because no employee table exists — add the FK when hrms.employees lands.
-- A disabled `users.status` with this link intact is how a former employee's
-- employment record survives while their login access is disabled (see
-- item 4 of the PR brief).
CREATE TABLE IF NOT EXISTS user_employee_links (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  employee_id UUID NOT NULL UNIQUE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by UUID NOT NULL REFERENCES users(id)
);

-- One password credential per user for this foundation. password_params is
-- stored per-row (not globally hard-coded) for crypto agility: parameters
-- can be strengthened for new hashes without invalidating old ones until
-- they are next rehashed. See docs/architecture/identity-foundation.md
-- "Password hashing" for the chosen algorithm and parameters.
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'scrypt',
  password_params JSONB NOT NULL DEFAULT '{"N":16384,"r":8,"p":1,"keylen":64}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Access control: roles, permissions, and independent entity access
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,   -- canonical machine key, e.g. 'administrator'
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- max_classification caps what this permission can authorize regardless of
-- role or entity access breadth — this is what stops "System Administrator"
-- or a Group-scope grant from implying access to RESTRICTED/PRIVILEGED data.
-- See docs/architecture/identity-foundation.md "Record-classification-aware
-- authorization".
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,  -- e.g. 'identity.sessions.revoke_any'
  description TEXT,
  max_classification TEXT NOT NULL DEFAULT 'INTERNAL'
    CHECK (max_classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','PRIVILEGED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- A role grant is Group-wide ("what this user is permitted to do"); WHERE
-- they may do it is entity_access_grants, entirely separately. Rows are
-- never deleted, only revoked, to preserve history — see
-- docs/architecture/data-and-database-conventions.md "Archive / soft-delete".
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS user_role_assignments_user_idx ON user_role_assignments(user_id) WHERE revoked_at IS NULL;

-- Independent of role. scope_type distinguishes Group-level authority from
-- legal-entity/business-unit/department-scoped access — see item 3's
-- requirement to model these as distinct axes. business_unit_id/
-- department_id have no foreign key yet: platform-services/organisation
-- owns those tables' future schema; add the FK once it exists.
CREATE TABLE IF NOT EXISTS entity_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('group','legal_entity','business_unit','department')),
  legal_entity_id UUID REFERENCES legal_entities(id),
  business_unit_id UUID,
  department_id UUID,
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  CONSTRAINT entity_access_grants_scope_columns CHECK (
    (scope_type = 'group' AND legal_entity_id IS NULL AND business_unit_id IS NULL AND department_id IS NULL) OR
    (scope_type = 'legal_entity' AND legal_entity_id IS NOT NULL AND business_unit_id IS NULL AND department_id IS NULL) OR
    (scope_type = 'business_unit' AND legal_entity_id IS NOT NULL AND business_unit_id IS NOT NULL AND department_id IS NULL) OR
    (scope_type = 'department' AND legal_entity_id IS NOT NULL AND business_unit_id IS NOT NULL AND department_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS entity_access_grants_user_idx ON entity_access_grants(user_id) WHERE revoked_at IS NULL;

-- ============================================================
-- Sessions
-- ============================================================

-- Only a SHA-256 hash of the bearer token is ever stored — see
-- docs/architecture/identity-foundation.md "Session tokens". Sessions are
-- looked up by token_hash, never by id from an untrusted client input.
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_active_idx ON sessions(user_id) WHERE revoked_at IS NULL;

-- ============================================================
-- MFA
-- ============================================================

-- The TOTP secret is stored as AES-256-GCM ciphertext, never plaintext —
-- see src/crypto/mfaSecretCipher.ts for the encrypt/decrypt implementation
-- and docs/architecture/identity-foundation.md "MFA secret encryption at
-- rest". secret_key_id identifies which key encrypted a given row, for a
-- future key-rotation mechanism (not implemented in this foundation — a
-- single active key is used throughout).
CREATE TABLE IF NOT EXISTS mfa_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  method_type TEXT NOT NULL DEFAULT 'totp' CHECK (method_type IN ('totp')),
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  secret_auth_tag TEXT NOT NULL,
  secret_key_id TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  disabled_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS mfa_methods_user_idx ON mfa_methods(user_id);
-- At most one active/pending TOTP method per user.
CREATE UNIQUE INDEX IF NOT EXISTS mfa_methods_one_live_totp
  ON mfa_methods(user_id) WHERE method_type = 'totp' AND status IN ('pending','active');

-- Recovery codes are single-use and stored hashed. generation_id groups one
-- batch together; regenerating creates a new generation_id, and the service
-- layer deletes the previous generation's unused rows (see
-- src/services/mfaService.ts) so "regenerating invalidates the previous set"
-- is enforced, not merely documented.
CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  generation_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mfa_recovery_codes_user_idx ON mfa_recovery_codes(user_id, generation_id);

-- ============================================================
-- Authentication security: brute-force protection
-- ============================================================

-- Every login attempt is recorded, including against unknown emails, so
-- rate-limiting can key on the attempted identifier without revealing via
-- timing/response whether the account exists. See
-- docs/architecture/identity-foundation.md "Login protection".
CREATE TABLE IF NOT EXISTS authentication_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL,
  reason TEXT, -- e.g. 'invalid_password','unknown_account','throttled','mfa_failed'
  ip TEXT,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS authentication_attempts_email_idx ON authentication_attempts(email, occurred_at DESC);
CREATE INDEX IF NOT EXISTS authentication_attempts_ip_idx ON authentication_attempts(ip, occurred_at DESC);

-- ============================================================
-- Security audit — Identity's own sink for now
-- ============================================================

-- Concrete storage for the AuditEvent contract in packages/types/src/
-- audit-event.ts, scoped to events Identity itself emits. This is not the
-- future central platform-services/audit service (not built in this PR) —
-- it is Identity's own append-only log until that service exists and
-- Identity is migrated to publish to it instead. No UPDATE/DELETE path
-- exists at the application layer for this table — see
-- docs/architecture/security-architecture.md "Auditability".
CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  actor_email TEXT,
  action TEXT NOT NULL,        -- e.g. 'auth.login.success', 'session.revoked'
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  legal_entity_id UUID REFERENCES legal_entities(id),
  session_id UUID,
  change_before JSONB,
  change_after JSONB,
  source_ip TEXT,
  source_user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS security_audit_events_actor_idx ON security_audit_events(actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_events_action_idx ON security_audit_events(action, occurred_at DESC);
