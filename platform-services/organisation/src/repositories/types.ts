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
  /**
   * PR #12: the employee's primary assignment whose effective date range
   * actually covers `asOfDate` — distinct from findCurrentPrimary's
   * "still-open pipeline row", which a future-dated transition (an
   * intentionally supported feature, see employmentAssignmentService.ts's
   * isCurrentAt()) makes return prematurely. Every DISPLAY consumer of
   * "the employee's current assignment" (Employee Directory, Employee
   * Profile, My SVE, /employees/me) must use this, never
   * findCurrentPrimary — see docs/architecture/organisation-employee-
   * master.md "Calendar-current vs. pipeline-current assignment
   * resolution". The write-path transition/termination logic keeps using
   * findCurrentPrimary unchanged: it genuinely wants "the row still open
   * in the pipeline" to know what to close, regardless of its date.
   */
  findEffectiveAsOf(employeeId: string, asOfDate: string): Promise<EmploymentAssignment | null>;
  list(filter: AssignmentFilter): Promise<EmploymentAssignment[]>;
  /** Ends the temporal validity of an assignment row (superseded by a transition, or a true employment end) — never a destructive update to its other business fields. `status` is accepted only so a true employment end (termination/resignation) can record the terminal status for that historical period; a transition close (superseded by a new row) omits it and leaves the row's prior status untouched. */
  closeAssignment(id: string, input: { effectiveTo: string; endDate?: string | null; status?: EmploymentStatus; updatedBy: string }): Promise<EmploymentAssignment>;
  /** Who currently (or ever) holds a given position — used to resolve the position-structural manager. */
  findByPositionId(positionId: string, currentOnly?: boolean): Promise<EmploymentAssignment[]>;
}

/**
 * Runs the employee row plus its required initial employment assignment (and
 * the follow-on status sync) as one atomic unit — see docs/architecture/
 * organisation-employee-master.md "Transactional employee creation". The
 * real Postgres implementation wraps `fn` in a single database transaction:
 * any error thrown inside `fn` rolls back every write, leaving neither the
 * employee row nor the assignment row persisted — never a delete-afterward
 * compensation. The in-memory implementation simply runs `fn` against the
 * existing repositories, since in-memory tests have no partial-write/
 * rollback concern to guard against.
 */
export interface EmployeeCreationTransaction {
  run<T>(fn: (repos: { employees: EmployeeRepository; assignments: EmploymentAssignmentRepository }) => Promise<T>): Promise<T>;
}

/**
 * Serializes writes that can introduce a new `reports_to_assignment_id`
 * edge, so two concurrent reporting-relationship changes cannot each
 * independently pass cycle validation and jointly commit a cycle — see the
 * architecture doc "Reporting-cycle concurrency safety". `lock` is true only
 * when the call is about to establish a new reporting edge (the real
 * Postgres implementation then takes a transaction-scoped advisory lock
 * before re-validating and writing); a plain transition with no
 * `reportsToAssignmentId` still gets a transaction boundary (atomic
 * close-then-insert) but never blocks on the advisory lock. The in-memory
 * implementation ignores `lock` and simply runs `fn`.
 */
export interface EmploymentAssignmentTransaction {
  run<T>(options: { lock: boolean }, fn: (repos: { assignments: EmploymentAssignmentRepository }) => Promise<T>): Promise<T>;
}
