/**
 * Concrete Postgres implementation of packages/shared's DatabaseProvider
 * contract, using `pg` (the standard, well-established Node Postgres
 * client — no ORM, matching apps/svegip's own no-ORM convention and
 * docs/architecture/data-and-database-conventions.md). This is the only
 * file in this service that imports `pg` directly — every repository
 * depends on the DatabaseProvider interface, not on `pg` itself, so
 * swapping to a different Postgres client or host later touches only this
 * file. See docs/architecture/deployment-portability.md.
 */
import pg from "pg";
import type { DatabaseProvider, QueryResult } from "../../../../../packages/shared/src/DatabaseProvider.ts";

const { Pool } = pg;

export function createPgDatabaseProvider(connectionString: string): DatabaseProvider & { close(): Promise<void> } {
  const pool = new Pool({ connectionString });

  const provider: DatabaseProvider & { close(): Promise<void> } = {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(fn: (tx: DatabaseProvider) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const tx: DatabaseProvider = {
          query: async <U>(sql: string, params: unknown[] = []) => {
            const result = await client.query(sql, params);
            return { rows: result.rows as U[] };
          },
          transaction: async () => {
            throw new Error("Nested transactions are not supported.");
          },
        };
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
  return provider;
}
