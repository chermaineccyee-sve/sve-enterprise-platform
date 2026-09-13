/**
 * Shared helper for HRMS integration tests that run against a real
 * Postgres instance (DATABASE_URL) — the SAME physical database as
 * platform-services/identity, platform-services/data-vault, and
 * platform-services/organisation (one shared schema). Reuses Identity's
 * own migration runner and Postgres connection provider by source import
 * — see src/composition/container.ts's header comment on dependency
 * direction. If DATABASE_URL is not set, tests using this helper skip
 * with a clear reason rather than failing.
 */
import { createPgDatabaseProvider } from "../../../identity/src/repositories/postgres/pgDatabaseProvider.ts";
import { runMigrations } from "../../../identity/scripts/migrate.ts";

export function getTestDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

export async function withTestDb<T>(fn: (db: ReturnType<typeof createPgDatabaseProvider>) => Promise<T>): Promise<T> {
  const url = getTestDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL not set");
  await runMigrations(url);
  const db = createPgDatabaseProvider(url);
  try {
    // Full reset: this package's own tables, Organisation's tables (HRMS
    // depends on Organisation to run employment-change/offboarding
    // completions in tests), plus every Identity table these tests create
    // fixtures in — kept seeded org rows (groups, legal_entities) intact.
    await db.query(`
      TRUNCATE TABLE
        hr_probation_reviews, hr_lifecycle_milestones, hr_lifecycle_events, hr_lifecycle_cases,
        employment_assignments, employees, positions, departments, business_units,
        security_audit_events, authentication_attempts, mfa_recovery_codes, mfa_methods,
        sessions, entity_access_grants, user_role_assignments, role_permissions,
        permissions, roles, user_employee_links, user_credentials, users
      RESTART IDENTITY CASCADE
    `);
    await db.query(`ALTER SEQUENCE hr_lifecycle_case_seq RESTART WITH 1`);
    await db.query(`ALTER SEQUENCE employee_number_seq RESTART WITH 1`);
    return await fn(db);
  } finally {
    await db.close();
  }
}
