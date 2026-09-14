import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, InvalidTransitionError } from "../../src/domain/errors.ts";
import { PERMISSIONS } from "../../src/services/access.ts";
import { setup, grantRole, actor, hireFictionalEmployee } from "./testSetup.ts";

const FULL_HR_PERMS = [
  { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.READ_DECISION, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_ONBOARDING, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_PROBATION, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.MANAGE_OFFBOARDING, maxClassification: "CONFIDENTIAL" as const },
  { key: PERMISSIONS.COMPLETE, maxClassification: "CONFIDENTIAL" as const },
];

test("an unauthenticated-equivalent caller with no HRMS permission is denied creating a case", async () => {
  const deps = await setup();
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional No-Perm Test");
  const noPermUser = randomUUID();
  await assert.rejects(
    () => deps.onboarding.createOnboardingCase(actor(noPermUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: noPermUser }),
    ForbiddenError,
  );
});

test("an authorised HR user can create a lifecycle case", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Create Test");
  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser });
  assert.match(created.caseNumber, /^HR-\d{6}$/);
  assert.equal(created.status, "IN_PROGRESS");
  assert.equal(created.lifecycleType, "onboarding");
});

test("System Admin (Organisation permissions only, no HRMS permission) cannot read restricted HR lifecycle data", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional SysAdmin Test");
  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser });

  const sysAdmin = randomUUID();
  // Group-wide, but zero HRMS permissions at all — mirrors PR#6's
  // "System Administrator != HR Administrator" scenario exactly.
  await grantRole(deps.rbacRepo, sysAdmin, [], { scopeType: "group" });
  await assert.rejects(() => deps.lifecycle.getCase(actor(sysAdmin), created.id), NotFoundError);
});

test("MY entity access does not imply SG entity access", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.sg.id, "Fictional MY-SG Test");
  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.sg.id, hrOwnerUserId: hrUser });

  const myOnlyUser = randomUUID();
  await grantRole(deps.rbacRepo, myOnlyUser, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });
  await assert.rejects(() => deps.lifecycle.getCase(actor(myOnlyUser), created.id), NotFoundError, "MY-scoped access must not reach an SG case");
});

test("SG HQ (group headquarters) access does not imply SK Lai & Partners restricted access", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  // The creating HR user needs the PRIVILEGED (RESTRICTED-ceiling) tier to
  // open an SKL case at all — granted separately here so the actor tested
  // below (group-wide, non-privileged) remains a clean negative case.
  await grantRole(deps.rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.skl.id, "Fictional SKL HQ Test");
  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.skl.id, hrOwnerUserId: hrUser });

  const groupWideNonPrivileged = randomUUID();
  await grantRole(deps.rbacRepo, groupWideNonPrivileged, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  await assert.rejects(() => deps.lifecycle.getCase(actor(groupWideNonPrivileged), created.id), NotFoundError, "Group-wide CONFIDENTIAL-tier access must not reach an SKL (RESTRICTED) case");
});

test("IDOR: a denied caller requesting a known-existing case id gets the same error as a nonexistent id", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional IDOR Test");
  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser });

  const stranger = randomUUID();
  await Promise.all([
    assert.rejects(() => deps.lifecycle.getCase(actor(stranger), created.id), NotFoundError),
    assert.rejects(() => deps.lifecycle.getCase(actor(stranger), randomUUID()), NotFoundError),
  ]);
});

test("employee self-access exposes only base and restricted tiers, never the decision tier", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Self Access Test");

  // Link the fictional employee to a fresh Identity user representing "self".
  const linkedUser = await deps.users.createUser({ email: `self.${randomUUID()}@example.test`, accountType: "employee" });
  await deps.users.linkEmployee({ userId: linkedUser.id, employeeId: employee.id, linkedBy: hrUser });

  const created = await deps.probation.createProbationCase(actor(hrUser), {
    employeeId: employee.id,
    legalEntityId: deps.my.id,
    hrOwnerUserId: hrUser,
    periodStart: "2026-02-10",
    expectedReviewDate: "2026-05-10",
  });
  await deps.probation.recordDecision(actor(hrUser), created.case.id, { decision: "CONFIRMED", recommendation: "Fictional confidential recommendation text", decisionNotes: "Fictional confidential decision notes", decisionDate: "2026-05-08" });

  const view = await deps.lifecycle.getCase(actor(linkedUser.id), created.case.id);
  assert.equal(view.canReadRestricted, true, "self must see restricted-tier fields (their own status)");
  assert.equal(view.canReadDecision, false, "self must never see decision-tier fields (recommendation/decision notes), even about their own case");

  // listReviews returns raw (unmasked) rows plus access flags — the API
  // route layer is what actually applies canReadRestricted/canReadDecision
  // to hide fields (see api/routes/lifecycle.ts's serializeReview); this
  // is verified via the flags themselves, which is what every caller of
  // this service is required to respect.
  const reviews = await deps.probation.listReviews(actor(linkedUser.id), created.case.id);
  assert.equal(reviews.canReadRestricted, true, "self sees restricted-tier review fields (decision/decisionDate)");
  assert.equal(reviews.canReadDecision, false, "self must never see decision-tier review fields (recommendation/decisionNotes)");
});

test("manager (read.team) access is limited to base-tier metadata for a direct report's case", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const manager = await hireFictionalEmployee(deps, deps.my.id, "Fictional Manager Test");
  const report = await hireFictionalEmployee(deps, deps.my.id, "Fictional Report Test");

  // Wire the reporting line: report's assignment reports to manager's assignment.
  await grantRole(deps.rbacRepo, hrUser, [
    { key: "employee_master.manage_assignment", maxClassification: "CONFIDENTIAL" },
    { key: "employee_master.manage_reporting", maxClassification: "CONFIDENTIAL" },
    { key: "employee_master.read.restricted", maxClassification: "CONFIDENTIAL" },
  ], { scopeType: "group" });
  const managerAssignment = (await deps.orgAssignments.listAssignments(actor(hrUser), manager.id))[0]!;
  await deps.orgAssignments.createAssignment(actor(hrUser), report.id, { legalEntityId: deps.my.id, employmentType: "full_time", status: "ACTIVE", startDate: "2026-03-01", effectiveFrom: "2026-03-01", reportsToAssignmentId: managerAssignment.id });

  const managerUser = randomUUID();
  const managerIdentityUser = await deps.users.createUser({ email: `${managerUser}@example.test`, accountType: "employee" });
  await deps.users.linkEmployee({ userId: managerIdentityUser.id, employeeId: manager.id, linkedBy: hrUser });
  await grantRole(deps.rbacRepo, managerIdentityUser.id, [{ key: PERMISSIONS.READ_TEAM, maxClassification: "PUBLIC" }], { scopeType: "group" });

  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: report.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser });
  const view = await deps.lifecycle.getCase(actor(managerIdentityUser.id), created.id);
  assert.equal(view.canReadRestricted, false, "manager (read.team) fallback is base-tier only, never restricted/decision content");
  assert.equal(view.canReadDecision, false);
});

test("invalid lifecycle status transitions are rejected", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Transition Test");
  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser });
  assert.equal(created.status, "IN_PROGRESS");

  await deps.onboarding.completeOnboarding(actor(hrUser), created.id);
  await assert.rejects(() => deps.onboarding.completeOnboarding(actor(hrUser), created.id), InvalidTransitionError, "a completed case must not be completed again");
  await assert.rejects(() => deps.lifecycle.cancelCase(actor(hrUser), created.id), InvalidTransitionError, "a completed case must not be cancelled");
});

test("mass-assignment: creating a case ignores unknown/server-controlled fields supplied by the caller", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Mass Assignment Test");
  const spoofedId = randomUUID();
  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), {
    employeeId: employee.id,
    legalEntityId: deps.my.id,
    hrOwnerUserId: hrUser,
    // @ts-expect-error -- deliberately supplying fields the input type doesn't accept, to prove they cannot be smuggled through
    id: spoofedId,
    caseNumber: "HR-999999",
    status: "COMPLETED",
  });
  assert.notEqual(created.id, spoofedId);
  assert.notEqual(created.caseNumber, "HR-999999");
  assert.equal(created.status, "IN_PROGRESS", "status is always server-assigned, never client-supplied");
});

test("malformed input (missing required fields) is rejected", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  await assert.rejects(
    () => deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: "", legalEntityId: deps.my.id, hrOwnerUserId: hrUser }),
    ValidationError,
  );
});

test("sensitive HR notes never leak into the generic security audit log", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Audit Redaction Test");
  const created = await deps.probation.createProbationCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: hrUser, periodStart: "2026-02-10", expectedReviewDate: "2026-05-10" });

  const confidentialText = "Fictional confidential probation decision rationale — must never appear in security_audit_events";
  await deps.probation.recordDecision(actor(hrUser), created.case.id, { decision: "UNSUCCESSFUL", decisionNotes: confidentialText, decisionDate: "2026-05-08" });

  const auditRows = deps.identityStore.auditEvents ?? [];
  const serialized = JSON.stringify(auditRows);
  assert.equal(serialized.includes(confidentialText), false, "decision notes must never appear in the generic security audit log");
});

// PR #12 final security verification: the Employee Profile's Lifecycle
// and History tabs are populated via GET /hrms/lifecycle/cases?employeeId=,
// which calls listCases with an employeeId filter. This must independently
// authorise EACH candidate case server-side (the same resolveAccess()
// getCase already uses) and silently EXCLUDE any case the caller cannot
// see — never include it and rely on the frontend to hide it. This is the
// list-path analogue of the existing "MY entity access does not imply SG
// entity access" / SKL getCase tests above, which only ever exercised the
// single-case path.
test("listCases (employeeId-filtered) independently authorises each case and excludes ones the caller cannot see, rather than trusting the employeeId filter alone", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  await grantRole(
    deps.rbacRepo,
    hrUser,
    [
      { key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" as const },
      { key: PERMISSIONS.READ_PRIVILEGED, maxClassification: "RESTRICTED" as const },
    ],
    { scopeType: "group" },
  );

  const employee = await hireFictionalEmployee(deps, deps.skl.id, "Fictional Listing SKL Test");
  const created = await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.skl.id, hrOwnerUserId: hrUser });

  // Group-wide, CONFIDENTIAL-tier only — enough to list/read ordinary
  // cases, but not enough for an SK Lai & Partners (RESTRICTED) one.
  const groupWideNonPrivileged = randomUUID();
  await grantRole(deps.rbacRepo, groupWideNonPrivileged, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });

  const filteredViews = await deps.lifecycle.listCases(actor(groupWideNonPrivileged), { employeeId: employee.id });
  assert.equal(filteredViews.length, 0, "a case the caller cannot read must be excluded from the list, not merely left for the frontend to hide");

  // Sanity: the SAME case, listed by a privileged caller, IS present —
  // proving the emptiness above is an authorisation exclusion, not a
  // broken employeeId filter or a fixture error.
  const privilegedViews = await deps.lifecycle.listCases(actor(hrUser), { employeeId: employee.id });
  assert.ok(privilegedViews.some((v) => v.case.id === created.id));
});

test("listCases excludes an unauthorised MY-scoped caller from another employee's SG case, mirroring getCase's own cross-entity denial", async () => {
  const deps = await setup();
  const hrUser = randomUUID();
  await grantRole(deps.rbacRepo, hrUser, FULL_HR_PERMS, { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.sg.id, "Fictional Listing SG Test");
  await deps.onboarding.createOnboardingCase(actor(hrUser), { employeeId: employee.id, legalEntityId: deps.sg.id, hrOwnerUserId: hrUser });

  const myOnlyUser = randomUUID();
  await grantRole(deps.rbacRepo, myOnlyUser, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const views = await deps.lifecycle.listCases(actor(myOnlyUser), { employeeId: employee.id });
  assert.equal(views.length, 0, "MY-scoped access must not reach an SG employee's case via the list endpoint either");
});
