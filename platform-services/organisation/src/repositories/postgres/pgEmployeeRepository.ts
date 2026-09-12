import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { EmployeeRepository } from "../types.ts";
import type { Employee, EmploymentStatus, CreateEmployeeInput, UpdateEmployeeInput, EmployeeFilter } from "../../domain/employee.ts";

interface EmployeeRow {
  id: string;
  employee_number: string;
  legal_name: string;
  preferred_name: string | null;
  work_email: string | null;
  personal_email: string | null;
  employment_country: string;
  status: EmploymentStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

const EMPLOYEE_COLUMNS = "id, employee_number, legal_name, preferred_name, work_email, personal_email, employment_country, status, created_by, updated_by, created_at, updated_at";

function mapEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id,
    employeeNumber: r.employee_number,
    legalName: r.legal_name,
    preferredName: r.preferred_name,
    workEmail: r.work_email,
    personalEmail: r.personal_email,
    employmentCountry: r.employment_country,
    status: r.status,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createPgEmployeeRepository(db: DatabaseProvider): EmployeeRepository {
  return {
    async create(input: CreateEmployeeInput & { employeeNumber: string; createdBy: string }): Promise<Employee> {
      const result = await db.query<EmployeeRow>(
        `INSERT INTO employees(employee_number, legal_name, preferred_name, work_email, personal_email, employment_country, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'PRE_HIRE', $7, $7)
         RETURNING ${EMPLOYEE_COLUMNS}`,
        [input.employeeNumber, input.legalName, input.preferredName ?? null, input.workEmail ?? null, input.personalEmail ?? null, input.employmentCountry, input.createdBy],
      );
      return mapEmployee(result.rows[0]!);
    },
    async findById(id: string): Promise<Employee | null> {
      const result = await db.query<EmployeeRow>(`SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE id = $1`, [id]);
      return result.rows[0] ? mapEmployee(result.rows[0]) : null;
    },
    async findByWorkEmail(workEmail: string): Promise<Employee | null> {
      const result = await db.query<EmployeeRow>(`SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE work_email = $1`, [workEmail]);
      return result.rows[0] ? mapEmployee(result.rows[0]) : null;
    },
    async list(filter: EmployeeFilter): Promise<Employee[]> {
      const clauses: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (filter.status) {
        clauses.push(`status = $${i++}`);
        params.push(filter.status);
      }
      if (filter.search) {
        clauses.push(`(employee_number ILIKE $${i} OR legal_name ILIKE $${i} OR preferred_name ILIKE $${i} OR work_email ILIKE $${i})`);
        params.push(`%${filter.search}%`);
        i++;
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await db.query<EmployeeRow>(`SELECT ${EMPLOYEE_COLUMNS} FROM employees ${where} ORDER BY legal_name`, params);
      return result.rows.map(mapEmployee);
    },
    async update(id: string, input: UpdateEmployeeInput & { updatedBy: string }): Promise<Employee> {
      const current = await db.query<EmployeeRow>(`SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE id = $1`, [id]);
      const existing = current.rows[0];
      if (!existing) throw new Error("Employee not found.");
      const result = await db.query<EmployeeRow>(
        `UPDATE employees SET legal_name = $2, preferred_name = $3, work_email = $4, personal_email = $5, employment_country = $6, updated_by = $7, updated_at = NOW()
         WHERE id = $1 RETURNING ${EMPLOYEE_COLUMNS}`,
        [
          id,
          input.legalName ?? existing.legal_name,
          input.preferredName === undefined ? existing.preferred_name : input.preferredName,
          input.workEmail === undefined ? existing.work_email : input.workEmail,
          input.personalEmail === undefined ? existing.personal_email : input.personalEmail,
          input.employmentCountry ?? existing.employment_country,
          input.updatedBy,
        ],
      );
      return mapEmployee(result.rows[0]!);
    },
    async setStatus(id: string, status: EmploymentStatus, updatedBy: string): Promise<Employee> {
      const result = await db.query<EmployeeRow>(
        `UPDATE employees SET status = $2, updated_by = $3, updated_at = NOW() WHERE id = $1 RETURNING ${EMPLOYEE_COLUMNS}`,
        [id, status, updatedBy],
      );
      if (!result.rows[0]) throw new Error("Employee not found.");
      return mapEmployee(result.rows[0]);
    },
    async nextEmployeeNumberSeq(): Promise<number> {
      const result = await db.query<{ nextval: string }>(`SELECT nextval('employee_number_seq')`);
      return Number(result.rows[0]!.nextval);
    },
  };
}
