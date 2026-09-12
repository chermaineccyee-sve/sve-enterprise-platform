
CREATE TABLE IF NOT EXISTS management_decisions (
  id BIGSERIAL PRIMARY KEY,
  decision_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'General',
  source_reference TEXT,
  linked_project TEXT,
  linked_meeting TEXT,
  linked_data_vault_id TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Decision Required',
  direction TEXT,
  owner_email TEXT,
  due_date DATE,
  implementation_note TEXT,
  closed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management_decision_audit (
  id BIGSERIAL PRIMARY KEY,
  decision_id BIGINT NOT NULL REFERENCES management_decisions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS management_decisions_status_idx ON management_decisions(status);
CREATE INDEX IF NOT EXISTS management_decisions_due_idx ON management_decisions(due_date);
CREATE INDEX IF NOT EXISTS management_decisions_project_idx ON management_decisions(linked_project);
CREATE INDEX IF NOT EXISTS management_decision_audit_idx ON management_decision_audit(decision_id, created_at DESC);
