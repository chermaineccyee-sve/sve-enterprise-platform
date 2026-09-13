-- SVE Enterprise Platform — Identity Access Revocation & Offboarding
-- Security Integration (PR #10)
-- Follows docs/architecture/data-and-database-conventions.md. Builds on
-- 001_identity-foundation (users/sessions/security_audit_events) and
-- 004_hrms-employee-lifecycle (hr_lifecycle_cases) — ALTERS neither of
-- those migration files (both are already-merged history); every change
-- here is a single new, additive table. See docs/architecture/
-- identity-offboarding-revocation.md "Deactivation request lifecycle".
--
-- Scope: a durable, HRMS-owned request row driving controlled Identity
-- account revocation after offboarding completes. This table intentionally
-- does NOT live in Identity's own schema — Identity stays domain-blind to
-- HRMS cases (see PR #9's own dependency-direction precedent: HRMS depends
-- on Identity, never the reverse). It is written by HRMS's own offboarding
-- completion (same transaction as the case's own COMPLETED write) and
-- processed by HRMS's own identityDeactivationProcessor.ts, which is the
-- ONE file that calls INTO Identity's generic accountSecurityService.
--
-- No real employees/users are seeded by this migration.

-- ============================================================
-- hr_identity_deactivation_requests
-- ============================================================
-- One row per offboarding completion that has a linked Identity user to
-- revoke (a case whose employee has no active Identity link creates no
-- row — nothing to deactivate). UNIQUE(case_id): a case can only ever
-- complete once (HRMS's own state machine enforces this — see
-- lifecycleCaseService.completeCaseWithAuthoritativeWrite), so this is a
-- defensive backstop, not the primary invariant.
--
-- status is deliberately a 2-value model: 'REQUESTED' (durably pending —
-- including a request that has already failed one or more processing
-- attempts) and 'COMPLETED' (terminal — the account was disabled and the
-- request acknowledged). There is no 'FAILED' status: a failed processing
-- attempt is metadata (failure_reason / attempt_count / last_attempted_at)
-- recorded on a row that STAYS 'REQUESTED', not a status transition. This
-- is what makes the request "independently retryable" in fact rather than
-- only in name — processAllPending()'s normal batch sweep selects
-- status = 'REQUESTED', so a previously-failed request is automatically
-- picked up again on the next sweep with no separate retry query or
-- manual-by-id intervention required. Earlier revisions of this migration
-- had a third 'FAILED' status that processAllPending() never selected,
-- which meant a single transient failure could permanently orphan an
-- offboarding deactivation request while the target account stayed
-- active — corrected before this PR left Draft.
--
-- This is deliberately NOT a generic job-processing table: no queue
-- semantics, no worker-lease columns, no priority/backoff schedule, no
-- attempt-count cutoff. A "processing" state was assessed and rejected:
-- this codebase's transaction-scoped processor either commits the whole
-- disable+audit+completion in one go or rolls all of it back (see
-- identityDeactivationProcessor.ts), so there is never an observable,
-- durable "in progress" state worth persisting. last_attempted_at exists
-- purely as operational visibility (when was this last tried, is it
-- stuck) — it drives no automatic behaviour and no hot retry loop: each
-- external invocation of processAllPending() does exactly one pass over
-- currently-REQUESTED rows, so retry cadence is controlled entirely by
-- however often something external calls it (the same externally-driven
-- cadence pattern already documented for expireDueSessions).
--
-- reason_category and failure_reason are deliberately short, generic,
-- non-sensitive text — never HR case content, termination detail, or SK
-- Lai & Partners privileged legal-case material (PR brief items 19/28).
CREATE TABLE IF NOT EXISTS hr_identity_deactivation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL UNIQUE REFERENCES hr_lifecycle_cases(id),
  employee_id UUID NOT NULL,
  target_user_id UUID NOT NULL REFERENCES users(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  reason_category TEXT NOT NULL DEFAULT 'hrms_offboarding',
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'COMPLETED')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hr_identity_deactivation_requests_status_idx ON hr_identity_deactivation_requests(status);
CREATE INDEX IF NOT EXISTS hr_identity_deactivation_requests_target_user_idx ON hr_identity_deactivation_requests(target_user_id);
