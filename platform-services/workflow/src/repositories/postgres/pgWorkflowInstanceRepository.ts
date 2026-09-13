import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowInstanceRepository } from "../types.ts";
import type { WorkflowInstance, InstanceStatus, FailureCategory, DataClassification } from "../../domain/workflow.ts";

interface Row {
  id: string;
  definition_id: string;
  version_id: string;
  subject_type: string;
  subject_id: string;
  legal_entity_id: string;
  data_classification: DataClassification;
  subject_employee_id: string | null;
  requester_user_id: string;
  subject_actor_user_id: string | null;
  status: InstanceStatus;
  outcome: string | null;
  failure_category: FailureCategory | null;
  current_step_id: string | null;
  idempotency_key: string | null;
  context: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  created_by: string;
  updated_at: string;
}

const COLUMNS =
  "id, definition_id, version_id, subject_type, subject_id, legal_entity_id, data_classification, subject_employee_id, requester_user_id, subject_actor_user_id, status, outcome, failure_category, current_step_id, idempotency_key, context, started_at, completed_at, cancelled_at, created_by, updated_at";

function mapRow(r: Row): WorkflowInstance {
  return {
    id: r.id,
    definitionId: r.definition_id,
    versionId: r.version_id,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    legalEntityId: r.legal_entity_id,
    dataClassification: r.data_classification,
    subjectEmployeeId: r.subject_employee_id,
    requesterUserId: r.requester_user_id,
    subjectActorUserId: r.subject_actor_user_id,
    status: r.status,
    outcome: r.outcome,
    failureCategory: r.failure_category,
    currentStepId: r.current_step_id,
    idempotencyKey: r.idempotency_key,
    context: r.context,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
    createdBy: r.created_by,
    updatedAt: r.updated_at,
  };
}

export function createPgWorkflowInstanceRepository(db: DatabaseProvider): WorkflowInstanceRepository {
  return {
    async create(input) {
      const result = await db.query<Row>(
        `INSERT INTO workflow_instances(
           definition_id, version_id, subject_type, subject_id, legal_entity_id, data_classification,
           subject_employee_id, requester_user_id, subject_actor_user_id, idempotency_key, context, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING ${COLUMNS}`,
        [
          input.definitionId,
          input.versionId,
          input.subjectType,
          input.subjectId,
          input.legalEntityId,
          input.dataClassification,
          input.subjectEmployeeId ?? null,
          input.requesterUserId,
          input.subjectActorUserId ?? null,
          input.idempotencyKey ?? null,
          input.context ? JSON.stringify(input.context) : null,
          input.createdBy,
        ],
      );
      return mapRow(result.rows[0]!);
    },
    async findById(id) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_instances WHERE id = $1`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async findByIdForUpdate(id) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_instances WHERE id = $1 FOR UPDATE`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async findByIdempotencyKey(definitionId, idempotencyKey) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_instances WHERE definition_id = $1 AND idempotency_key = $2`, [definitionId, idempotencyKey]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async list(filter) {
      const clauses: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (filter.status) {
        clauses.push(`status = $${i++}`);
        params.push(filter.status);
      }
      if (filter.subjectType) {
        clauses.push(`subject_type = $${i++}`);
        params.push(filter.subjectType);
      }
      if (filter.subjectId) {
        clauses.push(`subject_id = $${i++}`);
        params.push(filter.subjectId);
      }
      if (filter.legalEntityId) {
        clauses.push(`legal_entity_id = $${i++}`);
        params.push(filter.legalEntityId);
      }
      if (filter.requesterUserId) {
        clauses.push(`requester_user_id = $${i++}`);
        params.push(filter.requesterUserId);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_instances ${where} ORDER BY started_at DESC`, params);
      return result.rows.map(mapRow);
    },
    async updateProgress(id, input) {
      const result = await db.query<Row>(
        `UPDATE workflow_instances SET
           status = $2,
           current_step_id = CASE WHEN $3::boolean THEN $4::uuid ELSE current_step_id END,
           outcome = CASE WHEN $5::boolean THEN $6 ELSE outcome END,
           failure_category = CASE WHEN $7::boolean THEN $8 ELSE failure_category END,
           completed_at = CASE WHEN $2 = 'COMPLETED' THEN NOW() ELSE completed_at END,
           cancelled_at = CASE WHEN $2 = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
           updated_at = NOW()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [
          id,
          input.status,
          input.currentStepId !== undefined,
          input.currentStepId ?? null,
          input.outcome !== undefined,
          input.outcome ?? null,
          input.failureCategory !== undefined,
          input.failureCategory ?? null,
        ],
      );
      if (!result.rows[0]) throw new Error("Workflow instance not found.");
      return mapRow(result.rows[0]);
    },
  };
}
