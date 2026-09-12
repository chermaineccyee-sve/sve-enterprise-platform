/**
 * A fresh, isolated in-memory store per test for this package's OWN data
 * (organisation structure + employee master) — deliberately separate from
 * platform-services/identity's InMemoryStore (users/roles/entity grants/
 * audit events), mirroring platform-services/data-vault's same pattern.
 * Tests that exercise employeeService construct both stores independently
 * and wire them together via dependency injection.
 */
import type { BusinessUnit, Department, Position } from "../../domain/organisation.ts";
import type { Employee, EmploymentAssignment } from "../../domain/employee.ts";

export interface InMemoryStore {
  businessUnits: BusinessUnit[];
  departments: Department[];
  positions: Position[];
  employees: Employee[];
  employmentAssignments: EmploymentAssignment[];
  employeeNumberSeq: number;
}

export function createInMemoryStore(): InMemoryStore {
  return {
    businessUnits: [],
    departments: [],
    positions: [],
    employees: [],
    employmentAssignments: [],
    employeeNumberSeq: 0,
  };
}
