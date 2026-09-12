import { randomUUID } from "node:crypto";
import type { SessionRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { Session } from "../../domain/entities.ts";

export function createInMemorySessionRepository(store: InMemoryStore): SessionRepository {
  return {
    async create(input): Promise<Session> {
      const now = new Date().toISOString();
      const session: Session = {
        id: randomUUID(),
        userId: input.userId,
        tokenHash: input.tokenHash,
        createdAt: now,
        lastActiveAt: now,
        expiresAt: input.expiresAt,
        revokedAt: null,
        revokedReason: null,
        mfaVerified: input.mfaVerified,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      };
      store.sessions.push(session);
      return session;
    },
    async findByTokenHash(tokenHash: string): Promise<Session | null> {
      return store.sessions.find((s) => s.tokenHash === tokenHash) ?? null;
    },
    async findById(id: string): Promise<Session | null> {
      return store.sessions.find((s) => s.id === id) ?? null;
    },
    async touchLastActive(id: string): Promise<void> {
      const session = store.sessions.find((s) => s.id === id);
      if (session) session.lastActiveAt = new Date().toISOString();
    },
    async revoke(id: string, reason: string): Promise<void> {
      const session = store.sessions.find((s) => s.id === id);
      if (session && session.revokedAt === null) {
        session.revokedAt = new Date().toISOString();
        session.revokedReason = reason;
      }
    },
    async revokeAllForUser(userId: string, reason: string): Promise<number> {
      const now = new Date().toISOString();
      let count = 0;
      for (const session of store.sessions) {
        if (session.userId === userId && session.revokedAt === null) {
          session.revokedAt = now;
          session.revokedReason = reason;
          count++;
        }
      }
      return count;
    },
    async listActiveForUser(userId: string): Promise<Session[]> {
      const now = Date.now();
      return store.sessions.filter(
        (s) => s.userId === userId && s.revokedAt === null && new Date(s.expiresAt).getTime() > now,
      );
    },
    async expireDue(now: string): Promise<number> {
      let count = 0;
      const nowMs = new Date(now).getTime();
      for (const session of store.sessions) {
        if (session.revokedAt === null && new Date(session.expiresAt).getTime() <= nowMs) {
          session.revokedAt = now;
          session.revokedReason = "expired";
          count++;
        }
      }
      return count;
    },
  };
}
