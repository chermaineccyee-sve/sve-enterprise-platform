/**
 * Real Postgres implementation of EmploymentAssignmentTransaction — see
 * repositories/types.ts's interface doc and docs/architecture/
 * organisation-employee-master.md "Reporting-cycle concurrency safety".
 *
 * Two concurrent employmentAssignmentService.createAssignment() calls, each
 * setting a NEW reports_to_assignment_id, independently read the current
 * reporting graph (via reportingChainReachesEmployee's chain walk) before
 * either has written its own edge — a classic time-of-check-to-time-of-use
 * race. Two callers assigning "A reports to B" and "B reports to A" at the
 * same moment can each see a graph with neither edge yet present, each pass
 * cycle validation independently, and each commit — jointly creating a
 * cycle neither request's own check ever saw. See the architecture doc for
 * the concurrency analysis and the test that demonstrates it.
 *
 * The fix: `pg_advisory_xact_lock` (transaction-scoped — released
 * automatically on COMMIT or ROLLBACK, never needs an explicit unlock) on a
 * single fixed key, taken only by a call that is about to introduce a new
 * reporting edge. A second such call blocks until the first's transaction
 * ends, then re-reads the graph — now including the first call's committed
 * edge — inside the SAME lock+transaction scope, so its own cycle check
 * sees true, current state and correctly rejects the would-be cycle. A
 * plain transition that sets no reportsToAssignmentId cannot itself
 * introduce an edge, so it never contends for this lock. One fixed key
 * serializing the whole reporting hierarchy (rather than a per-employee or
 * per-subtree key) is the minimum mechanism sufficient at this
 * modular-monolith's current write volume — no graph-database engine or
 * trigger framework is introduced.
 */
import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { EmploymentAssignmentTransaction } from "../types.ts";
import { createPgEmploymentAssignmentRepository } from "./pgEmploymentAssignmentRepository.ts";

/** Arbitrary, fixed 32-bit key — stable identity for "the employment_assignments reporting hierarchy" advisory lock, chosen once and never reused for any other purpose. */
const REPORTING_HIERARCHY_LOCK_KEY = 851102233;

export function createPgEmploymentAssignmentTransaction(db: DatabaseProvider): EmploymentAssignmentTransaction {
  return {
    async run(options, fn) {
      return db.transaction(async (tx) => {
        if (options.lock) {
          await tx.query("SELECT pg_advisory_xact_lock($1)", [REPORTING_HIERARCHY_LOCK_KEY]);
        }
        return fn({ assignments: createPgEmploymentAssignmentRepository(tx) });
      });
    },
  };
}

/**
 * Same behaviour as createPgEmploymentAssignmentTransaction, for use when
 * the caller has ALREADY opened the Postgres transaction `tx` belongs to
 * (see platform-services/organisation/src/composition/transactionScope.ts
 * and docs/architecture/hrms-employee-lifecycle.md "Transaction
 * boundaries"). DatabaseProvider.transaction() does not support nesting,
 * so this variant never calls `tx.transaction()` — it takes the same
 * advisory lock (still transaction-scoped: released on the OUTER
 * transaction's commit/rollback) directly against `tx` and runs `fn`
 * against it, joining whatever outer transaction is already open.
 */
export function createPgEmploymentAssignmentTransactionScoped(tx: DatabaseProvider): EmploymentAssignmentTransaction {
  return {
    async run(options, fn) {
      if (options.lock) {
        await tx.query("SELECT pg_advisory_xact_lock($1)", [REPORTING_HIERARCHY_LOCK_KEY]);
      }
      return fn({ assignments: createPgEmploymentAssignmentRepository(tx) });
    },
  };
}
