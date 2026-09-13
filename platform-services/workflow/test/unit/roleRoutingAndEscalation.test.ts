import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { InvalidStateError } from "../../src/domain/errors.ts";
import { PERMISSIONS } from "../../src/services/access.ts";
import { setup, grantRole, grantFullWorkflowAccess, actor, hireFictionalEmployee, publishSimpleApprovalDefinition } from "./testSetup.ts";

const ROLE_PERMISSION_KEY = "test.workflow.role_approve";

/**
 * These tests exercise the PR #8 review-correction design: ROLE
 * eligibility is resolved ONCE at step-activation time (never re-checked
 * live at decision time), persisted as an immutable candidate set — see
 * docs/architecture/workflow-approval-foundation.md "Role-based
 * assignment" and "Role-change semantics after activation".
 */

test("ROLE route with exactly one eligible actor: only that resolved candidate can see and decide the task, and decision history records them", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.one", name: "Role routing: one eligible" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const roleHolder = await deps.users.createUser({ email: `role.holder.${randomUUID()}@example.test`, accountType: "employee" });
  const nonHolder = await deps.users.createUser({ email: `role.nonholder.${randomUUID()}@example.test`, accountType: "employee" });
  await grantRole(deps.rbacRepo, roleHolder.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.role.one", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id });
  assert.equal(instance.status, "ACTIVE");

  const holderTasks = await deps.tasks.listAssignedTasks(actor(roleHolder.id), { instanceId: instance.id });
  assert.equal(holderTasks.length, 1, "the resolved candidate must see the ROLE task");

  const nonHolderTasks = await deps.tasks.listAssignedTasks(actor(nonHolder.id), { instanceId: instance.id });
  assert.equal(nonHolderTasks.length, 0, "a non-candidate must not see a ROLE task they are not eligible for");

  const { task, decision } = await deps.tasks.decide(actor(roleHolder.id), holderTasks[0]!.id, { decision: "APPROVE" });
  assert.equal(task.status, "COMPLETED");
  assert.equal(decision.actorUserId, roleHolder.id, "decision history must record the actual deciding actor");
});

test("ROLE route with multiple eligible actors: every resolved candidate can see the task, but exactly one decision commits", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.many", name: "Role routing: many eligible" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const holderA = await deps.users.createUser({ email: `role.holdera.${randomUUID()}@example.test`, accountType: "employee" });
  const holderB = await deps.users.createUser({ email: `role.holderb.${randomUUID()}@example.test`, accountType: "employee" });
  await grantRole(deps.rbacRepo, holderA.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });
  await grantRole(deps.rbacRepo, holderB.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.role.many", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id });

  const tasksA = await deps.tasks.listAssignedTasks(actor(holderA.id), { instanceId: instance.id });
  const tasksB = await deps.tasks.listAssignedTasks(actor(holderB.id), { instanceId: instance.id });
  assert.equal(tasksA.length, 1);
  assert.equal(tasksB.length, 1);
  assert.equal(tasksA[0]!.id, tasksB[0]!.id, "both candidates must see the SAME task");

  const { decision } = await deps.tasks.decide(actor(holderA.id), tasksA[0]!.id, { decision: "APPROVE" });
  assert.equal(decision.actorUserId, holderA.id);

  await assert.rejects(
    () => deps.tasks.decide(actor(holderB.id), tasksB[0]!.id, { decision: "APPROVE" }),
    InvalidStateError,
    "the second eligible candidate's decision must be rejected once the task is already decided",
  );
});

test("ROLE route with no eligible actors fails safely as a ROUTING_FAILURE, creates no usable task, and never falls back to System Administrator or Group access", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin); // broad workflow permissions, but NOT the specific ROLE permission key this step requires
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.none", name: "Role routing: none eligible" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.role.none", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id });

  assert.equal(instance.status, "FAILED");
  assert.equal(instance.failureCategory, "ROUTING_FAILURE");

  const adminTasks = await deps.tasks.listAssignedTasks(actor(admin), { instanceId: instance.id });
  assert.equal(adminTasks.length, 0, "System Administrator / broad workflow access must never be offered the task as a fallback");

  const allTasks = await deps.taskRepo.listByInstance(instance.id);
  assert.equal(allTasks.length, 0, "no unusable ACTIVE task may be created when no eligible approver exists");
});

test("ROLE route where only the subject actor holds the permission: self-approval exclusion empties the candidate set, so routing fails safely rather than exposing a decidable task", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.selfonly", name: "Role routing: only self eligible" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, allowSelfApproval: false, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const subjectActor = await deps.users.createUser({ email: `role.selfonly.${randomUUID()}@example.test`, accountType: "employee" });
  await grantRole(deps.rbacRepo, subjectActor.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), {
    definitionKey: "test.role.selfonly",
    subjectType: "test.fixture",
    subjectId: randomUUID(),
    legalEntityId: deps.my.id,
    subjectActorUserId: subjectActor.id,
  });

  assert.equal(instance.status, "FAILED");
  assert.equal(instance.failureCategory, "ROUTING_FAILURE");

  const tasks = await deps.tasks.listAssignedTasks(actor(subjectActor.id), { instanceId: instance.id });
  assert.equal(tasks.length, 0, "the subject actor must never be offered a decidable task for their own request, even though they nominally hold the role");
});

test("a ROLE grant scoped to MY does not make an actor eligible for a workflow started under SG", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.myonly", name: "Role routing: MY-scoped grant" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const myOnlyHolder = await deps.users.createUser({ email: `role.myonly.${randomUUID()}@example.test`, accountType: "employee" });
  await grantRole(deps.rbacRepo, myOnlyHolder.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.role.myonly", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.sg.id });

  assert.equal(instance.status, "FAILED", "MY-scoped access must not resolve any candidate for an SG-scoped instance");
  assert.equal(instance.failureCategory, "ROUTING_FAILURE");
  const tasks = await deps.tasks.listAssignedTasks(actor(myOnlyHolder.id), { instanceId: instance.id });
  assert.equal(tasks.length, 0);
});

test("a group-scoped (SG HQ) base-tier ROLE grant does not make an actor eligible for an SK Lai & Partners step; the .privileged tier does", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.INSTANCE_START_PRIVILEGED, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.skl", name: "Role routing: SKL privileged tier" });
  await deps.definitions.addStep(actor(admin), version.id, {
    sequenceNumber: 1,
    stepType: "APPROVAL",
    name: "Role approval",
    assignmentMode: "ROLE",
    assignedPermissionKey: ROLE_PERMISSION_KEY,
    assignedPermissionKeyPrivileged: `${ROLE_PERMISSION_KEY}.privileged`,
    permittedDecisions: ["APPROVE"],
  });
  await deps.definitions.publish(actor(admin), version.id);

  const groupHolder = await deps.users.createUser({ email: `role.groupholder.${randomUUID()}@example.test`, accountType: "employee" });
  await grantRole(deps.rbacRepo, groupHolder.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.role.skl", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.skl.id });
  assert.equal(instance.status, "FAILED", "a group-wide CONFIDENTIAL-tier base grant must not be sufficient for an SKL-scoped ROLE step");

  await grantRole(deps.rbacRepo, groupHolder.id, [{ key: `${ROLE_PERMISSION_KEY}.privileged`, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  const secondInstance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.role.skl", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.skl.id });
  assert.equal(secondInstance.status, "ACTIVE", "the .privileged tier must resolve the group-scoped holder as an eligible SKL candidate");
  const tasks = await deps.tasks.listAssignedTasks(actor(groupHolder.id), { instanceId: secondInstance.id });
  assert.equal(tasks.length, 1);
});

test("a ROLE candidate whose permission grant's classification ceiling is below the instance's data classification is excluded", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.classceiling", name: "Role routing: classification ceiling" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const lowCeilingHolder = await deps.users.createUser({ email: `role.lowceiling.${randomUUID()}@example.test`, accountType: "employee" });
  await grantRole(deps.rbacRepo, lowCeilingHolder.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "INTERNAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), {
    definitionKey: "test.role.classceiling",
    subjectType: "test.fixture",
    subjectId: randomUUID(),
    legalEntityId: deps.my.id,
    dataClassification: "CONFIDENTIAL",
  });

  assert.equal(instance.status, "FAILED", "an INTERNAL-ceiling grant must not resolve a candidate for a CONFIDENTIAL-classified instance");
  const tasks = await deps.tasks.listAssignedTasks(actor(lowCeilingHolder.id), { instanceId: instance.id });
  assert.equal(tasks.length, 0);
});

test("a resolved ROLE candidate remains able to decide even after their role is later revoked (activation-time snapshot is immutable)", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.revoked", name: "Role routing: revoked after activation" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const holder = await deps.users.createUser({ email: `role.revoked.${randomUUID()}@example.test`, accountType: "employee" });
  await grantRole(deps.rbacRepo, holder.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.role.revoked", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id });
  const tasks = await deps.tasks.listAssignedTasks(actor(holder.id), { instanceId: instance.id });
  assert.equal(tasks.length, 1);

  const assignments = await deps.rbacRepo.listActiveRoleAssignments(holder.id);
  for (const a of assignments) await deps.rbacRepo.revokeRoleAssignment(a.id, admin);

  const stillEligible = await deps.tasks.listAssignedTasks(actor(holder.id), { instanceId: instance.id });
  assert.equal(stillEligible.length, 1, "a later role revocation must not retroactively remove an already-resolved candidate");

  const { task, decision } = await deps.tasks.decide(actor(holder.id), tasks[0]!.id, { decision: "APPROVE" });
  assert.equal(task.status, "COMPLETED", "the resolved candidate's own historical eligibility must survive a later role change");
  assert.equal(decision.actorUserId, holder.id);
});

test("a user who was not a resolved ROLE candidate cannot decide the task even after subsequently obtaining the role", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.role.late", name: "Role routing: late role grant" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const originalHolder = await deps.users.createUser({ email: `role.late.original.${randomUUID()}@example.test`, accountType: "employee" });
  const lateJoiner = await deps.users.createUser({ email: `role.late.joiner.${randomUUID()}@example.test`, accountType: "employee" });
  await grantRole(deps.rbacRepo, originalHolder.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.role.late", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id });
  const tasks = await deps.tasks.listAssignedTasks(actor(originalHolder.id), { instanceId: instance.id });
  assert.equal(tasks.length, 1);

  // The late joiner obtains the SAME role only AFTER the task already activated.
  await grantRole(deps.rbacRepo, lateJoiner.id, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const lateTasks = await deps.tasks.listAssignedTasks(actor(lateJoiner.id), { instanceId: instance.id });
  assert.equal(lateTasks.length, 0, "a role granted after activation must not retroactively add a candidate");
  await assert.rejects(() => deps.tasks.decide(actor(lateJoiner.id), tasks[0]!.id, { decision: "APPROVE" }), ForbiddenError);
});

test("processDueEscalations reassigns an overdue task to the current assignee's manager and records it exactly once", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const opsUser = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await grantRole(deps.rbacRepo, opsUser, [{ key: "workflow.operation.process_escalations", maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  await grantRole(
    deps.rbacRepo,
    admin,
    [
      { key: "employee_master.read.restricted", maxClassification: "CONFIDENTIAL" },
      { key: "employee_master.manage_assignment", maxClassification: "CONFIDENTIAL" },
      { key: "employee_master.manage_reporting", maxClassification: "CONFIDENTIAL" },
    ],
    { scopeType: "group" },
  );

  const manager = await hireFictionalEmployee(deps, deps.my.id, "Fictional Escalation Manager");
  const managerUser = await deps.users.createUser({ email: `fictional.escalation.manager.${randomUUID()}@example.test`, accountType: "employee" });
  await deps.users.linkEmployee({ userId: managerUser.id, employeeId: manager.id, linkedBy: admin });
  const managerAssignment = await deps.orgAssignments.listAssignments(actor(admin), manager.id).then((rows) => rows[0]!);

  const report = await hireFictionalEmployee(deps, deps.my.id, "Fictional Escalation Report");
  const assigneeUser = await deps.users.createUser({ email: `fictional.escalation.assignee.${randomUUID()}@example.test`, accountType: "employee" });
  await deps.users.linkEmployee({ userId: assigneeUser.id, employeeId: report.id, linkedBy: admin });
  await deps.orgAssignments.createAssignment(actor(admin), report.id, {
    legalEntityId: deps.my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-02-01",
    effectiveFrom: "2026-02-01",
    reportsToAssignmentId: managerAssignment.id,
  });

  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.escalation", name: "Escalation test" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step", assignmentMode: "USER", permittedDecisions: ["APPROVE"], escalateAfterMinutes: 1, escalationTargetMode: "REASSIGN_TO_ASSIGNEE_MANAGER" });
  await deps.definitions.publish(actor(admin), version.id);

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.escalation", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: assigneeUser.id } } });
  const tasks = await deps.tasks.listAssignedTasks(actor(assigneeUser.id), { instanceId: instance.id });
  const taskId = tasks[0]!.id;

  // Force the task's escalate_after into the past — a real scheduler would
  // simply wait; this test only needs to verify processDueEscalations'
  // OWN logic, not the passage of real time.
  const record = deps.wfStore.tasks.find((t) => t.id === taskId)!;
  record.escalateAfter = new Date(Date.now() - 60_000).toISOString();

  const result = await deps.escalations.processDueEscalations(actor(opsUser));
  assert.equal(result.processed, 1);
  assert.equal(result.reassigned, 1);

  const escalated = await deps.tasks.getTask(actor(managerUser.id), taskId);
  assert.equal(escalated.assignedUserId, managerUser.id, "the task must now be assigned to the original assignee's manager");
  assert.ok(escalated.escalatedAt);

  const events = await deps.instances.getInstanceHistory(actor(admin), instance.id);
  assert.equal(events.filter((e) => e.eventType === "escalation_triggered").length, 1, "escalation must be recorded exactly once");

  // A second sweep must be a no-op — this task was already escalated.
  const second = await deps.escalations.processDueEscalations(actor(opsUser));
  assert.equal(second.processed, 0);
});

test("sensitive decision comments never leak into the generic security audit log", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.auditredaction");
  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.auditredaction", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: approver } } });
  const tasks = await deps.tasks.listAssignedTasks(actor(approver), { instanceId: instance.id });

  const secret = "FICTIONAL-CONFIDENTIAL-DECISION-RATIONALE-XYZ";
  await deps.tasks.decide(actor(approver), tasks[0]!.id, { decision: "APPROVE", comment: secret });

  const dump = JSON.stringify(deps.identityStore.auditEvents ?? []);
  assert.ok(!dump.includes(secret), "the decision comment must never appear in the generic security audit log");
});
