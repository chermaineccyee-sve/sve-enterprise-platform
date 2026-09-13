/**
 * approvalService unit tests (in-memory) — exercises HRMS's OWN business
 * logic (authorisation, entity ceiling, state-machine, idempotent
 * submission, rejection reconciliation) against a FAKE
 * WorkflowSubmissionPort, never a real platform-services/workflow
 * instance — see services/workflowPort.ts's header for why approvalService
 * depends only on this narrow port. Real end-to-end behaviour against the
 * ACTUAL Workflow package is covered separately by
 * test/integration/workflowIntegration.test.ts (real Postgres).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { createRbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";
import { createInMemoryAuditRepository } from "../../../identity/src/repositories/memory/inMemoryAuditRepository.ts";
import { NotFoundError, ValidationError, InvalidTransitionError } from "../../src/domain/errors.ts";
import { PERMISSIONS } from "../../src/services/access.ts";
import { createApprovalService } from "../../src/services/approvalService.ts";
import type { WorkflowSubmissionPort, WorkflowStatusResult } from "../../src/services/workflowPort.ts";
import { setup, grantRole, actor, hireFictionalEmployee } from "./testSetup.ts";

const EMPLOYMENT_CHANGE_COMPLETION_INPUT = { employmentType: "full_time", status: "ACTIVE", startDate: "2026-03-01" };
const OFFBOARDING_COMPLETION_INPUT = { endDate: "2026-03-01", status: "RESIGNED" as const };

/** A fake, in-memory WorkflowSubmissionPort — records every call for assertion and lets a test control what `getStatus` returns. */
function createFakePort() {
  const instances = new Map<string, WorkflowStatusResult>();
  let submitCalls = 0;
  const port: WorkflowSubmissionPort = {
    async submit() {
      submitCalls++;
      const id = randomUUID();
      instances.set(id, { status: "ACTIVE", outcome: null });
      return { workflowInstanceId: id, status: "ACTIVE" };
    },
    async getStatus(_actor, workflowInstanceId) {
      return instances.get(workflowInstanceId) ?? null;
    },
  };
  return { port, instances, get submitCalls() { return submitCalls; } };
}

async function buildApprovalDeps(deps: Awaited<ReturnType<typeof setup>>, fakePort: WorkflowSubmissionPort) {
  const rbac = createRbacService({ rbac: deps.rbacRepo, organisation: deps.organisation });
  const audit = createAuditService({ audit: createInMemoryAuditRepository(deps.identityStore) });
  return createApprovalService({
    cases: deps.caseRepo,
    organisation: deps.organisation,
    rbac,
    audit,
    transactions: deps.transactions,
    lifecycle: deps.lifecycle,
    workflow: fakePort,
  });
}

test("submitForApproval denies a caller without manage_employment_change", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee A");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });

  const { port } = createFakePort();
  const approval = await buildApprovalDeps(deps, port);

  const noPermission = randomUUID();
  await assert.rejects(() => approval.submitForApproval(actor(noPermission), hrCase.id, EMPLOYMENT_CHANGE_COMPLETION_INPUT), ForbiddenError);
});

test("submitForApproval enforces entity isolation: MY-scoped permission does not cover an SG case", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.sg.id, "Fictional Approval Test Employee B");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.sg.id, hrOwnerUserId: admin, changeType: "transfer" });

  const { port } = createFakePort();
  const approval = await buildApprovalDeps(deps, port);

  const myOnlyHr = randomUUID();
  await grantRole(deps.rbacRepo, myOnlyHr, [{ key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: deps.my.id });
  await assert.rejects(() => approval.submitForApproval(actor(myOnlyHr), hrCase.id, EMPLOYMENT_CHANGE_COMPLETION_INPUT), ForbiddenError);
});

test("submitForApproval rejects an invalid/missing completionInput", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee C");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });

  const { port } = createFakePort();
  const approval = await buildApprovalDeps(deps, port);
  await assert.rejects(() => approval.submitForApproval(actor(admin), hrCase.id, { employmentType: "full_time" }), ValidationError, "startDate/status are required for an employment_change completionInput");
});

test("submitForApproval rejects a case that is not in a submittable status", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.COMPLETE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee D");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });
  await deps.lifecycle.cancelCase(actor(admin), hrCase.id);

  const { port } = createFakePort();
  const approval = await buildApprovalDeps(deps, port);
  await assert.rejects(() => approval.submitForApproval(actor(admin), hrCase.id, EMPLOYMENT_CHANGE_COMPLETION_INPUT), InvalidTransitionError);
});

test("submitForApproval rejects onboarding/probation cases — only employment_change/offboarding are submittable in this foundation", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee E");
  const onboardingCase = await deps.onboarding.createOnboardingCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, initialMilestones: [] });

  const { port } = createFakePort();
  const approval = await buildApprovalDeps(deps, port);
  await assert.rejects(() => approval.submitForApproval(actor(admin), onboardingCase.id, {}), ValidationError);
});

test("submitForApproval succeeds: case moves to PENDING_DECISION, records pendingCompletionInput, links the workflow instance, and appends approval_submitted exactly once", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee F");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });

  const fake = createFakePort();
  const approval = await buildApprovalDeps(deps, fake.port);
  const result = await approval.submitForApproval(actor(admin), hrCase.id, EMPLOYMENT_CHANGE_COMPLETION_INPUT);

  assert.equal(result.case.status, "PENDING_DECISION");
  assert.equal(result.case.workflowInstanceId, result.workflowInstanceId);
  assert.deepEqual(result.case.pendingCompletionInput, EMPLOYMENT_CHANGE_COMPLETION_INPUT);
  assert.equal(fake.submitCalls, 1);

  const events = await deps.eventRepo.listByCase(hrCase.id);
  assert.equal(events.filter((e) => e.eventType === "approval_submitted").length, 1);
});

test("submitForApproval is idempotent: a second call on an already-submitted case is a safe no-op (no second Workflow instance)", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee G");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });

  const fake = createFakePort();
  const approval = await buildApprovalDeps(deps, fake.port);
  const first = await approval.submitForApproval(actor(admin), hrCase.id, EMPLOYMENT_CHANGE_COMPLETION_INPUT);
  const second = await approval.submitForApproval(actor(admin), hrCase.id, EMPLOYMENT_CHANGE_COMPLETION_INPUT);

  assert.equal(second.workflowInstanceId, first.workflowInstanceId);
  assert.equal(fake.submitCalls, 1, "a second submission must not start a second Workflow instance");
});

test("getApprovalStatus reports not-submitted for a case never sent for approval", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee H");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });

  const fake = createFakePort();
  const approval = await buildApprovalDeps(deps, fake.port);
  const status = await approval.getApprovalStatus(actor(admin), hrCase.id);
  assert.deepEqual(status, { submitted: false, workflowInstanceId: null, status: null, outcome: null, visible: true });
});

test("getApprovalStatus reconciles a REJECTED outcome exactly once: the case returns to IN_PROGRESS and records approval_rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee I");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });

  const fake = createFakePort();
  const approval = await buildApprovalDeps(deps, fake.port);
  const submitted = await approval.submitForApproval(actor(admin), hrCase.id, EMPLOYMENT_CHANGE_COMPLETION_INPUT);
  fake.instances.set(submitted.workflowInstanceId, { status: "COMPLETED", outcome: "REJECTED" });

  const first = await approval.getApprovalStatus(actor(admin), hrCase.id);
  assert.equal(first.outcome, "REJECTED");

  const reconciledCase = await deps.caseRepo.findById(hrCase.id);
  assert.equal(reconciledCase!.status, "IN_PROGRESS", "a rejected approval must return the case to editable IN_PROGRESS, never CANCELLED");
  const events = await deps.eventRepo.listByCase(hrCase.id);
  assert.equal(events.filter((e) => e.eventType === "approval_rejected").length, 1);

  // Calling it again must not append a second approval_rejected event —
  // the case is already back at IN_PROGRESS, so reconciliation is a no-op.
  await approval.getApprovalStatus(actor(admin), hrCase.id);
  const eventsAfterSecondCall = await deps.eventRepo.listByCase(hrCase.id);
  assert.equal(eventsAfterSecondCall.filter((e) => e.eventType === "approval_rejected").length, 1);
});

test("getApprovalStatus degrades gracefully (visible: false) rather than leaking an error when the port cannot see the instance", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee J");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });

  const fake = createFakePort();
  const approval = await buildApprovalDeps(deps, fake.port);
  const submitted = await approval.submitForApproval(actor(admin), hrCase.id, EMPLOYMENT_CHANGE_COMPLETION_INPUT);
  fake.instances.delete(submitted.workflowInstanceId); // simulate a denied/not-found read from the port

  const status = await approval.getApprovalStatus(actor(admin), hrCase.id);
  assert.equal(status.submitted, true);
  assert.equal(status.visible, false);
  assert.equal(status.status, null);
});

test("getApprovalStatus is denied for a caller with no HRMS read access to the case at all (IDOR-safe: NotFoundError, not a leak)", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee K");
  const hrCase = await deps.employmentChange.createChangeCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, changeType: "promotion" });

  const fake = createFakePort();
  const approval = await buildApprovalDeps(deps, fake.port);
  const unrelated = randomUUID();
  await assert.rejects(() => approval.getApprovalStatus(actor(unrelated), hrCase.id), NotFoundError);
});

test("submitForApproval for offboarding validates its own completionInput shape (endDate/status)", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantRole(deps.rbacRepo, admin, [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.MANAGE_OFFBOARDING, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const employee = await hireFictionalEmployee(deps, deps.my.id, "Fictional Approval Test Employee L");
  const hrCase = await deps.offboarding.createOffboardingCase(actor(admin), { employeeId: employee.id, legalEntityId: deps.my.id, hrOwnerUserId: admin, separationType: "resignation" });

  const fake = createFakePort();
  const approval = await buildApprovalDeps(deps, fake.port);
  await assert.rejects(() => approval.submitForApproval(actor(admin), hrCase.id, { endDate: "2026-03-01", status: "QUIT" }), ValidationError);

  const result = await approval.submitForApproval(actor(admin), hrCase.id, OFFBOARDING_COMPLETION_INPUT);
  assert.equal(result.case.status, "PENDING_DECISION");
});
