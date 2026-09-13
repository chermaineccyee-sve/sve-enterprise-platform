import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PERMISSIONS } from "../../src/services/access.ts";
import { setup, grantRole, actor, hireFictionalEmployee } from "./testSetup.ts";

const FULL_HR_PERMS = [
  { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_OFFBOARDING, maxClassification: "CONFIDENTIAL" as const },
];

test("a successful employment change creates the authoritative Organisation assignment and completes the case", async () => {
  const deps = await setup();
  const hrUser = (await deps.users.createUser({ email: `hr.${randomUUID()}@example.test`, accountType: "employee" })).id;
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  await grantRole(deps.rbacRepo, hrUser, [{ key: "employee_master.manage_assignment", maxClassification: "CONFIDENTIAL" }, { key: "employee_master.read.restricted", maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Employment Change Test");

  const created = await deps.employmentChange.createChangeCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser, changeType: "department_transfer" });
  assert.equal(created.status, "IN_PROGRESS");

  const result = await deps.employmentChange.completeChange(actor(hrUser), created.id, {
    legalEntityId: deps.my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-06-01",
    effectiveFrom: "2026-06-01",
    changeReason: "Fictional department transfer",
  });

  assert.equal(result.case.status, "COMPLETED");
  assert.equal(result.case.resultingAssignmentId, result.assignment.id, "the case must reference the real Organisation-created assignment");

  const orgHistory = await deps.orgAssignments.listAssignments(actor(hrUser), employee.id);
  assert.ok(orgHistory.some((a) => a.id === result.assignment.id), "the authoritative assignment must actually exist in Organisation's own history");
});

test("an employment-change case cannot complete if the Employee Master transition fails, and is never falsely marked completed", async () => {
  const deps = await setup();
  const hrUser = (await deps.users.createUser({ email: `hr.${randomUUID()}@example.test`, accountType: "employee" })).id;
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  await grantRole(deps.rbacRepo, hrUser, [{ key: "employee_master.manage_assignment", maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Change Failure Test");
  const created = await deps.employmentChange.createChangeCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser, changeType: "position_change" });

  // An invalid legalEntityId forces Organisation's own createAssignment to fail.
  await assert.rejects(() =>
    deps.employmentChange.completeChange(actor(hrUser), created.id, {
      legalEntityId: randomUUID(),
      employmentType: "full_time",
      status: "ACTIVE",
      startDate: "2026-06-01",
      effectiveFrom: "2026-06-01",
    }),
  );

  const stillOpen = await deps.lifecycle.getCase(actor(hrUser), created.id);
  assert.equal(stillOpen.case.status, "IN_PROGRESS", "the case must remain open, never falsely COMPLETED, when the authoritative change failed");
  assert.equal(stillOpen.case.resultingAssignmentId, null);
});

test("a successful offboarding ends the authoritative Organisation assignment and completes the case", async () => {
  const deps = await setup();
  const hrUser = (await deps.users.createUser({ email: `hr.${randomUUID()}@example.test`, accountType: "employee" })).id;
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  await grantRole(deps.rbacRepo, hrUser, [{ key: "employee_master.manage_assignment", maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Offboarding Test");
  const linkedIdentityUser = await deps.users.createUser({ email: `offboarding.${randomUUID()}@example.test`, accountType: "employee" });
  await deps.users.linkEmployee({ userId: linkedIdentityUser.id, employeeId: employee.id, linkedBy: hrUser });

  const created = await deps.offboarding.createOffboardingCase(actor(hrUser), {
    employeeId: employee.id,
    legalEntityId: deps.my.id,
    hrOwnerUserId: hrUser,
    separationType: "resignation",
    noticeDate: "2026-05-01",
    intendedLastWorkingDate: "2026-06-01",
    clearanceMilestones: ["access_removal", "asset_return"],
  });
  assert.equal(created.status, "IN_PROGRESS");

  const result = await deps.offboarding.completeOffboarding(actor(hrUser), created.id, { endDate: "2026-06-01", status: "RESIGNED", changeReason: "Fictional resignation" });
  assert.equal(result.case.status, "COMPLETED");
  assert.equal(result.case.outcome, "RESIGNED");
  assert.equal(result.case.effectiveDate, "2026-06-01");

  const events = await deps.eventRepo.listByCase(created.id);
  assert.ok(events.some((e) => e.eventType === "separation_effective"));
  assert.ok(events.some((e) => e.eventType === "identity_deactivation_requested"), "offboarding must request Identity deactivation as an event, never perform it directly");

  const identityUser = await deps.users.findById(linkedIdentityUser.id);
  assert.ok(identityUser, "completing offboarding must never delete the departing employee's linked Identity user record");
  assert.equal(identityUser!.status, "active", "completing offboarding must never itself disable the Identity account — only an event requesting that follow-up action is recorded");
});

test("an offboarding case cannot falsely complete if the Employee Master end-assignment fails", async () => {
  const deps = await setup();
  const hrUser = (await deps.users.createUser({ email: `hr.${randomUUID()}@example.test`, accountType: "employee" })).id;
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Offboarding Failure Test");
  const created = await deps.offboarding.createOffboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser, separationType: "termination" });

  // hrUser lacks employee_master.manage_assignment, so Organisation's own endAssignment must reject this.
  await assert.rejects(() => deps.offboarding.completeOffboarding(actor(hrUser), created.id, { endDate: "2026-06-01", status: "TERMINATED" }));

  const stillOpen = await deps.lifecycle.getCase(actor(hrUser), created.id);
  assert.equal(stillOpen.case.status, "IN_PROGRESS");
});
