import { randomUUID } from "node:crypto";
import type { OrgStructureRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { BusinessUnit, Department, Position, CreateBusinessUnitInput, CreateDepartmentInput, CreatePositionInput } from "../../domain/organisation.ts";

export function createInMemoryOrgStructureRepository(store: InMemoryStore): OrgStructureRepository {
  return {
    async createBusinessUnit(input: CreateBusinessUnitInput): Promise<BusinessUnit> {
      const now = new Date().toISOString();
      const unit: BusinessUnit = { id: randomUUID(), legalEntityId: input.legalEntityId, name: input.name, code: input.code, status: "active", createdAt: now, updatedAt: now };
      store.businessUnits.push(unit);
      return unit;
    },
    async findBusinessUnitById(id: string): Promise<BusinessUnit | null> {
      return store.businessUnits.find((u) => u.id === id) ?? null;
    },
    async listBusinessUnits(filter?: { legalEntityId?: string }): Promise<BusinessUnit[]> {
      return store.businessUnits.filter((u) => !filter?.legalEntityId || u.legalEntityId === filter.legalEntityId);
    },

    async createDepartment(input: CreateDepartmentInput): Promise<Department> {
      const now = new Date().toISOString();
      const dept: Department = {
        id: randomUUID(),
        legalEntityId: input.legalEntityId,
        businessUnitId: input.businessUnitId ?? null,
        name: input.name,
        code: input.code,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      store.departments.push(dept);
      return dept;
    },
    async findDepartmentById(id: string): Promise<Department | null> {
      return store.departments.find((d) => d.id === id) ?? null;
    },
    async listDepartments(filter?: { legalEntityId?: string; businessUnitId?: string }): Promise<Department[]> {
      return store.departments.filter(
        (d) => (!filter?.legalEntityId || d.legalEntityId === filter.legalEntityId) && (!filter?.businessUnitId || d.businessUnitId === filter.businessUnitId),
      );
    },

    async createPosition(input: CreatePositionInput): Promise<Position> {
      const now = new Date().toISOString();
      const position: Position = {
        id: randomUUID(),
        departmentId: input.departmentId,
        title: input.title,
        status: "active",
        reportsToPositionId: input.reportsToPositionId ?? null,
        costCentreCode: input.costCentreCode ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.positions.push(position);
      return position;
    },
    async findPositionById(id: string): Promise<Position | null> {
      return store.positions.find((p) => p.id === id) ?? null;
    },
    async listPositions(filter?: { departmentId?: string }): Promise<Position[]> {
      return store.positions.filter((p) => !filter?.departmentId || p.departmentId === filter.departmentId);
    },
  };
}
