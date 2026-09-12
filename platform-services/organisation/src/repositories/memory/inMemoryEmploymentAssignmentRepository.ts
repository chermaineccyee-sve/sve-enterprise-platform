import { randomUUID } from "node:crypto";
import type { EmploymentAssignmentRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { EmploymentAssignment, EmploymentStatus, CreateAssignmentInput, AssignmentFilter } from "../../domain/employee.ts";

export function createInMemoryEmploymentAssignmentRepository(store: InMemoryStore): EmploymentAssignmentRepository {
  return {
    async create(input: CreateAssignmentInput & { employeeId: string; createdBy: string }): Promise<EmploymentAssignment> {
      const now = new Date().toISOString();
      const assignment: EmploymentAssignment = {
        id: randomUUID(),
        employeeId: input.employeeId,
        legalEntityId: input.legalEntityId,
        businessUnitId: input.businessUnitId ?? null,
        departmentId: input.departmentId ?? null,
        positionId: input.positionId ?? null,
        employmentType: input.employmentType,
        status: input.status,
        isPrimary: input.isPrimary ?? true,
        startDate: input.startDate,
        confirmationDate: input.confirmationDate ?? null,
        probationEndDate: input.probationEndDate ?? null,
        endDate: null,
        effectiveFrom: input.effectiveFrom ?? input.startDate,
        effectiveTo: null,
        workLocation: input.workLocation ?? null,
        workArrangement: input.workArrangement ?? null,
        reportsToAssignmentId: input.reportsToAssignmentId ?? null,
        changeReason: input.changeReason ?? null,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      store.employmentAssignments.push(assignment);
      return assignment;
    },
    async findById(id: string): Promise<EmploymentAssignment | null> {
      return store.employmentAssignments.find((a) => a.id === id) ?? null;
    },
    async findCurrentPrimary(employeeId: string): Promise<EmploymentAssignment | null> {
      return store.employmentAssignments.find((a) => a.employeeId === employeeId && a.effectiveTo === null && a.isPrimary) ?? null;
    },
    async list(filter: AssignmentFilter): Promise<EmploymentAssignment[]> {
      return store.employmentAssignments.filter((a) => {
        if (filter.employeeId && a.employeeId !== filter.employeeId) return false;
        if (filter.legalEntityId && a.legalEntityId !== filter.legalEntityId) return false;
        if (filter.currentOnly && a.effectiveTo !== null) return false;
        return true;
      });
    },
    async closeAssignment(id: string, input: { effectiveTo: string; endDate?: string | null; status?: EmploymentStatus; updatedBy: string }): Promise<EmploymentAssignment> {
      const assignment = store.employmentAssignments.find((a) => a.id === id);
      if (!assignment) throw new Error("Employment assignment not found.");
      assignment.effectiveTo = input.effectiveTo;
      if (input.endDate !== undefined) assignment.endDate = input.endDate;
      if (input.status !== undefined) assignment.status = input.status;
      assignment.updatedBy = input.updatedBy;
      assignment.updatedAt = new Date().toISOString();
      return assignment;
    },
    async findByPositionId(positionId: string, currentOnly = true): Promise<EmploymentAssignment[]> {
      return store.employmentAssignments.filter((a) => a.positionId === positionId && (!currentOnly || a.effectiveTo === null));
    },
  };
}
