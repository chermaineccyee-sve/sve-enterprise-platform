/**
 * Login orchestration: password verification + rate limiting + account
 * enumeration resistance + the "primary auth passed, MFA pending"
 * intermediate state that apps/svegip's single-step cookie has no room for.
 * See docs/architecture/identity-foundation.md "Password authentication",
 * "Login protection", and packages/security/src/AuthProvider.ts (the
 * contract this service is a concrete instance of the *shape* of, though it
 * does not implement that exact interface directly in this foundation —
 * see the doc's "Relationship to packages/security" note).
 */
import { randomUUID } from "node:crypto";
import type { UserRepository, AttemptRepository } from "../repositories/types.ts";
import type { MfaService } from "./mfaService.ts";
import type { RateLimiter } from "./rateLimiter.ts";
import { verifyPassword, hashPassword, type PasswordHash } from "../crypto/password.ts";
import { InvalidCredentialsError, AccountDisabledError, ThrottledError } from "../domain/errors.ts";

// A fixed, never-matching dummy hash verified against on "unknown account" so
// the time taken is comparable to a real verification — see
// docs/architecture/identity-foundation.md "Account enumeration resistance".
let DUMMY_HASH: PasswordHash | null = null;
async function getDummyHash(): Promise<PasswordHash> {
  if (!DUMMY_HASH) DUMMY_HASH = await hashPassword(randomUUID());
  return DUMMY_HASH;
}

interface PendingChallenge {
  userId: string;
  expiresAt: number;
}

export interface LoginResult {
  outcome: "authenticated" | "mfa_challenge";
  userId?: string;
  challengeId?: string;
}

export function createAuthService(deps: {
  users: UserRepository;
  attempts: AttemptRepository;
  mfa: MfaService;
  rateLimiter: RateLimiter;
}) {
  // Foundation-scope limitation: in-process only. A multi-instance
  // deployment needs this moved to shared storage (DB/Redis) — see
  // docs/architecture/identity-foundation.md "Remaining risks".
  const pendingChallenges = new Map<string, PendingChallenge>();

  async function fail(email: string, ip: string | undefined, userAgent: string | undefined, reason: Parameters<RateLimiter["recordFailure"]>[0]["reason"]): Promise<never> {
    await deps.rateLimiter.recordFailure({ email, ip, userAgent, reason });
    throw new InvalidCredentialsError();
  }

  return {
    async login(input: { email: string; password: string; ip?: string; userAgent?: string }): Promise<LoginResult> {
      const email = input.email.trim().toLowerCase();

      const backoff = await deps.rateLimiter.checkThrottle({ email, ip: input.ip });
      if (backoff > 0) {
        await deps.rateLimiter.recordFailure({ email, ip: input.ip, userAgent: input.userAgent, reason: "throttled" });
        throw new ThrottledError(backoff);
      }

      const user = await deps.users.findByEmail(email);
      if (!user) {
        // Enumeration resistance: verify against a dummy hash so timing does
        // not reveal that the account doesn't exist, then fail generically.
        await verifyPassword(input.password, await getDummyHash());
        return fail(email, input.ip, input.userAgent, "unknown_account");
      }

      const credential = await deps.users.getCredential(user.id);
      if (!credential) {
        await verifyPassword(input.password, await getDummyHash());
        return fail(email, input.ip, input.userAgent, "unknown_account");
      }

      const validPassword = await verifyPassword(input.password, credential);
      if (!validPassword) {
        return fail(email, input.ip, input.userAgent, "invalid_password");
      }

      if (user.status === "disabled") {
        await deps.rateLimiter.recordFailure({ email, ip: input.ip, userAgent: input.userAgent, reason: "account_disabled" });
        throw new AccountDisabledError();
      }

      const mfaMethod = await deps.mfa.getActiveOrPendingMethod(user.id);
      if (mfaMethod && mfaMethod.status === "active") {
        const challengeId = randomUUID();
        pendingChallenges.set(challengeId, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
        await deps.rateLimiter.recordFailure({ email, ip: input.ip, userAgent: input.userAgent, reason: "mfa_required" });
        return { outcome: "mfa_challenge", userId: user.id, challengeId };
      }

      await deps.rateLimiter.recordSuccess({ email, ip: input.ip, userAgent: input.userAgent });
      return { outcome: "authenticated", userId: user.id };
    },

    /** Resolves a pending MFA challenge to a userId, or null if unknown/expired. Consumes the challenge. */
    resolveChallenge(challengeId: string): string | null {
      const pending = pendingChallenges.get(challengeId);
      if (!pending) return null;
      pendingChallenges.delete(challengeId);
      if (pending.expiresAt < Date.now()) return null;
      return pending.userId;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
