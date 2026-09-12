/**
 * Applies database/migrations/*\/migration.sql, in directory order, against
 * DATABASE_URL. Migrations are idempotent (CREATE TABLE IF NOT EXISTS,
 * guarded seed INSERTs) so re-running is safe — no migration-tracking table
 * is introduced in this foundation; add one if/when migrations stop being
 * safely re-runnable. Used by test/integration's setup and can be run
 * directly for local development: `npm run migrate`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "..", "database", "migrations");

export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) {
      const sqlPath = join(migrationsDir, dir, "migration.sql");
      const sql = readFileSync(sqlPath, "utf8");
      await pool.query(sql);
      console.log(`Applied ${dir}`);
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  runMigrations(connectionString).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
