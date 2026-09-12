/**
 * This package's own composition root — mirrors platform-services/
 * data-vault's exact pattern (see that package's README for the
 * dependency-direction rationale this repeats): Organisation depends on
 * Identity's contracts/services, imported by source path; Identity has no
 * corresponding dependency on this package.
 *
 * Unlike Data Vault, this package does not include a SVEGIP session-
 * cookie bridge: no existing apps/svegip page authenticates against
 * Employee Master today (no SVEGIP UI change is made by this PR), so the
 * only authentication path is a native Identity bearer session. Adding a
 * SVEGIP bridge remains straightforward to add later following Data
 * Vault's model, if a future PR wires an apps/svegip page into this API.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "../../../identity/src/repositories/postgres/pgSessionRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createSessionService, type SessionService } from "../../../identity/src/services/sessionService.ts";
import { createRbacService, type RbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService, type AuditService } from "../../../identity/src/services/auditService.ts";
import type { UserRepository, OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import { createPgOrgStructureRepository } from "../repositories/postgres/pgOrgStructureRepository.ts";
import { createPgEmployeeRepository } from "../repositories/postgres/pgEmployeeRepository.ts";
import { createPgEmploymentAssignmentRepository } from "../repositories/postgres/pgEmploymentAssignmentRepository.ts";
import { createPgEmployeeCreationTransaction } from "../repositories/postgres/pgEmployeeCreationTransaction.ts";
import { createPgEmploymentAssignmentTransaction } from "../repositories/postgres/pgEmploymentAssignmentTransaction.ts";
import { createEmployeeService, type EmployeeService } from "../services/employeeService.ts";
import { createEmploymentAssignmentService, type EmploymentAssignmentService } from "../services/employmentAssignmentService.ts";
import { createOrganisationStructureService, type OrganisationStructureService } from "../services/organisationStructureService.ts";

export interface OrganisationContainer {
  users: UserRepository;
  organisation: OrganisationRepository;
  sessions: SessionService;
  rbac: RbacService;
  audit: AuditService;
  employees: EmployeeService;
  assignments: EmploymentAssignmentService;
  orgStructure: OrganisationStructureService;
}

export async function createOrganisationContainer(db: DatabaseProvider): Promise<OrganisationContainer> {
  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const sessionRepo = createPgSessionRepository(db);
  const auditRepo = createPgAuditRepository(db);
  const orgStructureRepo = createPgOrgStructureRepository(db);
  const employeeRepo = createPgEmployeeRepository(db);
  const assignmentRepo = createPgEmploymentAssignmentRepository(db);
  const employeeCreation = createPgEmployeeCreationTransaction(db);
  const assignmentTransactions = createPgEmploymentAssignmentTransaction(db);

  const sessions = createSessionService({ sessions: sessionRepo });
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });

  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });
  const assignments = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, transactions: assignmentTransactions });
  const orgStructure = createOrganisationStructureService({ orgStructure: orgStructureRepo, organisation, rbac, audit });

  return { users, organisation, sessions, rbac, audit, employees, assignments, orgStructure };
}
