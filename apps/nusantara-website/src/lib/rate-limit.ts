import "server-only";

/**
 * Fixed-window rate limiter — readiness, not production infrastructure.
 *
 * State is held in this server process, so limits are per instance and reset
 * on restart. That is adequate for the prototype and for a single-instance
 * deployment. A multi-instance production deployment should replace the
 * store with a shared one (or rely on the hosting platform's edge rate
 * limiting); the call sites do not change.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  const now = Date.now();
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, retryAfterS: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) return { ok: false as const, retryAfterS: Math.ceil((entry.resetAt - now) / 1000) };
  return { ok: true as const, retryAfterS: 0 };
}
