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

test("Offboarding: full approval flow — ends the Organisation assignment, completes the case, records identity_deactivation_requested exactly once, does not itself touch the Identity account, and creates a processable PR #10 deactivation request", { skip }, async () => {
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

    // PR #10: offboarding completion via the FULL Workflow-approval path
    // (the SYSTEM_ACTION handler's own transaction-scoped offboarding
    // service, not a direct call) must ALSO create the durable
    // deactivation request row, atomically alongside everything above —
    // proving the tx-scoped composition path (createOffboardingServiceForTransaction)
    // wires the same PR #10 logic as the direct-call path.
    const requestRow = await db.query<{ status: string; target_user_id: string }>(`SELECT status, target_user_id FROM hr_identity_deactivation_requests WHERE case_id = $1`, [hrCase.id]);
    assert.equal(requestRow.rows.length, 1);
    assert.equal(requestRow.rows[0]!.status, "REQUESTED");
    assert.equal(requestRow.rows[0]!.target_user_id, employeeUser.userId);

    // And it is genuinely processable end-to-end from here.
    const systemPrincipal = actor((await container.users.createUser({ email: "workflow-integration.pg.ob.system@example.test", accountType: "service" })).id, "workflow-integration.pg.ob.system@example.test");
    await grantRole(db, systemPrincipal.userId, [{ key: "identity.security.manage_account", maxClassification: "INTERNAL" }], { scopeType: "group" }, admin.userId);
    const processed = await container.identityDeactivation.processAllPending(systemPrincipal);
    assert.equal(processed.length, 1);
    assert.equal(processed[0]!.outcome, "completed");
    const disabledNow = await container.users.findById(employeeUser.userId);
    assert.equal(disabledNow!.status, "disabled", "processing the request must actually disable the account, completing the PR #10 chain end-to-end");
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

// --- PR #9 review correction: Execution Principal & Authority Revalidation ---
//
// `admin` creates and submits every case below but is never the case's
// hrOwnerUserId — a SEPARATE `hrOwner` user (the EXECUTION PRINCIPAL the
// registered SYSTEM_ACTION handler resolves via resolveHrOwnerActor) is
// granted, via its OWN individually-revocable role assignments and a
// single entity-access grant, exactly the authority
// completeCaseWithAuthoritativeWrite requires. Revoking one of those
// grants AFTER submitForApproval but BEFORE the approver's decide() call
// proves the handler re-validates that authority LIVE, at execution time,
// rather than trusting whatever held at submission time. See
// docs/architecture/hrms-workflow-integration.md "Execution principal
// revalidation".

async function grantSingleRole(
  db: DatabaseProvider,
  userId: string,
  permission: { key: string; maxClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PRIVILEGED" },
  grantedBy: string,
): Promise<string> {
  const rbacRepo = createPgRbacRepository(db);
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: "Test role (single permission)" });
  const existing = await rbacRepo.findPermissionByKey(permission.key);
  const perm = existing ?? (await rbacRepo.createPermission({ key: permission.key, maxClassification: permission.maxClassification }));
  await rbacRepo.grantPermissionToRole(role.id, perm.id);
  const assignment = await rbacRepo.assignRole({ userId, roleId: role.id, grantedBy });
  return assignment.id;
}

async function grantSingleEntityAccess(db: DatabaseProvider, userId: string, legalEntityId: string, grantedBy: string): Promise<string> {
  const rbacRepo = createPgRbacRepository(db);
  const grant = await rbacRepo.grantEntityAccess({ userId, scopeType: "legal_entity", legalEntityId, grantedBy });
  return grant.id;
}

async function revokeRole(db: DatabaseProvider, assignmentId: string, revokedBy: string): Promise<void> {
  await createPgRbacRepository(db).revokeRoleAssignment(assignmentId, revokedBy);
}

async function revokeEntity(db: DatabaseProvider, grantId: string, revokedBy: string): Promise<void> {
  await createPgRbacRepository(db).revokeEntityAccess(grantId, revokedBy);
}

/**
 * Builds a case whose hrOwnerUserId is a distinct, minimally-provisioned
 * `hrOwner` — exactly the two permissions (HRMS + Organisation) the
 * completion write needs, each its own revocable role assignment, plus
 * ONE shared entity-access grant (so revoking it removes entity coverage
 * entirely, rather than leaving a second grant still covering the same
 * entity). Submits the case (as `admin`) and returns the approver's
 * pending task id, ready for decide().
 */
async function setupRevocableHrOwnerCase(container: HrmsContainer, db: DatabaseProvider, admin: { userId: string; email: string }, legalEntityId: string, emailPrefix: string) {
  const hrOwner = actor((await container.users.createUser({ email: `${emailPrefix}.hrowner@example.test`, accountType: "employee" })).id, `${emailPrefix}.hrowner@example.test`);
  const hrPermRoleId = await grantSingleRole(db, hrOwner.userId, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }, admin.userId);
  const orgPermRoleId = await grantSingleRole(db, hrOwner.userId, { key: ORG_PERMISSIONS.MANAGE_ASSIGNMENT, maxClassification: "CONFIDENTIAL" }, admin.userId);
  const entityGrantId = await grantSingleEntityAccess(db, hrOwner.userId, legalEntityId, admin.userId);

  const approver = actor((await container.users.createUser({ email: `${emailPrefix}.approver@example.test`, accountType: "employee" })).id, `${emailPrefix}.approver@example.test`);
  await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId }, admin.userId);

  const employee = await hireFictional(container, admin, legalEntityId, `Fictional ${emailPrefix} Employee`);
  const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId, hrOwnerUserId: hrOwner.userId, changeType: "promotion" });
  const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
  const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });

  return { hrOwner, approver, employee, hrCase, submitted, taskId: tasks[0]!.id, hrPermRoleId, orgPermRoleId, entityGrantId };
}

async function assertNoMutationAndNoCommittedDecision(container: HrmsContainer, db: DatabaseProvider, admin: { userId: string; email: string }, hrCaseId: string, employeeId: string, taskId: string) {
  const decisionRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_decisions WHERE task_id = $1`, [taskId]);
  assert.equal(decisionRows.rows[0]!.count, "0", "no Workflow decision may be committed when the execution principal's authority fails at execution time");
  const taskRow = await db.query<{ status: string }>(`SELECT status FROM workflow_tasks WHERE id = $1`, [taskId]);
  assert.equal(taskRow.rows[0]!.status, "PENDING", "the task transition must roll back entirely, leaving the task retryable");
  const caseRow = await container.lifecycle.getCase(admin, hrCaseId);
  assert.equal(caseRow.case.status, "PENDING_DECISION", "the HRMS case must not be left COMPLETED (or any other state) when the execution principal's authority failed");
  const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employeeId]);
  assert.equal(assignmentRows.rows[0]!.count, "1", "only the initial hire — no Organisation mutation may survive a failed execution-principal revalidation");
}

test("Execution principal revalidation: an HR owner who is active and fully authorised at execution time succeeds, and history attributes the approver and the execution principal distinctly", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.execprincipal.base.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const { hrOwner, approver, employee, hrCase, submitted, taskId } = await setupRevocableHrOwnerCase(container, db, admin, my.id, "workflow-integration.pg.execprincipal.base");

    await container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" });

    const finalCase = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(finalCase.case.status, "COMPLETED");
    assert.ok(finalCase.case.resultingAssignmentId);

    // Attribution: the Workflow decision belongs to the APPROVER...
    const decisionRow = await db.query<{ actor_user_id: string }>(`SELECT actor_user_id FROM workflow_decisions WHERE task_id = $1`, [taskId]);
    assert.equal(decisionRow.rows[0]!.actor_user_id, approver.userId, "the Workflow decision must be attributed to the deciding approver");

    // ...while the HRMS completion event/audit attribute execution to the HR OWNER, and separately cross-reference the approver as decisionActorUserId.
    const completedEventRow = await db.query<{ recorded_by: string; event_data: { decisionActorUserId?: string; initiatedBySystem?: string } | null }>(
      `SELECT recorded_by, event_data FROM hr_lifecycle_events WHERE case_id = $1 AND event_type = 'employment_change_completed'`,
      [hrCase.id],
    );
    assert.equal(completedEventRow.rows[0]!.recorded_by, hrOwner.userId, "the completion event's recordedBy is the EXECUTION PRINCIPAL, never the approver");
    assert.equal(completedEventRow.rows[0]!.event_data?.decisionActorUserId, approver.userId, "the completion event must separately reference who APPROVED, never conflating it with recordedBy");
    assert.ok(completedEventRow.rows[0]!.event_data?.initiatedBySystem?.startsWith("workflow:"), "the completion event must record which system/integration initiated it");

    const auditRow = await db.query<{ actor_user_id: string; change_after: { executionPrincipalUserId?: string; decisionActorUserId?: string } | null }>(
      `SELECT actor_user_id, change_after FROM security_audit_events WHERE resource_id = $1 AND action = 'hrms.lifecycle.employment_change_completed' ORDER BY occurred_at DESC LIMIT 1`,
      [hrCase.id],
    );
    assert.equal(auditRow.rows[0]!.actor_user_id, hrOwner.userId, "the completion audit entry's actor is the EXECUTION PRINCIPAL");
    assert.equal(auditRow.rows[0]!.change_after?.executionPrincipalUserId, hrOwner.userId);
    assert.equal(auditRow.rows[0]!.change_after?.decisionActorUserId, approver.userId, "the audit entry must never imply the approver personally executed the Organisation mutation, nor that the HR owner approved the request — both are recorded distinctly");

    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    assert.equal(assignmentRows.rows[0]!.count, "2");
    void submitted;
  });
});

test("Execution principal revalidation: HR owner loses the HRMS permission after submission but before approval — the whole decision rolls back", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.execprincipal.hrmsperm.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const { hrOwner, approver, employee, hrCase, taskId, hrPermRoleId } = await setupRevocableHrOwnerCase(container, db, admin, my.id, "workflow-integration.pg.execprincipal.hrmsperm");

    await revokeRole(db, hrPermRoleId, admin.userId);

    await assert.rejects(() => container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" }), /manage_employment_change/);
    await assertNoMutationAndNoCommittedDecision(container, db, admin, hrCase.id, employee.id, taskId);
    void hrOwner;
  });
});

test("Execution principal revalidation: HR owner loses Organisation's employee_master.manage_assignment after submission but before approval — rolls back", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.execprincipal.orgperm.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const { approver, employee, hrCase, taskId, orgPermRoleId } = await setupRevocableHrOwnerCase(container, db, admin, my.id, "workflow-integration.pg.execprincipal.orgperm");

    await revokeRole(db, orgPermRoleId, admin.userId);

    await assert.rejects(() => container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" }), /manage_assignment/);
    await assertNoMutationAndNoCommittedDecision(container, db, admin, hrCase.id, employee.id, taskId);
  });
});

test("Execution principal revalidation: HR owner loses legal-entity access after submission but before approval — rolls back", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.execprincipal.entity.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const { approver, employee, hrCase, taskId, entityGrantId } = await setupRevocableHrOwnerCase(container, db, admin, my.id, "workflow-integration.pg.execprincipal.entity");

    await revokeEntity(db, entityGrantId, admin.userId);

    await assert.rejects(() => container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" }), /manage_employment_change/);
    await assertNoMutationAndNoCommittedDecision(container, db, admin, hrCase.id, employee.id, taskId);
  });
});

test("Execution principal revalidation: HR owner's account becomes inactive after submission but before approval — no HRMS/Organisation mutation and no committed Workflow decision", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.execprincipal.inactive.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const { hrOwner, approver, employee, hrCase, taskId } = await setupRevocableHrOwnerCase(container, db, admin, my.id, "workflow-integration.pg.execprincipal.inactive");

    // The approver themself remains entirely valid — only the execution
    // principal (hrOwner) is deactivated. The task/decision must still be
    // rejected: approval authority is never sufficient on its own.
    await container.users.setStatus(hrOwner.userId, "disabled");

    await assert.rejects(() => container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" }), /not active/);
    await assertNoMutationAndNoCommittedDecision(container, db, admin, hrCase.id, employee.id, taskId);

    const stillDisabled = await container.users.findById(hrOwner.userId);
    assert.equal(stillDisabled!.status, "disabled", "the account itself is untouched by the rejected completion attempt — this test only proves the completion never executed under it");
  });
});

test("Execution principal revalidation: HR owner loses SK Lai & Partners privileged-tier access after submission but before approval — rolls back", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.execprincipal.skl.admin@example.test");
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
    const entities = await container.organisation.listLegalEntities();
    const skl = entities.find((e) => e.key === "sk-lai-partners-my")!;

    const hrOwner = actor((await container.users.createUser({ email: "workflow-integration.pg.execprincipal.skl.hrowner@example.test", accountType: "employee" })).id, "workflow-integration.pg.execprincipal.skl.hrowner@example.test");
    const hrPrivRoleId = await grantSingleRole(db, hrOwner.userId, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE_PRIVILEGED, maxClassification: "RESTRICTED" }, admin.userId);
    await grantSingleRole(db, hrOwner.userId, { key: ORG_PERMISSIONS.MANAGE_ASSIGNMENT_PRIVILEGED, maxClassification: "RESTRICTED" }, admin.userId);
    await grantSingleEntityAccess(db, hrOwner.userId, skl.id, admin.userId);

    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.execprincipal.skl.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.execprincipal.skl.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE_PRIVILEGED, maxClassification: "RESTRICTED" }], { scopeType: "legal_entity", legalEntityId: skl.id }, admin.userId);

    const employee = await hireFictional(container, admin, skl.id, "Fictional SKL Execution Principal Employee");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: skl.id, hrOwnerUserId: hrOwner.userId, changeType: "promotion" });
    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    const taskId = tasks[0]!.id;

    // Downgrade the HR owner's SKL access: revoke the PRIVILEGED role — no
    // base-tier permission exists to fall back to, so this leaves them with
    // NO permission capable of covering SKL's RESTRICTED ceiling.
    await revokeRole(db, hrPrivRoleId, admin.userId);

    await assert.rejects(() => container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" }), /manage_employment_change/);
    await assertNoMutationAndNoCommittedDecision(container, db, admin, hrCase.id, employee.id, taskId);
  });
});

test("Execution principal revalidation: retry after the HR owner's authority is legitimately restored is idempotent — exactly one business completion", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.execprincipal.retry.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const { employee, hrCase, approver, taskId, hrPermRoleId } = await setupRevocableHrOwnerCase(container, db, admin, my.id, "workflow-integration.pg.execprincipal.retry");

    await revokeRole(db, hrPermRoleId, admin.userId);
    await assert.rejects(() => container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" }));
    await assertNoMutationAndNoCommittedDecision(container, db, admin, hrCase.id, employee.id, taskId);

    // Authority legitimately restored (e.g. a permission grant that was
    // only briefly lapsed, or corrected by an administrator).
    await grantSingleRole(db, (await container.lifecycle.getCase(admin, hrCase.id)).case.hrOwnerUserId, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }, admin.userId);

    await container.workflow.tasks.decide(approver, taskId, { decision: "APPROVE" });

    const finalCase = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(finalCase.case.status, "COMPLETED");

    const decisionRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_decisions WHERE task_id = $1`, [taskId]);
    assert.equal(decisionRows.rows[0]!.count, "1", "exactly one decision must ever commit for this task");

    const completedEvents = await db.query<{ count: string }>(`SELECT count(*)::text FROM hr_lifecycle_events WHERE case_id = $1 AND event_type = 'employment_change_completed'`, [hrCase.id]);
    assert.equal(completedEvents.rows[0]!.count, "1", "exactly one business completion, never duplicated by the earlier rejected attempt");

    const assignmentRows = await db.query<{ count: string }>(`SELECT count(*)::text FROM employment_assignments WHERE employee_id = $1`, [employee.id]);
    assert.equal(assignmentRows.rows[0]!.count, "2", "the initial hire plus exactly one new assignment — the earlier rejected attempt must never have partially applied");
  });
});

test("Two-phase submission crash recovery: the Workflow instance starts successfully but the HRMS linkage write fails before commit — retry converges to exactly one instance and one linkage", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createHrmsContainer(db);
    const admin = await provisionAdmin(db, container, "workflow-integration.pg.crashretry.admin@example.test");
    const entities = await container.organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const employee = await hireFictional(container, admin, my.id, "Fictional Crash Retry Employee A");
    const hrCase = await container.employmentChange.createChangeCase(admin, { employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.userId, changeType: "promotion" });

    // Granted BEFORE the first submission: ROLE-mode candidates are
    // resolved once, at step-activation time (PR #8 fix) — this must
    // exist before the original startWorkflow call for the approver to be
    // a candidate on the task that instance's activation creates.
    const approver = actor((await container.users.createUser({ email: "workflow-integration.pg.crashretry.approver@example.test", accountType: "employee" })).id, "workflow-integration.pg.crashretry.approver@example.test");
    await grantRole(db, approver.userId, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id }, admin.userId);

    // A normal submission first, so a real ACTIVE Workflow instance
    // genuinely exists (Phase 2's own write, in its own transaction,
    // really did commit).
    const submitted = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    const instancesBefore = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_instances WHERE subject_type = 'hrms.lifecycle' AND subject_id = $1`, [hrCase.id]);
    assert.equal(instancesBefore.rows[0]!.count, "1");

    // Simulate the exact crash the review asked to be proven: Phase 2's
    // OWN linkage write (deps.cases.linkWorkflowInstance, a SEPARATE
    // statement/transaction from Workflow's own startWorkflow — see this
    // two-phase design's doc comment) never committed, even though the
    // Workflow instance itself did. This reproduces the identical end
    // state a genuine crash between the two writes would leave, without
    // needing to inject a fault into the real code path.
    await db.query(`UPDATE hr_lifecycle_cases SET workflow_instance_id = NULL WHERE id = $1`, [hrCase.id]);
    const orphaned = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(orphaned.case.status, "PENDING_DECISION");
    assert.equal(orphaned.case.workflowInstanceId, null, "the simulated crash state: PENDING_DECISION with no linkage, exactly like a genuine Phase-2 failure");

    // Retry: submitForApproval must not fail, must not create a SECOND
    // Workflow instance (Workflow's own UNIQUE(definition_id, subject_type,
    // subject_id) WHERE status='ACTIVE' constraint is the backstop even if
    // it tried), and must converge the case back to referencing the SAME,
    // original instance.
    const retried = await container.approval.submitForApproval(admin, hrCase.id, EMPLOYMENT_CHANGE_INPUT);
    assert.equal(retried.workflowInstanceId, submitted.workflowInstanceId, "retry must discover and reuse the SAME orphaned instance, never start a second one");

    const instancesAfter = await db.query<{ count: string }>(`SELECT count(*)::text FROM workflow_instances WHERE subject_type = 'hrms.lifecycle' AND subject_id = $1`, [hrCase.id]);
    assert.equal(instancesAfter.rows[0]!.count, "1", "exactly one Workflow instance must ever exist for this case, even across a crash-and-retry");

    const recovered = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(recovered.case.workflowInstanceId, submitted.workflowInstanceId, "the case must converge to exactly one linkage, pointing at the original instance");

    // The recovered linkage is fully functional — approval still completes normally.
    const tasks = await container.workflow.tasks.listAssignedTasks(approver, { instanceId: submitted.workflowInstanceId });
    assert.equal(tasks.length, 1);
    await container.workflow.tasks.decide(approver, tasks[0]!.id, { decision: "APPROVE" });

    const finalCase = await container.lifecycle.getCase(admin, hrCase.id);
    assert.equal(finalCase.case.status, "COMPLETED");
  });
});
