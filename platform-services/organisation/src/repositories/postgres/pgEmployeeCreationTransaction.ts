/**
 * Real Postgres implementation of EmployeeCreationTransaction — see
 * repositories/types.ts's interface doc and docs/architecture/
 * organisation-employee-master.md "Transactional employee creation".
 * Constructs employee/assignment repositories scoped to the SAME
 * transaction connection (`DatabaseProvider.transaction()`, already used
 * elsewhere — e.g. platform-services/identity's pgMfaRepository), so every
 * write inside `fn` commits or rolls back together.
 */
import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { EmployeeCreationTransaction } from "../types.ts";
import { createPgEmployeeRepository } from "./pgEmployeeRepository.ts";
import { createPgEmploymentAssignmentRepository } from "./pgEmploymentAssignmentRepository.ts";

export function createPgEmployeeCreationTransaction(db: DatabaseProvider): EmployeeCreationTransaction {
  return {
    async run(fn) {
      return db.transaction(async (tx) => {
        return fn({
          employees: createPgEmployeeRepository(tx),
          assignments: createPgEmploymentAssignmentRepository(tx),
        });
      });
    },
  };
}
