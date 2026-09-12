import type { EmployeeCreationTransaction, EmployeeRepository, EmploymentAssignmentRepository } from "../types.ts";

/** In-memory implementation — see repositories/types.ts's interface doc. No real rollback: in-memory unit tests exercise the RBAC/domain logic, not Postgres transaction/rollback behaviour, which is covered separately by real-Postgres integration tests. */
export function createInMemoryEmployeeCreationTransaction(deps: {
  employees: EmployeeRepository;
  assignments: EmploymentAssignmentRepository;
}): EmployeeCreationTransaction {
  return {
    async run(fn) {
      return fn(deps);
    },
  };
}
