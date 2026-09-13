import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { UserSecurityTransaction, UserRepository, SessionRepository, AuditRepository } from "../types.ts";

/** No real Postgres connection exists in-memory — see HRMS's identical NO_REAL_CONNECTION convention (inMemoryLifecycleTransaction.ts). Any attempt to actually use it as a DatabaseProvider is a test wiring bug. */
const NO_REAL_CONNECTION: DatabaseProvider = {
  async query() {
    throw new Error("In-memory UserSecurityTransaction has no real DatabaseProvider connection to expose.");
  },
  async transaction() {
    throw new Error("In-memory UserSecurityTransaction has no real DatabaseProvider connection to expose.");
  },
};

/** In-memory implementation — no real rollback: in-memory unit tests exercise RBAC/domain logic, not Postgres transaction/rollback behaviour, which is covered separately by real-Postgres integration tests. */
export function createInMemoryUserSecurityTransaction(deps: { users: UserRepository; sessions: SessionRepository; audit: AuditRepository }): UserSecurityTransaction {
  return {
    async run(fn) {
      return fn(deps, NO_REAL_CONNECTION);
    },
  };
}
