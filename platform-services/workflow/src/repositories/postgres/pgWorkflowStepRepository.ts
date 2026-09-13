import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowStepRepository } from "../types.ts";
import type { WorkflowStep, StepType, AssignmentMode, ApprovalDecisionType, EscalationTargetMode } from "../../domain/workflow.ts";

interface Row {
  id: string;
  version_id: string;
  sequence_number: number;
  step_type: StepType;
  name: string;
  assignment_mode: AssignmentMode | null;
  assigned_permission_key: string | null;
  assigned_permission_key_privileged: string | null;
  allow_self_approval: boolean;
  permitted_decisions: ApprovalDecisionType[] | null;
  system_action_handler_key: string | null;
  due_after_minutes: number | null;
  escalate_after_minutes: number | null;
  escalation_target_mode: EscalationTargetMode;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, version_id, sequence_number, step_type, name, assignment_mode, assigned_permission_key, assigned_permission_key_privileged, allow_self_approval, permitted_decisions, system_action_handler_key, due_after_minutes, escalate_after_minutes, escalation_target_mode, created_at, updated_at";

function mapRow(r: Row): WorkflowStep {
  return {
    id: r.id,
    versionId: r.version_id,
    sequenceNumber: r.sequence_number,
    stepType: r.step_type,
    name: r.name,
    assignmentMode: r.assignment_mode,
    assignedPermissionKey: r.assigned_permission_key,
    assignedPermissionKeyPrivileged: r.assigned_permission_key_privileged,
    allowSelfApproval: r.allow_self_approval,
    permittedDecisions: r.permitted_decisions,
    systemActionHandlerKey: r.system_action_handler_key,
    dueAfterMinutes: r.due_after_minutes,
    escalateAfterMinutes: r.escalate_after_minutes,
    escalationTargetMode: r.escalation_target_mode,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createPgWorkflowStepRepository(db: DatabaseProvider): WorkflowStepRepository {
  return {
    async create(versionId, input) {
      const result = await db.query<Row>(
        `INSERT INTO workflow_steps(
           version_id, sequence_number, step_type, name, assignment_mode, assigned_permission_key, assigned_permission_key_privileged,
           allow_self_approval, permitted_decisions, system_action_handler_key, due_after_minutes,
           escalate_after_minutes, escalation_target_mode
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING ${COLUMNS}`,
        [
          versionId,
          input.sequenceNumber,
          input.stepType,
          input.name,
          input.assignmentMode ?? null,
          input.assignedPermissionKey ?? null,
          input.assignedPermissionKeyPrivileged ?? null,
          input.allowSelfApproval ?? false,
          input.permittedDecisions ?? null,
          input.systemActionHandlerKey ?? null,
          input.dueAfterMinutes ?? null,
          input.escalateAfterMinutes ?? null,
          input.escalationTargetMode ?? "NONE",
        ],
      );
      return mapRow(result.rows[0]!);
    },
    async findById(id) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_steps WHERE id = $1`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async listByVersion(versionId) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_steps WHERE version_id = $1 ORDER BY sequence_number ASC`, [versionId]);
      return result.rows.map(mapRow);
    },
    async findBySequence(versionId, sequenceNumber) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_steps WHERE version_id = $1 AND sequence_number = $2`, [versionId, sequenceNumber]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async update(id, input) {
      const current = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_steps WHERE id = $1`, [id]);
      const existing = current.rows[0];
      if (!existing) throw new Error("Workflow step not found.");
      const result = await db.query<Row>(
        `UPDATE workflow_steps SET
           sequence_number = $2, step_type = $3, name = $4, assignment_mode = $5, assigned_permission_key = $6,
           assigned_permission_key_privileged = $7, allow_self_approval = $8, permitted_decisions = $9,
           system_action_handler_key = $10, due_after_minutes = $11, escalate_after_minutes = $12,
           escalation_target_mode = $13, updated_at = NOW()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [
          id,
          input.sequenceNumber ?? existing.sequence_number,
          input.stepType ?? existing.step_type,
          input.name ?? existing.name,
          input.assignmentMode === undefined ? existing.assignment_mode : input.assignmentMode,
          input.assignedPermissionKey === undefined ? existing.assigned_permission_key : input.assignedPermissionKey,
          input.assignedPermissionKeyPrivileged === undefined ? existing.assigned_permission_key_privileged : input.assignedPermissionKeyPrivileged,
          input.allowSelfApproval === undefined ? existing.allow_self_approval : input.allowSelfApproval,
          input.permittedDecisions === undefined ? existing.permitted_decisions : input.permittedDecisions,
          input.systemActionHandlerKey === undefined ? existing.system_action_handler_key : input.systemActionHandlerKey,
          input.dueAfterMinutes === undefined ? existing.due_after_minutes : input.dueAfterMinutes,
          input.escalateAfterMinutes === undefined ? existing.escalate_after_minutes : input.escalateAfterMinutes,
          input.escalationTargetMode ?? existing.escalation_target_mode,
        ],
      );
      return mapRow(result.rows[0]!);
    },
    async delete(id) {
      await db.query(`DELETE FROM workflow_steps WHERE id = $1`, [id]);
    },
  };
}
