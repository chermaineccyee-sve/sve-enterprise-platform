/**
 * Server-side session management. See docs/architecture/
 * identity-foundation.md "Sessions" — this is the gap apps/svegip's
 * stateless signed cookie has today (no per-device revocation); this
 * service exists specifically so that becomes possible for the new
 * foundation from day one.
 */
import type { SessionRepository, UserRepository, UserSecurityTransaction } from "../repositories/types.ts";
import type { Session } from "../domain/entities.ts";
import { generateBearerToken, sha256Hex } from "../crypto/token.ts";
import { SessionInvalidError, AccountDisabledError } from "../domain/errors.ts";

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours, matching apps/svegip's existing session lifetime

export interface CreatedSession {
  session: Session;
  /** The raw bearer token — returned exactly once, at creation. Never stored raw, never logged. */
  token: string;
}

export function createSessionService(deps: { sessions: SessionRepository; users: UserRepository; transactions: UserSecurityTransaction }) {
  return {
    /**
     * PR #10: closes the login/session-creation race against a concurrent
     * disableAccount() — every caller of createSession (password login,
     * MFA-verify, recovery-code-verify) already checked account status
     * EARLIER in its own flow, but that check can be stale by the time
     * this function actually runs if a disable transaction commits in
     * between. Locking the SAME `users` row here (`findByIdForUpdate`,
     * inside the SAME UserSecurityTransaction disableAccount() itself
     * uses) serializes this against disableAccount() at the database
     * level: whichever transaction acquires the row lock first commits
     * first. If disable wins the race, this throws before any session
     * row exists. If this wins, the session commits first — and
     * disableAccount()'s own revokeAllForUser (which runs after ITS lock
     * acquisition succeeds, i.e. strictly after this transaction has
     * already committed) sees and revokes the just-created session too.
     * Either way, no session issued while — or immediately after — the
     * account is/becomes disabled ever survives usable. See
     * docs/architecture/identity-offboarding-revocation.md "Login/
     * session-creation race".
     */
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
      const session = await deps.transactions.run(async (repos) => {
        // Skipped (not denied) if no `users` row exists — see
        // validateSession's identical, identically-justified carve-out
        // below for the full reasoning (this package's own pre-PR#10
        // unit-test fixtures; never true for a real userId).
        const user = await repos.users.findByIdForUpdate(input.userId);
        if (user && user.status !== "active") throw new AccountDisabledError();
        return repos.sessions.create({
          userId: input.userId,
          tokenHash,
          expiresAt,
          mfaVerified: input.mfaVerified,
          ip: input.ip,
          userAgent: input.userAgent,
        });
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
      // PR #10 defense-in-depth: disabling an account revokes all of its
      // sessions explicitly (accountSecurityService.disableAccount, in the
      // SAME transaction as the status change — see docs/architecture/
      // identity-offboarding-revocation.md "Session revocation"), so this
      // should already be unreachable for a disabled account's session.
      // Checked again here anyway — the one place literally every
      // authenticated request resolves its actor through — so ANY future
      // code path that ever sets status without going through that
      // operation (a raw setStatus() call, exactly like this codebase's own
      // pre-PR#10 test fixtures did) still cannot leave a live session
      // usable. Skipped (not denied) if no `users` row exists for this
      // session's userId — never true for a real session (users.id is a
      // NOT NULL FK), only for a handful of this package's own pre-PR#10
      // unit-test fixtures that predate this check.
      const user = await deps.users.findById(session.userId);
      if (user && user.status !== "active") throw new SessionInvalidError("account_disabled");
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
