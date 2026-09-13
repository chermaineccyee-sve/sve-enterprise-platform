/**
 * Real Postgres implementation of LifecycleTransaction — mirrors
 * platform-services/organisation's pgEmployeeCreationTransaction.ts
 * exactly: constructs case/event/milestone/review repositories scoped to
 * the SAME transaction connection, so every write inside `fn` commits or
 * rolls back together. Also passes the raw `tx` through to `fn` so a
 * caller can bind Organisation's OWN transaction-scoped composition
 * helper (createEmploymentAssignmentServiceForTransaction) to this exact
 * connection — never a second, nested DatabaseProvider.transaction() call
 * (which throws) — so employment-change/offboarding completion can run
 * Organisation's authoritative assignment mutation and HRMS's own case
 * completion as one shared Postgres transaction. See docs/architecture/
 * hrms-employee-lifecycle.md "Transaction boundaries".
 */
import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { LifecycleTransaction } from "../types.ts";
import { createPgLifecycleCaseRepository } from "./pgLifecycleCaseRepository.ts";
import { createPgLifecycleEventRepository } from "./pgLifecycleEventRepository.ts";
import { createPgLifecycleMilestoneRepository } from "./pgLifecycleMilestoneRepository.ts";
import { createPgProbationReviewRepository } from "./pgProbationReviewRepository.ts";
import { createPgIdentityDeactivationRequestRepository } from "./pgIdentityDeactivationRequestRepository.ts";

export function createPgLifecycleTransaction(db: DatabaseProvider): LifecycleTransaction {
  return {
    async run(fn) {
      return db.transaction(async (tx) => {
        return fn(
          {
            cases: createPgLifecycleCaseRepository(tx),
            events: createPgLifecycleEventRepository(tx),
            milestones: createPgLifecycleMilestoneRepository(tx),
            reviews: createPgProbationReviewRepository(tx),
            deactivationRequests: createPgIdentityDeactivationRequestRepository(tx),
          },
          tx,
        );
      });
    },
  };
}

/**
 * Same behaviour as createPgLifecycleTransaction, for use when the caller
 * has ALREADY opened the Postgres transaction `tx` belongs to (PR #9 —
 * see platform-services/hrms/src/composition/transactionScope.ts and
 * docs/architecture/hrms-workflow-integration.md "Transaction boundary").
 * DatabaseProvider.transaction() does not support nesting, so this variant
 * never calls `tx.transaction()` — it runs `fn` directly against `tx`,
 * joining whatever outer transaction (a Workflow-triggered SYSTEM_ACTION
 * handler's own) is already open. Mirrors platform-services/organisation's
 * createPgEmploymentAssignmentTransactionScoped exactly.
 */
export function createPgLifecycleTransactionScoped(tx: DatabaseProvider): LifecycleTransaction {
  return {
    async run(fn) {
      return fn(
        {
          cases: createPgLifecycleCaseRepository(tx),
          events: createPgLifecycleEventRepository(tx),
          milestones: createPgLifecycleMilestoneRepository(tx),
          reviews: createPgProbationReviewRepository(tx),
          deactivationRequests: createPgIdentityDeactivationRequestRepository(tx),
        },
        tx,
      );
    },
  };
}
