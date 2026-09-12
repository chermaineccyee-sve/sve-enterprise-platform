import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { AuditRepository } from "../types.ts";
import type { SecurityAuditEvent } from "../../domain/entities.ts";

interface AuditRow {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  legal_entity_id: string | null;
  session_id: string | null;
  change_before: Record<string, unknown> | null;
  change_after: Record<string, unknown> | null;
  source_ip: string | null;
  source_user_agent: string | null;
  occurred_at: string;
}
const mapEvent = (r: AuditRow): SecurityAuditEvent => ({
  id: r.id,
  actorUserId: r.actor_user_id,
  actorEmail: r.actor_email,
  action: r.action,
  resourceType: r.resource_type,
  resourceId: r.resource_id,
  legalEntityId: r.legal_entity_id,
  sessionId: r.session_id,
  changeBefore: r.change_before,
  changeAfter: r.change_after,
  sourceIp: r.source_ip,
  sourceUserAgent: r.source_user_agent,
  occurredAt: r.occurred_at,
});

export function createPgAuditRepository(db: DatabaseProvider): AuditRepository {
  return {
    async record(event: Omit<SecurityAuditEvent, "id" | "occurredAt">): Promise<SecurityAuditEvent> {
      const result = await db.query<AuditRow>(
        `INSERT INTO security_audit_events(
           actor_user_id, actor_email, action, resource_type, resource_id,
           legal_entity_id, session_id, change_before, change_after, source_ip, source_user_agent
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, actor_user_id, actor_email, action, resource_type, resource_id,
           legal_entity_id, session_id, change_before, change_after, source_ip, source_user_agent, occurred_at`,
        [
          event.actorUserId,
          event.actorEmail,
          event.action,
          event.resourceType,
          event.resourceId,
          event.legalEntityId,
          event.sessionId,
          event.changeBefore ? JSON.stringify(event.changeBefore) : null,
          event.changeAfter ? JSON.stringify(event.changeAfter) : null,
          event.sourceIp,
          event.sourceUserAgent,
        ],
      );
      return mapEvent(result.rows[0]!);
    },
  };
}
