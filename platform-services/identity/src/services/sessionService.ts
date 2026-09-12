/**
 * Server-side session management. See docs/architecture/
 * identity-foundation.md "Sessions" — this is the gap apps/svegip's
 * stateless signed cookie has today (no per-device revocation); this
 * service exists specifically so that becomes possible for the new
 * foundation from day one.
 */
import type { SessionRepository } from "../repositories/types.ts";
import type { Session } from "../domain/entities.ts";
import { generateBearerToken, sha256Hex } from "../crypto/token.ts";
import { SessionInvalidError } from "../domain/errors.ts";

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours, matching apps/svegip's existing session lifetime

export interface CreatedSession {
  session: Session;
  /** The raw bearer token — returned exactly once, at creation. Never stored raw, never logged. */
  token: string;
}

export function createSessionService(deps: { sessions: SessionRepository }) {
  return {
    async createSession(input: {
      userId: string;
      mfaVerified: boolean;
      ip?: string | null;
      userAgent?: string | null;
      ttlSeconds?: number;
    }): Promise<CreatedSession> {
      const token = generateBearerToken();
      const tokenHash = sha256Hex(token);
      const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS) * 1000).toISOString();
      const session = await deps.sessions.create({
        userId: input.userId,
        tokenHash,
        expiresAt,
        mfaVerified: input.mfaVerified,
        ip: input.ip,
        userAgent: input.userAgent,
      });
      return { session, token };
    },

    /** Validates a raw bearer token, returning the live session or throwing. Never logs the token. */
    async validateSession(token: string): Promise<Session> {
      const tokenHash = sha256Hex(token);
      const session = await deps.sessions.findByTokenHash(tokenHash);
      if (!session) throw new SessionInvalidError("not_found");
      if (session.revokedAt !== null) throw new SessionInvalidError("revoked");
      if (new Date(session.expiresAt).getTime() <= Date.now()) throw new SessionInvalidError("expired");
      await deps.sessions.touchLastActive(session.id);
      return session;
    },

    async revokeSession(sessionId: string, reason: string): Promise<void> {
      await deps.sessions.revoke(sessionId, reason);
    },

    async revokeAllSessionsForUser(userId: string, reason: string): Promise<number> {
      return deps.sessions.revokeAllForUser(userId, reason);
    },

    async listActiveSessions(userId: string): Promise<Session[]> {
      return deps.sessions.listActiveForUser(userId);
    },

    async expireDueSessions(now: Date = new Date()): Promise<number> {
      return deps.sessions.expireDue(now.toISOString());
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
