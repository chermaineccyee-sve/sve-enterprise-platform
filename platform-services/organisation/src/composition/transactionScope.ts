/**
 * Builds a full EmploymentAssignmentService bound to a Postgres transaction
 * connection ALREADY opened by another package (HRMS's own lifecycle-case
 * transaction) — the minimum transaction-aware port needed so Organisation's
 * own authoritative assignment mutation (with all its own validation, RBAC,
 * cycle checks and audit write) commits or rolls back as one unit together
 * with the caller's own writes, without HRMS ever touching
 * employment_assignments/employees directly and without Organisation
 * knowing HRMS exists. See docs/architecture/hrms-employee-lifecycle.md
 * "Transaction boundaries" for the full reasoning and docs/architecture/
 * organisation-employee-master.md for why DatabaseProvider.transaction()
 * cannot simply be nested.
 *
 * Every repository this service touches (employees, assignments,
 * orgStructure, organisation, users) — AND its own audit write — is bound
 * to the SAME `tx` connection, so a rollback of the outer transaction
 * undoes all of it, including the audit row: an audit record must never
 * outlive the business write it describes. `rbac` is deliberately NOT
 * re-bound: it only reads pre-existing role/permission grants, never
 * writes, so sharing the caller's already-wired RbacService (its own
 * connection, from the pool) is correct and avoids reconstructing RBAC's
 * whole dependency graph here.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createPgOrgStructureRepository } from "../repositories/postgres/pgOrgStructureRepository.ts";
import { createPgEmployeeRepository } from "../repositories/postgres/pgEmployeeRepository.ts";
import { createPgEmploymentAssignmentRepository } from "../repositories/postgres/pgEmploymentAssignmentRepository.ts";
import { createPgEmploymentAssignmentTransactionScoped } from "../repositories/postgres/pgEmploymentAssignmentTransaction.ts";
import { createEmploymentAssignmentService, type EmploymentAssignmentService } from "../services/employmentAssignmentService.ts";

export function createEmploymentAssignmentServiceForTransaction(tx: DatabaseProvider, rbac: RbacService): EmploymentAssignmentService {
  const users = createPgUserRepository(tx);
  const organisation = createPgOrganisationRepository(tx);
  const orgStructure = createPgOrgStructureRepository(tx);
  const employees = createPgEmployeeRepository(tx);
  const assignments = createPgEmploymentAssignmentRepository(tx);
  const audit = createAuditService({ audit: createPgAuditRepository(tx) });
  const transactions = createPgEmploymentAssignmentTransactionScoped(tx);

  return createEmploymentAssignmentService({ employees, assignments, orgStructure, organisation, users, rbac, audit, transactions });
}
