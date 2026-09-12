import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { LifecycleEventRepository } from "../types.ts";
import type { HrLifecycleEvent, LifecycleEventType } from "../../domain/lifecycle.ts";

interface EventRow {
  id: string;
  case_id: string;
  event_type: LifecycleEventType;
  event_data: Record<string, unknown> | null;
  notes: string | null;
  occurred_at: string;
  recorded_by: string;
}

const EVENT_COLUMNS = "id, case_id, event_type, event_data, notes, occurred_at, recorded_by";

function mapEvent(r: EventRow): HrLifecycleEvent {
  return {
    id: r.id,
    caseId: r.case_id,
    eventType: r.event_type,
    eventData: r.event_data,
    notes: r.notes,
    occurredAt: r.occurred_at,
    recordedBy: r.recorded_by,
  };
}

export function createPgLifecycleEventRepository(db: DatabaseProvider): LifecycleEventRepository {
  return {
    async append(input: { caseId: string; eventType: LifecycleEventType; eventData?: Record<string, unknown> | null; notes?: string | null; recordedBy: string }): Promise<HrLifecycleEvent> {
      const result = await db.query<EventRow>(
        `INSERT INTO hr_lifecycle_events(case_id, event_type, event_data, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING ${EVENT_COLUMNS}`,
        [input.caseId, input.eventType, input.eventData ? JSON.stringify(input.eventData) : null, input.notes ?? null, input.recordedBy],
      );
      return mapEvent(result.rows[0]!);
    },
    async listByCase(caseId: string): Promise<HrLifecycleEvent[]> {
      const result = await db.query<EventRow>(`SELECT ${EVENT_COLUMNS} FROM hr_lifecycle_events WHERE case_id = $1 ORDER BY occurred_at ASC`, [caseId]);
      return result.rows.map(mapEvent);
    },
  };
}
