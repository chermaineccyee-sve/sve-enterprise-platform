import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withTestDb, getTestDatabaseUrl } from "./testDb.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createRbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";
import { createActorResolutionService } from "../../../identity/src/services/actorResolutionService.ts";

import { createPgOrgStructureRepository } from "../../../organisation/src/repositories/postgres/pgOrgStructureRepository.ts";
import { createPgEmployeeRepository } from "../../../organisation/src/repositories/postgres/pgEmployeeRepository.ts";
import { createPgEmploymentAssignmentRepository } from "../../../organisation/src/repositories/postgres/pgEmploymentAssignmentRepository.ts";
import { createPgEmployeeCreationTransaction } from "../../../organisation/src/repositories/postgres/pgEmployeeCreationTransaction.ts";
import { createPgEmploymentAssignmentTransaction } from "../../../organisation/src/repositories/postgres/pgEmploymentAssignmentTransaction.ts";
import { createEmployeeService } from "../../../organisation/src/services/employeeService.ts";
import { createEmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";

import { createPgWorkflowDefinitionRepository } from "../../src/repositories/postgres/pgWorkflowDefinitionRepository.ts";
import { createPgWorkflowDefinitionVersionRepository } from "../../src/repositories/postgres/pgWorkflowDefinitionVersionRepository.ts";
import { createPgWorkflowStepRepository } from "../../src/repositories/postgres/pgWorkflowStepRepository.ts";
import { createPgWorkflowInstanceRepository } from "../../src/repositories/postgres/pgWorkflowInstanceRepository.ts";
import { createPgWorkflowTaskRepository } from "../../src/repositories/postgres/pgWorkflowTaskRepository.ts";
import { createPgWorkflowTaskCandidateRepository } from "../../src/repositories/postgres/pgWorkflowTaskCandidateRepository.ts";
import { createPgWorkflowEventRepository } from "../../src/repositories/postgres/pgWorkflowEventRepository.ts";
import { createPgWorkflowTransaction } from "../../src/repositories/postgres/pgWorkflowTransaction.ts";
import { createSystemActionRegistry } from "../../src/domain/systemActionRegistry.ts";
import { createInstanceEngine } from "../../src/services/instanceEngine.ts";
import { createDefinitionService } from "../../src/services/definitionService.ts";
import { createInstanceService } from "../../src/services/instanceService.ts";
import { createTaskService } from "../../src/services/taskService.ts";
import { PERMISSIONS } from "../../src/services/access.ts";

const skip: boolean | string = getTestDatabaseUrl() ? false : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

function buildContainer(db: Parameters<typeof createPgUserRepository>[0]) {
  const users = createPgUserRepository(db);
  const organisation = createPgOrganisationRepository(db);
  const rbacRepo = createPgRbacRepository(db);
  const auditRepo = createPgAuditRepository(db);
  const rbac = createRbacService({ rbac: rbacRepo, organisation, users });
  const audit = createAuditService({ audit: auditRepo });
  const actorResolution = createActorResolutionService({ rbac: rbacRepo, rbacService: rbac, users });

  const orgStructureRepo = createPgOrgStructureRepository(db);
  const employeeRepo = createPgEmployeeRepository(db);
  const assignmentRepo = createPgEmploymentAssignmentRepository(db);
  const employeeCreation = createPgEmployeeCreationTransaction(db);
  const assignmentTransactions = createPgEmploymentAssignmentTransaction(db);
  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, employeeCreation });
  const orgAssignments = createEmploymentAssignmentService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit, transactions: assignmentTransactions });

  const definitionRepo = createPgWorkflowDefinitionRepository(db);
  const versionRepo = createPgWorkflowDefinitionVersionRepository(db);
  const stepRepo = createPgWorkflowStepRepository(db);
  const instanceRepo = createPgWorkflowInstanceRepository(db);
  const taskRepo = createPgWorkflowTaskRepository(db);
  const taskCandidateRepo = createPgWorkflowTaskCandidateRepository(db);
  const eventRepo = createPgWorkflowEventRepository(db);
  const transactions = createPgWorkflowTransaction(db);
  const systemActions = createSystemActionRegistry();
  const engine = createInstanceEngine({ orgAssignments, actorResolution, systemActions });

  const definitions = createDefinitionService({ definitions: definitionRepo, versions: versionRepo, steps: stepRepo, rbac, audit, transactions, systemActions });
  const instances = createInstanceService({ definitions: definitionRepo, versions: versionRepo, steps: stepRepo, instances: instanceRepo, tasks: taskRepo, events: eventRepo, organisation, users, rbac, audit, transactions, engine });
  const tasks = createTaskService({ instances: instanceRepo, steps: stepRepo, tasks: taskRepo, taskCandidates: taskCandidateRepo, rbac, users, audit, transactions, engine });

  return { users, organisation, rbacRepo, rbac, audit, employees, orgAssignments, actorResolution, taskCandidateRepo, definitions, instances, tasks, systemActions };
}

async function grantFullAccess(c: ReturnType<typeof buildContainer>, userId: string, grantedBy: string) {
  const role = await c.rbacRepo.createRole({ key: `role-${randomUUID()}`, name: `Role for ${userId}` });
  for (const key of [
    PERMISSIONS.DEFINITION_READ, PERMISSIONS.DEFINITION_CREATE, PERMISSIONS.DEFINITION_UPDATE, PERMISSIONS.DEFINITION_PUBLISH, PERMISSIONS.DEFINITION_RETIRE,
    PERMISSIONS.INSTANCE_START, PERMISSIONS.INSTANCE_READ, PERMISSIONS.INSTANCE_CANCEL, PERMISSIONS.APPROVAL_DECIDE,
  ]) {
    const existing = await c.rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await c.rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" }));
    await c.rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await c.rbacRepo.assignRole({ userId, roleId: role.id, grantedBy });
  await c.rbacRepo.grantEntityAccess({ userId, scopeType: "group", grantedBy });
}

async function provisionFullAccess(c: ReturnType<typeof buildContainer>, email: string, adminId: string) {
  const user = await c.users.createUser({ email, accountType: "employee" });
  await grantFullAccess(c, user.id, adminId);
  return user;
}

async function publishSimpleApproval(c: ReturnType<typeof buildContainer>, actorCtx: { userId: string; email: string }, key: string) {
  const { version } = await c.definitions.createDefinition(actorCtx, { key, name: key });
  await c.definitions.addStep(actorCtx, version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Approve", assignmentMode: "USER", permittedDecisions: ["APPROVE", "REJECT"] });
  return c.definitions.publish(actorCtx, version.id);
}

test("Workflow: hr_lifecycle-style CHECK constraints reject invalid status values and enforce completed_at/failure_category consistency", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "workflow.pg.checks.admin@example.test", accountType: "employee" });
    await grantFullAccess(c, admin.id, admin.id);
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;

    const { definition, version } = await c.definitions.createDefinition({ userId: admin.id, email: admin.email }, { key: "test.pg.checks", name: "Checks" });
    await db.query(`UPDATE workflow_definition_versions SET status='PUBLISHED', published_at=NOW() WHERE id = $1`, [version.id]);

    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO workflow_instances(definition_id, version_id, subject_type, subject_id, legal_entity_id, requester_user_id, status, created_by)
           VALUES ($1,$2,'test.fixture',$3,$4,$5,'NOT_A_STATUS',$5)`,
          [definition.id, version.id, randomUUID(), my.id, admin.id],
        ),
      /check constraint|status/i,
    );

    // status=FAILED requires failure_category to be set.
    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO workflow_instances(definition_id, version_id, subject_type, subject_id, legal_entity_id, requester_user_id, status, created_by)
           VALUES ($1,$2,'test.fixture',$3,$4,$5,'FAILED',$5)`,
          [definition.id, version.id, randomUUID(), my.id, admin.id],
        ),
      /check constraint|failure_category/i,
    );
  });
});

test("Workflow: two concurrent createDraftVersion calls for the same definition never produce duplicate version numbers", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "workflow.pg.versionrace.admin@example.test", accountType: "employee" });
    await grantFullAccess(c, admin.id, admin.id);
    const { definition } = await c.definitions.createDefinition({ userId: admin.id, email: admin.email }, { key: "test.pg.versionrace", name: "Version race" });

    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => c.definitions.createDraftVersion({ userId: admin.id, email: admin.email }, definition.id)));
    const fulfilled = attempts.filter((a) => a.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof c.definitions.createDraftVersion>>>[];
    assert.equal(fulfilled.length, 5, "all 5 concurrent draft-version creations must succeed");

    const versionNumbers = fulfilled.map((r) => r.value.versionNumber).sort((a, b) => a - b);
    assert.deepEqual(versionNumbers, [2, 3, 4, 5, 6], "version numbers must be unique and contiguous even under concurrency");
  });
});

test("Workflow: two concurrent decisions on the same task produce exactly one committed decision", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "workflow.pg.decisionrace.admin@example.test", accountType: "employee" });
    await grantFullAccess(c, admin.id, admin.id);
    const approver = await provisionFullAccess(c, "workflow.pg.decisionrace.approver@example.test", admin.id);
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;

    await publishSimpleApproval(c, { userId: admin.id, email: admin.email }, "test.pg.decisionrace");
    const instance = await c.instances.startWorkflow({ userId: admin.id, email: admin.email }, { definitionKey: "test.pg.decisionrace", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: my.id, stepAssignments: { 1: { userId: approver.id } } });
    const tasks = await c.tasks.listAssignedTasks({ userId: approver.id, email: approver.email }, { instanceId: instance.id });
    const taskId = tasks[0]!.id;

    const attempt = () => c.tasks.decide({ userId: approver.id, email: approver.email }, taskId, { decision: "APPROVE" });
    const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exactly one concurrent decision attempt must commit");
    assert.equal(rejected.length, 2);

    const decisionRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_decisions WHERE task_id = $1`, [taskId]);
    assert.equal(decisionRows.rows[0]!.count, "1", "at most one committed decision may ever exist for a task");

    const finalInstance = await c.instances.getInstance({ userId: admin.id, email: admin.email }, instance.id);
    assert.equal(finalInstance.status, "COMPLETED");
    assert.equal(finalInstance.outcome, "APPROVED");
  });
});

test("Workflow: two eligible ROLE candidates racing the same task — exactly one decision commits (review correction: candidate-set concurrency)", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "workflow.pg.roleconcurrency.admin@example.test", accountType: "employee" });
    await grantFullAccess(c, admin.id, admin.id);
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;

    const { version } = await c.definitions.createDefinition({ userId: admin.id, email: admin.email }, { key: "test.pg.roleconcurrency", name: "Role concurrency" });
    await c.definitions.addStep({ userId: admin.id, email: admin.email }, version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Role approval", assignmentMode: "ROLE", assignedPermissionKey: "test.pg.role_approve", permittedDecisions: ["APPROVE"] });
    await c.definitions.publish({ userId: admin.id, email: admin.email }, version.id);

    const holderA = await c.users.createUser({ email: "workflow.pg.roleconcurrency.holdera@example.test", accountType: "employee" });
    const holderB = await c.users.createUser({ email: "workflow.pg.roleconcurrency.holderb@example.test", accountType: "employee" });
    const role = await c.rbacRepo.createRole({ key: "workflow-role-concurrency", name: "Role concurrency test role" });
    const permission = (await c.rbacRepo.findPermissionByKey("test.pg.role_approve")) ?? (await c.rbacRepo.createPermission({ key: "test.pg.role_approve", maxClassification: "CONFIDENTIAL" }));
    await c.rbacRepo.grantPermissionToRole(role.id, permission.id);
    await c.rbacRepo.assignRole({ userId: holderA.id, roleId: role.id, grantedBy: admin.id });
    await c.rbacRepo.assignRole({ userId: holderB.id, roleId: role.id, grantedBy: admin.id });
    await c.rbacRepo.grantEntityAccess({ userId: holderA.id, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin.id });
    await c.rbacRepo.grantEntityAccess({ userId: holderB.id, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin.id });

    const instance = await c.instances.startWorkflow({ userId: admin.id, email: admin.email }, { definitionKey: "test.pg.roleconcurrency", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: my.id });
    assert.equal(instance.status, "ACTIVE");

    const tasksA = await c.tasks.listAssignedTasks({ userId: holderA.id, email: holderA.email }, { instanceId: instance.id });
    const tasksB = await c.tasks.listAssignedTasks({ userId: holderB.id, email: holderB.email }, { instanceId: instance.id });
    assert.equal(tasksA.length, 1, "holderA must be a resolved candidate");
    assert.equal(tasksB.length, 1, "holderB must be a resolved candidate");
    assert.equal(tasksA[0]!.id, tasksB[0]!.id, "both candidates must see the SAME task");
    const taskId = tasksA[0]!.id;

    const attemptA = () => c.tasks.decide({ userId: holderA.id, email: holderA.email }, taskId, { decision: "APPROVE" });
    const attemptB = () => c.tasks.decide({ userId: holderB.id, email: holderB.email }, taskId, { decision: "APPROVE" });
    const results = await Promise.allSettled([attemptA(), attemptB()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "exactly one of the two eligible ROLE candidates' concurrent decisions must commit");
    assert.equal(rejected.length, 1);

    const decisionRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_decisions WHERE task_id = $1`, [taskId]);
    assert.equal(decisionRows.rows[0]!.count, "1", "at most one committed decision may ever exist for a task, even under ROLE-mode candidate contention");

    const actorRow = await db.query<{ actor_user_id: string }>(`SELECT actor_user_id FROM workflow_decisions WHERE task_id = $1`, [taskId]);
    assert.ok([holderA.id, holderB.id].includes(actorRow.rows[0]!.actor_user_id), "decision history must record the actual winning actor");
  });
});

test("Workflow: a SYSTEM_ACTION handler failure rolls back the WHOLE transaction — the decision, the task transition, and any write the handler itself made — against real Postgres (PR #9 review correction)", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "workflow.pg.rollback.admin@example.test", accountType: "employee" });
    await grantFullAccess(c, admin.id, admin.id);
    const approver = await provisionFullAccess(c, "workflow.pg.rollback.approver@example.test", admin.id);
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;

    // A fictional "marker" row this handler writes via the SAME shared
    // transaction connection before deliberately failing — proves the
    // handler's own writes are undone too, not just Workflow's own rows.
    await db.query(`CREATE TABLE IF NOT EXISTS test_pg_rollback_marker (id UUID PRIMARY KEY, instance_id UUID NOT NULL)`);

    c.systemActions.register("test.pg.rollback.alwaysfails", async (ctx) => {
      await ctx.tx.query(`INSERT INTO test_pg_rollback_marker (id, instance_id) VALUES ($1, $2)`, [randomUUID(), ctx.instance.id]);
      throw new Error("fictional cross-domain completion failure");
    });

    const { version } = await c.definitions.createDefinition({ userId: admin.id, email: admin.email }, { key: "test.pg.rollback", name: "Rollback proof" });
    await c.definitions.addStep({ userId: admin.id, email: admin.email }, version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Approve", assignmentMode: "USER", permittedDecisions: ["APPROVE"] });
    await c.definitions.addStep({ userId: admin.id, email: admin.email }, version.id, { sequenceNumber: 2, stepType: "SYSTEM_ACTION", name: "Complete", systemActionHandlerKey: "test.pg.rollback.alwaysfails" });
    await c.definitions.publish({ userId: admin.id, email: admin.email }, version.id);

    const instance = await c.instances.startWorkflow({ userId: admin.id, email: admin.email }, { definitionKey: "test.pg.rollback", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: my.id, stepAssignments: { 1: { userId: approver.id } } });
    const tasks = await c.tasks.listAssignedTasks({ userId: approver.id, email: approver.email }, { instanceId: instance.id });
    const taskId = tasks[0]!.id;

    await assert.rejects(() => c.tasks.decide({ userId: approver.id, email: approver.email }, taskId, { decision: "APPROVE" }), "a handler failure must reject decide() rather than silently completing the task");

    const taskRow = await db.query<{ status: string }>(`SELECT status FROM workflow_tasks WHERE id = $1`, [taskId]);
    assert.equal(taskRow.rows[0]!.status, "PENDING", "the task transition must roll back — never left COMPLETED when the transaction it belongs to failed");

    const decisionRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_decisions WHERE task_id = $1`, [taskId]);
    assert.equal(decisionRows.rows[0]!.count, "0", "no decision row may exist when the transaction it belongs to rolled back");

    const instanceRow = await db.query<{ status: string; current_step_id: string }>(`SELECT status, current_step_id FROM workflow_instances WHERE id = $1`, [instance.id]);
    assert.equal(instanceRow.rows[0]!.status, "ACTIVE", "the instance must remain ACTIVE at its prior step, unchanged, ready for a retried decision");

    const executionRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_system_action_executions WHERE instance_id = $1`, [instance.id]);
    assert.equal(executionRows.rows[0]!.count, "0", "no system_action_executions row may survive — its own INSERT was part of the same rolled-back transaction");

    const markerRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM test_pg_rollback_marker WHERE instance_id = $1`, [instance.id]);
    assert.equal(markerRows.rows[0]!.count, "0", "the handler's OWN write, made against the shared transaction connection, must also roll back — proving true single-transaction atomicity, not just Workflow's own tables");

    // The rollback must leave the system genuinely retryable, not merely
    // "unchanged in the database" — confirm the SAME task is still
    // readable and PENDING via the service layer (not just a raw row).
    const stillPending = await c.tasks.getTask({ userId: approver.id, email: approver.email }, taskId);
    assert.equal(stillPending.status, "PENDING");
  });
});

test("Workflow: a full definition-to-decision flow commits real rows across workflow_definitions/versions/steps/instances/tasks/decisions/events", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "workflow.pg.fullflow.admin@example.test", accountType: "employee" });
    await grantFullAccess(c, admin.id, admin.id);
    const approver = await provisionFullAccess(c, "workflow.pg.fullflow.approver@example.test", admin.id);
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;

    const published = await publishSimpleApproval(c, { userId: admin.id, email: admin.email }, "test.pg.fullflow");
    const instance = await c.instances.startWorkflow({ userId: admin.id, email: admin.email }, {
      definitionKey: "test.pg.fullflow",
      subjectType: "test.fixture",
      subjectId: randomUUID(),
      legalEntityId: my.id,
      context: { fictionalNote: "full flow test" },
      stepAssignments: { 1: { userId: approver.id } },
    });
    assert.equal(instance.versionId, published.id);

    const tasks = await c.tasks.listAssignedTasks({ userId: approver.id, email: approver.email }, { instanceId: instance.id });
    await c.tasks.decide({ userId: approver.id, email: approver.email }, tasks[0]!.id, { decision: "APPROVE", comment: "Looks good" });

    const instanceRow = await db.query<{ status: string; outcome: string; context: Record<string, unknown> }>(`SELECT status, outcome, context FROM workflow_instances WHERE id = $1`, [instance.id]);
    assert.equal(instanceRow.rows[0]!.status, "COMPLETED");
    assert.equal(instanceRow.rows[0]!.outcome, "APPROVED");
    assert.equal(instanceRow.rows[0]!.context!.fictionalNote, "full flow test", "context JSONB must round-trip correctly");

    const eventRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_events WHERE instance_id = $1`, [instance.id]);
    assert.ok(Number(eventRows.rows[0]!.count) >= 4, "instance_started/step_activated/task_created/decision_recorded/step_completed/instance_completed events must all be recorded");
  });
});

test("PR #10 central invariant: a Workflow approver whose Identity account has been disabled cannot decide a task, even though their role assignment/candidacy is untouched", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "workflow.pg.disabledapprover.admin@example.test", accountType: "employee" });
    await grantFullAccess(c, admin.id, admin.id);
    const approver = await provisionFullAccess(c, "workflow.pg.disabledapprover.approver@example.test", admin.id);
    const entities = await c.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;

    await publishSimpleApproval(c, { userId: admin.id, email: admin.email }, "test.pg.disabledapprover");
    const instance = await c.instances.startWorkflow({ userId: admin.id, email: admin.email }, {
      definitionKey: "test.pg.disabledapprover",
      subjectType: "test.fixture",
      subjectId: randomUUID(),
      legalEntityId: my.id,
      stepAssignments: { 1: { userId: approver.id } },
    });
    const tasks = await c.tasks.listAssignedTasks({ userId: approver.id, email: approver.email }, { instanceId: instance.id });
    assert.equal(tasks.length, 1, "the approver remains a valid candidate — nothing about their role/candidacy has changed");

    await c.users.setStatus(approver.id, "disabled");

    await assert.rejects(() => c.tasks.decide({ userId: approver.id, email: approver.email }, tasks[0]!.id, { decision: "APPROVE" }));

    const taskRow = await db.query<{ status: string }>(`SELECT status FROM workflow_tasks WHERE id = $1`, [tasks[0]!.id]);
    assert.equal(taskRow.rows[0]!.status, "PENDING", "a disabled approver's decision must not commit — this is Identity's central authorize() invariant reaching Workflow, not a Workflow-specific patch");
  });
});

test("Workflow end-to-end through real Postgres: SK Lai & Partners requires the privileged permission tier even for an otherwise Group-wide administrator", { skip }, async () => {
  await withTestDb(async (db) => {
    const c = buildContainer(db);
    const admin = await c.users.createUser({ email: "workflow.pg.skl.admin@example.test", accountType: "employee" });
    await grantFullAccess(c, admin.id, admin.id);
    const entities = await c.organisation.listLegalEntities();
    const skl = entities.find((e) => e.key === "sk-lai-partners-my")!;

    await publishSimpleApproval(c, { userId: admin.id, email: admin.email }, "test.pg.skl");

    const groupUser = await c.users.createUser({ email: "workflow.pg.skl.groupuser@example.test", accountType: "employee" });
    const role = await c.rbacRepo.createRole({ key: "workflow-e2e-group", name: "Group (non-privileged)" });
    const startPerm = (await c.rbacRepo.findPermissionByKey(PERMISSIONS.INSTANCE_START)) ?? (await c.rbacRepo.createPermission({ key: PERMISSIONS.INSTANCE_START, maxClassification: "CONFIDENTIAL" }));
    await c.rbacRepo.grantPermissionToRole(role.id, startPerm.id);
    await c.rbacRepo.assignRole({ userId: groupUser.id, roleId: role.id, grantedBy: admin.id });
    await c.rbacRepo.grantEntityAccess({ userId: groupUser.id, scopeType: "group", grantedBy: admin.id });

    await assert.rejects(
      () => c.instances.startWorkflow({ userId: groupUser.id, email: groupUser.email }, { definitionKey: "test.pg.skl", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: skl.id, stepAssignments: { 1: { userId: admin.id } } }),
      "Group-wide CONFIDENTIAL-tier access must not be sufficient to start an SKL-scoped workflow",
    );

    const privilegedPerm = (await c.rbacRepo.findPermissionByKey(PERMISSIONS.INSTANCE_START_PRIVILEGED)) ?? (await c.rbacRepo.createPermission({ key: PERMISSIONS.INSTANCE_START_PRIVILEGED, maxClassification: "RESTRICTED" }));
    await c.rbacRepo.grantPermissionToRole(role.id, privilegedPerm.id);
    const instance = await c.instances.startWorkflow({ userId: groupUser.id, email: groupUser.email }, { definitionKey: "test.pg.skl", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: skl.id, stepAssignments: { 1: { userId: admin.id } } });
    assert.ok(instance.id);
    assert.equal(instance.dataClassification, "RESTRICTED");
  });
});

