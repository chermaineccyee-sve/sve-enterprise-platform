import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { HrIdentityDeactivationRequestRepository } from "../types.ts";
import type { HrIdentityDeactivationRequest, DeactivationRequestStatus } from "../../domain/lifecycle.ts";

interface RequestRow {
  id: string;
  case_id: string;
  employee_id: string;
  target_user_id: string;
  requested_by: string;
  reason_category: string;
  status: DeactivationRequestStatus;
  requested_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  attempt_count: number;
}

const COLUMNS = "id, case_id, employee_id, target_user_id, requested_by, reason_category, status, requested_at, completed_at, failure_reason, attempt_count";

function mapRow(r: RequestRow): HrIdentityDeactivationRequest {
  return {
    id: r.id,
    caseId: r.case_id,
    employeeId: r.employee_id,
    targetUserId: r.target_user_id,
    requestedBy: r.requested_by,
    reasonCategory: r.reason_category,
    status: r.status,
    requestedAt: r.requested_at,
    completedAt: r.completed_at,
    failureReason: r.failure_reason,
    attemptCount: r.attempt_count,
  };
}

export function createPgIdentityDeactivationRequestRepository(db: DatabaseProvider): HrIdentityDeactivationRequestRepository {
  return {
    async create(input): Promise<HrIdentityDeactivationRequest> {
      const result = await db.query<RequestRow>(
        `INSERT INTO hr_identity_deactivation_requests(case_id, employee_id, target_user_id, requested_by, reason_category)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
        [input.caseId, input.employeeId, input.targetUserId, input.requestedBy, input.reasonCategory ?? "hrms_offboarding"],
      );
      return mapRow(result.rows[0]!);
    },
    async findById(id: string): Promise<HrIdentityDeactivationRequest | null> {
      const result = await db.query<RequestRow>(`SELECT ${COLUMNS} FROM hr_identity_deactivation_requests WHERE id = $1`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async findByIdForUpdate(id: string): Promise<HrIdentityDeactivationRequest | null> {
      const result = await db.query<RequestRow>(`SELECT ${COLUMNS} FROM hr_identity_deactivation_requests WHERE id = $1 FOR UPDATE`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async listByStatus(status: DeactivationRequestStatus): Promise<HrIdentityDeactivationRequest[]> {
      const result = await db.query<RequestRow>(`SELECT ${COLUMNS} FROM hr_identity_deactivation_requests WHERE status = $1 ORDER BY requested_at ASC`, [status]);
      return result.rows.map(mapRow);
    },
    async markCompleted(id: string): Promise<HrIdentityDeactivationRequest> {
      const result = await db.query<RequestRow>(
        `UPDATE hr_identity_deactivation_requests SET status = 'COMPLETED', completed_at = NOW(), attempt_count = attempt_count + 1 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id],
      );
      return mapRow(result.rows[0]!);
    },
    async markFailed(id: string, failureReason: string): Promise<HrIdentityDeactivationRequest> {
      const result = await db.query<RequestRow>(
        `UPDATE hr_identity_deactivation_requests SET status = 'FAILED', failure_reason = $2, attempt_count = attempt_count + 1 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, failureReason],
      );
      return mapRow(result.rows[0]!);
    },
  };
}
