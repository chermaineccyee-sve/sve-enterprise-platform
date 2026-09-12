import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { UserRepository } from "../types.ts";
import type { AccountType, User, UserEmployeeLink } from "../../domain/entities.ts";
import type { PasswordHash, ScryptParams } from "../../crypto/password.ts";

interface UserRow {
  id: string;
  email: string;
  account_type: AccountType;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    accountType: row.account_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface LinkRow {
  id: string;
  user_id: string;
  employee_id: string;
  linked_at: string;
  linked_by: string;
  unlinked_at: string | null;
  unlinked_by: string | null;
}

const LINK_COLUMNS = "id, user_id, employee_id, linked_at, linked_by, unlinked_at, unlinked_by";

function mapLink(row: LinkRow): UserEmployeeLink {
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id,
    linkedAt: row.linked_at,
    linkedBy: row.linked_by,
    unlinkedAt: row.unlinked_at,
    unlinkedBy: row.unlinked_by,
  };
}

export function createPgUserRepository(db: DatabaseProvider): UserRepository {
  return {
    async createUser(input: { email: string; accountType: AccountType }): Promise<User> {
      const result = await db.query<UserRow>(
        `INSERT INTO users(email, account_type) VALUES ($1, $2) RETURNING id, email, account_type, status, created_at, updated_at`,
        [input.email.toLowerCase(), input.accountType],
      );
      return mapUser(result.rows[0]!);
    },
    async findByEmail(email: string): Promise<User | null> {
      const result = await db.query<UserRow>(
        `SELECT id, email, account_type, status, created_at, updated_at FROM users WHERE email = $1`,
        [email.toLowerCase()],
      );
      return result.rows[0] ? mapUser(result.rows[0]) : null;
    },
    async findById(id: string): Promise<User | null> {
      const result = await db.query<UserRow>(
        `SELECT id, email, account_type, status, created_at, updated_at FROM users WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapUser(result.rows[0]) : null;
    },
    async setStatus(userId: string, status: "active" | "disabled"): Promise<void> {
      await db.query(`UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1`, [userId, status]);
    },
    async setCredential(userId: string, hash: PasswordHash): Promise<void> {
      await db.query(
        `INSERT INTO user_credentials(user_id, password_hash, password_salt, password_algorithm, password_params)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           password_salt = EXCLUDED.password_salt,
           password_algorithm = EXCLUDED.password_algorithm,
           password_params = EXCLUDED.password_params,
           updated_at = NOW()`,
        [userId, hash.hash, hash.salt, hash.algorithm, JSON.stringify(hash.params)],
      );
    },
    async getCredential(userId: string): Promise<PasswordHash | null> {
      const result = await db.query<{
        password_hash: string;
        password_salt: string;
        password_algorithm: "scrypt";
        password_params: ScryptParams;
      }>(
        `SELECT password_hash, password_salt, password_algorithm, password_params FROM user_credentials WHERE user_id = $1`,
        [userId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return { hash: row.password_hash, salt: row.password_salt, algorithm: row.password_algorithm, params: row.password_params };
    },
    async linkEmployee(link: { userId: string; employeeId: string; linkedBy: string }): Promise<UserEmployeeLink> {
      const result = await db.query<LinkRow>(
        `INSERT INTO user_employee_links(user_id, employee_id, linked_by) VALUES ($1, $2, $3)
         RETURNING ${LINK_COLUMNS}`,
        [link.userId, link.employeeId, link.linkedBy],
      );
      return mapLink(result.rows[0]!);
    },
    async findActiveLinkByUserId(userId: string): Promise<UserEmployeeLink | null> {
      const result = await db.query<LinkRow>(
        `SELECT ${LINK_COLUMNS} FROM user_employee_links WHERE user_id = $1 AND unlinked_at IS NULL`,
        [userId],
      );
      return result.rows[0] ? mapLink(result.rows[0]) : null;
    },
    async findActiveLinkByEmployeeId(employeeId: string): Promise<UserEmployeeLink | null> {
      const result = await db.query<LinkRow>(
        `SELECT ${LINK_COLUMNS} FROM user_employee_links WHERE employee_id = $1 AND unlinked_at IS NULL`,
        [employeeId],
      );
      return result.rows[0] ? mapLink(result.rows[0]) : null;
    },
    async unlinkEmployee(linkId: string, unlinkedBy: string): Promise<void> {
      await db.query(`UPDATE user_employee_links SET unlinked_at = NOW(), unlinked_by = $2 WHERE id = $1 AND unlinked_at IS NULL`, [linkId, unlinkedBy]);
    },
  };
}
