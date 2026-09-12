/**
 * Shared in-memory wiring for HRMS unit tests — mirrors platform-services/
 * organisation's test/unit setup pattern exactly, extended with
 * Organisation's own in-memory services (HRMS depends on Organisation for
 * employment-change/offboarding completion and the manager/"team"
 * read.team fallback).
 */
import { randomUUID } from "node:crypto";
import { createInMemoryStore as createIdentityInMemoryStore } from "../../../identity/src/repositories/memory/inMemoryStore.ts";
import { createInMemoryRbacRepository } from "../../../identity/src/repositories/memory/inMemoryRbacRepository.ts";
import { createInMemoryOrganisationRepository } from "../../../identity/src/repositories/memory/inMemoryOrganisationRepository.ts";
import { createInMemoryAuditRepository } from "../../../identity/src/repositories/memory/inMemoryAuditRepository.ts";
import { createInMemoryUserRepository } from "../../../identity/src/repositories/memory/inMemoryUserRepository.ts";
import { createRbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";

import { createInMemoryStore as createOrgInMemoryStore } from "../../../organisation/src/repositories/memory/inMemoryStore.ts";
import { createInMemoryOrgStructureRepository } from "../../../organisation/src/repositories/memory/inMemoryOrgStructureRepository.ts";
import { createInMemoryEmployeeRepository } from "../../../organisation/src/repositories/memory/inMemoryEmployeeRepository.ts";
import { createInMemoryEmploymentAssignmentRepository } from "../../../organisation/src/repositories/memory/inMemoryEmploymentAssignmentRepository.ts";
import { createInMemoryEmployeeCreationTransaction } from "../../../organisation/src/repositories/memory/inMemoryEmployeeCreationTransaction.ts";
import { createInMemoryEmploymentAssignmentTransaction } from "../../../organisation/src/repositories/memory/inMemoryEmploymentAssignmentTransaction.ts";
import { createEmployeeService, PERMISSIONS as ORG_PERMISSIONS } from "../../../organisation/src/services/employeeService.ts";
import { createEmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";

import { createInMemoryStore as createHrmsInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryLifecycleCaseRepository } from "../../src/repositories/memory/inMemoryLifecycleCaseRepository.ts";
import { createInMemoryLifecycleEventRepository } from "../../src/repositories/memory/inMemoryLifecycleEventRepository.ts";
import { createInMemoryLifecycleMilestoneRepository } from "../../src/repositories/memory/inMemoryLifecycleMilestoneRepository.ts";
import { createInMemoryProbationReviewRepository } from "../../src/repositories/memory/inMemoryProbationReviewRepository.ts";
import { createInMemoryLifecycleTransaction } from "../../src/repositories/memory/inMemoryLifecycleTransaction.ts";
import { createLifecycleCaseService } from "../../src/services/lifecycleCaseService.ts";
import { createOnboardingService } from "../../src/services/onboardingService.ts";
import { createProbationService } from "../../src/services/probationService.ts";
import { createEmploymentChangeService } from "../../src/services/employmentChangeService.ts";
import { createOffboardingService } from "../../src/services/offboardingService.ts";

export const ADMIN = randomUUID();

export async function setup() {
  const identityStore = createIdentityInMemoryStore();
  const rbacRepo = createInMemoryRbacRepository(identityStore);
  const organisation = createInMemoryOrganisationRepository(identityStore);
  const auditRepo = createInMemoryAuditRepository(identityStore);
  const users = createInMemoryUserRepository(identityStore);
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });

  const orgStore = createOrgInMemoryStore();
  const orgStructure = createInMemoryOrgStructureRepository(orgStore);
  const employeeRepo = createInMemoryEmployeeRepository(orgStore);
  const assignmentRepo = createInMemoryEmploymentAssignmentRepository(orgStore);
  const employeeCreation = createInMemoryEmployeeCreationTransaction({ employees: employeeRepo, assignments: assignmentRepo });
  const assignmentTransactions = createInMemoryEmploymentAssignmentTransaction({ assignments: assignmentRepo });
  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, employeeCreation });
  const orgAssignments = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, transactions: assignmentTransactions });

  const hrmsStore = createHrmsInMemoryStore();
  const caseRepo = createInMemoryLifecycleCaseRepository(hrmsStore);
  const eventRepo = createInMemoryLifecycleEventRepository(hrmsStore);
  const milestoneRepo = createInMemoryLifecycleMilestoneRepository(hrmsStore);
  const reviewRepo = createInMemoryProbationReviewRepository(hrmsStore);
  const transactions = createInMemoryLifecycleTransaction({ cases: caseRepo, events: eventRepo, milestones: milestoneRepo, reviews: reviewRepo });

  const lifecycle = createLifecycleCaseService({ cases: caseRepo, events: eventRepo, milestones: milestoneRepo, organisation, users, rbac, audit, transactions, assignments: orgAssignments });
  const onboarding = createOnboardingService({ lifecycle });
  const probation = createProbationService({ lifecycle, cases: caseRepo, reviews: reviewRepo, organisation, rbac, audit });
  const employmentChange = createEmploymentChangeService({ lifecycle, cases: caseRepo, organisation, rbac, orgAssignments });
  const offboarding = createOffboardingService({ lifecycle, cases: caseRepo, organisation, rbac, orgAssignments });

  const [sg, my, skl] = identityStore.legalEntities;
  return { identityStore, rbacRepo, organisation, users, employees, orgAssignments, lifecycle, onboarding, probation, employmentChange, offboarding, eventRepo, sg: sg!, my: my!, skl: skl! };
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

/** Hires a fictional test employee via Organisation's own service, granting a transient HR user just enough org permission to do so. Never a real SVE employee. */
export async function hireFictionalEmployee(
  deps: Awaited<ReturnType<typeof setup>>,
  legalEntityId: string,
  legalName: string,
) {
  const orgHr = randomUUID();
  await grantRole(deps.rbacRepo, orgHr, [{ key: ORG_PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  return deps.employees.createEmployee(actor(orgHr), {
    legalName,
    employmentCountry: "MY",
    initialAssignment: { legalEntityId, employmentType: "full_time", startDate: "2026-01-01" },
  });
}
