/**
 * Brute-force protection: failed-attempt tracking with temporary
 * exponential-ish backoff, not permanent lockout (a permanent lockout is
 * itself a denial-of-service vector — an attacker can lock a real user out
 * indefinitely just by failing their password a few times). See
 * docs/architecture/identity-foundation.md "Login protection".
 */
import type { AttemptRepository } from "../repositories/types.ts";
import type { AuthenticationAttemptReason } from "../domain/entities.ts";

const WINDOW_SECONDS = 15 * 60; // look-back window for counting recent failures
/** Thresholds are deliberately modest for a foundation; tune once real traffic patterns exist. */
const THROTTLE_THRESHOLDS: { failures: number; backoffSeconds: number }[] = [
  { failures: 5, backoffSeconds: 30 },
  { failures: 8, backoffSeconds: 5 * 60 },
  { failures: 12, backoffSeconds: 30 * 60 },
];

export function createRateLimiter(deps: { attempts: AttemptRepository }) {
  return {
    /** Returns seconds the caller must wait, or 0 if not currently throttled. */
    async checkThrottle(input: { email: string; ip?: string }): Promise<number> {
      const sinceIso = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
      const byEmail = await deps.attempts.countRecentFailures({ email: input.email, sinceIso });
      const byIp = input.ip ? await deps.attempts.countRecentFailures({ ip: input.ip, sinceIso }) : 0;
      const failures = Math.max(byEmail, byIp);
      let backoff = 0;
      for (const threshold of THROTTLE_THRESHOLDS) {
        if (failures >= threshold.failures) backoff = threshold.backoffSeconds;
      }
      return backoff;
    },

    async recordFailure(input: {
      email: string;
      ip?: string;
      userAgent?: string;
      reason: AuthenticationAttemptReason;
    }): Promise<void> {
      await deps.attempts.record({
        email: input.email,
        succeeded: false,
        reason: input.reason,
        ip: input.ip,
        userAgent: input.userAgent,
      });
    },

    /**
     * Records a non-failure attempt — reason defaults to "success" (fully
     * authenticated) but a caller may pass "mfa_required" for the case
     * where the primary factor (password) was correct and a challenge was
     * issued: that is not a completed login, but it is also genuinely not
     * a failure, and must never contribute to brute-force throttling.
     * countRecentFailures only counts succeeded=false rows, so any reason
     * passed here is structurally excluded from the failure count.
     */
    async recordSuccess(input: { email: string; ip?: string; userAgent?: string; reason?: AuthenticationAttemptReason }): Promise<void> {
      await deps.attempts.record({ email: input.email, succeeded: true, reason: input.reason ?? "success", ip: input.ip, userAgent: input.userAgent });
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
