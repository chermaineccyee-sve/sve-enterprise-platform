import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setup, grantRole, grantFullWorkflowAccess, actor, hireFictionalEmployee, publishSimpleApprovalDefinition } from "./testSetup.ts";

const ROLE_PERMISSION_KEY = "test.workflow.role_approve";

test("ROLE mode: eligibility is checked live via the step's assignedPermissionKey — a holder can decide, a non-holder sees nothing and cannot", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.rolerouting", name: "Role routing" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const roleHolder = randomUUID();
  const nonHolder = randomUUID();
  await grantRole(deps.rbacRepo, roleHolder, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.rolerouting", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id });

  const holderTasks = await deps.tasks.listAssignedTasks(actor(roleHolder), { instanceId: instance.id });
  assert.equal(holderTasks.length, 1, "the role holder must see the ROLE-pool task");

  const nonHolderTasks = await deps.tasks.listAssignedTasks(actor(nonHolder), { instanceId: instance.id });
  assert.equal(nonHolderTasks.length, 0, "a non-holder must not see a ROLE task they are not eligible for");

  const result = await deps.tasks.decide(actor(roleHolder), holderTasks[0]!.id, { decision: "APPROVE" });
  assert.equal(result.task.status, "COMPLETED");
});

test("ROLE mode: self-approval is still refused at decision time even though eligibility could not be checked at routing time", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.roleself", name: "Role self-approval" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: ROLE_PERMISSION_KEY, permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const subjectActor = randomUUID();
  await grantRole(deps.rbacRepo, subjectActor, [{ key: ROLE_PERMISSION_KEY, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.roleself", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, subjectActorUserId: subjectActor });
  const tasks = await deps.tasks.listAssignedTasks(actor(subjectActor), { instanceId: instance.id });
  assert.equal(tasks.length, 1, "the subject actor is still nominally ROLE-eligible — routing cannot know this in advance");
  await assert.rejects(() => deps.tasks.decide(actor(subjectActor), tasks[0]!.id, { decision: "APPROVE" }));
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
