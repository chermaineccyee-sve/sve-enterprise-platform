import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { OrgStructureRepository } from "../types.ts";
import type { BusinessUnit, Department, Position, OrgStatus, CreateBusinessUnitInput, CreateDepartmentInput, CreatePositionInput } from "../../domain/organisation.ts";

interface BusinessUnitRow {
  id: string;
  legal_entity_id: string;
  name: string;
  code: string;
  status: OrgStatus;
  created_at: string;
  updated_at: string;
}
interface DepartmentRow {
  id: string;
  legal_entity_id: string;
  business_unit_id: string | null;
  name: string;
  code: string;
  status: OrgStatus;
  created_at: string;
  updated_at: string;
}
interface PositionRow {
  id: string;
  department_id: string;
  title: string;
  status: OrgStatus;
  reports_to_position_id: string | null;
  cost_centre_code: string | null;
  created_at: string;
  updated_at: string;
}

const mapBusinessUnit = (r: BusinessUnitRow): BusinessUnit => ({
  id: r.id,
  legalEntityId: r.legal_entity_id,
  name: r.name,
  code: r.code,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const mapDepartment = (r: DepartmentRow): Department => ({
  id: r.id,
  legalEntityId: r.legal_entity_id,
  businessUnitId: r.business_unit_id,
  name: r.name,
  code: r.code,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const mapPosition = (r: PositionRow): Position => ({
  id: r.id,
  departmentId: r.department_id,
  title: r.title,
  status: r.status,
  reportsToPositionId: r.reports_to_position_id,
  costCentreCode: r.cost_centre_code,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function createPgOrgStructureRepository(db: DatabaseProvider): OrgStructureRepository {
  return {
    async createBusinessUnit(input: CreateBusinessUnitInput): Promise<BusinessUnit> {
      const result = await db.query<BusinessUnitRow>(
        `INSERT INTO business_units(legal_entity_id, name, code) VALUES ($1, $2, $3)
         RETURNING id, legal_entity_id, name, code, status, created_at, updated_at`,
        [input.legalEntityId, input.name, input.code],
      );
      return mapBusinessUnit(result.rows[0]!);
    },
    async findBusinessUnitById(id: string): Promise<BusinessUnit | null> {
      const result = await db.query<BusinessUnitRow>(
        `SELECT id, legal_entity_id, name, code, status, created_at, updated_at FROM business_units WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapBusinessUnit(result.rows[0]) : null;
    },
    async listBusinessUnits(filter?: { legalEntityId?: string }): Promise<BusinessUnit[]> {
      if (filter?.legalEntityId) {
        const result = await db.query<BusinessUnitRow>(
          `SELECT id, legal_entity_id, name, code, status, created_at, updated_at FROM business_units WHERE legal_entity_id = $1 ORDER BY name`,
          [filter.legalEntityId],
        );
        return result.rows.map(mapBusinessUnit);
      }
      const result = await db.query<BusinessUnitRow>(`SELECT id, legal_entity_id, name, code, status, created_at, updated_at FROM business_units ORDER BY name`);
      return result.rows.map(mapBusinessUnit);
    },

    async createDepartment(input: CreateDepartmentInput): Promise<Department> {
      const result = await db.query<DepartmentRow>(
        `INSERT INTO departments(legal_entity_id, business_unit_id, name, code) VALUES ($1, $2, $3, $4)
         RETURNING id, legal_entity_id, business_unit_id, name, code, status, created_at, updated_at`,
        [input.legalEntityId, input.businessUnitId ?? null, input.name, input.code],
      );
      return mapDepartment(result.rows[0]!);
    },
    async findDepartmentById(id: string): Promise<Department | null> {
      const result = await db.query<DepartmentRow>(
        `SELECT id, legal_entity_id, business_unit_id, name, code, status, created_at, updated_at FROM departments WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapDepartment(result.rows[0]) : null;
    },
    async listDepartments(filter?: { legalEntityId?: string; businessUnitId?: string }): Promise<Department[]> {
      const clauses: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (filter?.legalEntityId) {
        clauses.push(`legal_entity_id = $${i++}`);
        params.push(filter.legalEntityId);
      }
      if (filter?.businessUnitId) {
        clauses.push(`business_unit_id = $${i++}`);
        params.push(filter.businessUnitId);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await db.query<DepartmentRow>(
        `SELECT id, legal_entity_id, business_unit_id, name, code, status, created_at, updated_at FROM departments ${where} ORDER BY name`,
        params,
      );
      return result.rows.map(mapDepartment);
    },

    async createPosition(input: CreatePositionInput): Promise<Position> {
      const result = await db.query<PositionRow>(
        `INSERT INTO positions(department_id, title, reports_to_position_id, cost_centre_code) VALUES ($1, $2, $3, $4)
         RETURNING id, department_id, title, status, reports_to_position_id, cost_centre_code, created_at, updated_at`,
        [input.departmentId, input.title, input.reportsToPositionId ?? null, input.costCentreCode ?? null],
      );
      return mapPosition(result.rows[0]!);
    },
    async findPositionById(id: string): Promise<Position | null> {
      const result = await db.query<PositionRow>(
        `SELECT id, department_id, title, status, reports_to_position_id, cost_centre_code, created_at, updated_at FROM positions WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapPosition(result.rows[0]) : null;
    },
    async listPositions(filter?: { departmentId?: string }): Promise<Position[]> {
      if (filter?.departmentId) {
        const result = await db.query<PositionRow>(
          `SELECT id, department_id, title, status, reports_to_position_id, cost_centre_code, created_at, updated_at FROM positions WHERE department_id = $1 ORDER BY title`,
          [filter.departmentId],
        );
        return result.rows.map(mapPosition);
      }
      const result = await db.query<PositionRow>(`SELECT id, department_id, title, status, reports_to_position_id, cost_centre_code, created_at, updated_at FROM positions ORDER BY title`);
      return result.rows.map(mapPosition);
    },
  };
}
