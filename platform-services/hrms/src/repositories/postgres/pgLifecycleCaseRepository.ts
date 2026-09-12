import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { LifecycleCaseRepository } from "../types.ts";
import type { HrLifecycleCase, LifecycleType, LifecycleStatus, CreateLifecycleCaseInput, LifecycleCaseFilter } from "../../domain/lifecycle.ts";

interface CaseRow {
  id: string;
  case_number: string;
  employee_id: string;
  legal_entity_id: string;
  lifecycle_type: LifecycleType;
  case_subtype: string | null;
  status: LifecycleStatus;
  current_stage: string | null;
  initiated_at: string;
  effective_date: string | null;
  hr_owner_user_id: string;
  outcome: string | null;
  reason_category: string | null;
  notice_date: string | null;
  intended_last_working_date: string | null;
  resulting_assignment_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}

const CASE_COLUMNS =
  "id, case_number, employee_id, legal_entity_id, lifecycle_type, case_subtype, status, current_stage, initiated_at, effective_date, hr_owner_user_id, outcome, reason_category, notice_date, intended_last_working_date, resulting_assignment_id, created_by, updated_by, created_at, updated_at, completed_at, cancelled_at";

function mapCase(r: CaseRow): HrLifecycleCase {
  return {
    id: r.id,
    caseNumber: r.case_number,
    employeeId: r.employee_id,
    legalEntityId: r.legal_entity_id,
    lifecycleType: r.lifecycle_type,
    caseSubtype: r.case_subtype,
    status: r.status,
    currentStage: r.current_stage,
    initiatedAt: r.initiated_at,
    effectiveDate: r.effective_date,
    hrOwnerUserId: r.hr_owner_user_id,
    outcome: r.outcome,
    reasonCategory: r.reason_category,
    noticeDate: r.notice_date,
    intendedLastWorkingDate: r.intended_last_working_date,
    resultingAssignmentId: r.resulting_assignment_id,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
  };
}

export function createPgLifecycleCaseRepository(db: DatabaseProvider): LifecycleCaseRepository {
  return {
    async create(input: CreateLifecycleCaseInput & { caseNumber: string; createdBy: string }): Promise<HrLifecycleCase> {
      const result = await db.query<CaseRow>(
        `INSERT INTO hr_lifecycle_cases(
           case_number, employee_id, legal_entity_id, lifecycle_type, case_subtype, current_stage,
           effective_date, hr_owner_user_id, reason_category, notice_date, intended_last_working_date,
           created_by, updated_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
         RETURNING ${CASE_COLUMNS}`,
        [
          input.caseNumber,
          input.employeeId,
          input.legalEntityId,
          input.lifecycleType,
          input.caseSubtype ?? null,
          input.currentStage ?? null,
          input.effectiveDate ?? null,
          input.hrOwnerUserId,
          input.reasonCategory ?? null,
          input.noticeDate ?? null,
          input.intendedLastWorkingDate ?? null,
          input.createdBy,
        ],
      );
      return mapCase(result.rows[0]!);
    },
    async findById(id: string): Promise<HrLifecycleCase | null> {
      const result = await db.query<CaseRow>(`SELECT ${CASE_COLUMNS} FROM hr_lifecycle_cases WHERE id = $1`, [id]);
      return result.rows[0] ? mapCase(result.rows[0]) : null;
    },
    async list(filter: LifecycleCaseFilter): Promise<HrLifecycleCase[]> {
      const clauses: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (filter.employeeId) {
        clauses.push(`employee_id = $${i++}`);
        params.push(filter.employeeId);
      }
      if (filter.legalEntityId) {
        clauses.push(`legal_entity_id = $${i++}`);
        params.push(filter.legalEntityId);
      }
      if (filter.lifecycleType) {
        clauses.push(`lifecycle_type = $${i++}`);
        params.push(filter.lifecycleType);
      }
      if (filter.status) {
        clauses.push(`status = $${i++}`);
        params.push(filter.status);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await db.query<CaseRow>(`SELECT ${CASE_COLUMNS} FROM hr_lifecycle_cases ${where} ORDER BY initiated_at DESC`, params);
      return result.rows.map(mapCase);
    },
    async updateStatus(
      id: string,
      input: { status: LifecycleStatus; currentStage?: string | null; outcome?: string | null; effectiveDate?: string | null; resultingAssignmentId?: string | null; updatedBy: string },
    ): Promise<HrLifecycleCase> {
      const current = await db.query<CaseRow>(`SELECT ${CASE_COLUMNS} FROM hr_lifecycle_cases WHERE id = $1`, [id]);
      const existing = current.rows[0];
      if (!existing) throw new Error("Lifecycle case not found.");
      const result = await db.query<CaseRow>(
        `UPDATE hr_lifecycle_cases SET
           status = $2,
           current_stage = $3,
           outcome = $4,
           effective_date = $5,
           resulting_assignment_id = $6,
           updated_by = $7,
           updated_at = NOW(),
           completed_at = CASE WHEN $2 = 'COMPLETED' THEN NOW() ELSE completed_at END,
           cancelled_at = CASE WHEN $2 = 'CANCELLED' THEN NOW() ELSE cancelled_at END
         WHERE id = $1 RETURNING ${CASE_COLUMNS}`,
        [
          id,
          input.status,
          input.currentStage === undefined ? existing.current_stage : input.currentStage,
          input.outcome === undefined ? existing.outcome : input.outcome,
          input.effectiveDate === undefined ? existing.effective_date : input.effectiveDate,
          input.resultingAssignmentId === undefined ? existing.resulting_assignment_id : input.resultingAssignmentId,
          input.updatedBy,
        ],
      );
      return mapCase(result.rows[0]!);
    },
    async nextCaseNumberSeq(): Promise<number> {
      const result = await db.query<{ nextval: string }>(`SELECT nextval('hr_lifecycle_case_seq')`);
      return Number(result.rows[0]!.nextval);
    },
  };
}
