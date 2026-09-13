import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowTransaction, WorkflowTxRepos } from "../types.ts";

/** No real Postgres connection exists in-memory — a registered SYSTEM_ACTION handler under test that needs cross-package transaction-scoping (e.g. HRMS's employment-change/offboarding completion handler) reuses the shared in-memory HRMS/Organisation services directly instead of binding to this. Any attempt to actually use it as a DatabaseProvider is a test wiring bug (mirrors platform-services/hrms's inMemoryLifecycleTransaction.ts NO_REAL_CONNECTION). */
const NO_REAL_CONNECTION: DatabaseProvider = {
  async query() {
    throw new Error("In-memory WorkflowTransaction has no real DatabaseProvider connection to expose.");
  },
  async transaction() {
    throw new Error("In-memory WorkflowTransaction has no real DatabaseProvider connection to expose.");
  },
};

/** In-memory implementation — no real rollback: in-memory unit tests exercise RBAC/domain logic, not Postgres transaction/rollback behaviour, which is covered separately by real-Postgres integration tests (mirrors platform-services/hrms's inMemoryLifecycleTransaction.ts). */
export function createInMemoryWorkflowTransaction(repos: WorkflowTxRepos): WorkflowTransaction {
  return {
    async run(fn) {
      return fn(repos, NO_REAL_CONNECTION);
    },
  };
}
