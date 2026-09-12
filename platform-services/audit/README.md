# platform-services/audit

**Status: scaffolding only — no implementation.**

Future home of a central audit-event service that every sensitive module feeds, per the event contract defined in `docs/architecture/security-architecture.md`. SVEGIP today has four separate, well-formed but non-centralized audit tables (`employee_account_audit`, `portal_business_audit`, `controlled_document_audit`, `management_decision_audit`) in `apps/svegip` — this module is where that consolidates, not a replacement built in this PR.

**Depends on:** `platform-services/identity` (actor resolution), `packages/types` (the `AuditEvent` contract).
**Must not depend on:** any business domain's internal schema — it receives structured events through a stable contract, never reaches into a domain's tables directly.
**Planned API namespace:** `/api/v1/audit`.
**Typical data classification:** CONFIDENTIAL to RESTRICTED — the audit trail itself is sensitive and must be append-only for sensitive event types (see security architecture doc).
