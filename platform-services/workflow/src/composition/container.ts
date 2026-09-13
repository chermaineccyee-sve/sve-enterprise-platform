/**
 * This package's own composition root — mirrors platform-services/hrms's
 * exact pattern: Workflow depends on Identity's AND Organisation's
 * contracts/services, imported by source path; neither Identity nor
 * Organisation has any dependency on this package. See docs/architecture/
 * workflow-approval-foundation.md "Module ownership and dependency
 * direction".
 *
 * Workflow deliberately does NOT depend on platform-services/hrms (or any
 * other business domain) — see the architecture doc "Domain boundary":
 * domains plug INTO Workflow, Workflow never plugs into a domain, so a
 * future HRMS-consumes-Workflow integration never creates a cycle.
 *
 * No real SYSTEM_ACTION handler is registered here — no business domain
 * is integrated by this PR (see domain/systemActionRegistry.ts's header).
 *
 * PR #11: the SVEGIP session-cookie bridge is now wired here, following
 * Organisation's/HRMS's own wiring exactly (which itself mirrors Data
 * Vault's already-accepted model) — apps/svegip's new My Tasks/Approvals
 * area calls into this service's HTTP API via its own Netlify proxy
 * function. See docs/architecture/hrms-application-shell.md.
 */
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import type { SecretsProvider } from "../../../../packages/security/src/SecretsProvider.ts";
import { createEnvSecretsProvider } from "../../../identity/src/config/envSecretsProvider.ts";
import { loadSvegipBridgeSecret } from "../../../identity/src/services/svegipSessionBridge.ts";
import { loadTrustedOrigins } from "../config/trustedOrigins.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "../../../identity/src/repositories/postgres/pgSessionRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createSessionService, type SessionService } from "../../../identity/src/services/sessionService.ts";
import { createPgUserSecurityTransaction } from "../../../identity/src/repositories/postgres/pgUserSecurityTransaction.ts";
import { createRbacService, type RbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService, type AuditService } from "../../../identity/src/services/auditService.ts";
import { createActorResolutionService, type ActorResolutionService } from "../../../identity/src/services/actorResolutionService.ts";
import type { UserRepository, OrganisationRepository } from "../../../identity/src/repositories/types.ts";
import { createOrganisationContainer, type OrganisationContainer } from "../../../organisation/src/composition/container.ts";
import { createPgWorkflowDefinitionRepository } from "../repositories/postgres/pgWorkflowDefinitionRepository.ts";
import { createPgWorkflowDefinitionVersionRepository } from "../repositories/postgres/pgWorkflowDefinitionVersionRepository.ts";
import { createPgWorkflowStepRepository } from "../repositories/postgres/pgWorkflowStepRepository.ts";
import { createPgWorkflowInstanceRepository } from "../repositories/postgres/pgWorkflowInstanceRepository.ts";
import { createPgWorkflowTaskRepository } from "../repositories/postgres/pgWorkflowTaskRepository.ts";
import { createPgWorkflowTaskCandidateRepository } from "../repositories/postgres/pgWorkflowTaskCandidateRepository.ts";
import { createPgWorkflowEventRepository } from "../repositories/postgres/pgWorkflowEventRepository.ts";
import { createPgWorkflowTransaction } from "../repositories/postgres/pgWorkflowTransaction.ts";
import { createSystemActionRegistry, type SystemActionRegistry } from "../domain/systemActionRegistry.ts";
import { createInstanceEngine, type InstanceEngine } from "../services/instanceEngine.ts";
import { createDefinitionService, type DefinitionService } from "../services/definitionService.ts";
import { createInstanceService, type InstanceService } from "../services/instanceService.ts";
import { createTaskService, type TaskService } from "../services/taskService.ts";
import { createEscalationService, type EscalationService } from "../services/escalationService.ts";

export interface WorkflowContainer {
  users: UserRepository;
  organisation: OrganisationRepository;
  sessions: SessionService;
  rbac: RbacService;
  audit: AuditService;
  orgContainer: OrganisationContainer;
  actorResolution: ActorResolutionService;
  systemActions: SystemActionRegistry;
  engine: InstanceEngine;
  definitions: DefinitionService;
  instances: InstanceService;
  tasks: TaskService;
  escalations: EscalationService;
  /** Null when the transitional SVEGIP bridge is not configured for this deployment — see identity/src/services/svegipSessionBridge.ts. */
  svegipBridgeSecret: string | null;
  /** Origins trusted for cookie-authenticated state-changing requests — see config/trustedOrigins.ts. */
  trustedOrigins: Set<string>;
}

export async function createWorkflowContainer(db: DatabaseProvider, opts?: { secrets?: SecretsProvider }): Promise<WorkflowContainer> {
  const secrets = opts?.secrets ?? createEnvSecretsProvider();
  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const sessionRepo = createPgSessionRepository(db);
  const auditRepo = createPgAuditRepository(db);

  const sessions = createSessionService({ sessions: sessionRepo, users, transactions: createPgUserSecurityTransaction(db) });
  const rbac = createRbacService({ rbac: rbacRepo, organisation, users });
  const audit = createAuditService({ audit: auditRepo });
  const actorResolution = createActorResolutionService({ rbac: rbacRepo, rbacService: rbac, users });

  // Organisation is consumed as a whole container, the same
  // dependency-direction convention platform-services/hrms established —
  // Workflow never reaches into Organisation's repositories directly,
  // only its service-level contract (assignments.resolveDirectManagerUserId).
  const orgContainer = await createOrganisationContainer(db);

  const definitionRepo = createPgWorkflowDefinitionRepository(db);
  const versionRepo = createPgWorkflowDefinitionVersionRepository(db);
  const stepRepo = createPgWorkflowStepRepository(db);
  const instanceRepo = createPgWorkflowInstanceRepository(db);
  const taskRepo = createPgWorkflowTaskRepository(db);
  const taskCandidateRepo = createPgWorkflowTaskCandidateRepository(db);
  const eventRepo = createPgWorkflowEventRepository(db);
  const transactions = createPgWorkflowTransaction(db);

  const systemActions = createSystemActionRegistry();

  const engine = createInstanceEngine({ orgAssignments: orgContainer.assignments, actorResolution, systemActions });

  const definitions = createDefinitionService({ definitions: definitionRepo, versions: versionRepo, steps: stepRepo, rbac, audit, transactions, systemActions });
  const instances = createInstanceService({ definitions: definitionRepo, versions: versionRepo, steps: stepRepo, instances: instanceRepo, tasks: taskRepo, events: eventRepo, organisation, users, rbac, audit, transactions, engine });
  const tasks = createTaskService({ instances: instanceRepo, steps: stepRepo, tasks: taskRepo, taskCandidates: taskCandidateRepo, rbac, users, audit, transactions, engine });
  const escalations = createEscalationService({ tasks: taskRepo, instances: instanceRepo, users, orgAssignments: orgContainer.assignments, rbac, transactions });

  const svegipBridgeSecret = await loadSvegipBridgeSecret(secrets);
  const trustedOrigins = loadTrustedOrigins();

  return { users, organisation, sessions, rbac, audit, orgContainer, actorResolution, systemActions, engine, definitions, instances, tasks, escalations, svegipBridgeSecret, trustedOrigins };
}
