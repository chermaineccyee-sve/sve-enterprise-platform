import type { EmploymentAssignmentTransaction, EmploymentAssignmentRepository } from "../types.ts";

/** In-memory implementation — see repositories/types.ts's interface doc. `options.lock` is ignored: the advisory-lock race this exists to prevent is a real-Postgres concurrency concern (concurrent connections), which in-memory unit tests (single-threaded, sequential awaits) cannot exhibit — covered separately by a real-Postgres concurrency integration test. */
export function createInMemoryEmploymentAssignmentTransaction(deps: { assignments: EmploymentAssignmentRepository }): EmploymentAssignmentTransaction {
  return {
    async run(_options, fn) {
      return fn(deps);
    },
  };
}
