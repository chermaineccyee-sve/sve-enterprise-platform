import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { ValidationError, InvalidStateError, NotFoundError } from "../../src/domain/errors.ts";
import { setup, grantRole, grantFullWorkflowAccess, actor, hireFictionalEmployee, publishSimpleApprovalDefinition } from "./testSetup.ts";
import { PERMISSIONS } from "../../src/services/access.ts";

test("starting a workflow with no workflow.instance.start permission is denied", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.start.noperm");

  const nobody = randomUUID();
  await assert.rejects(
    () => deps.instances.startWorkflow(actor(nobody), { definitionKey: "test.start.noperm", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: admin } } }),
    ForbiddenError,
  );
});

test("starting a workflow with an unregistered subject type is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.start.badsubject");
  await assert.rejects(
    () => deps.instances.startWorkflow(actor(admin), { definitionKey: "test.start.badsubject", subjectType: "not.a.real.type", subjectId: randomUUID(), legalEntityId: deps.my.id }),
    ValidationError,
  );
});

test("starting a workflow for a definition with no published version is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await deps.definitions.createDefinition(actor(admin), { key: "test.start.unpublished", name: "Unpublished" });
  await assert.rejects(
    () => deps.instances.startWorkflow(actor(admin), { definitionKey: "test.start.unpublished", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id }),
    ValidationError,
  );
});

test("a successful start creates an ACTIVE instance with a PENDING task for step 1", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.start.success");

  const instance = await deps.instances.startWorkflow(actor(admin), {
    definitionKey: "test.start.success",
    subjectType: "test.fixture",
    subjectId: randomUUID(),
    legalEntityId: deps.my.id,
    stepAssignments: { 1: { userId: approver } },
  });
  assert.equal(instance.status, "ACTIVE");
  assert.ok(instance.currentStepId);

  const tasks = await deps.tasks.listAssignedTasks(actor(approver), {});
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.status, "PENDING");
  assert.equal(tasks[0]!.assignedUserId, approver);
});

test("MY entity access does not imply SG entity access for starting a workflow", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.start.myonly");

  const myOnlyUser = randomUUID();
  await grantRole(deps.rbacRepo, myOnlyUser, [{ key: PERMISSIONS.INSTANCE_START, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });

  await assert.rejects(
    () => deps.instances.startWorkflow(actor(myOnlyUser), { definitionKey: "test.start.myonly", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.sg.id, stepAssignments: { 1: { userId: admin } } }),
    ForbiddenError,
  );
});

test("SG HQ access does not imply SK Lai & Partners privileged access for starting a workflow", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.start.skl");

  const groupUser = randomUUID();
  await grantRole(deps.rbacRepo, groupUser, [{ key: PERMISSIONS.INSTANCE_START, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });

  await assert.rejects(
    () => deps.instances.startWorkflow(actor(groupUser), { definitionKey: "test.start.skl", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.skl.id, stepAssignments: { 1: { userId: admin } } }),
    ForbiddenError,
    "Group-wide CONFIDENTIAL-tier access must not be sufficient to start an SKL-scoped workflow",
  );

  await grantRole(deps.rbacRepo, groupUser, [{ key: PERMISSIONS.INSTANCE_START_PRIVILEGED, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  const instance = await deps.instances.startWorkflow(actor(groupUser), { definitionKey: "test.start.skl", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.skl.id, stepAssignments: { 1: { userId: admin } } });
  assert.ok(instance.id);
});

test("an idempotencyKey replay returns the SAME instance rather than creating a second one", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.idempotent");
  const subjectId = randomUUID();
  const key = "fixture-key-1";

  const first = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.idempotent", subjectType: "test.fixture", subjectId, legalEntityId: deps.my.id, idempotencyKey: key, stepAssignments: { 1: { userId: admin } } });
  const second = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.idempotent", subjectType: "test.fixture", subjectId, legalEntityId: deps.my.id, idempotencyKey: key, stepAssignments: { 1: { userId: admin } } });
  assert.equal(first.id, second.id);
});

test("without an idempotencyKey, a second start for the same still-ACTIVE subject is rejected (natural uniqueness invariant)", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.natural.unique");
  const subjectId = randomUUID();

  await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.natural.unique", subjectType: "test.fixture", subjectId, legalEntityId: deps.my.id, stepAssignments: { 1: { userId: admin } } });
  await assert.rejects(
    () => deps.instances.startWorkflow(actor(admin), { definitionKey: "test.natural.unique", subjectType: "test.fixture", subjectId, legalEntityId: deps.my.id, stepAssignments: { 1: { userId: admin } } }),
    InvalidStateError,
  );
});

test("MANAGER routing resolves the subject employee's current manager via Organisation, who can then decide", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
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

  const manager = await hireFictionalEmployee(deps, deps.my.id, "Fictional Manager For Workflow Test");
  const managerUser = await deps.users.createUser({ email: `fictional.manager.${randomUUID()}@example.test`, accountType: "employee" });
  await deps.users.linkEmployee({ userId: managerUser.id, employeeId: manager.id, linkedBy: admin });

  const managerAssignment = await deps.orgAssignments.listAssignments(actor(admin), manager.id).then((rows) => rows[0]!);
  const report = await hireFictionalEmployee(deps, deps.my.id, "Fictional Report For Workflow Test");
  await deps.orgAssignments.createAssignment(actor(admin), report.id, {
    legalEntityId: deps.my.id,
    employmentType: "full_time",
    status: "ACTIVE",
    startDate: "2026-02-01",
    effectiveFrom: "2026-02-01",
    reportsToAssignmentId: managerAssignment.id,
  });

  const { definition, version } = await deps.definitions.createDefinition(actor(admin), { key: "test.managerroute", name: "Manager routing" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Manager approval", assignmentMode: "MANAGER", permittedDecisions: ["APPROVE", "REJECT"] });
  await deps.definitions.publish(actor(admin), version.id);
  void definition;

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.managerroute", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, subjectEmployeeId: report.id });
  assert.equal(instance.status, "ACTIVE");

  const tasks = await deps.tasks.listAssignedTasks(actor(managerUser.id), {});
  assert.equal(tasks.length, 1);
  const result = await deps.tasks.decide(actor(managerUser.id), tasks[0]!.id, { decision: "APPROVE" });
  assert.equal(result.task.status, "COMPLETED");
  const finalInstance = await deps.instances.getInstance(actor(admin), instance.id);
  assert.equal(finalInstance.status, "COMPLETED");
  assert.equal(finalInstance.outcome, "APPROVED");
});

test("MANAGER routing with no resolvable manager fails safely as a ROUTING_FAILURE, never an insecure fallback", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional No-Manager Employee");

  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.nomanager", name: "No manager" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Manager approval", assignmentMode: "MANAGER", permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.nomanager", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, subjectEmployeeId: employee.id });
  assert.equal(instance.status, "FAILED");
  assert.equal(instance.failureCategory, "ROUTING_FAILURE");
});

test("self-approval is refused: a USER-mode step assigned to the workflow's own subject actor never creates an actionable task", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.selfapproval");

  const subjectActor = randomUUID();
  const instance = await deps.instances.startWorkflow(actor(admin), {
    definitionKey: "test.selfapproval",
    subjectType: "test.fixture",
    subjectId: randomUUID(),
    legalEntityId: deps.my.id,
    subjectActorUserId: subjectActor,
    stepAssignments: { 1: { userId: subjectActor } },
  });
  assert.equal(instance.status, "FAILED");
  assert.equal(instance.failureCategory, "ROUTING_FAILURE");
});

test("non-assignee cannot decide a task assigned to someone else", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver = randomUUID();
  const stranger = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.notmine");
  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.notmine", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: approver } } });
  const tasks = await deps.tasks.listAssignedTasks(actor(approver), { instanceId: instance.id });
  await assert.rejects(() => deps.tasks.decide(actor(stranger), tasks[0]!.id, { decision: "APPROVE" }), ForbiddenError);
});

test("a decision outside the step's permitted decisions is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { definition, version } = await deps.definitions.createDefinition(actor(admin), { key: "test.notpermitted", name: "Not permitted" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step", assignmentMode: "USER", permittedDecisions: ["APPROVE"] });
  await deps.definitions.publish(actor(admin), version.id);
  void definition;

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.notpermitted", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: approver } } });
  const tasks = await deps.tasks.listAssignedTasks(actor(approver), { instanceId: instance.id });
  await assert.rejects(() => deps.tasks.decide(actor(approver), tasks[0]!.id, { decision: "REJECT" }), ValidationError);
});

test("a decision is immutable: a second decide attempt on the same task is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.doubledecide");
  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.doubledecide", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: approver } } });
  const tasks = await deps.tasks.listAssignedTasks(actor(approver), { instanceId: instance.id });
  await deps.tasks.decide(actor(approver), tasks[0]!.id, { decision: "APPROVE" });
  await assert.rejects(() => deps.tasks.decide(actor(approver), tasks[0]!.id, { decision: "APPROVE" }), InvalidStateError);
});

test("REJECT completes the instance immediately with outcome REJECTED, regardless of step position", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.rejectflow");
  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.rejectflow", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: approver } } });
  const tasks = await deps.tasks.listAssignedTasks(actor(approver), { instanceId: instance.id });
  await deps.tasks.decide(actor(approver), tasks[0]!.id, { decision: "REJECT" });
  const final = await deps.instances.getInstance(actor(admin), instance.id);
  assert.equal(final.status, "COMPLETED");
  assert.equal(final.outcome, "REJECTED");
});

test("RETURN reactivates the previous step, and history remains fully reconstructable", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver1 = randomUUID();
  const approver2 = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.returnflow", name: "Return flow" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step 1", assignmentMode: "USER", permittedDecisions: ["APPROVE"] });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 2, stepType: "APPROVAL", name: "Step 2", assignmentMode: "USER", permittedDecisions: ["APPROVE", "RETURN"] });
  await deps.definitions.publish(actor(admin), version.id);

  const instance = await deps.instances.startWorkflow(actor(admin), {
    definitionKey: "test.returnflow",
    subjectType: "test.fixture",
    subjectId: randomUUID(),
    legalEntityId: deps.my.id,
    stepAssignments: { 1: { userId: approver1 }, 2: { userId: approver2 } },
  });

  const step1Tasks = await deps.tasks.listAssignedTasks(actor(approver1), { instanceId: instance.id });
  await deps.tasks.decide(actor(approver1), step1Tasks[0]!.id, { decision: "APPROVE" });

  const step2Tasks = await deps.tasks.listAssignedTasks(actor(approver2), { instanceId: instance.id });
  await deps.tasks.decide(actor(approver2), step2Tasks[0]!.id, { decision: "RETURN" });

  const midInstance = await deps.instances.getInstance(actor(admin), instance.id);
  assert.equal(midInstance.status, "ACTIVE", "the instance must be back in step 1, still ACTIVE");

  const newStep1Tasks = await deps.tasks.listAssignedTasks(actor(approver1), { instanceId: instance.id, status: "PENDING" });
  assert.equal(newStep1Tasks.length, 1, "a NEW task for step 1 must be created; the old one remains completed in history");
  await deps.tasks.decide(actor(approver1), newStep1Tasks[0]!.id, { decision: "APPROVE" });

  const events = await deps.instances.getInstanceHistory(actor(admin), instance.id);
  const decisionEvents = events.filter((e) => e.eventType === "decision_recorded");
  assert.equal(decisionEvents.length, 3, "all three decisions (approve, return, re-approve) must remain in history");
});

test("cancelling an instance protects its pending task, and a terminal instance can never be cancelled again", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.cancel");
  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.cancel", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: approver } } });
  const tasks = await deps.tasks.listAssignedTasks(actor(approver), { instanceId: instance.id });

  const cancelled = await deps.instances.cancelInstance(actor(admin), instance.id);
  assert.equal(cancelled.status, "CANCELLED");

  const task = await deps.tasks.getTask(actor(admin), tasks[0]!.id);
  assert.equal(task.status, "CANCELLED", "the pending task must be cancelled along with its instance");

  await assert.rejects(() => deps.instances.cancelInstance(actor(admin), instance.id), InvalidStateError);
  await assert.rejects(() => deps.tasks.decide(actor(approver), tasks[0]!.id, { decision: "APPROVE" }), InvalidStateError, "a cancelled task must never accept a decision");
});

test("IDOR: a caller unrelated to an instance cannot read it merely by knowing its id", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const approver = randomUUID();
  const stranger = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await publishSimpleApprovalDefinition(deps, admin, "test.idor");
  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.idor", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: approver } } });
  await assert.rejects(() => deps.instances.getInstance(actor(stranger), instance.id), NotFoundError);
  await assert.rejects(() => deps.instances.getInstance(actor(stranger), randomUUID()), NotFoundError);
});

test("a TASK-type step completes via completeTask (no decision row) and advances the workflow", async () => {
  const deps = await setup();
  const admin = randomUUID();
  const assignee = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.plaintask", name: "Plain task" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "TASK", name: "Do the thing", assignmentMode: "USER" });
  await deps.definitions.publish(actor(admin), version.id);

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.plaintask", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id, stepAssignments: { 1: { userId: assignee } } });
  const tasks = await deps.tasks.listAssignedTasks(actor(assignee), { instanceId: instance.id });
  assert.equal(tasks[0]!.taskType, "TASK");
  const completed = await deps.tasks.completeTask(actor(assignee), tasks[0]!.id);
  assert.equal(completed.status, "COMPLETED");
  const final = await deps.instances.getInstance(actor(admin), instance.id);
  assert.equal(final.status, "COMPLETED");
  assert.equal(final.outcome, "COMPLETED");
});

test("a SYSTEM_ACTION step executes its registered handler exactly once and advances automatically", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  let calls = 0;
  deps.systemActions.register("test.increment", async () => {
    calls++;
  });
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.sysaction", name: "System action" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "SYSTEM_ACTION", name: "Run it", systemActionHandlerKey: "test.increment" });
  await deps.definitions.publish(actor(admin), version.id);

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.sysaction", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id });
  assert.equal(instance.status, "COMPLETED");
  assert.equal(calls, 1);
});

test("a SYSTEM_ACTION step whose handler throws marks the instance FAILED with SYSTEM_ACTION_FAILURE, never falsely COMPLETED", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  deps.systemActions.register("test.alwaysfails", async () => {
    throw new Error("fictional handler failure");
  });
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.sysfail", name: "System action failure" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "SYSTEM_ACTION", name: "Run it", systemActionHandlerKey: "test.alwaysfails" });
  await deps.definitions.publish(actor(admin), version.id);

  const instance = await deps.instances.startWorkflow(actor(admin), { definitionKey: "test.sysfail", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: deps.my.id });
  assert.equal(instance.status, "FAILED");
  assert.equal(instance.failureCategory, "SYSTEM_ACTION_FAILURE");
});
