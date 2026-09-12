import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { AttemptRepository } from "../types.ts";
import type { AuthenticationAttempt, AuthenticationAttemptReason } from "../../domain/entities.ts";

interface AttemptRow {
  id: string;
  email: string;
  succeeded: boolean;
  reason: AuthenticationAttemptReason | null;
  ip: string | null;
  user_agent: string | null;
  occurred_at: string;
}
const mapAttempt = (r: AttemptRow): AuthenticationAttempt => ({
  id: r.id,
  email: r.email,
  succeeded: r.succeeded,
  reason: r.reason,
  ip: r.ip,
  userAgent: r.user_agent,
  occurredAt: r.occurred_at,
});

export function createPgAttemptRepository(db: DatabaseProvider): AttemptRepository {
  return {
    async record(input): Promise<AuthenticationAttempt> {
      const result = await db.query<AttemptRow>(
        `INSERT INTO authentication_attempts(email, succeeded, reason, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, email, succeeded, reason, ip, user_agent, occurred_at`,
        [input.email.toLowerCase(), input.succeeded, input.reason ?? null, input.ip ?? null, input.userAgent ?? null],
      );
      return mapAttempt(result.rows[0]!);
    },
    async countRecentFailures(input: { email?: string; ip?: string; sinceIso: string }): Promise<number> {
      const conditions: string[] = ["succeeded = FALSE", "occurred_at >= $1"];
      const params: unknown[] = [input.sinceIso];
      if (input.email) {
        params.push(input.email.toLowerCase());
        conditions.push(`email = $${params.length}`);
      }
      if (input.ip) {
        params.push(input.ip);
        conditions.push(`ip = $${params.length}`);
      }
      const result = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM authentication_attempts WHERE ${conditions.join(" AND ")}`,
        params,
      );
      return Number(result.rows[0]?.count ?? "0");
    },
  };
}
