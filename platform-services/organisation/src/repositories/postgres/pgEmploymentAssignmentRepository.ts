import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { EmploymentAssignmentRepository } from "../types.ts";
import type { EmploymentAssignment, EmploymentStatus, CreateAssignmentInput, AssignmentFilter } from "../../domain/employee.ts";

interface AssignmentRow {
  id: string;
  employee_id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  department_id: string | null;
  position_id: string | null;
  employment_type: string;
  status: EmploymentStatus;
  is_primary: boolean;
  start_date: string;
  confirmation_date: string | null;
  probation_end_date: string | null;
  end_date: string | null;
  effective_from: string;
  effective_to: string | null;
  work_location: string | null;
  work_arrangement: string | null;
  reports_to_assignment_id: string | null;
  change_reason: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

const ASSIGNMENT_COLUMNS =
  "id, employee_id, legal_entity_id, business_unit_id, department_id, position_id, employment_type, status, is_primary, start_date, confirmation_date, probation_end_date, end_date, effective_from, effective_to, work_location, work_arrangement, reports_to_assignment_id, change_reason, created_by, updated_by, created_at, updated_at";

function mapAssignment(r: AssignmentRow): EmploymentAssignment {
  return {
    id: r.id,
    employeeId: r.employee_id,
    legalEntityId: r.legal_entity_id,
    businessUnitId: r.business_unit_id,
    departmentId: r.department_id,
    positionId: r.position_id,
    employmentType: r.employment_type,
    status: r.status,
    isPrimary: r.is_primary,
    startDate: r.start_date,
    confirmationDate: r.confirmation_date,
    probationEndDate: r.probation_end_date,
    endDate: r.end_date,
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    workLocation: r.work_location,
    workArrangement: r.work_arrangement,
    reportsToAssignmentId: r.reports_to_assignment_id,
    changeReason: r.change_reason,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createPgEmploymentAssignmentRepository(db: DatabaseProvider): EmploymentAssignmentRepository {
  return {
    async create(input: CreateAssignmentInput & { employeeId: string; createdBy: string }): Promise<EmploymentAssignment> {
      const result = await db.query<AssignmentRow>(
        `INSERT INTO employment_assignments(
           employee_id, legal_entity_id, business_unit_id, department_id, position_id, employment_type, status, is_primary,
           start_date, confirmation_date, probation_end_date, effective_from, work_location, work_arrangement,
           reports_to_assignment_id, change_reason, created_by, updated_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
         RETURNING ${ASSIGNMENT_COLUMNS}`,
        [
          input.employeeId,
          input.legalEntityId,
          input.businessUnitId ?? null,
          input.departmentId ?? null,
          input.positionId ?? null,
          input.employmentType,
          input.status,
          input.isPrimary ?? true,
          input.startDate,
          input.confirmationDate ?? null,
          input.probationEndDate ?? null,
          input.effectiveFrom ?? input.startDate,
          input.workLocation ?? null,
          input.workArrangement ?? null,
          input.reportsToAssignmentId ?? null,
          input.changeReason ?? null,
          input.createdBy,
        ],
      );
      return mapAssignment(result.rows[0]!);
    },
    async findById(id: string): Promise<EmploymentAssignment | null> {
      const result = await db.query<AssignmentRow>(`SELECT ${ASSIGNMENT_COLUMNS} FROM employment_assignments WHERE id = $1`, [id]);
      return result.rows[0] ? mapAssignment(result.rows[0]) : null;
    },
    async findCurrentPrimary(employeeId: string): Promise<EmploymentAssignment | null> {
      const result = await db.query<AssignmentRow>(
        `SELECT ${ASSIGNMENT_COLUMNS} FROM employment_assignments WHERE employee_id = $1 AND effective_to IS NULL AND is_primary = TRUE`,
        [employeeId],
      );
      return result.rows[0] ? mapAssignment(result.rows[0]) : null;
    },
    async findEffectiveAsOf(employeeId: string, asOfDate: string): Promise<EmploymentAssignment | null> {
      const result = await db.query<AssignmentRow>(
        `SELECT ${ASSIGNMENT_COLUMNS} FROM employment_assignments
         WHERE employee_id = $1 AND is_primary = TRUE AND effective_from <= $2 AND (effective_to IS NULL OR effective_to >= $2)
         ORDER BY effective_from DESC LIMIT 1`,
        [employeeId, asOfDate],
      );
      return result.rows[0] ? mapAssignment(result.rows[0]) : null;
    },
    async list(filter: AssignmentFilter): Promise<EmploymentAssignment[]> {
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
      if (filter.currentOnly) {
        clauses.push(`effective_to IS NULL`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await db.query<AssignmentRow>(
        `SELECT ${ASSIGNMENT_COLUMNS} FROM employment_assignments ${where} ORDER BY effective_from DESC`,
        params,
      );
      return result.rows.map(mapAssignment);
    },
    async closeAssignment(id: string, input: { effectiveTo: string; endDate?: string | null; status?: EmploymentStatus; updatedBy: string }): Promise<EmploymentAssignment> {
      const current = await db.query<AssignmentRow>(`SELECT ${ASSIGNMENT_COLUMNS} FROM employment_assignments WHERE id = $1`, [id]);
      const existing = current.rows[0];
      if (!existing) throw new Error("Employment assignment not found.");
      const result = await db.query<AssignmentRow>(
        `UPDATE employment_assignments SET effective_to = $2, end_date = $3, status = $4, updated_by = $5, updated_at = NOW()
         WHERE id = $1 RETURNING ${ASSIGNMENT_COLUMNS}`,
        [id, input.effectiveTo, input.endDate === undefined ? existing.end_date : input.endDate, input.status ?? existing.status, input.updatedBy],
      );
      return mapAssignment(result.rows[0]!);
    },
    async findByPositionId(positionId: string, currentOnly = true): Promise<EmploymentAssignment[]> {
      const where = currentOnly ? "AND effective_to IS NULL" : "";
      const result = await db.query<AssignmentRow>(
        `SELECT ${ASSIGNMENT_COLUMNS} FROM employment_assignments WHERE position_id = $1 ${where}`,
        [positionId],
      );
      return result.rows.map(mapAssignment);
    },
  };
}
