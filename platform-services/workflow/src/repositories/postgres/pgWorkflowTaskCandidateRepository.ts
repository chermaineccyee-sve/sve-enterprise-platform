import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowTaskCandidateRepository } from "../types.ts";
import type { WorkflowTaskCandidate } from "../../domain/workflow.ts";

interface Row {
  id: string;
  task_id: string;
  user_id: string;
  created_at: string;
}

const COLUMNS = "id, task_id, user_id, created_at";

function mapRow(r: Row): WorkflowTaskCandidate {
  return { id: r.id, taskId: r.task_id, userId: r.user_id, createdAt: r.created_at };
}

export function createPgWorkflowTaskCandidateRepository(db: DatabaseProvider): WorkflowTaskCandidateRepository {
  return {
    async recordCandidates(taskId, userIds) {
      for (const userId of userIds) {
        await db.query(`INSERT INTO workflow_task_candidates(task_id, user_id) VALUES ($1,$2) ON CONFLICT (task_id, user_id) DO NOTHING`, [taskId, userId]);
      }
    },
    async isCandidate(taskId, userId) {
      const result = await db.query(`SELECT 1 FROM workflow_task_candidates WHERE task_id = $1 AND user_id = $2`, [taskId, userId]);
      return result.rows.length > 0;
    },
    async listCandidateUserIds(taskId) {
      const result = await db.query<{ user_id: string }>(`SELECT user_id FROM workflow_task_candidates WHERE task_id = $1`, [taskId]);
      return result.rows.map((r) => r.user_id);
    },
    async listByTask(taskId) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_task_candidates WHERE task_id = $1`, [taskId]);
      return result.rows.map(mapRow);
    },
  };
}
