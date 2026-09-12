import { randomUUID } from "node:crypto";
import type { EmployeeRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { Employee, EmploymentStatus, CreateEmployeeInput, UpdateEmployeeInput, EmployeeFilter } from "../../domain/employee.ts";

export function createInMemoryEmployeeRepository(store: InMemoryStore): EmployeeRepository {
  return {
    async create(input: CreateEmployeeInput & { employeeNumber: string; createdBy: string }): Promise<Employee> {
      const now = new Date().toISOString();
      const employee: Employee = {
        id: randomUUID(),
        employeeNumber: input.employeeNumber,
        legalName: input.legalName,
        preferredName: input.preferredName ?? null,
        workEmail: input.workEmail ?? null,
        personalEmail: input.personalEmail ?? null,
        employmentCountry: input.employmentCountry,
        status: "PRE_HIRE",
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      store.employees.push(employee);
      return employee;
    },
    async findById(id: string): Promise<Employee | null> {
      return store.employees.find((e) => e.id === id) ?? null;
    },
    async findByWorkEmail(workEmail: string): Promise<Employee | null> {
      return store.employees.find((e) => e.workEmail === workEmail) ?? null;
    },
    async list(filter: EmployeeFilter): Promise<Employee[]> {
      const q = filter.search?.trim().toLowerCase();
      return store.employees.filter((e) => {
        if (filter.status && e.status !== filter.status) return false;
        if (q) {
          const haystack = `${e.employeeNumber} ${e.legalName} ${e.preferredName ?? ""} ${e.workEmail ?? ""}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
    },
    async update(id: string, input: UpdateEmployeeInput & { updatedBy: string }): Promise<Employee> {
      const employee = store.employees.find((e) => e.id === id);
      if (!employee) throw new Error("Employee not found.");
      if (input.legalName !== undefined) employee.legalName = input.legalName;
      if (input.preferredName !== undefined) employee.preferredName = input.preferredName;
      if (input.workEmail !== undefined) employee.workEmail = input.workEmail;
      if (input.personalEmail !== undefined) employee.personalEmail = input.personalEmail;
      if (input.employmentCountry !== undefined) employee.employmentCountry = input.employmentCountry;
      employee.updatedBy = input.updatedBy;
      employee.updatedAt = new Date().toISOString();
      return employee;
    },
    async setStatus(id: string, status: EmploymentStatus, updatedBy: string): Promise<Employee> {
      const employee = store.employees.find((e) => e.id === id);
      if (!employee) throw new Error("Employee not found.");
      employee.status = status;
      employee.updatedBy = updatedBy;
      employee.updatedAt = new Date().toISOString();
      return employee;
    },
    async nextEmployeeNumberSeq(): Promise<number> {
      store.employeeNumberSeq += 1;
      return store.employeeNumberSeq;
    },
  };
}
