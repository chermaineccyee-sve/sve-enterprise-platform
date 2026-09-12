/**
 * Repository interfaces for this package's two domains (organisation
 * structure, employee master). Services depend on these, never on a
 * concrete DatabaseProvider/SQL client directly — mirrors Identity's own
 * repository-pattern convention.
 */
import type { BusinessUnit, Department, Position, CreateBusinessUnitInput, CreateDepartmentInput, CreatePositionInput } from "../domain/organisation.ts";
import type {
  Employee,
  EmploymentAssignment,
  EmploymentStatus,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  CreateAssignmentInput,
  AssignmentFilter,
  EmployeeFilter,
} from "../domain/employee.ts";

export interface OrgStructureRepository {
  createBusinessUnit(input: CreateBusinessUnitInput): Promise<BusinessUnit>;
  findBusinessUnitById(id: string): Promise<BusinessUnit | null>;
  listBusinessUnits(filter?: { legalEntityId?: string }): Promise<BusinessUnit[]>;

  createDepartment(input: CreateDepartmentInput): Promise<Department>;
  findDepartmentById(id: string): Promise<Department | null>;
  listDepartments(filter?: { legalEntityId?: string; businessUnitId?: string }): Promise<Department[]>;

  createPosition(input: CreatePositionInput): Promise<Position>;
  findPositionById(id: string): Promise<Position | null>;
  listPositions(filter?: { departmentId?: string }): Promise<Position[]>;
}

export interface EmployeeRepository {
  create(input: CreateEmployeeInput & { employeeNumber: string; createdBy: string }): Promise<Employee>;
  findById(id: string): Promise<Employee | null>;
  findByWorkEmail(workEmail: string): Promise<Employee | null>;
  list(filter: EmployeeFilter): Promise<Employee[]>;
  update(id: string, input: UpdateEmployeeInput & { updatedBy: string }): Promise<Employee>;
  setStatus(id: string, status: EmploymentStatus, updatedBy: string): Promise<Employee>;
  /** Draws the next value from employee_number_seq — never a row count or client-supplied value. */
  nextEmployeeNumberSeq(): Promise<number>;
}

export interface EmploymentAssignmentRepository {
  create(input: CreateAssignmentInput & { employeeId: string; createdBy: string }): Promise<EmploymentAssignment>;
  findById(id: string): Promise<EmploymentAssignment | null>;
  findCurrentPrimary(employeeId: string): Promise<EmploymentAssignment | null>;
  list(filter: AssignmentFilter): Promise<EmploymentAssignment[]>;
  /** Ends the temporal validity of an assignment row (superseded by a transition, or a true employment end) — never a destructive update to its other business fields. `status` is accepted only so a true employment end (termination/resignation) can record the terminal status for that historical period; a transition close (superseded by a new row) omits it and leaves the row's prior status untouched. */
  closeAssignment(id: string, input: { effectiveTo: string; endDate?: string | null; status?: EmploymentStatus; updatedBy: string }): Promise<EmploymentAssignment>;
  /** Who currently (or ever) holds a given position — used to resolve the position-structural manager. */
  findByPositionId(positionId: string, currentOnly?: boolean): Promise<EmploymentAssignment[]>;
}
