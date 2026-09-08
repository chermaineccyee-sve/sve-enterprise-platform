
CREATE TABLE IF NOT EXISTS controlled_documents (
  id BIGSERIAL PRIMARY KEY,
  document_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  business_unit TEXT NOT NULL,
  category TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'Internal',
  owner_email TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',
  current_version TEXT NOT NULL DEFAULT '0.1',
  storage_provider TEXT NOT NULL DEFAULT 'INTERIM',
  storage_reference TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS controlled_document_versions (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES controlled_documents(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'INTERIM',
  storage_reference TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  change_note TEXT,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id,version)
);
CREATE TABLE IF NOT EXISTS controlled_document_access (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES controlled_documents(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_value TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view',
  granted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id,subject_type,subject_value,permission)
);
CREATE TABLE IF NOT EXISTS controlled_document_audit (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT,
  document_code TEXT,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS controlled_documents_unit_idx ON controlled_documents(business_unit);
CREATE INDEX IF NOT EXISTS controlled_documents_class_idx ON controlled_documents(classification);
CREATE INDEX IF NOT EXISTS controlled_document_versions_doc_idx ON controlled_document_versions(document_id);
CREATE INDEX IF NOT EXISTS controlled_document_audit_doc_idx ON controlled_document_audit(document_id,created_at DESC);
