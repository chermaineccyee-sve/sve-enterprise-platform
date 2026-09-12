import { randomUUID } from "node:crypto";
import type { LifecycleEventRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { HrLifecycleEvent, LifecycleEventType } from "../../domain/lifecycle.ts";

export function createInMemoryLifecycleEventRepository(store: InMemoryStore): LifecycleEventRepository {
  return {
    async append(input: { caseId: string; eventType: LifecycleEventType; eventData?: Record<string, unknown> | null; notes?: string | null; recordedBy: string }): Promise<HrLifecycleEvent> {
      const record: HrLifecycleEvent = {
        id: randomUUID(),
        caseId: input.caseId,
        eventType: input.eventType,
        eventData: input.eventData ?? null,
        notes: input.notes ?? null,
        occurredAt: new Date().toISOString(),
        recordedBy: input.recordedBy,
      };
      store.events.push(record);
      return record;
    },
    async listByCase(caseId: string): Promise<HrLifecycleEvent[]> {
      return store.events.filter((e) => e.caseId === caseId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    },
  };
}
