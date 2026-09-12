# platform-services/documents

**Status: scaffolding only — no implementation.**

Future home of a shared document/file metadata registry — version history, access grants, audit trail, and a storage abstraction (`packages/shared`'s `StorageProvider`) so business modules never talk to a storage vendor SDK directly. SVEGIP's existing `controlled_documents`/`_versions`/`_access`/`_audit` tables (in `apps/svegip`) are a real, working example of this exact pattern at small scale; this module is where it becomes shared infrastructure other services (HRMS employee documents, Accounting supporting records, Data Vault files) reuse instead of re-implementing.

**Depends on:** `platform-services/identity`, `platform-services/organisation`, `packages/security` (`StorageProvider`).
**Must not depend on:** business-specific modules — `documents` is a shared utility consumed by domains, not the reverse.
**Planned API namespace:** `/api/v1/documents`.
**Typical data classification:** varies per document — INTERNAL to PRIVILEGED; access rules must consult the document's own classification, not assume one.
