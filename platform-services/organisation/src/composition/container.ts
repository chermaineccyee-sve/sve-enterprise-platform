/**
 * This package's own composition root — mirrors platform-services/
 * data-vault's exact pattern (see that package's README for the
 * dependency-direction rationale this repeats): Organisation depends on
 * Identity's contracts/services, imported by source path; Identity has no
 * corresponding dependency on this package.
 *
 * PR #11: the SVEGIP session-cookie bridge (previously not wired here —
 * this file used to note "no existing apps/svegip page authenticates
 * against Employee Master today") is now wired, following Data Vault's
 * existing model exactly, because apps/svegip's new People/HRMS area does
 * call into this service's HTTP API (via its own Netlify proxy functions
 * — see docs/architecture/hrms-application-shell.md "Frontend/backend
 * boundaries"). This is not a new authentication mechanism: it reuses the
 * same identity/src/services/svegipSessionBridge.ts capability Data Vault
 * already relies on.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type { SecretsProvider } from "../../../../packages/security/src/SecretsProvider.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "../../../identity/src/repositories/postgres/pgSessionRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createSessionService, type SessionService } from "../../../identity/src/services/sessionService.ts";
import { createPgUserSecurityTransaction } from "../../../identity/src/repositories/postgres/pgUserSecurityTransaction.ts";
import { createRbacService, type RbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService, type AuditService } from "../../../identity/src/services/auditService.ts";
import { createEnvSecretsProvider } from "../../../identity/src/config/envSecretsProvider.ts";
import { loadSvegipBridgeSecret } from "../../../identity/src/services/svegipSessionBridge.ts";
import type { UserRepository, OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import { createPgOrgStructureRepository } from "../repositories/postgres/pgOrgStructureRepository.ts";
import { createPgEmployeeRepository } from "../repositories/postgres/pgEmployeeRepository.ts";
import { createPgEmploymentAssignmentRepository } from "../repositories/postgres/pgEmploymentAssignmentRepository.ts";
import { createPgEmployeeCreationTransaction } from "../repositories/postgres/pgEmployeeCreationTransaction.ts";
import { createPgEmploymentAssignmentTransaction } from "../repositories/postgres/pgEmploymentAssignmentTransaction.ts";
import { createEmployeeService, type EmployeeService } from "../services/employeeService.ts";
import { createEmploymentAssignmentService, type EmploymentAssignmentService } from "../services/employmentAssignmentService.ts";
import { createOrganisationStructureService, type OrganisationStructureService } from "../services/organisationStructureService.ts";
import { loadTrustedOrigins } from "../config/trustedOrigins.ts";

export interface OrganisationContainer {
  users: UserRepository;
  organisation: OrganisationRepository;
  sessions: SessionService;
  rbac: RbacService;
  audit: AuditService;
  employees: EmployeeService;
  assignments: EmploymentAssignmentService;
  orgStructure: OrganisationStructureService;
  /** Null when the transitional SVEGIP bridge is not configured for this deployment — see identity/src/services/svegipSessionBridge.ts. */
  svegipBridgeSecret: string | null;
  /** Origins trusted for cookie-authenticated state-changing requests — see config/trustedOrigins.ts. */
  trustedOrigins: Set<string>;
}

export async function createOrganisationContainer(db: DatabaseProvider, opts?: { secrets?: SecretsProvider }): Promise<OrganisationContainer> {
  const secrets = opts?.secrets ?? createEnvSecretsProvider();
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

  const sessions = createSessionService({ sessions: sessionRepo, users, transactions: createPgUserSecurityTransaction(db) });
  const rbac = createRbacService({ rbac: rbacRepo, organisation, users });
  const audit = createAuditService({ audit: auditRepo });

  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });
  const assignments = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, transactions: assignmentTransactions });
  const orgStructure = createOrganisationStructureService({ orgStructure: orgStructureRepo, organisation, rbac, audit });

  const svegipBridgeSecret = await loadSvegipBridgeSecret(secrets);
  const trustedOrigins = loadTrustedOrigins();

  return { users, organisation, sessions, rbac, audit, employees, assignments, orgStructure, svegipBridgeSecret, trustedOrigins };
}
