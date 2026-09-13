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
import { ValidationError, NotFoundError } from "../../src/domain/errors.ts";

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

  const rbac = createRbacService({ rbac: rbacRepo, organisation, users });
  const audit = createAuditService({ audit: auditRepo });
  const employeeCreation = createInMemoryEmployeeCreationTransaction({ employees: employeeRepo, assignments: assignmentRepo });
  const transactions = createInMemoryEmploymentAssignmentTransaction({ assignments: assignmentRepo });
  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, employeeCreation });
  const assignments = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, transactions });

  const [sg, my, skl] = identityStore.legalEntities;
  return { identityStore, store, rbacRepo, organisation, users, employees, assignments, assignmentRepo, orgStructure, sg: sg!, my: my!, skl: skl! };
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

/** Relative to the actual wall clock, so these tests stay correct regardless of when they run — never a hardcoded date that could drift into the past or future. */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
  const transferDate = daysFromToday(-30);
  await assignments.createAssignment(actor(hrUser), employee.id, {
    legalEntityId: sg.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: transferDate,
    effectiveFrom: transferDate,
  });

  const view = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(view.currentAssignment?.legalEntityId, sg.id, "only the newer (already-effective) assignment is current");
  assert.notEqual(view.currentAssignment?.legalEntityId, my.id);
});

// PR #12: findCurrentPrimary() (the "still open in the write pipeline" row)
// is NOT the same thing as "the row whose effective date range covers
// today". A future-dated transition is an intentionally supported feature
// (see employmentAssignmentService.ts's isCurrentAt() docstring) that must
// not be surfaced to any display consumer (Employee Directory, Employee
// Profile, My SVE, /employees/me) before its own effective date arrives.
test("a future-dated transfer does not appear as the current assignment before its effective date", async () => {
  const { employees, assignments, rbacRepo, my, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const futureTransferDate = daysFromToday(90);
  const transferred = await assignments.createAssignment(actor(hrUser), employee.id, {
    legalEntityId: sg.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: futureTransferDate,
    effectiveFrom: futureTransferDate,
    changeReason: "Promotion effective next quarter",
  });

  // findCurrentPrimary would incorrectly say the future row is "current"
  // (it is the still-open pipeline row) — but the employee-facing view
  // must still show the original (Malaysia) assignment as current today.
  const view = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(view.currentAssignment?.legalEntityId, my.id, "the original assignment remains current until the transfer's own effective date");
  assert.notEqual(view.currentAssignment?.id, transferred.id);

  // The full history (used for the Employee Profile's History section)
  // still contains the future row — it is simply not treated as "current".
  const history = await assignments.listAssignments(actor(hrUser), employee.id);
  assert.ok(history.some((a) => a.id === transferred.id), "the future-dated row is still visible in history/future-planning views");
});

test("a historical (closed) assignment does not reappear as current after it has ended, even though the employee's status was originally recorded against it", async () => {
  const { employees, assignments, rbacRepo, my, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const pastTransferDate = daysFromToday(-400);
  await assignments.createAssignment(actor(hrUser), employee.id, {
    legalEntityId: sg.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: pastTransferDate,
    effectiveFrom: pastTransferDate,
  });

  const view = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(view.currentAssignment?.legalEntityId, sg.id, "the long-past transfer is the current assignment, not the original hire");
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

// ---- PR #12: manager/reporting display resolution ----

test("manager display resolves to a human-readable name and title, never a raw assignment/employee id", async () => {
  const { employees, assignments, rbacRepo, orgStructure, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });

  const dept = await orgStructure.createDepartment({ legalEntityId: my.id, name: "Strategy", code: "STRAT" });
  const managerPosition = await orgStructure.createPosition({ departmentId: dept.id, title: "Chief Strategic & Planning Officer" });
  const manager = await employees.createEmployee(actor(hrUser), { ...baseHire(my.id), legalName: "Eric Tang" });
  await assignments.createAssignment(actor(hrUser), manager.id, {
    legalEntityId: my.id,
    positionId: managerPosition.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-01-01",
    effectiveFrom: "2026-01-01",
  });
  const managerAssignment = (await assignments.listAssignments(actor(hrUser), manager.id)).find((a) => a.effectiveTo === null)!;

  const report = await employees.createEmployee(actor(hrUser), { ...baseHire(my.id), legalName: "Jane Tan" });
  await assignments.createAssignment(actor(hrUser), report.id, {
    legalEntityId: my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-02-01",
    effectiveFrom: "2026-02-01",
    reportsToAssignmentId: managerAssignment.id,
  });

  const view = await employees.getEmployee(actor(hrUser), report.id);
  assert.deepEqual(view.managerDisplay, { name: "Eric Tang", title: "Chief Strategic & Planning Officer" }, "managerDisplay carries only a name and title — no id fields of any kind");
});

test("an employee with no manager shows managerDisplay: null (rendered as 'Not assigned'), not an error or a raw id", async () => {
  const { employees, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const view = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(view.managerDisplay, null);
});

test("an employee viewing their own My SVE profile always sees their own manager's name, even with no HR read permission at all", async () => {
  const { employees, assignments, rbacRepo, users, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [...FULL_PERMS, { key: PERMISSIONS.LINK_IDENTITY, maxClassification: "CONFIDENTIAL" as const }], { scopeType: "group" });

  const manager = await employees.createEmployee(actor(hrUser), { ...baseHire(my.id), legalName: "Manager Person" });
  const managerAssignment = (await assignments.listAssignments(actor(hrUser), manager.id))[0]!;
  const report = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  await assignments.createAssignment(actor(hrUser), report.id, {
    legalEntityId: my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-02-01",
    effectiveFrom: "2026-02-01",
    reportsToAssignmentId: managerAssignment.id,
  });

  const selfUser = await users.createUser({ email: "self.report@example.test", accountType: "employee" });
  await employees.linkIdentity(actor(hrUser), report.id, selfUser.id);

  // selfUser has NO role assignments and NO entity access grants at all.
  const myView = await employees.getMyEmployee(actor(selfUser.id));
  assert.equal(myView?.managerDisplay?.name, "Manager Person");
});

test("cross-entity leak guard: a manager at SK Lai & Partners is not named to an HR actor who can see the report but lacks RESTRICTED/.privileged access to SK Lai & Partners", async () => {
  const { employees, assignments, assignmentRepo, rbacRepo, my, skl } = await setup();
  const groupAdmin = randomUUID();
  // Group-wide ordinary-tier access (covers the ordinary-entity report at
  // `my`) plus SK-Lai-scoped privileged-tier access (needed to create and
  // assign the manager at the RESTRICTED-ceiling SK Lai & Partners entity).
  await grantRole(rbacRepo, groupAdmin, FULL_PERMS, { scopeType: "group" });
  await grantRole(rbacRepo, groupAdmin, [{ key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" as const }, { key: PERMISSIONS.MANAGE_ASSIGNMENT_PRIVILEGED, maxClassification: "RESTRICTED" as const }], {
    scopeType: "legal_entity",
    legalEntityId: skl.id,
  });

  const manager = await employees.createEmployee(actor(groupAdmin), { ...baseHire(skl.id), legalName: "SK Lai Partner" });
  const managerAssignment = (await assignmentRepo.list({ employeeId: manager.id, currentOnly: true }))[0]!;
  const report = await employees.createEmployee(actor(groupAdmin), baseHire(my.id));
  await assignments.createAssignment(actor(groupAdmin), report.id, {
    legalEntityId: my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-02-01",
    effectiveFrom: "2026-02-01",
    reportsToAssignmentId: managerAssignment.id,
  });

  // Ordinary MY-scoped HR: can see the (ordinary-entity) report, but has no
  // RESTRICTED/.privileged access into SK Lai & Partners at all.
  const myOnlyHr = randomUUID();
  await grantRole(rbacRepo, myOnlyHr, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });

  const view = await employees.getEmployee(actor(myOnlyHr), report.id);
  assert.equal(view.canReadRestricted, true, "the report's own restricted fields are visible under ordinary MY-scoped access");
  assert.equal(view.managerDisplay, null, "the SK Lai & Partners manager must not be named without RESTRICTED/.privileged access to that entity, even though the report is visible");
});

test("a privileged actor with SK Lai & Partners access does see the manager named correctly", async () => {
  const { employees, assignments, assignmentRepo, rbacRepo, my, skl } = await setup();
  const groupAdmin = randomUUID();
  await grantRole(rbacRepo, groupAdmin, FULL_PERMS, { scopeType: "group" });
  await grantRole(rbacRepo, groupAdmin, [{ key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" as const }, { key: PERMISSIONS.MANAGE_ASSIGNMENT_PRIVILEGED, maxClassification: "RESTRICTED" as const }], {
    scopeType: "legal_entity",
    legalEntityId: skl.id,
  });

  const manager = await employees.createEmployee(actor(groupAdmin), { ...baseHire(skl.id), legalName: "SK Lai Partner" });
  const managerAssignment = (await assignmentRepo.list({ employeeId: manager.id, currentOnly: true }))[0]!;
  const report = await employees.createEmployee(actor(groupAdmin), baseHire(my.id));
  await assignments.createAssignment(actor(groupAdmin), report.id, {
    legalEntityId: my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-02-01",
    effectiveFrom: "2026-02-01",
    reportsToAssignmentId: managerAssignment.id,
  });

  const privilegedHr = randomUUID();
  await grantRole(
    rbacRepo,
    privilegedHr,
    [
      { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ_PRIVILEGED, maxClassification: "PRIVILEGED" },
      { key: PERMISSIONS.READ_RESTRICTED_PRIVILEGED, maxClassification: "PRIVILEGED" },
    ],
    { scopeType: "group" },
  );

  const view = await employees.getEmployee(actor(privilegedHr), report.id);
  assert.equal(view.managerDisplay?.name, "SK Lai Partner");
});

// PR #12 final security verification: the Employee Profile's Employment
// and History tabs are only ever rendered when getEmployee's
// canReadRestricted is true — but that is a FRONTEND convenience, not the
// security boundary. The actual boundary is that listAssignments (backing
// GET /employees/:id/assignments) performs its OWN independent
// READ_RESTRICTED check, so calling the API directly — bypassing the
// frontend's tab logic entirely — must still be denied.
test("listAssignments independently denies a caller without READ_RESTRICTED — the History tab's data source is not merely hidden client-side", async () => {
  const { employees, assignments, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, FULL_PERMS, { scopeType: "group" });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));

  // Base directory access only — enough for getEmployee's canReadRestricted
  // to correctly report false, but explicitly NOT employee_master.read.restricted.
  const baseOnlyUser = randomUUID();
  await grantRole(rbacRepo, baseOnlyUser, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });

  const view = await employees.getEmployee(actor(baseOnlyUser), employee.id);
  assert.equal(view.canReadRestricted, false, "sanity check: this actor is exactly the one the frontend would hide Employment/History tabs from");

  await assert.rejects(
    () => assignments.listAssignments(actor(baseOnlyUser), employee.id),
    NotFoundError,
    "the assignment-history endpoint itself must reject this caller, independent of whatever the frontend chooses to render",
  );
});
