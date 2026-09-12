import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { MfaRepository } from "../types.ts";
import type { MfaMethod, MfaMethodStatus, MfaRecoveryCode } from "../../domain/entities.ts";

interface MethodRow {
  id: string;
  user_id: string;
  method_type: "totp";
  secret_ciphertext: string;
  secret_iv: string;
  secret_auth_tag: string;
  secret_key_id: string;
  status: MfaMethodStatus;
  created_at: string;
  activated_at: string | null;
  disabled_at: string | null;
  disabled_by: string | null;
}
const METHOD_COLUMNS =
  "id, user_id, method_type, secret_ciphertext, secret_iv, secret_auth_tag, secret_key_id, status, created_at, activated_at, disabled_at, disabled_by";
const mapMethod = (r: MethodRow): MfaMethod => ({
  id: r.id,
  userId: r.user_id,
  methodType: r.method_type,
  secret: { ciphertext: r.secret_ciphertext, iv: r.secret_iv, authTag: r.secret_auth_tag, keyId: r.secret_key_id },
  status: r.status,
  createdAt: r.created_at,
  activatedAt: r.activated_at,
  disabledAt: r.disabled_at,
  disabledBy: r.disabled_by,
});

interface RecoveryRow {
  id: string;
  user_id: string;
  generation_id: string;
  code_hash: string;
  used_at: string | null;
  created_at: string;
}
const mapRecovery = (r: RecoveryRow): MfaRecoveryCode => ({
  id: r.id,
  userId: r.user_id,
  generationId: r.generation_id,
  codeHash: r.code_hash,
  usedAt: r.used_at,
  createdAt: r.created_at,
});

export function createPgMfaRepository(db: DatabaseProvider): MfaRepository {
  return {
    async createMethod(input): Promise<MfaMethod> {
      const result = await db.query<MethodRow>(
        `INSERT INTO mfa_methods(user_id, secret_ciphertext, secret_iv, secret_auth_tag, secret_key_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${METHOD_COLUMNS}`,
        [input.userId, input.secret.ciphertext, input.secret.iv, input.secret.authTag, input.secret.keyId],
      );
      return mapMethod(result.rows[0]!);
    },
    async findActiveOrPendingByUser(userId: string): Promise<MfaMethod | null> {
      const result = await db.query<MethodRow>(
        `SELECT ${METHOD_COLUMNS} FROM mfa_methods WHERE user_id = $1 AND status IN ('active','pending') ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      return result.rows[0] ? mapMethod(result.rows[0]) : null;
    },
    async activateMethod(id: string): Promise<void> {
      await db.query(`UPDATE mfa_methods SET status = 'active', activated_at = NOW() WHERE id = $1`, [id]);
    },
    async disableMethod(id: string, disabledBy: string): Promise<void> {
      await db.query(
        `UPDATE mfa_methods SET status = 'disabled', disabled_at = NOW(), disabled_by = $2 WHERE id = $1`,
        [id, disabledBy],
      );
    },
    async replaceRecoveryCodes(input): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.query(`DELETE FROM mfa_recovery_codes WHERE user_id = $1`, [input.userId]);
        for (const codeHash of input.codeHashes) {
          await tx.query(
            `INSERT INTO mfa_recovery_codes(user_id, generation_id, code_hash) VALUES ($1, $2, $3)`,
            [input.userId, input.generationId, codeHash],
          );
        }
      });
    },
    async findUnusedRecoveryCodeByHash(userId: string, codeHash: string) {
      const result = await db.query<RecoveryRow>(
        `SELECT id, user_id, generation_id, code_hash, used_at, created_at
         FROM mfa_recovery_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`,
        [userId, codeHash],
      );
      return result.rows[0] ? mapRecovery(result.rows[0]) : null;
    },
    async markRecoveryCodeUsed(id: string): Promise<void> {
      await db.query(`UPDATE mfa_recovery_codes SET used_at = NOW() WHERE id = $1`, [id]);
    },
  };
}
