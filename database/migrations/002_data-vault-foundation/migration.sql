-- SVE Enterprise Platform — Data Vault Server-Side Remediation (PR #5)
-- Follows docs/architecture/data-and-database-conventions.md (UUID keys,
-- created/updated metadata, archive-not-delete, idempotent
-- CREATE TABLE IF NOT EXISTS). Builds on 001_identity-foundation's
-- users/legal_entities/roles/permissions/entity_access_grants — does not
-- alter that migration.
--
-- Scope: only the tables needed to move SVE Data Vault "Evidence" records
-- (apps/svegip/data-vault/index.html's `sveRecords`, currently
-- authoritative only in browser localStorage — see
-- docs/architecture/data-vault-foundation.md "Evidence-based inventory")
-- to server-side PostgreSQL. No HRMS/Payroll/iClaims/Accounting schema.
-- No tags/access-event tables: current Data Vault functionality has no
-- tagging feature, and record-level access is audited through the
-- existing security_audit_events sink (001_identity-foundation), not a
-- new parallel table.

-- Human-readable record codes (SVE-DV-<JUR>-<CAT>-<seq>, matching the
-- format apps/svegip's client already generated) are assigned from one
-- shared sequence so concurrent creates can never collide, unlike the
-- client-side `data.length + 1` scheme it replaces.
CREATE SEQUENCE IF NOT EXISTS data_vault_record_seq START WITH 1;

CREATE TABLE IF NOT EXISTS data_vault_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Server-generated only (see src/services/dataVaultService.ts) — never
  -- accepted from the client, so a record's human-readable code can't be
  -- spoofed or collided by a caller.
  record_code TEXT UNIQUE NOT NULL,

  -- Entity scoping — the axis rbacService.ts's entity_access_grants check
  -- authorizes against. Distinct from `jurisdiction` below, which is
  -- descriptive content (what the evidence is about), not an access
  -- boundary (who owns/may see the record). See docs/architecture/
  -- data-vault-foundation.md "Legal entity vs. jurisdiction".
  legal_entity_id UUID NOT NULL REFERENCES legal_entities(id),

  -- Descriptive fields, derived from the current "Evidence Record" form
  -- (apps/svegip/data-vault/index.html #recordModal) — kept as free TEXT,
  -- not CHECK-constrained enums, because their option lists live in that
  -- UI and are not a security boundary; constraining them here would risk
  -- breaking legitimate future additions for no security benefit.
  jurisdiction TEXT NOT NULL,
  category TEXT NOT NULL,
  topic TEXT NOT NULL,
  source TEXT NOT NULL,
  tier TEXT NOT NULL,
  confidence TEXT NOT NULL,
  checked_date DATE,

  -- Classification IS a security boundary — rbacService.ts's
  -- classificationAllowed() hardcodes exactly these five values. Server-
  -- assigned/validated at every write; never trusted verbatim from the
  -- client (see docs/architecture/data-vault-foundation.md "Classification
  -- is never client-authoritative").
  classification TEXT NOT NULL DEFAULT 'INTERNAL'
    CHECK (classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','PRIVILEGED')),

  -- 'Archived' is new (item 11 — archive/supersede instead of destructive
  -- delete); the other three match the status values already produced by
  -- the current client-side prototype.
  status TEXT NOT NULL DEFAULT 'Requires Review'
    CHECK (status IN ('Requires Review','Report Ready','Monitoring','Archived')),

  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS data_vault_records_entity_idx ON data_vault_records(legal_entity_id);
CREATE INDEX IF NOT EXISTS data_vault_records_classification_idx ON data_vault_records(classification);
CREATE INDEX IF NOT EXISTS data_vault_records_status_idx ON data_vault_records(status);

-- Update history (item 11: "Active -> Updated -> version history ->
-- Archived/Superseded" instead of silent overwrite/delete). One row per
-- update, capturing the full prior field values so a change can be
-- reviewed or reconstructed. This table is protected by the same
-- database-level access as the live table; it is not the audit trail
-- (security_audit_events is, and deliberately never stores this full
-- snapshot — see docs/architecture/data-vault-foundation.md "Audit model
-- does not duplicate record content").
CREATE TABLE IF NOT EXISTS data_vault_record_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES data_vault_records(id),
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_note TEXT,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (record_id, version)
);
CREATE INDEX IF NOT EXISTS data_vault_record_versions_record_idx ON data_vault_record_versions(record_id, version DESC);
