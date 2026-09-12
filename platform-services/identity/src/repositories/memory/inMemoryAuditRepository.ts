import { randomUUID } from "node:crypto";
import type { AuditRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { SecurityAuditEvent } from "../../domain/entities.ts";

export function createInMemoryAuditRepository(store: InMemoryStore): AuditRepository {
  return {
    async record(event: Omit<SecurityAuditEvent, "id" | "occurredAt">): Promise<SecurityAuditEvent> {
      const full: SecurityAuditEvent = { ...event, id: randomUUID(), occurredAt: new Date().toISOString() };
      store.auditEvents.push(full);
      return full;
    },
  };
}
