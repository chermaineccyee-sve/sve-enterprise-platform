CREATE TABLE IF NOT EXISTS portal_records (
  module TEXT NOT NULL,
  record_id BIGINT NOT NULL,
  data JSONB NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(module,record_id)
);
CREATE TABLE IF NOT EXISTS portal_business_audit (
  id BIGSERIAL PRIMARY KEY,
  module TEXT NOT NULL,
  record_id BIGINT,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portal_records_module_idx ON portal_records(module);
CREATE INDEX IF NOT EXISTS portal_business_audit_created_idx ON portal_business_audit(created_at DESC);

INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'announcements', 1, '{"id": 1, "title": "SVE Group Internal Portal \u2013 Management Review", "summary": "Initial management-review environment prepared for internal evaluation.", "audience": "All SVE", "date": "2026-09-05", "status": "Published"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='announcements' AND record_id=1);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'announcements', 2, '{"id": 2, "title": "SVE Monthly Meeting \u2013 September", "summary": "Next monthly meeting scheduled for 25 September 2026.", "audience": "Management", "date": "2026-09-25", "status": "Published"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='announcements' AND record_id=2);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'projects', 1, '{"id": 1, "name": "Nusantara", "unit": "SVE / SKL", "owner": "Management", "status": "Active", "next": "Monthly review", "priority": "Medium"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='projects' AND record_id=1);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'projects', 2, '{"id": 2, "name": "Axtraction AI", "unit": "SVE / SKL", "owner": "Executive Office", "status": "Active", "next": "HR & governance workstream", "priority": "High"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='projects' AND record_id=2);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'projects', 3, '{"id": 3, "name": "Best88", "unit": "SVE / SKL", "owner": "Management", "status": "Active", "next": "Status update", "priority": "Medium"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='projects' AND record_id=3);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'projects', 4, '{"id": 4, "name": "Guo Xiumin", "unit": "SKL", "owner": "Legal Team", "status": "Review", "next": "Matter review", "priority": "Medium"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='projects' AND record_id=4);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'projects', 5, '{"id": 5, "name": "Hafiz", "unit": "SKL", "owner": "Legal Team", "status": "Active", "next": "Matter update", "priority": "Medium"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='projects' AND record_id=5);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'projects', 6, '{"id": 6, "name": "Khairul Mustaqim", "unit": "SKL", "owner": "Legal Team", "status": "Active", "next": "Matter update", "priority": "Medium"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='projects' AND record_id=6);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'policies', 1, '{"id": 1, "code": "SVE-GOV-001", "title": "Group Code of Conduct", "category": "Governance", "version": "0.1", "owner": "Management", "review": "2027-09-01", "status": "Draft"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='policies' AND record_id=1);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'policies', 2, '{"id": 2, "code": "SVE-HR-001", "title": "Employee Handbook", "category": "People & HR", "version": "0.1", "owner": "People & Culture", "review": "2027-09-01", "status": "Draft"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='policies' AND record_id=2);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'policies', 3, '{"id": 3, "code": "SVE-IT-001", "title": "IT Acceptable Use Policy", "category": "IT", "version": "0.1", "owner": "Administration", "review": "2027-09-01", "status": "Draft"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='policies' AND record_id=3);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'policies', 4, '{"id": 4, "code": "SKL-SOP-001", "title": "Client Matter Opening Procedure", "category": "SKL SOP", "version": "0.1", "owner": "SKL", "review": "2027-09-01", "status": "Draft"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='policies' AND record_id=4);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'policies', 5, '{"id": 5, "code": "SKL-SOP-002", "title": "Conflict Checking Procedure", "category": "SKL SOP", "version": "0.1", "owner": "SKL", "review": "2027-09-01", "status": "Draft"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='policies' AND record_id=5);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'documents', 1, '{"id": 1, "title": "SVE Monthly Meeting Minutes", "type": "Meeting Minutes", "area": "Executive Office", "access": "Management", "status": "Current"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='documents' AND record_id=1);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'documents', 2, '{"id": 2, "title": "SVE Monthly Meeting Agenda", "type": "Agenda", "area": "Executive Office", "access": "Management", "status": "Current"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='documents' AND record_id=2);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'documents', 3, '{"id": 3, "title": "Policy Registry", "type": "Registry", "area": "Corporate Governance", "access": "Management", "status": "Working"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='documents' AND record_id=3);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'documents', 4, '{"id": 4, "title": "Project Status Register", "type": "Registry", "area": "Projects & Clients", "access": "Management", "status": "Working"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='documents' AND record_id=4);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'documents', 5, '{"id": 5, "title": "Corporate Templates", "type": "Templates", "area": "Knowledge & Documents", "access": "All SVE", "status": "Current"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='documents' AND record_id=5);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'documents', 6, '{"id": 6, "title": "SKL Matter Opening Checklist", "type": "Checklist", "area": "SKL", "access": "SKL", "status": "Working"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='documents' AND record_id=6);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'documents', 7, '{"id": 7, "title": "SKL Conflict Check Record", "type": "Controlled Record", "area": "SKL", "access": "SKL", "status": "Working"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='documents' AND record_id=7);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'meetings', 1, '{"id": 1, "title": "SVE Monthly Meeting", "date": "2026-09-25", "time": "11:00 AM \u2013 12:00 PM", "owner": "Executive Office", "status": "Upcoming"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='meetings' AND record_id=1);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'meetings', 2, '{"id": 2, "title": "Previous SVE Monthly Meeting", "date": "2026-08-28", "time": "11:00 AM \u2013 12:00 PM", "owner": "Executive Office", "status": "Completed"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='meetings' AND record_id=2);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'actions', 1, '{"id": 1, "title": "Nusantara status update", "owner": "Farah", "due": "2026-09-25", "project": "Nusantara", "status": "Open"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='actions' AND record_id=1);
INSERT INTO portal_records(module,record_id,data,created_by,updated_by)
SELECT 'actions', 2, '{"id": 2, "title": "Axtraction AI workstream update", "owner": "Executive Office", "due": "2026-09-25", "project": "Axtraction AI", "status": "Open"}'::jsonb, 'system-seed', 'system-seed'
WHERE NOT EXISTS (SELECT 1 FROM portal_records WHERE module='actions' AND record_id=2);
