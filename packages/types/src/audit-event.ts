/**
 * Future central audit event contract. Contract only — no ingestion service
 * exists yet (see platform-services/audit). SVEGIP's four existing per-domain
 * audit tables in apps/svegip are untouched by this PR; this is the shape a
 * future consolidation would adopt, not a migration of them.
 *
 * See docs/architecture/security-architecture.md "Auditability" for the
 * append-only handling expectations for sensitive event types.
 */
import type { EntityContext } from "./entity-context";

export interface AuditEvent {
  id: string;
  /** Who performed the action. */
  actor: {
    userId: string;
    email: string;
  };
  /** What happened — a stable, namespaced verb, e.g. "employee.role.changed". */
  action: string;
  /** What it happened to. */
  resource: {
    type: string; // e.g. "employee_account", "controlled_document"
    id: string;
  };
  timestamp: string; // ISO 8601
  entityContext: EntityContext;
  sessionId?: string;
  /** Structured before/after or change detail — never a raw diff of secrets. */
  change?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  source?: {
    ip?: string;
    userAgent?: string;
    device?: string;
  };
}
