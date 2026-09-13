import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowSystemActionExecutionRepository } from "../types.ts";
import type { WorkflowSystemActionExecution, SystemActionExecutionStatus } from "../../domain/workflow.ts";

interface Row {
  id: string;
  instance_id: string;
  step_id: string;
  handler_key: string;
  status: SystemActionExecutionStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
}

const COLUMNS = "id, instance_id, step_id, handler_key, status, attempts, last_error, created_at, updated_at, executed_at";

function mapRow(r: Row): WorkflowSystemActionExecution {
  return {
    id: r.id,
    instanceId: r.instance_id,
    stepId: r.step_id,
    handlerKey: r.handler_key,
    status: r.status,
    attempts: r.attempts,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    executedAt: r.executed_at,
  };
}

export function createPgWorkflowSystemActionExecutionRepository(db: DatabaseProvider): WorkflowSystemActionExecutionRepository {
  return {
    async findOrCreate(input) {
      // UNIQUE(instance_id, step_id) is the idempotency guarantee (PR
      // brief item 21): ON CONFLICT DO NOTHING means a second concurrent
      // (or repeated) attempt for the same instance+step never inserts a
      // second row — it falls through to the SELECT below and returns the
      // existing one.
      const inserted = await db.query<Row>(
        `INSERT INTO workflow_system_action_executions(instance_id, step_id, handler_key)
         VALUES ($1,$2,$3) ON CONFLICT (instance_id, step_id) DO NOTHING RETURNING ${COLUMNS}`,
        [input.instanceId, input.stepId, input.handlerKey],
      );
      if (inserted.rows[0]) return { execution: mapRow(inserted.rows[0]), created: true };
      const existing = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_system_action_executions WHERE instance_id = $1 AND step_id = $2`, [input.instanceId, input.stepId]);
      return { execution: mapRow(existing.rows[0]!), created: false };
    },
    async updateStatus(id, input) {
      const result = await db.query<Row>(
        `UPDATE workflow_system_action_executions SET
           status = $2,
           attempts = $3,
           last_error = CASE WHEN $4::boolean THEN $5 ELSE last_error END,
           executed_at = CASE WHEN $2 IN ('SUCCEEDED','FAILED') THEN NOW() ELSE executed_at END,
           updated_at = NOW()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, input.status, input.attempts, input.lastError !== undefined, input.lastError ?? null],
      );
      if (!result.rows[0]) throw new Error("System action execution not found.");
      return mapRow(result.rows[0]);
    },
  };
}
