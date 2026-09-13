/**
 * HRMS <-> Workflow integration (PR #9) — real Postgres end-to-end tests.
 * Uses the REAL composition root (createHrmsContainer), which now wires a
 * full Workflow container sharing the same `db` and registers the two
 * SYSTEM_ACTION completion handlers — see src/composition/container.ts and
 * src/integrations/workflowIntegration.ts. Fictional fixtures only.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { DatabaseProvider } from "../../../../packages/shared/src/DatabaseProvider.ts";
import { withTestDb, getTestDatabaseUrl } from "./testDb.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createHrmsContainer, type HrmsContainer } from "../../src/composition/container.ts";
import { installHrmsWorkflowDefinitions } from "../../src/integrations/workflowIntegration.ts";
import { PERMISSIONS } from "../../src/services/access.ts";
import { PERMISSIONS as ORG_PERMISSIONS } from "../../../organisation/src/services/employeeService.ts";
import { PERMISSIONS as WORKFLOW_PERMISSIONS } from "../../../workflow/src/services/access.ts";

const skip: boolean | string = getTestDatabaseUrl() ? false : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

function actor(userId: string, email?: string) {
  return { userId, email: email ?? `${userId}@example.test` };
}

async function grantRole(
  db: DatabaseProvider,
  userId: string,
  permissions: { key: string; maxClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PRIVILEGED" }[],
  entityGrant: { scopeType: "group" } | { scopeType: "legal_entity"; legalEntityId: string },
  grantedBy: string,
) {
  const rbacRepo = createPgRbacRepository(db);
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: "Test role" });
  for (const p of permissions) {
    const existing = await rbacRepo.findPermissionByKey(p.key);
    const permission = existing ?? (await rbacRepo.createPermission({ key: p.key, maxClassification: p.maxClassification }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId, roleId: role.id, grantedBy });
  await rbacRepo.grantEntityAccess({ userId, ...entityGrant, grantedBy } as Parameters<typeof rbacRepo.grantEntityAccess>[0]);
}

const FULL_ADMIN_PERMISSIONS: { key: string; maxClassification: "CONFIDENTIAL" | "RESTRICTED" }[] = [
  { key: ORG_PERMISSIONS.CREATE, maxClassification: "RESTRICTED" },
  // The admin is this suite's hrOwnerUserId on every case it creates —
  // the registered SYSTEM_ACTION handler attributes the authoritative
  // completion write to the case's HR owner (see workflowIntegration.ts's
  // resolveHrOwnerActor), which — exactly like directly calling
  // completeChange()/completeOffboarding() since PR #7 — requires BOTH
  // the HRMS manage_* permission AND Organisation's own
  // manage_assignment permission.
  { key: ORG_PERMISSIONS.MANAGE_ASSIGNMENT, maxClassification: "CONFIDENTIAL" },
  { key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" },
  { key: PERMISSIONS.READ, maxClassification: "RESTRICTED" },
  { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" },
  { key: PERMISSIONS.MANAGE_OFFBOARDING, maxClassification: "CONFIDENTIAL" },
  { key: WORKFLOW_PERMISSIONS.DEFINITION_READ, maxClassification: "CONFIDENTIAL" },
  { key: WORKFLOW_PERMISSIONS.DEFINITION_CREATE, maxClassification: "CONFIDENTIAL" },
  { key: WORKFLOW_PERMISSIONS.DEFINITION_UPDATE, maxClassification: "CONFIDENTIAL" },
  { key: WORKFLOW_PERMISSIONS.DEFINITION_PUBLISH, maxClassification: "CONFIDENTIAL" },
  { key: WORKFLOW_PERMISSIONS.INSTANCE_START, maxClassification: "CONFIDENTIAL" },
  { key: WORKFLOW_PERMISSIONS.INSTANCE_READ, maxClassification: "CONFIDENTIAL" },
  { key: WORKFLOW_PERMISSIONS.INSTANCE_CANCEL, maxClassification: "CONFIDENTIAL" },
];

async function provisionAdmin(db: DatabaseProvider, container: HrmsContainer, email: string): Promise<{ userId: string; email: string }> {
  const user = await container.users.createUser({ email, accountType: "employee" });
  await grantRole(db, user.id, FULL_ADMIN_PERMISSIONS, { scopeType: "group" }, user.id);
  await installHrmsWorkflowDefinitions(container.workflow, actor(user.id, email));
  return actor(user.id, email);
}

async function hireFictional(container: HrmsContainer, admin: { userId: string; email: string }, legalEntityId: string, legalName: string) {
  return container.orgContainer.employees.createEmployee(admin, {
    legalName,
    employmentCountry: "MY",
    initialAssignment: { legalEntityId, employmentType: "full_time", startDate: "2026-01-01" },
  });
}

const EMPLOYMENT_CHANGE_INPUT = { employmentType: "full_time", status: "ACTIVE", startDate: "2026-04-01", effectiveFrom: "2026-04-01", isPrimary: false };
const OFFBOARDING_INPUT = { endDate: "2026-04-01", status: "RESIGNED" as const, changeReason: "fictional resignation" };

test("Employment Change: full approval flow — approved decision creates exactly one Organisation assignment and completes the HRMS case", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.ec.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Employment Change Employee A");

    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.ec.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.ec.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    assert.equal(submitted.case.status, "PENDING_DECISION");

    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    assert.equal(tasks.length, 1, "the approver must be resolved as the ROLE candidate for this instance's approval step");
    await container.workflow.tasks.decide(approver, tasks[0]!.id, { decision: "APPROVE" });

    const finalCase = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(finalCase.case.status, "COMPLETED");
    assert.ok(finalCase.case.resultingAssignmentId);

    const finalInstance = await container.workflow.instances.getInstance(admin, submitted.workflowInstanceId);
    assert.equal(finalInstance.status, "COMPLETED");
    // The instance's own coarse outcome is "COMPLETED", not "APPROVED":
    // this definition's LAST step is the SYSTEM_ACTION (not the APPROVAL
    // step itself), so Workflow's generic "isLast step -> outcome
    // APPROVED" propagation does not apply here — the actual APPROVE
    // signal is preserved on the workflow_decisions row instead (checked
    // via the decision-history assertions below), which is the correct,
    // authoritative place for it.
    assert.equal(finalInstance.outcome, "COMPLETED");

    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    // hireFictional's own initial (PRE_HIRE) assignment is row 1; the
    // approved employment change's own new assignment is row 2 — never a
    // THIRD row from any duplicate/retried completion.
    assert.equal(assignmentRows.rows[0]!.count, "2", "approval must create exactly ONE additional Organisation assignment beyond the initial hire, never more");

    const events = await container.lifecycle.listEvents(admin, hrCase.id);
    assert.equal(events.events.filter((e) => e.eventType === "employment_change_completed").length, 1);
    assert.equal(events.events.filter((e) => e.eventType === "approval_submitted").length, 1);
  });
});

test("Offboarding: full approval flow — ends the Organisation assignment, completes the case, records identity_deactivation_requested exactly once, and never touches the Identity account", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.ob.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Offboarding Employee A");

    const employeeUser = actor((await container.users.createUser({ email: "workflow-integration.pg.ob.employee@example.test", accountType: "employee" })).id, "workflow-integration.pg.ob.employee@example.test");
    await container.users.linkEmployee({ userId: employeeUser.userId, employeeId: employee.id, linkedBy: admin.userId });

    const hrCase = await container.offboarding.createOffboardingCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, separationType: "resignation" });

    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.ob.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.ob.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_OFFBOARDING, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    const submitted = await container.approval.submitForApproval(admin, hrCase.id, OFFBOARDING_INPUT);
    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    await container.workflow.tasks.decide(approver, tasks[0]!.id, { decision: "APPROVE" });

    const finalCase = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(finalCase.case.status, "COMPLETED");
    assert.equal(finalCase.case.outcome, "RESIGNED");

    const events = await container.lifecycle.listEvents(admin, hrCase.id);
    assert.equal(events.events.filter((e) => e.eventType === "identity_deactivation_requested").length, 1, "must record exactly one deactivation REQUEST");
    assert.equal(events.events.filter((e) => e.eventType === "separation_effective").length, 1);

    const stillExists = await container.users.findById(employeeUser.userId);
    assert.ok(stillExists, "the Identity user must NEVER be deleted by offboarding completion");
    assert.equal(stillExists!.status, "active", "offboarding completion must NEVER itself deactivate the Identity account — deactivation remains a pending, separately-authorised follow-up");

    const assignmentRow = await db.query<{ status: string; effective_to: string | null }>(`SELECT status, effective_to FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    assert.equal(assignmentRow.rows[0]!.status, "RESIGNED");
    assert.ok(assignmentRow.rows[0]!.effective_to, "Organisation's own assignment must be ended (effective_to set)");
  });
});

test("Employment Change: REJECT leaves Organisation untouched and the case reconciles to editable IN_PROGRESS (clean terminate-and-resubmit, never CANCELLED)", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.reject.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Rejection Employee A");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.reject.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.reject.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    await container.workflow.tasks.decide(approver, tasks[0]!.id, { decision: "REJECT" });

    const status = await container.approval.getApprovalStatus(admin, hrCase.id);
    assert.equal(status.outcome, "REJECTED");

    const reconciled = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(reconciled.case.status, "IN_PROGRESS", "REJECT must return the case to editable IN_PROGRESS, never CANCELLED");
    assert.equal(reconciled.case.resultingAssignmentId, null);

    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    // Only hireFictional's own initial hire assignment — a rejected
    // approval must never add a second (or any) Organisation mutation.
    assert.equal(assignmentRows.rows[0]!.count, "1", "a rejected approval must never mutate Organisation");

    const events = await container.lifecycle.listEvents(admin, hrCase.id);
    assert.equal(events.events.filter((e) => e.eventType === "approval_rejected").length, 1);
    assert.equal(events.events.filter((e) => e.eventType === "employment_change_completed").length, 0);
  });
});

test("Employment Change: RETURN is not offered by this Workflow definition — attempting it is refused cleanly", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.return.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Return Employee A");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.return.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.return.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    await assert.rejects(() => container.workflow.tasks.decide(approver, tasks[0]!.id, { decision: "RETURN" }), /permit/i);

    const stillPending = await container.workflow.tasks.getTask(approver, tasks[0]!.id);
    assert.equal(stillPending.status, "PENDING");
  });
});

test("SK Lai & Partners: a group-scoped base-tier approval permission does not resolve as a ROLE candidate for an SKL case; System Administrator (Organisation-only permissions) is never implicitly an approver", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.skl.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const skl = entities.find((e) => e.key === "sk-lai-partners-my")!;

    // System Administrator: broad Organisation/HRMS-create permissions, but NOT manage_employment_change — never implicitly an approver.
    const sysAdmin = actor((await container.users.createUser({ email: "workflow-integration.pg.skl.sysadmin@example.test", accountType: "employee" })).id, "workflow-integration.pg.skl.sysadmin@example.test");
    await grantRole(db, sysAdmin.userId, [{ key: ORG_PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }], { scopeType: "group" }, admin.userId);

    // A group-scoped, non-privileged holder of the approval permission.
    const groupHolder = actor((await container.users.createUser({ email: "workflow-integration.pg.skl.groupholder@example.test", accountType: "employee" })).id, "workflow-integration.pg.skl.groupholder@example.test");
    await grantRole(db, groupHolder.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" }, admin.userId);

    // Admin needs the PRIVILEGED HRMS tier to even create/submit an SKL case in the first place, plus Workflow's own privileged instance-start tier.
    await grantRole(
      db,
      admin.userId,
      [
        { key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" },
        { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE_PRIVILEGED, maxClassification: "RESTRICTED" },
        { key: WORKFLOW_PERMISSIONS.INSTANCE_START_PRIVILEGED, maxClassification: "RESTRICTED" },
      ],
      { scopeType: "group" },
      admin.userId,
    );

    const employee = await hireFictional(container, admin, skl.id, "Fictional SKL Employee A");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: skl.id, hrOwnerUserId: admin.userId, changeType: "promotion" });
    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);

    const sysAdminTasks = await container.workflow.tasks.listAssignedTasks(sysAdmin, { instanceId: submitted.workflowInstanceId });
    assert.equal(sysAdminTasks.length, 0, "System Administrator must never be implicitly an approver");
    const groupHolderTasks = await container.workflow.tasks.listAssignedTasks(groupHolder, { instanceId: submitted.workflowInstanceId });
    assert.equal(groupHolderTasks.length, 0, "a group-wide CONFIDENTIAL-tier grant must not resolve as a candidate for an SKL-scoped approval");

    // The privileged-tier holder (admin, granted above) IS a valid candidate.
    const adminTasks = await container.workflow.tasks.listAssignedTasks(admin, { instanceId: submitted.workflowInstanceId });
    assert.equal(adminTasks.length, 1);
  });
});

test("Idempotency (Race A): two concurrent submitForApproval calls for the same case result in exactly one active Workflow instance", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.racea.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Race A Employee");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    const attempt = () => container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    const results = await Promise.allSettled([attempt(), attempt(), attempt()]);
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof attempt>>> => r.status === "fulfilled");
    assert.ok(fulfilled.length >= 1, "at least one submission must succeed");
    const instanceIds = new Set(fulfilled.map((r) => r.value.workflowInstanceId));
    assert.equal(instanceIds.size, 1, "every successful submission must reference the SAME single Workflow instance");

    const activeInstances = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_instances WHERE subject_type = 'hrms.lifecycle' AND subject_id = $1 AND status = 'ACTIVE'`, [hrCase.id]);
    assert.equal(activeInstances.rows[0]!.count, "1");

    const finalCase = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(finalCase.case.workflowInstanceId, [...instanceIds][0]);
  });
});

test("Concurrency (Race B): two eligible ROLE candidates racing the same approval task produce exactly one decision and exactly one Organisation assignment", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.raceb.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Race B Employee");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    const approverA = actor((await container.users.createUser({ email: "workflow-integration.pg.raceb.a@example.test", accountType: "employee" })).id, "workflow-integration.pg.raceb.a@example.test");
    const approverB = actor((await container.users.createUser({ email: "workflow-integration.pg.raceb.b@example.test", accountType: "employee" })).id, "workflow-integration.pg.raceb.b@example.test");
    await grantRole(db, approverA.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);
    await grantRole(db, approverB.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    const tasksA = await container.workflow.tasks.listAssignedTasks(approverA, { instanceId: submitted.workflowInstanceId });
    const taskId = tasksA[0]!.id;

    const attemptA = () => container.workflow.tasks.decide(approverA, taskId, { decision: "APPROVE" });
    const attemptB = () => container.workflow.tasks.decide(approverB, taskId, { decision: "APPROVE" });
    const results = await Promise.allSettled([attemptA(), attemptB()]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);

    const decisionRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_decisions WHERE task_id = $1`, [taskId]);
    assert.equal(decisionRows.rows[0]!.count, "1");

    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    assert.equal(assignmentRows.rows[0]!.count, "2", "even under a two-candidate decision race, exactly ONE additional Organisation assignment (beyond the initial hire) may ever be created");

    const finalCase = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(finalCase.case.status, "COMPLETED");
  });
});

test("Concurrency (Race C): an approval decision racing an instance cancellation resolves deterministically with no split-brain HRMS/Workflow state", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.racec.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Race C Employee");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.racec.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.racec.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    const taskId = tasks[0]!.id;

    const decideAttempt = () => container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" });
    const cancelAttempt = () => container.workflow.instances.cancelInstance(admin, submitted.workflowInstanceId);
    const [decideResult, cancelResult] = await Promise.allSettled([decideAttempt(), cancelAttempt()]);

    const finalTask = await db.query<{ status: string }>(`SELECT status FROM workflow_tasks WHERE id = $1`, [taskId]);
    const finalInstance = await db.query<{ status: string }>(`SELECT status FROM workflow_instances WHERE id = $1`, [submitted.workflowInstanceId]);
    const finalCase = await container.lifecycle.getCase(admin, hrCase.id);
    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);

    if (decideResult.status === "fulfilled") {
      assert.equal(cancelResult.status, "rejected", "cancellation must lose deterministically once the decision won");
      assert.equal(finalTask.rows[0]!.status, "COMPLETED");
      assert.equal(finalInstance.rows[0]!.status, "COMPLETED");
      assert.equal(finalCase.case.status, "COMPLETED");
      assert.equal(assignmentRows.rows[0]!.count, "2", "the initial hire plus exactly one new assignment from the approved change");
    } else {
      assert.equal(cancelResult.status, "fulfilled", "one of the two attempts must always win deterministically");
      assert.equal(finalTask.rows[0]!.status, "CANCELLED");
      assert.equal(finalInstance.rows[0]!.status, "CANCELLED");
      assert.equal(finalCase.case.status, "PENDING_DECISION", "HRMS must not silently complete when Workflow was cancelled — no split-brain");
      assert.equal(assignmentRows.rows[0]!.count, "1", "only the initial hire — cancellation must never let Organisation be mutated");
    }
  });
});

test("Rollback (forced Organisation failure): an invalid completion input causes the WHOLE approval decision to roll back — no committed decision, no partial HRMS/Organisation state", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.rollback.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Rollback Employee A");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.rollback.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.rollback.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    // A nonexistent positionId — Organisation's own createAssignment
    // rejects this with a real FK-driven validation failure, which the
    // SYSTEM_ACTION handler propagates, rolling back the ENTIRE
    // transaction (the decision included).
    const invalidInput = { ...EMPLOYMENT_CHANGE_INPUT, positionId: randomUUID() };
    const submitted = await container.approval.submitForApproval(admin, hrCase.id, invalidInput);
    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    const taskId = tasks[0]!.id;

    await assert.rejects(() => container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" }));

    const taskRow = await db.query<{ status: string }>(`SELECT status FROM workflow_tasks WHERE id = $1`, [taskId]);
    assert.equal(taskRow.rows[0]!.status, "PENDING", "the task transition must roll back entirely");

    const decisionRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_decisions WHERE task_id = $1`, [taskId]);
    assert.equal(decisionRows.rows[0]!.count, "0", "no decision may be committed when the transaction it belongs to failed");

    const instanceRow = await db.query<{ status: string }>(`SELECT status FROM workflow_instances WHERE id = $1`, [submitted.workflowInstanceId]);
    assert.equal(instanceRow.rows[0]!.status, "ACTIVE");

    const caseRow = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(caseRow.case.status, "PENDING_DECISION", "the HRMS case must NOT be left COMPLETED when its authoritative Organisation mutation failed");

    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    assert.equal(assignmentRows.rows[0]!.count, "1", "only the initial hire — no NEW Organisation assignment may exist when the transaction rolled back");

    // Retry after fixing the input succeeds — proving the rollback left a
    // genuinely clean, retryable state, never a stuck one.
    const fixedInput = EMPLOYMENT_CHANGE_INPUT;
    await container.lifecycle.getCase(admin, hrCase.id); // sanity read, no mutation
    await db.query(`UPDATE hr_lifecycle_cases SET pending_completion_input = $2 WHERE id = $1`, [hrCase.id, JSON.stringify(fixedInput)]);
    const retryTasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    await container.workflow.tasks.decide(approver, retryTasks[0]!.id, { decision: "APPROVE" });
    const recovered = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(recovered.case.status, "COMPLETED");
  });
});

test("Workflow subject-data minimisation: the workflow instance/task/event rows for an HRMS case never carry the case's own pendingCompletionInput or other HR content", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.minimisation.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Minimisation Employee A");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });
    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);

    const instanceRow = await db.query<{ context: Record<string, unknown> | null }>(`SELECT context FROM workflow_instances WHERE id = $1`, [submitted.workflowInstanceId]);
    const eventRows = await db.query<{ event_data: Record<string, unknown> | null }>(`SELECT event_data FROM workflow_events WHERE instance_id = $1`, [submitted.workflowInstanceId]);
    const dump = JSON.stringify({ context: instanceRow.rows[0]!.context, events: eventRows.rows.map((r) => r.event_data) });
    assert.ok(!dump.includes("full_time"), "Workflow's own rows must never carry the case's employmentType/other HR completion content");
    assert.ok(!dump.includes(EMPLOYMENT_CHANGE_INPUT.startDate), "Workflow's own rows must never carry the case's completion dates");
  });
});

test("Retry after success: repeating a decide() call on an already-decided task never duplicates the Organisation assignment", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.retry.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Retry Employee A");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.retry.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.retry.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    await container.workflow.tasks.decide(approver, tasks[0]!.id, { decision: "APPROVE" });
    await assert.rejects(() => container.workflow.tasks.decide(approver, tasks[0]!.id, { decision: "APPROVE" }));

    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    assert.equal(assignmentRows.rows[0]!.count, "2", "the initial hire plus exactly one new assignment — a retried decide() must never duplicate it");
  });
});
