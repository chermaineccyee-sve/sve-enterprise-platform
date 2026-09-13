import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowTaskRepository } from "../types.ts";
import type { WorkflowTask, TaskType, AssignmentMode, TaskStatus, EscalationTargetMode } from "../../domain/workflow.ts";

interface Row {
  id: string;
  instance_id: string;
  step_id: string;
  task_type: TaskType;
  assignment_mode: AssignmentMode;
  assigned_user_id: string | null;
  assigned_permission_key: string | null;
  status: TaskStatus;
  due_at: string | null;
  escalate_after: string | null;
  escalated_at: string | null;
  escalation_target_mode: EscalationTargetMode;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by: string | null;
  cancelled_at: string | null;
}

const COLUMNS =
  "id, instance_id, step_id, task_type, assignment_mode, assigned_user_id, assigned_permission_key, status, due_at, escalate_after, escalated_at, escalation_target_mode, created_at, updated_at, completed_at, completed_by, cancelled_at";

function mapRow(r: Row): WorkflowTask {
  return {
    id: r.id,
    instanceId: r.instance_id,
    stepId: r.step_id,
    taskType: r.task_type,
    assignmentMode: r.assignment_mode,
    assignedUserId: r.assigned_user_id,
    assignedPermissionKey: r.assigned_permission_key,
    status: r.status,
    dueAt: r.due_at,
    escalateAfter: r.escalate_after,
    escalatedAt: r.escalated_at,
    escalationTargetMode: r.escalation_target_mode,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    cancelledAt: r.cancelled_at,
  };
}

export function createPgWorkflowTaskRepository(db: DatabaseProvider): WorkflowTaskRepository {
  return {
    async create(input) {
      const result = await db.query<Row>(
        `INSERT INTO workflow_tasks(instance_id, step_id, task_type, assignment_mode, assigned_user_id, assigned_permission_key, due_at, escalate_after, escalation_target_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLUMNS}`,
        [input.instanceId, input.stepId, input.taskType, input.assignmentMode, input.assignedUserId ?? null, input.assignedPermissionKey ?? null, input.dueAt ?? null, input.escalateAfter ?? null, input.escalationTargetMode],
      );
      return mapRow(result.rows[0]!);
    },
    async findById(id) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_tasks WHERE id = $1`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async listByInstance(instanceId) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_tasks WHERE instance_id = $1 ORDER BY created_at ASC`, [instanceId]);
      return result.rows.map(mapRow);
    },
    async listCandidatesForUser(userId, filter) {
      const clauses: string[] = [`(assigned_user_id = $1 OR assignment_mode = 'ROLE')`];
      const params: unknown[] = [userId];
      let i = 2;
      if (filter.instanceId) {
        clauses.push(`instance_id = $${i++}`);
        params.push(filter.instanceId);
      }
      if (filter.status) {
        clauses.push(`status = $${i++}`);
        params.push(filter.status);
      }
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_tasks WHERE ${clauses.join(" AND ")} ORDER BY created_at ASC`, params);
      return result.rows.map(mapRow);
    },
    async transitionStatus(id, expectedStatus, input) {
      const result = await db.query<Row>(
        `UPDATE workflow_tasks SET
           status = $3,
           completed_at = CASE WHEN $3 = 'COMPLETED' THEN NOW() ELSE completed_at END,
           completed_by = CASE WHEN $3 = 'COMPLETED' THEN $4 ELSE completed_by END,
           cancelled_at = CASE WHEN $3 = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
           updated_at = NOW()
         WHERE id = $1 AND status = $2 RETURNING ${COLUMNS}`,
        [id, expectedStatus, input.status, input.completedBy ?? null],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async markEscalated(id, input) {
      const result = await db.query<Row>(
        `UPDATE workflow_tasks SET
           escalated_at = NOW(),
           assigned_user_id = CASE WHEN $2::boolean THEN $3::uuid ELSE assigned_user_id END,
           updated_at = NOW()
         WHERE id = $1 AND escalated_at IS NULL RETURNING ${COLUMNS}`,
        [id, input.assignedUserId !== undefined, input.assignedUserId ?? null],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async reassign(id, input) {
      const result = await db.query<Row>(`UPDATE workflow_tasks SET assigned_user_id = $2, updated_at = NOW() WHERE id = $1 RETURNING ${COLUMNS}`, [id, input.assignedUserId]);
      if (!result.rows[0]) throw new Error("Workflow task not found.");
      return mapRow(result.rows[0]);
    },
    async listDueForEscalation(now) {
      const result = await db.query<Row>(
        `SELECT ${COLUMNS} FROM workflow_tasks WHERE status = 'PENDING' AND escalated_at IS NULL AND escalate_after IS NOT NULL AND escalate_after <= $1`,
        [now],
      );
      return result.rows.map(mapRow);
    },
  };
}
