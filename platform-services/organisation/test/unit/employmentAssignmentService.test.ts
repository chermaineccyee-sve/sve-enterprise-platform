import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInMemoryStore as createIdentityInMemoryStore } from "../../../identity/src/repositories/memory/inMemoryStore.ts";
import { createInMemoryRbacRepository } from "../../../identity/src/repositories/memory/inMemoryRbacRepository.ts";
import { createInMemoryOrganisationRepository } from "../../../identity/src/repositories/memory/inMemoryOrganisationRepository.ts";
import { createInMemoryAuditRepository } from "../../../identity/src/repositories/memory/inMemoryAuditRepository.ts";
import { createInMemoryUserRepository } from "../../../identity/src/repositories/memory/inMemoryUserRepository.ts";
import { createRbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryOrgStructureRepository } from "../../src/repositories/memory/inMemoryOrgStructureRepository.ts";
import { createInMemoryEmployeeRepository } from "../../src/repositories/memory/inMemoryEmployeeRepository.ts";
import { createInMemoryEmploymentAssignmentRepository } from "../../src/repositories/memory/inMemoryEmploymentAssignmentRepository.ts";
import { createInMemoryEmployeeCreationTransaction } from "../../src/repositories/memory/inMemoryEmployeeCreationTransaction.ts";
import { createInMemoryEmploymentAssignmentTransaction } from "../../src/repositories/memory/inMemoryEmploymentAssignmentTransaction.ts";
import { createEmployeeService, PERMISSIONS } from "../../src/services/employeeService.ts";
import { createEmploymentAssignmentService } from "../../src/services/employmentAssignmentService.ts";
import { ValidationError } from "../../src/domain/errors.ts";

const ADMIN = randomUUID();

async function setup() {
  const identityStore = createIdentityInMemoryStore();
  const store = createInMemoryStore();
  const rbacRepo = createInMemoryRbacRepository(identityStore);
  const organisation = createInMemoryOrganisationRepository(identityStore);
  const auditRepo = createInMemoryAuditRepository(identityStore);
  const users = createInMemoryUserRepository(identityStore);
  const orgStructure = createInMemoryOrgStructureRepository(store);
  const employeeRepo = createInMemoryEmployeeRepository(store);
  const assignmentRepo = createInMemoryEmploymentAssignmentRepository(store);

  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });
  const employeeCreation = createInMemoryEmployeeCreationTransaction({ employees: employeeRepo, assignments: assignmentRepo });
  const transactions = createInMemoryEmploymentAssignmentTransaction({ assignments: assignmentRepo });
  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, employeeCreation });
  const assignments = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, transactions });

  const [sg, my] = identityStore.legalEntities;
  return { identityStore, store, rbacRepo, organisation, users, employees, assignments, assignmentRepo, orgStructure, sg: sg!, my: my! };
}

async function grantRole(
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

function actor(userId: string) {
  return { userId, email: `${userId}@example.test` };
}

const FULL_PERMS = [
  { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_ASSIGNMENT, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_REPORTING, maxClassification: "CONFIDENTIAL" as const },
];

const baseHire = (legalEntityId: string, departmentId?: string, positionId?: string) => ({
  legalName: "Fictional Assignment Test Employee",
  employmentCountry: "MY",
  initialAssignment: { legalEntityId, departmentId, positionId, employmentType: "full_time", startDate: "2026-01-01" },
});

test("department assignment and position assignment are recorded on the initial hire", async () => {
  const { employees, rbacRepo, orgStructure, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "legal_entity", legalEntityId: my.id });
  const dept = await orgStructure.createDepartment({ legalEntityId: my.id, name: "Engineering", code: "ENG" });
  const position = await orgStructure.createPosition({ departmentId: dept.id, title: "Software Engineer" });

  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id, dept.id, position.id));
  const view = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(view.currentAssignment?.departmentId, dept.id);
  assert.equal(view.currentAssignment?.positionId, position.id);
});

test("a transfer creates a new effective-dated assignment row rather than overwriting the previous one, and history is preserved", async () => {
  const { employees, assignments, rbacRepo, my, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));

  const original = (await assignments.listAssignments(actor(hrUser), employee.id))[0]!;
  const transferred = await assignments.createAssignment(actor(hrUser), employee.id, {
    legalEntityId: sg.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2027-01-01",
    effectiveFrom: "2027-01-01",
    changeReason: "Transfer to Singapore",
  });

  const history = await assignments.listAssignments(actor(hrUser), employee.id);
  assert.equal(history.length, 2, "the original assignment row must still exist — transfer creates history, not an overwrite");

  const closedOriginal = history.find((a) => a.id === original.id)!;
  assert.equal(closedOriginal.effectiveTo, "2026-12-31", "the prior assignment's effective_to closes the day before the new one starts");
  assert.equal(closedOriginal.legalEntityId, my.id, "the historical row's own fields are never rewritten");

  assert.equal(transferred.effectiveTo, null);
  assert.equal(transferred.legalEntityId, sg.id);
});

test("an ended/inactive assignment is not returned as the current primary assignment", async () => {
  const { employees, assignments, rbacRepo, my, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  await assignments.createAssignment(actor(hrUser), employee.id, {
    legalEntityId: sg.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2027-01-01",
    effectiveFrom: "2027-01-01",
  });

  const view = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(view.currentAssignment?.legalEntityId, sg.id, "only the newer assignment is current");
  assert.notEqual(view.currentAssignment?.legalEntityId, my.id);
});

test("a transfer requires manage_assignment authority over BOTH the origin and destination entity", async () => {
  const { employees, assignments, rbacRepo, my, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));

  const myOnlyHr = randomUUID();
  await grantRole(rbacRepo, myOnlyHr, [{ key: PERMISSIONS.MANAGE_ASSIGNMENT, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });

  await assert.rejects(
    () =>
      assignments.createAssignment(actor(myOnlyHr), employee.id, {
        legalEntityId: sg.id,
        employmentType: "full_time",
        status: "ACTIVE",
        startDate: "2027-01-01",
        effectiveFrom: "2027-01-01",
      }),
    ForbiddenError,
    "MY-only manage_assignment authority must not be sufficient to transfer someone INTO Singapore",
  );
});

test("self-reporting is rejected: an employee cannot report to their own (about-to-be-superseded) assignment", async () => {
  const { employees, assignments, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const currentAssignment = (await assignments.listAssignments(actor(hrUser), employee.id))[0]!;

  await assert.rejects(
    () =>
      assignments.createAssignment(actor(hrUser), employee.id, {
        legalEntityId: my.id,
        employmentType: "full_time",
        status: "ACTIVE",
        startDate: "2027-01-01",
        effectiveFrom: "2027-01-01",
        reportsToAssignmentId: currentAssignment.id,
      }),
    ValidationError,
  );
});

test("a circular reporting relationship (A -> B -> A) is detected and rejected", async () => {
  const { employees, assignments, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });

  const employeeA = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const employeeB = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const assignmentA = (await assignments.listAssignments(actor(hrUser), employeeA.id))[0]!;

  // B reports to A.
  const assignmentB = await assignments.createAssignment(actor(hrUser), employeeB.id, {
    legalEntityId: my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-06-01",
    effectiveFrom: "2026-06-01",
    reportsToAssignmentId: assignmentA.id,
  });

  // Now attempt: A reports to B — a two-hop cycle back to A.
  await assert.rejects(
    () =>
      assignments.createAssignment(actor(hrUser), employeeA.id, {
        legalEntityId: my.id,
        employmentType: "full_time",
        status: "ACTIVE",
        startDate: "2027-01-01",
        effectiveFrom: "2027-01-01",
        reportsToAssignmentId: assignmentB.id,
      }),
    ValidationError,
    "A -> B -> A must be rejected as a circular reporting relationship",
  );
});

test("a valid (non-circular) reporting-line assignment succeeds", async () => {
  const { employees, assignments, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });

  const manager = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const managerAssignment = (await assignments.listAssignments(actor(hrUser), manager.id))[0]!;

  const report = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const reportAssignment = await assignments.createAssignment(actor(hrUser), report.id, {
    legalEntityId: my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-06-01",
    effectiveFrom: "2026-06-01",
    reportsToAssignmentId: managerAssignment.id,
  });
  assert.equal(reportAssignment.reportsToAssignmentId, managerAssignment.id);
});

test("reporting-line assignment requires the manage_reporting permission, distinct from manage_assignment alone", async () => {
  const { employees, assignments, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const manager = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const managerAssignment = (await assignments.listAssignments(actor(hrUser), manager.id))[0]!;
  const report = await employees.createEmployee(actor(hrUser), baseHire(my.id));

  const noReportingPermUser = randomUUID();
  await grantRole(rbacRepo, noReportingPermUser, [{ key: PERMISSIONS.MANAGE_ASSIGNMENT, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });

  await assert.rejects(
    () =>
      assignments.createAssignment(actor(noReportingPermUser), report.id, {
        legalEntityId: my.id,
        employmentType: "full_time",
        status: "ACTIVE",
        startDate: "2026-06-01",
        effectiveFrom: "2026-06-01",
        reportsToAssignmentId: managerAssignment.id,
      }),
    ForbiddenError,
  );
});

test("ending employment (termination) closes the current assignment with an end date and no successor row", async () => {
  const { employees, assignments, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));

  const ended = await assignments.endAssignment(actor(hrUser), employee.id, { endDate: "2026-12-31", status: "TERMINATED" });
  assert.equal(ended.endDate, "2026-12-31");
  assert.equal(ended.effectiveTo, "2026-12-31");
  assert.equal(ended.status, "TERMINATED", "the closed assignment row's own status must reflect the terminal status for that historical period, not the prior in-progress status");

  const history = await assignments.listAssignments(actor(hrUser), employee.id);
  assert.equal(history.length, 1, "no successor row is created on a true end");

  const updatedEmployee = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(updatedEmployee.employee.status, "TERMINATED");
});

test("multi-employment readiness: a secondary (non-primary) assignment can coexist with the primary one", async () => {
  const { employees, assignments, rbacRepo, my, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));

  const secondment = await assignments.createAssignment(actor(hrUser), employee.id, {
    legalEntityId: sg.id,
    employmentType: "secondment",
    status: "ACTIVE",
    isPrimary: false,
    startDate: "2026-06-01",
    effectiveFrom: "2026-06-01",
  });
  assert.equal(secondment.isPrimary, false);

  const history = await assignments.listAssignments(actor(hrUser), employee.id);
  assert.equal(history.length, 2, "the primary assignment must still exist alongside the secondment");
  const primaryStillOpen = history.find((a) => a.isPrimary);
  assert.equal(primaryStillOpen?.effectiveTo, null, "the primary assignment is untouched by an is_primary=false secondment");
});
