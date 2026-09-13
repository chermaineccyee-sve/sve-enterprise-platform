/**
 * Shared in-memory wiring for Workflow unit tests — mirrors
 * platform-services/hrms's test/unit setup pattern, extended with
 * Organisation's own in-memory services (Workflow depends on Organisation
 * for MANAGER routing/escalation).
 */
import { randomUUID } from "node:crypto";
import { createInMemoryStore as createIdentityInMemoryStore } from "../../../identity/src/repositories/memory/inMemoryStore.ts";
import { createInMemoryRbacRepository } from "../../../identity/src/repositories/memory/inMemoryRbacRepository.ts";
import { createInMemoryOrganisationRepository } from "../../../identity/src/repositories/memory/inMemoryOrganisationRepository.ts";
import { createInMemoryAuditRepository } from "../../../identity/src/repositories/memory/inMemoryAuditRepository.ts";
import { createInMemoryUserRepository } from "../../../identity/src/repositories/memory/inMemoryUserRepository.ts";
import { createRbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";
import { createActorResolutionService } from "../../../identity/src/services/actorResolutionService.ts";

import { createInMemoryStore as createOrgInMemoryStore } from "../../../organisation/src/repositories/memory/inMemoryStore.ts";
import { createInMemoryOrgStructureRepository } from "../../../organisation/src/repositories/memory/inMemoryOrgStructureRepository.ts";
import { createInMemoryEmployeeRepository } from "../../../organisation/src/repositories/memory/inMemoryEmployeeRepository.ts";
import { createInMemoryEmploymentAssignmentRepository } from "../../../organisation/src/repositories/memory/inMemoryEmploymentAssignmentRepository.ts";
import { createInMemoryEmployeeCreationTransaction } from "../../../organisation/src/repositories/memory/inMemoryEmployeeCreationTransaction.ts";
import { createInMemoryEmploymentAssignmentTransaction } from "../../../organisation/src/repositories/memory/inMemoryEmploymentAssignmentTransaction.ts";
import { createEmployeeService, PERMISSIONS as ORG_PERMISSIONS } from "../../../organisation/src/services/employeeService.ts";
import { createEmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";

import { createInMemoryStore as createWorkflowInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryWorkflowDefinitionRepository } from "../../src/repositories/memory/inMemoryWorkflowDefinitionRepository.ts";
import { createInMemoryWorkflowDefinitionVersionRepository } from "../../src/repositories/memory/inMemoryWorkflowDefinitionVersionRepository.ts";
import { createInMemoryWorkflowStepRepository } from "../../src/repositories/memory/inMemoryWorkflowStepRepository.ts";
import { createInMemoryWorkflowInstanceRepository } from "../../src/repositories/memory/inMemoryWorkflowInstanceRepository.ts";
import { createInMemoryWorkflowTaskRepository } from "../../src/repositories/memory/inMemoryWorkflowTaskRepository.ts";
import { createInMemoryWorkflowDecisionRepository } from "../../src/repositories/memory/inMemoryWorkflowDecisionRepository.ts";
import { createInMemoryWorkflowEventRepository } from "../../src/repositories/memory/inMemoryWorkflowEventRepository.ts";
import { createInMemoryWorkflowSystemActionExecutionRepository } from "../../src/repositories/memory/inMemoryWorkflowSystemActionExecutionRepository.ts";
import { createInMemoryWorkflowTaskCandidateRepository } from "../../src/repositories/memory/inMemoryWorkflowTaskCandidateRepository.ts";
import { createInMemoryWorkflowTransaction } from "../../src/repositories/memory/inMemoryWorkflowTransaction.ts";
import { createSystemActionRegistry } from "../../src/domain/systemActionRegistry.ts";
import { createInstanceEngine } from "../../src/services/instanceEngine.ts";
import { createDefinitionService } from "../../src/services/definitionService.ts";
import { createInstanceService } from "../../src/services/instanceService.ts";
import { createTaskService } from "../../src/services/taskService.ts";
import { createEscalationService } from "../../src/services/escalationService.ts";
import { PERMISSIONS } from "../../src/services/access.ts";

export const ADMIN = randomUUID();

export async function setup() {
  const identityStore = createIdentityInMemoryStore();
  const rbacRepo = createInMemoryRbacRepository(identityStore);
  const organisation = createInMemoryOrganisationRepository(identityStore);
  const auditRepo = createInMemoryAuditRepository(identityStore);
  const users = createInMemoryUserRepository(identityStore);
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });
  const actorResolution = createActorResolutionService({ rbac: rbacRepo, rbacService: rbac, users });

  const orgStore = createOrgInMemoryStore();
  const orgStructure = createInMemoryOrgStructureRepository(orgStore);
  const employeeRepo = createInMemoryEmployeeRepository(orgStore);
  const assignmentRepo = createInMemoryEmploymentAssignmentRepository(orgStore);
  const employeeCreation = createInMemoryEmployeeCreationTransaction({ employees: employeeRepo, assignments: assignmentRepo });
  const assignmentTransactions = createInMemoryEmploymentAssignmentTransaction({ assignments: assignmentRepo });
  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, employeeCreation });
  const orgAssignments = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, transactions: assignmentTransactions });

  const wfStore = createWorkflowInMemoryStore();
  const definitionRepo = createInMemoryWorkflowDefinitionRepository(wfStore);
  const versionRepo = createInMemoryWorkflowDefinitionVersionRepository(wfStore);
  const stepRepo = createInMemoryWorkflowStepRepository(wfStore);
  const instanceRepo = createInMemoryWorkflowInstanceRepository(wfStore);
  const taskRepo = createInMemoryWorkflowTaskRepository(wfStore);
  const decisionRepo = createInMemoryWorkflowDecisionRepository(wfStore);
  const eventRepo = createInMemoryWorkflowEventRepository(wfStore);
  const systemActionExecutionRepo = createInMemoryWorkflowSystemActionExecutionRepository(wfStore);
  const taskCandidateRepo = createInMemoryWorkflowTaskCandidateRepository(wfStore);
  const transactions = createInMemoryWorkflowTransaction({ definitions: definitionRepo, versions: versionRepo, steps: stepRepo, instances: instanceRepo, tasks: taskRepo, taskCandidates: taskCandidateRepo, decisions: decisionRepo, events: eventRepo, systemActions: systemActionExecutionRepo });

  const systemActions = createSystemActionRegistry();
  const engine = createInstanceEngine({ orgAssignments, actorResolution, systemActions });

  const definitions = createDefinitionService({ definitions: definitionRepo, versions: versionRepo, steps: stepRepo, rbac, audit, transactions, systemActions });
  const instances = createInstanceService({ definitions: definitionRepo, versions: versionRepo, steps: stepRepo, instances: instanceRepo, tasks: taskRepo, events: eventRepo, organisation, users, rbac, audit, transactions, engine });
  const tasks = createTaskService({ instances: instanceRepo, steps: stepRepo, tasks: taskRepo, taskCandidates: taskCandidateRepo, rbac, audit, transactions, engine });
  const escalations = createEscalationService({ tasks: taskRepo, instances: instanceRepo, users, orgAssignments, rbac, transactions });

  const [sg, my, skl] = identityStore.legalEntities;
  return { identityStore, rbacRepo, organisation, users, employees, orgAssignments, actorResolution, taskCandidateRepo, systemActions, definitions, instances, tasks, escalations, eventRepo, taskRepo, wfStore, sg: sg!, my: my!, skl: skl! };
}

export async function grantRole(
  rbacRepo: ReturnType<typeof createInMemoryRbacRepository>,
  userId: string,
  permissions: { key: string; maxClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PRIVILEGED" }[],
  entityGrant: { scopeType: "group" } | { scopeType: "legal_entity"; legalEntityId: string },
) {
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: "Test role" });
  for (const p of permissions) {
    const existing = await rbacRepo.findPermissionByKey(p.key);
    const permission = existing ?? (await rbacRepo.createPermission({ key: p.key, maxClassification: p.maxClassification }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId, roleId: role.id, grantedBy: ADMIN });
  await rbacRepo.grantEntityAccess({ userId, ...entityGrant, grantedBy: ADMIN } as Parameters<typeof rbacRepo.grantEntityAccess>[0]);
}

export function actor(userId: string) {
  return { userId, email: `${userId}@example.test` };
}

/** Grants a user every Workflow permission this test suite needs, group-wide. */
export async function grantFullWorkflowAccess(deps: Awaited<ReturnType<typeof setup>>, userId: string) {
  await grantRole(
    deps.rbacRepo,
    userId,
    [
      { key: PERMISSIONS.DEFINITION_READ, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.DEFINITION_CREATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.DEFINITION_UPDATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.DEFINITION_PUBLISH, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.DEFINITION_RETIRE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.INSTANCE_START, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.INSTANCE_READ, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.INSTANCE_CANCEL, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.TASK_REASSIGN, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.APPROVAL_DECIDE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.OPERATION_PROCESS_ESCALATIONS, maxClassification: "CONFIDENTIAL" },
    ],
    { scopeType: "group" },
  );
}

/** Hires a fictional test employee via Organisation's own service. Never a real SVE employee. */
export async function hireFictionalEmployee(deps: Awaited<ReturnType<typeof setup>>, legalEntityId: string, legalName: string) {
  const orgHr = randomUUID();
  await grantRole(deps.rbacRepo, orgHr, [{ key: ORG_PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  return deps.employees.createEmployee(actor(orgHr), {
    legalName,
    employmentCountry: "MY",
    initialAssignment: { legalEntityId, employmentType: "full_time", startDate: "2026-01-01" },
  });
}

/** Creates and publishes a minimal single-step APPROVAL definition (USER assignment mode), ready for startWorkflow tests. */
export async function publishSimpleApprovalDefinition(deps: Awaited<ReturnType<typeof setup>>, adminUserId: string, key: string, options?: { allowSelfApproval?: boolean; assignmentMode?: "USER" | "ROLE" | "MANAGER"; assignedPermissionKey?: string }) {
  const { definition, version } = await deps.definitions.createDefinition(actor(adminUserId), { key, name: key });
  await deps.definitions.addStep(actor(adminUserId), version.id, {
    sequenceNumber: 1,
    stepType: "APPROVAL",
    name: "Approve",
    assignmentMode: options?.assignmentMode ?? "USER",
    assignedPermissionKey: options?.assignedPermissionKey ?? null,
    allowSelfApproval: options?.allowSelfApproval ?? false,
    permittedDecisions: ["APPROVE", "REJECT"],
  });
  const published = await deps.definitions.publish(actor(adminUserId), version.id);
  return { definition, version: published };
}
