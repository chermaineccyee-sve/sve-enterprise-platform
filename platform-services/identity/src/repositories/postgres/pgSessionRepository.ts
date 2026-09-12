import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { SessionRepository } from "../types.ts";
import type { Session } from "../../domain/entities.ts";

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  last_active_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  mfa_verified: boolean;
  ip: string | null;
  user_agent: string | null;
}

const COLUMNS = "id, user_id, token_hash, created_at, last_active_at, expires_at, revoked_at, revoked_reason, mfa_verified, ip, user_agent";

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    mfaVerified: row.mfa_verified,
    ip: row.ip,
    userAgent: row.user_agent,
  };
}

export function createPgSessionRepository(db: DatabaseProvider): SessionRepository {
  return {
    async create(input): Promise<Session> {
      const result = await db.query<SessionRow>(
        `INSERT INTO sessions(user_id, token_hash, expires_at, mfa_verified, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
        [input.userId, input.tokenHash, input.expiresAt, input.mfaVerified, input.ip ?? null, input.userAgent ?? null],
      );
      return mapSession(result.rows[0]!);
    },
    async findByTokenHash(tokenHash: string): Promise<Session | null> {
      const result = await db.query<SessionRow>(`SELECT ${COLUMNS} FROM sessions WHERE token_hash = $1`, [tokenHash]);
      return result.rows[0] ? mapSession(result.rows[0]) : null;
    },
    async findById(id: string): Promise<Session | null> {
      const result = await db.query<SessionRow>(`SELECT ${COLUMNS} FROM sessions WHERE id = $1`, [id]);
      return result.rows[0] ? mapSession(result.rows[0]) : null;
    },
    async touchLastActive(id: string): Promise<void> {
      await db.query(`UPDATE sessions SET last_active_at = NOW() WHERE id = $1`, [id]);
    },
    async revoke(id: string, reason: string): Promise<void> {
      await db.query(`UPDATE sessions SET revoked_at = NOW(), revoked_reason = $2 WHERE id = $1 AND revoked_at IS NULL`, [id, reason]);
    },
    async revokeAllForUser(userId: string, reason: string): Promise<number> {
      const result = await db.query(
        `UPDATE sessions SET revoked_at = NOW(), revoked_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
        [userId, reason],
      );
      return result.rows.length;
    },
    async listActiveForUser(userId: string): Promise<Session[]> {
      const result = await db.query<SessionRow>(
        `SELECT ${COLUMNS} FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
        [userId],
      );
      return result.rows.map(mapSession);
    },
    async expireDue(now: string): Promise<number> {
      const result = await db.query(
        `UPDATE sessions SET revoked_at = $1, revoked_reason = 'expired' WHERE revoked_at IS NULL AND expires_at <= $1 RETURNING id`,
        [now],
      );
      return result.rows.length;
    },
  };
}
