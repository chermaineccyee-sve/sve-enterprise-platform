import type { LifecycleTransaction, LifecycleCaseRepository, LifecycleEventRepository, LifecycleMilestoneRepository, ProbationReviewRepository } from "../types.ts";

/** In-memory implementation — see repositories/types.ts's interface doc. No real rollback: in-memory unit tests exercise RBAC/domain logic, not Postgres transaction/rollback behaviour, which is covered separately by real-Postgres integration tests (mirrors platform-services/organisation's inMemoryEmployeeCreationTransaction.ts). */
export function createInMemoryLifecycleTransaction(deps: {
  cases: LifecycleCaseRepository;
  events: LifecycleEventRepository;
  milestones: LifecycleMilestoneRepository;
  reviews: ProbationReviewRepository;
}): LifecycleTransaction {
  return {
    async run(fn) {
      return fn(deps);
    },
  };
}
