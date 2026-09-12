/**
 * Shared helper for integration tests that run against a real Postgres
 * instance (DATABASE_URL). If DATABASE_URL is not set, tests using this
 * helper skip with a clear reason rather than failing — CI sets it via a
 * postgres service container (see .github/workflows/ci.yml), so this only
 * affects ad hoc local runs without a database configured.
 */
import { createPgDatabaseProvider } from "../../src/repositories/postgres/pgDatabaseProvider.ts";
import { runMigrations } from "../../scripts/migrate.ts";

export function getTestDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

export async function withTestDb<T>(fn: (db: ReturnType<typeof createPgDatabaseProvider>) => Promise<T>): Promise<T> {
  const url = getTestDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL not set");
  await runMigrations(url);
  const db = createPgDatabaseProvider(url);
  try {
    // Clean slate for every test file run — keep the seeded org rows (groups,
    // legal_entities), truncate everything that tests actually create.
    await db.query(`
      TRUNCATE TABLE
        security_audit_events, authentication_attempts, mfa_recovery_codes, mfa_methods,
        sessions, entity_access_grants, user_role_assignments, role_permissions,
        permissions, roles, user_employee_links, user_credentials, users
      RESTART IDENTITY CASCADE
    `);
    return await fn(db);
  } finally {
    await db.close();
  }
}
