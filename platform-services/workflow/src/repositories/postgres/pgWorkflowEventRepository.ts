import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowEventRepository } from "../types.ts";
import type { WorkflowEvent, WorkflowEventType } from "../../domain/workflow.ts";

interface Row {
  id: string;
  instance_id: string;
  event_type: WorkflowEventType;
  event_data: Record<string, unknown> | null;
  notes: string | null;
  occurred_at: string;
  recorded_by: string | null;
}

const COLUMNS = "id, instance_id, event_type, event_data, notes, occurred_at, recorded_by";

function mapRow(r: Row): WorkflowEvent {
  return { id: r.id, instanceId: r.instance_id, eventType: r.event_type, eventData: r.event_data, notes: r.notes, occurredAt: r.occurred_at, recordedBy: r.recorded_by };
}

export function createPgWorkflowEventRepository(db: DatabaseProvider): WorkflowEventRepository {
  return {
    async append(input) {
      const result = await db.query<Row>(
        `INSERT INTO workflow_events(instance_id, event_type, event_data, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING ${COLUMNS}`,
        [input.instanceId, input.eventType, input.eventData ? JSON.stringify(input.eventData) : null, input.notes ?? null, input.recordedBy ?? null],
      );
      return mapRow(result.rows[0]!);
    },
    async listByInstance(instanceId) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_events WHERE instance_id = $1 ORDER BY occurred_at ASC`, [instanceId]);
      return result.rows.map(mapRow);
    },
  };
}
