/**
 * Real Postgres implementation of LifecycleTransaction — mirrors
 * platform-services/organisation's pgEmployeeCreationTransaction.ts
 * exactly: constructs case/event/milestone/review repositories scoped to
 * the SAME transaction connection, so every write inside `fn` commits or
 * rolls back together. See docs/architecture/hrms-employee-lifecycle.md
 * "Transaction boundaries" for which operations use this and why
 * employment-change/offboarding completion deliberately do NOT try to
 * nest platform-services/organisation's own transaction inside this one
 * (DatabaseProvider.transaction() does not support nesting).
 */
import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { LifecycleTransaction } from "../types.ts";
import { createPgLifecycleCaseRepository } from "./pgLifecycleCaseRepository.ts";
import { createPgLifecycleEventRepository } from "./pgLifecycleEventRepository.ts";
import { createPgLifecycleMilestoneRepository } from "./pgLifecycleMilestoneRepository.ts";
import { createPgProbationReviewRepository } from "./pgProbationReviewRepository.ts";

export function createPgLifecycleTransaction(db: DatabaseProvider): LifecycleTransaction {
  return {
    async run(fn) {
      return db.transaction(async (tx) => {
        return fn({
          cases: createPgLifecycleCaseRepository(tx),
          events: createPgLifecycleEventRepository(tx),
          milestones: createPgLifecycleMilestoneRepository(tx),
          reviews: createPgProbationReviewRepository(tx),
        });
      });
    },
  };
}
