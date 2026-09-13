import { randomUUID } from "node:crypto";
import type { WorkflowDecisionRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { WorkflowDecision } from "../../domain/workflow.ts";

export function createInMemoryWorkflowDecisionRepository(store: InMemoryStore): WorkflowDecisionRepository {
  return {
    async create(input): Promise<WorkflowDecision> {
      // Mirrors the DB's UNIQUE(task_id) constraint — sufficient for
      // single-threaded in-memory unit tests; real concurrency is
      // verified against Postgres (see docs "Concurrency").
      if (store.decisions.some((d) => d.taskId === input.taskId)) {
        throw new Error("A decision already exists for this task.");
      }
      const record: WorkflowDecision = {
        id: randomUUID(),
        taskId: input.taskId,
        instanceId: input.instanceId,
        actorUserId: input.actorUserId,
        decision: input.decision,
        comment: input.comment ?? null,
        resultingTransition: input.resultingTransition,
        decidedAt: new Date().toISOString(),
      };
      store.decisions.push(record);
      return record;
    },
    async findByTaskId(taskId) {
      return store.decisions.find((d) => d.taskId === taskId) ?? null;
    },
    async listByInstance(instanceId) {
      return store.decisions.filter((d) => d.instanceId === instanceId);
    },
  };
}
