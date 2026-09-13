import { randomUUID } from "node:crypto";
import type { WorkflowEventRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { WorkflowEvent } from "../../domain/workflow.ts";

export function createInMemoryWorkflowEventRepository(store: InMemoryStore): WorkflowEventRepository {
  return {
    async append(input): Promise<WorkflowEvent> {
      const record: WorkflowEvent = {
        id: randomUUID(),
        instanceId: input.instanceId,
        eventType: input.eventType,
        eventData: input.eventData ?? null,
        notes: input.notes ?? null,
        occurredAt: new Date().toISOString(),
        recordedBy: input.recordedBy ?? null,
      };
      store.events.push(record);
      return record;
    },
    async listByInstance(instanceId) {
      return store.events.filter((e) => e.instanceId === instanceId);
    },
  };
}
