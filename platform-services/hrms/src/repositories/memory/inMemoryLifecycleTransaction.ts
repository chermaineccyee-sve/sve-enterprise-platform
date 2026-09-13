import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { LifecycleTransaction, LifecycleCaseRepository, LifecycleEventRepository, LifecycleMilestoneRepository, ProbationReviewRepository } from "../types.ts";

/** No real Postgres connection exists in-memory — callers that need cross-package transaction-scoping (employment-change/offboarding completion) reuse the shared in-memory Organisation service directly instead of binding to this. Any attempt to actually use it as a DatabaseProvider is a test wiring bug. */
const NO_REAL_CONNECTION: DatabaseProvider = {
  async query() {
    throw new Error("In-memory LifecycleTransaction has no real DatabaseProvider connection to expose.");
  },
  async transaction() {
    throw new Error("In-memory LifecycleTransaction has no real DatabaseProvider connection to expose.");
  },
};

/** In-memory implementation — see repositories/types.ts's interface doc. No real rollback: in-memory unit tests exercise RBAC/domain logic, not Postgres transaction/rollback behaviour, which is covered separately by real-Postgres integration tests (mirrors platform-services/organisation's inMemoryEmployeeCreationTransaction.ts). */
export function createInMemoryLifecycleTransaction(deps: {
  cases: LifecycleCaseRepository;
  events: LifecycleEventRepository;
  milestones: LifecycleMilestoneRepository;
  reviews: ProbationReviewRepository;
}): LifecycleTransaction {
  return {
    async run(fn) {
      return fn(deps, NO_REAL_CONNECTION);
    },
  };
}
