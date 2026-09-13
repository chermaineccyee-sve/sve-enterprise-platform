import type { WorkflowTransaction, WorkflowTxRepos } from "../types.ts";

/** In-memory implementation — no real rollback: in-memory unit tests exercise RBAC/domain logic, not Postgres transaction/rollback behaviour, which is covered separately by real-Postgres integration tests (mirrors platform-services/hrms's inMemoryLifecycleTransaction.ts). */
export function createInMemoryWorkflowTransaction(repos: WorkflowTxRepos): WorkflowTransaction {
  return {
    async run(fn) {
      return fn(repos);
    },
  };
}
