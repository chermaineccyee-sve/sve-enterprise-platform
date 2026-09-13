import { randomUUID } from "node:crypto";
import type { WorkflowSystemActionExecutionRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { WorkflowSystemActionExecution } from "../../domain/workflow.ts";

export function createInMemoryWorkflowSystemActionExecutionRepository(store: InMemoryStore): WorkflowSystemActionExecutionRepository {
  return {
    async findOrCreate(input) {
      const existing = store.systemActionExecutions.find((e) => e.instanceId === input.instanceId && e.stepId === input.stepId);
      if (existing) return { execution: existing, created: false };
      const now = new Date().toISOString();
      const record: WorkflowSystemActionExecution = {
        id: randomUUID(),
        instanceId: input.instanceId,
        stepId: input.stepId,
        handlerKey: input.handlerKey,
        status: "PENDING",
        attempts: 0,
        lastError: null,
        createdAt: now,
        updatedAt: now,
        executedAt: null,
      };
      store.systemActionExecutions.push(record);
      return { execution: record, created: true };
    },
    async updateStatus(id, input) {
      const record = store.systemActionExecutions.find((e) => e.id === id);
      if (!record) throw new Error("System action execution not found.");
      const now = new Date().toISOString();
      record.status = input.status;
      record.attempts = input.attempts;
      if (input.lastError !== undefined) record.lastError = input.lastError;
      if (input.status === "SUCCEEDED" || input.status === "FAILED") record.executedAt = now;
      record.updatedAt = now;
      return record;
    },
  };
}
