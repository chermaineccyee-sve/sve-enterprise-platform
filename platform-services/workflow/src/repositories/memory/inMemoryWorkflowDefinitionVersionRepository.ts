import { randomUUID } from "node:crypto";
import type { WorkflowDefinitionVersionRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { WorkflowDefinitionVersion } from "../../domain/workflow.ts";

export function createInMemoryWorkflowDefinitionVersionRepository(store: InMemoryStore): WorkflowDefinitionVersionRepository {
  return {
    async create(input): Promise<WorkflowDefinitionVersion> {
      const now = new Date().toISOString();
      const record: WorkflowDefinitionVersion = {
        id: randomUUID(),
        definitionId: input.definitionId,
        versionNumber: input.versionNumber,
        status: "DRAFT",
        allowParallelSteps: false,
        publishedAt: null,
        retiredAt: null,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      store.versions.push(record);
      return record;
    },
    async findById(id) {
      return store.versions.find((v) => v.id === id) ?? null;
    },
    async findByIdForUpdate(id) {
      return store.versions.find((v) => v.id === id) ?? null;
    },
    async listByDefinition(definitionId) {
      return store.versions.filter((v) => v.definitionId === definitionId);
    },
    async maxVersionNumber(definitionId) {
      const nums = store.versions.filter((v) => v.definitionId === definitionId).map((v) => v.versionNumber);
      return nums.length ? Math.max(...nums) : 0;
    },
    async updateStatus(id, input) {
      const record = store.versions.find((v) => v.id === id);
      if (!record) throw new Error("Workflow definition version not found.");
      const now = new Date().toISOString();
      record.status = input.status;
      if (input.status === "PUBLISHED") record.publishedAt = now;
      if (input.status === "RETIRED") record.retiredAt = now;
      record.updatedAt = now;
      return record;
    },
  };
}
