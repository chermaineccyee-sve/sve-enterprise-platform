/**
 * Employee Master domain types, mirroring database/migrations/
 * 003_organisation-employee-master/migration.sql. See docs/architecture/
 * organisation-employee-master.md "Employee Master model" and
 * "Effective-dated records".
 *
 * Deliberately excluded from this PR (PR brief item 6): bank details,
 * salary/compensation amounts, tax numbers, statutory contribution
 * numbers, medical information. Those belong to later controlled modules
 * (compensation, payroll) that will reference an employee/assignment by
 * id, not extend this table.
 */

/**
 * Shared by both Employee.status (the current/latest value) and
 * EmploymentAssignment.status (the historical value for that effective
 * period) — see the architecture doc for why both exist. Not a
 * mechanical copy of the PR brief's example list: CONFIRMED was folded
 * into ACTIVE + a populated confirmationDate, since "confirmed" is better
 * modelled as a fact about an active assignment than a distinct top-level
 * state — see the architecture doc for the reasoning.
 */
export type EmploymentStatus = "PRE_HIRE" | "ACTIVE" | "PROBATION" | "NOTICE" | "SUSPENDED" | "TERMINATED" | "RESIGNED" | "INACTIVE";

export interface Employee {
  id: string;
  employeeNumber: string;
  legalName: string;
  preferredName: string | null;
  workEmail: string | null;
  personalEmail: string | null;
  employmentCountry: string;
  status: EmploymentStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentAssignment {
  id: string;
  employeeId: string;
  legalEntityId: string;
  businessUnitId: string | null;
  departmentId: string | null;
  positionId: string | null;
  employmentType: string;
  status: EmploymentStatus;
  isPrimary: boolean;
  startDate: string;
  confirmationDate: string | null;
  probationEndDate: string | null;
  endDate: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  workLocation: string | null;
  workArrangement: string | null;
  /** Explicit per-assignment override of the position-structural reporting line — see organisation.ts's Position.reportsToPositionId. */
  reportsToAssignmentId: string | null;
  changeReason: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeInput {
  legalName: string;
  preferredName?: string | null;
  workEmail?: string | null;
  personalEmail?: string | null;
  employmentCountry: string;
}

export interface UpdateEmployeeInput {
  legalName?: string;
  preferredName?: string | null;
  workEmail?: string | null;
  personalEmail?: string | null;
  employmentCountry?: string;
}

/** Input for the very first assignment (hire) or any transition (transfer/promotion/status change) that creates a new effective-dated row. */
export interface CreateAssignmentInput {
  legalEntityId: string;
  businessUnitId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  employmentType: string;
  status: EmploymentStatus;
  isPrimary?: boolean;
  startDate: string;
  confirmationDate?: string | null;
  probationEndDate?: string | null;
  /** Defaults to startDate when omitted — the common case (a transition takes effect the same day it starts). */
  effectiveFrom?: string;
  workLocation?: string | null;
  workArrangement?: string | null;
  reportsToAssignmentId?: string | null;
  changeReason?: string | null;
}

export interface AssignmentFilter {
  employeeId?: string;
  legalEntityId?: string;
  currentOnly?: boolean;
}

export interface EmployeeFilter {
  legalEntityId?: string;
  status?: EmploymentStatus;
  search?: string;
}
