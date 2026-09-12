import { randomUUID } from "node:crypto";
import type { AttemptRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { AuthenticationAttempt } from "../../domain/entities.ts";

export function createInMemoryAttemptRepository(store: InMemoryStore): AttemptRepository {
  return {
    async record(input): Promise<AuthenticationAttempt> {
      const attempt: AuthenticationAttempt = {
        id: randomUUID(),
        email: input.email.toLowerCase(),
        succeeded: input.succeeded,
        reason: input.reason ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        occurredAt: new Date().toISOString(),
      };
      store.attempts.push(attempt);
      return attempt;
    },
    async countRecentFailures(input: { email?: string; ip?: string; sinceIso: string }): Promise<number> {
      const sinceMs = new Date(input.sinceIso).getTime();
      return store.attempts.filter((a) => {
        if (a.succeeded) return false;
        if (new Date(a.occurredAt).getTime() < sinceMs) return false;
        if (input.email && a.email !== input.email.toLowerCase()) return false;
        if (input.ip && a.ip !== input.ip) return false;
        return true;
      }).length;
    },
  };
}
