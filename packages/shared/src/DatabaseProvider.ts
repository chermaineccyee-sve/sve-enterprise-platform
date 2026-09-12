/**
 * Database provider contract. Contract only — no implementation.
 *
 * apps/svegip calls @netlify/database's getDatabase() directly today —
 * unchanged by this PR. This is the contract a future portable data-access
 * layer (used by platform-services/*, not apps/svegip) would implement, so
 * swapping private PostgreSQL for AWS RDS PostgreSQL is a provider swap, not
 * a rewrite of every service. See docs/architecture/data-and-database-conventions.md.
 */
export interface QueryResult<T> {
  rows: T[];
}

export interface DatabaseProvider {
  /**
   * Parameterised query only — implementations must never allow raw string
   * concatenation into SQL. See security-architecture.md "SQL injection".
   */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /** Runs the callback in a single transaction; rolls back on any thrown error. */
  transaction<T>(fn: (tx: DatabaseProvider) => Promise<T>): Promise<T>;
}
