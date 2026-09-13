import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowDecisionRepository } from "../types.ts";
import type { WorkflowDecision, ApprovalDecisionType } from "../../domain/workflow.ts";

interface Row {
  id: string;
  task_id: string;
  instance_id: string;
  actor_user_id: string;
  decision: ApprovalDecisionType;
  comment: string | null;
  resulting_transition: string;
  decided_at: string;
}

const COLUMNS = "id, task_id, instance_id, actor_user_id, decision, comment, resulting_transition, decided_at";

function mapRow(r: Row): WorkflowDecision {
  return { id: r.id, taskId: r.task_id, instanceId: r.instance_id, actorUserId: r.actor_user_id, decision: r.decision, comment: r.comment, resultingTransition: r.resulting_transition, decidedAt: r.decided_at };
}

export function createPgWorkflowDecisionRepository(db: DatabaseProvider): WorkflowDecisionRepository {
  return {
    async create(input) {
      // UNIQUE(task_id) on this table is the real concurrency guarantee
      // (PR brief item 19) — a second concurrent attempt for the same
      // task hits a unique-violation here, never a second committed
      // decision. The caller (taskService) surfaces that as an
      // InvalidStateError, not a raw Postgres error.
      const result = await db.query<Row>(
        `INSERT INTO workflow_decisions(task_id, instance_id, actor_user_id, decision, comment, resulting_transition)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLUMNS}`,
        [input.taskId, input.instanceId, input.actorUserId, input.decision, input.comment ?? null, input.resultingTransition],
      );
      return mapRow(result.rows[0]!);
    },
    async findByTaskId(taskId) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_decisions WHERE task_id = $1`, [taskId]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async listByInstance(instanceId) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_decisions WHERE instance_id = $1 ORDER BY decided_at ASC`, [instanceId]);
      return result.rows.map(mapRow);
    },
  };
}
