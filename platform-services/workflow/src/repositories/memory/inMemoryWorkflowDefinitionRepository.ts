import { randomUUID } from "node:crypto";
import type { WorkflowDefinitionRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { WorkflowDefinition } from "../../domain/workflow.ts";

export function createInMemoryWorkflowDefinitionRepository(store: InMemoryStore): WorkflowDefinitionRepository {
  return {
    async create(input): Promise<WorkflowDefinition> {
      const now = new Date().toISOString();
      const record: WorkflowDefinition = {
        id: randomUUID(),
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      store.definitions.push(record);
      return record;
    },
    async findById(id) {
      return store.definitions.find((d) => d.id === id) ?? null;
    },
    async findByIdForUpdate(id) {
      return store.definitions.find((d) => d.id === id) ?? null;
    },
    async findByKey(key) {
      return store.definitions.find((d) => d.key === key) ?? null;
    },
    async list() {
      return [...store.definitions];
    },
  };
}
