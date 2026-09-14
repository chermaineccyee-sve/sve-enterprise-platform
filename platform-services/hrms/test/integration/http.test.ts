import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { getTestDatabaseUrl, withTestDb } from "./testDb.ts";
import { createHrmsContainer } from "../../src/composition/container.ts";
import { createHttpServer } from "../../src/api/http.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { installHrmsWorkflowDefinitions } from "../../src/integrations/workflowIntegration.ts";
import { PERMISSIONS } from "../../src/services/access.ts";
import { PERMISSIONS as ORG_PERMISSIONS } from "../../../organisation/src/services/employeeService.ts";
import { PERMISSIONS as WORKFLOW_PERMISSIONS } from "../../../workflow/src/services/access.ts";

const skip: boolean | string = getTestDatabaseUrl() ? false : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

async function startServer(db: Parameters<typeof createHrmsContainer>[0]) {
  const container = await createHrmsContainer(db);
  const server = createHttpServer(container);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl, container };
}

async function provisionHr(
  container: Awaited<ReturnType<typeof createHrmsContainer>>,
  rbacRepo: ReturnType<typeof createPgRbacRepository>,
  email: string,
  adminId: string,
) {
  const user = await container.users.createUser({ email, accountType: "employee" });
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: `Role for ${email}` });
  for (const key of [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.READ_RESTRICTED, PERMISSIONS.READ_DECISION, PERMISSIONS.MANAGE_ONBOARDING, PERMISSIONS.MANAGE_PROBATION, PERMISSIONS.MANAGE_EMPLOYMENT_CHANGE, PERMISSIONS.MANAGE_OFFBOARDING, PERMISSIONS.COMPLETE]) {
    const existing = await rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  const orgRole = await rbacRepo.createRole({ key: `role-org-${randomUUID()}`, name: `Org role for ${email}` });
  for (const key of [ORG_PERMISSIONS.CREATE, ORG_PERMISSIONS.READ, ORG_PERMISSIONS.READ_RESTRICTED, ORG_PERMISSIONS.MANAGE_ASSIGNMENT]) {
    const existing = await rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" }));
    await rbacRepo.grantPermissionToRole(orgRole.id, permission.id);
  }
  await rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: adminId });
  await rbacRepo.assignRole({ userId: user.id, roleId: orgRole.id, grantedBy: adminId });
  await rbacRepo.grantEntityAccess({ userId: user.id, scopeType: "group", grantedBy: adminId });
  const session = await container.sessions.createSession({ userId: user.id, mfaVerified: true });
  return { user, token: session.token };
}

async function hireFictional(container: Awaited<ReturnType<typeof createHrmsContainer>>, hr: { userId: string; email: string }, legalEntityId: string, legalName: string) {
  return container.orgContainer.employees.createEmployee(hr, { legalName, employmentCountry: "MY", initialAssignment: { legalEntityId, employmentType: "full_time", startDate: "2026-01-01" } });
}

test("HRMS HTTP: an unauthenticated request is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`);
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, "SESSION_INVALID");
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: an invalid bearer token is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, { headers: { authorization: "Bearer not-a-real-token" } });
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: full onboarding flow — create case, add milestone, complete milestone, complete case", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "hrms.http.onboarding.admin@example.test", accountType: "service" });
      const { user: hrUser, token } = await provisionHr(container, rbacRepo, "hrms.http.onboarding.hr@example.test", admin.id);
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const employee = await hireFictional(container, { userId: hrUser.id, email: hrUser.email }, my.id, "Fictional HTTP Onboarding Test");
      const auth = { authorization: `Bearer ${token}` };

      const createRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "onboarding", employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.id, initialMilestones: ["documentation", "orientation"] }),
      });
      const createBody = await createRes.json();
      assert.equal(createRes.status, 201, JSON.stringify(createBody));
      const created = createBody.data.case;
      assert.match(created.caseNumber, /^HR-\d{6}$/);

      const milestonesRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${created.id}/milestones`, { headers: auth });
      const milestones = (await milestonesRes.json()).data.milestones as Array<{ id: string; milestoneType: string; status: string }>;
      assert.equal(milestones.length, 2);
      const doc = milestones.find((m) => m.milestoneType === "documentation")!;

      const completeMilestoneRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${created.id}/milestones/${doc.id}`, {
        method: "PATCH",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      assert.equal(completeMilestoneRes.status, 200);

      const completeCaseRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${created.id}/complete`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ outcome: "onboarded" }) });
      const completeBody = await completeCaseRes.json();
      assert.equal(completeCaseRes.status, 200, JSON.stringify(completeBody));
      assert.equal(completeBody.data.case.status, "COMPLETED");
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: full probation flow via real HTTP — create, extend (history preserved), then confirm", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "hrms.http.probation.admin@example.test", accountType: "service" });
      const { user: hrUser, token } = await provisionHr(container, rbacRepo, "hrms.http.probation.hr@example.test", admin.id);
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const employee = await hireFictional(container, { userId: hrUser.id, email: hrUser.email }, my.id, "Fictional HTTP Probation Test");
      const auth = { authorization: `Bearer ${token}` };

      const createRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "probation", employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.id, periodStart: "2026-02-10", expectedReviewDate: "2026-05-10" }),
      });
      const created = (await createRes.json()).data.case;
      assert.equal(createRes.status, 201);

      const extendRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${created.id}/probation-decision`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ decision: "EXTENDED", decisionDate: "2026-05-05", decisionNotes: "Fictional HTTP extension notes", extension: { periodStart: "2026-05-10", expectedReviewDate: "2026-06-10" } }),
      });
      const extendBody = await extendRes.json();
      assert.equal(extendRes.status, 200, JSON.stringify(extendBody));
      assert.equal(extendBody.data.case.status, "IN_PROGRESS");
      assert.ok(extendBody.data.extension, "the response must include the new extension review period");

      const reviewsRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${created.id}/probation-reviews`, { headers: auth });
      const reviews = (await reviewsRes.json()).data.reviews as Array<{ sequenceNumber: number; periodStart: string; decision: string | null }>;
      assert.equal(reviews.length, 2, "both the original and extended periods must be visible via the API");
      assert.equal(reviews[0]!.decision, "EXTENDED", "the original period's decision remains recorded, never erased");

      const confirmRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${created.id}/probation-decision`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ decision: "CONFIRMED", decisionDate: "2026-06-01" }),
      });
      const confirmBody = await confirmRes.json();
      assert.equal(confirmRes.status, 200, JSON.stringify(confirmBody));
      assert.equal(confirmBody.data.case.status, "COMPLETED");

      // outcome is a restricted-tier field, not part of the base write
      // response (serializeCaseBase) — fetch the full view to confirm it.
      const finalViewRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${created.id}`, { headers: auth });
      const finalView = (await finalViewRes.json()).data.case;
      assert.equal(finalView.restricted.outcome, "CONFIRMED");
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: create rejects mass-assignment of server-controlled fields (id, caseNumber, status)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "hrms.http.massassign.admin@example.test", accountType: "service" });
      const { user: hrUser, token } = await provisionHr(container, rbacRepo, "hrms.http.massassign.hr@example.test", admin.id);
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const employee = await hireFictional(container, { userId: hrUser.id, email: hrUser.email }, my.id, "Fictional HTTP Mass Assignment Test");

      const spoofedId = randomUUID();
      const res = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "onboarding", employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.id, id: spoofedId, caseNumber: "HR-999999", status: "COMPLETED" }),
      });
      assert.equal(res.status, 201);
      const created = (await res.json()).data.case;
      assert.notEqual(created.id, spoofedId);
      assert.notEqual(created.caseNumber, "HR-999999");
      assert.equal(created.status, "IN_PROGRESS");
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: a denied caller requesting a known-existing case id gets the same 404 as a nonexistent one (no IDOR / existence leak)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "hrms.http.idor.admin@example.test", accountType: "service" });
      const { user: hrUser, token: hrToken } = await provisionHr(container, rbacRepo, "hrms.http.idor.hr@example.test", admin.id);
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const employee = await hireFictional(container, { userId: hrUser.id, email: hrUser.email }, my.id, "Fictional HTTP IDOR Test");

      const createRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { authorization: `Bearer ${hrToken}`, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "onboarding", employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.id }),
      });
      const created = (await createRes.json()).data.case;

      const stranger = await container.users.createUser({ email: "hrms.http.idor.stranger@example.test", accountType: "employee" });
      const strangerSession = await container.sessions.createSession({ userId: stranger.id, mfaVerified: true });
      const auth = { authorization: `Bearer ${strangerSession.token}` };

      const knownRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${created.id}`, { headers: auth });
      const unknownRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${randomUUID()}`, { headers: auth });
      assert.equal(knownRes.status, 404);
      assert.equal(unknownRes.status, 404);
      const knownBody = await knownRes.json();
      const unknownBody = await unknownRes.json();
      assert.equal(knownBody.error.code, unknownBody.error.code);
      assert.equal(knownBody.error.message, unknownBody.error.message, "identical error for existing-but-forbidden vs. genuinely nonexistent");
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: malformed create input (missing required fields) is rejected with 400", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "hrms.http.malformed.admin@example.test", accountType: "service" });
      const { user: hrUser, token } = await provisionHr(container, rbacRepo, "hrms.http.malformed.hr@example.test", admin.id);

      const res = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "onboarding" }),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: an unrecognised lifecycleType is rejected with 400", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "hrms.http.badtype.admin@example.test", accountType: "service" });
      const { user: hrUser, token } = await provisionHr(container, rbacRepo, "hrms.http.badtype.hr@example.test", admin.id);
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;

      const res = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "not_a_real_type", employeeId: randomUUID(), legalEntityId: my.id, hrOwnerUserId: admin.id }),
      });
      assert.equal(res.status, 400);
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: full employment-change flow completes through real Organisation, and full offboarding flow ends the assignment without deleting the Identity user", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "hrms.http.lifecycle.admin@example.test", accountType: "service" });
      const { user: hrUser, token } = await provisionHr(container, rbacRepo, "hrms.http.lifecycle.hr@example.test", admin.id);
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const employee = await hireFictional(container, { userId: hrUser.id, email: hrUser.email }, my.id, "Fictional HTTP Change+Offboard Test");
      const linkedUser = await container.users.createUser({ email: `hrms.http.linked.${randomUUID()}@example.test`, accountType: "employee" });
      await container.users.linkEmployee({ userId: linkedUser.id, employeeId: employee.id, linkedBy: admin.id });
      const auth = { authorization: `Bearer ${token}` };

      const changeCaseRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "employment_change", employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.id, changeType: "promotion" }),
      });
      const changeCase = (await changeCaseRes.json()).data.case;

      const changeCompleteRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${changeCase.id}/employment-change/complete`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ legalEntityId: my.id, employmentType: "full_time", status: "ACTIVE", startDate: "2026-07-01", effectiveFrom: "2026-07-01" }),
      });
      const changeCompleteBody = await changeCompleteRes.json();
      assert.equal(changeCompleteRes.status, 200, JSON.stringify(changeCompleteBody));
      assert.equal(changeCompleteBody.data.case.status, "COMPLETED");
      assert.ok(changeCompleteBody.data.assignment.id);

      const offboardCaseRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "offboarding", employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: admin.id, separationType: "resignation", clearanceMilestones: ["access_removal"] }),
      });
      const offboardCase = (await offboardCaseRes.json()).data.case;

      // PR #13: before completion, no deactivation request exists yet.
      const beforeStatusRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${offboardCase.id}/deactivation-status`, { headers: auth });
      const beforeStatusBody = await beforeStatusRes.json();
      assert.equal(beforeStatusRes.status, 200, JSON.stringify(beforeStatusBody));
      assert.equal(beforeStatusBody.data.status, "not_requested");

      const offboardCompleteRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${offboardCase.id}/offboarding/complete`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ endDate: "2026-08-01", status: "RESIGNED" }),
      });
      const offboardCompleteBody = await offboardCompleteRes.json();
      assert.equal(offboardCompleteRes.status, 200, JSON.stringify(offboardCompleteBody));
      assert.equal(offboardCompleteBody.data.case.status, "COMPLETED");

      const stillLinkedUser = await container.users.findById(linkedUser.id);
      assert.ok(stillLinkedUser, "the departing employee's Identity user record must never be deleted");
      assert.equal(stillLinkedUser!.status, "active", "offboarding completion must never itself deactivate the Identity account");

      const eventsRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${offboardCase.id}/events`, { headers: auth });
      const events = (await eventsRes.json()).data.events as Array<{ eventType: string }>;
      assert.ok(events.some((e) => e.eventType === "identity_deactivation_requested"));

      // PR #13: after completion, a durable request row exists — surfaced
      // as "requested" (the processor sweep has not run in this test).
      const afterStatusRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${offboardCase.id}/deactivation-status`, { headers: auth });
      const afterStatusBody = await afterStatusRes.json();
      assert.equal(afterStatusRes.status, 200);
      assert.equal(afterStatusBody.data.status, "requested");

      // An unauthorised caller gets the same 404 the case itself would give.
      const strangerSession = await container.sessions.createSession({ userId: (await container.users.createUser({ email: `hrms.http.deactivation.stranger.${randomUUID()}@example.test`, accountType: "employee" })).id, mfaVerified: true });
      const deniedStatusRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${offboardCase.id}/deactivation-status`, { headers: { authorization: `Bearer ${strangerSession.token}` } });
      assert.equal(deniedStatusRes.status, 404, "an unauthorised caller must not learn anything about this case's deactivation status");
    } finally {
      server.close();
    }
  });
});

async function provisionWorkflowHr(
  container: Awaited<ReturnType<typeof createHrmsContainer>>,
  rbacRepo: ReturnType<typeof createPgRbacRepository>,
  email: string,
  adminId: string,
) {
  const hr = await provisionHr(container, rbacRepo, email, adminId);
  const role = await rbacRepo.createRole({ key: `role-workflow-${randomUUID()}`, name: `Workflow role for ${email}` });
  for (const key of [WORKFLOW_PERMISSIONS.DEFINITION_READ, WORKFLOW_PERMISSIONS.DEFINITION_CREATE, WORKFLOW_PERMISSIONS.DEFINITION_UPDATE, WORKFLOW_PERMISSIONS.DEFINITION_PUBLISH, WORKFLOW_PERMISSIONS.INSTANCE_START, WORKFLOW_PERMISSIONS.INSTANCE_READ]) {
    const existing = await rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId: hr.user.id, roleId: role.id, grantedBy: adminId });
  return hr;
}

test("HRMS HTTP: submit-for-approval is denied without authentication", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${randomUUID()}/submit-for-approval`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ completionInput: {} }) });
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });
});

test("HRMS HTTP: full submit-for-approval -> Workflow decision -> completion flow over real HTTP, and IDOR-safe approval status for an unrelated caller", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "hrms.http.workflow.admin@example.test", accountType: "service" });
      const { user: hrUser, token } = await provisionWorkflowHr(container, rbacRepo, "hrms.http.workflow.hr@example.test", admin.id);
      await installHrmsWorkflowDefinitions(container.workflow, { userId: hrUser.id, email: hrUser.email });

      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const employee = await hireFictional(container, { userId: hrUser.id, email: hrUser.email }, my.id, "Fictional HTTP Approval Test");
      const auth = { authorization: `Bearer ${token}` };

      const createRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "employment_change", employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hrUser.id, changeType: "promotion" }),
      });
      const hrCase = (await createRes.json()).data.case;

      const submitRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${hrCase.id}/submit-for-approval`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ completionInput: { employmentType: "full_time", status: "ACTIVE", startDate: "2026-09-01", effectiveFrom: "2026-09-01" } }),
      });
      const submitBody = await submitRes.json();
      assert.equal(submitRes.status, 200, JSON.stringify(submitBody));
      assert.equal(submitBody.data.case.status, "PENDING_DECISION");
      const workflowInstanceId = submitBody.data.workflowInstanceId as string;
      assert.ok(workflowInstanceId);

      // PR #13: the Employment Changes case-detail view's "proposed
      // change" projection — allowlisted fields only, server-side, never
      // trusting the frontend to hide what was actually sent. A SEPARATE
      // case is used here (left at PENDING_DECISION, never decided) so
      // planting a raw assignment id in completionInput cannot affect the
      // main flow's own completion below — reportsToAssignmentId is a
      // real, permission-checked field once completion actually runs
      // createAssignment(), which is exactly why this projection must
      // never echo it back regardless.
      const projectionCaseRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ lifecycleType: "employment_change", employeeId: employee.id, legalEntityId: my.id, hrOwnerUserId: hrUser.id, changeType: "promotion" }),
      });
      const projectionCase = (await projectionCaseRes.json()).data.case;
      const plantedAssignmentId = randomUUID();
      const projectionSubmitRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${projectionCase.id}/submit-for-approval`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ completionInput: { employmentType: "full_time", status: "ACTIVE", startDate: "2026-09-01", effectiveFrom: "2026-09-01", positionId: "pos-fictional-1", reportsToAssignmentId: plantedAssignmentId, someUnexpectedInternalField: "must-not-leak" } }),
      });
      assert.equal(projectionSubmitRes.status, 200, JSON.stringify(await projectionSubmitRes.json()));

      const pendingCaseRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${projectionCase.id}`, { headers: auth });
      const pendingCaseBody = await pendingCaseRes.json();
      const proposedChange = pendingCaseBody.data.case.restricted.proposedChange;
      assert.deepEqual(proposedChange, { employmentType: "full_time", status: "ACTIVE", startDate: "2026-09-01", effectiveFrom: "2026-09-01", positionId: "pos-fictional-1" });
      const pendingSerialized = JSON.stringify(pendingCaseBody);
      assert.ok(!pendingSerialized.includes(plantedAssignmentId), "reportsToAssignmentId must never be echoed back in the proposedChange projection");
      assert.ok(!pendingSerialized.includes("must-not-leak"), "an unrecognised field in a caller-supplied completionInput must never be echoed back raw");

      // The approver's decision itself goes through Workflow's own
      // service layer (its own HTTP surface is Workflow's own, already
      // covered by PR #8's own HTTP tests) — this test's own HTTP surface
      // is HRMS's two new endpoints.
      const tasks = await container.workflow.tasks.listAssignedTasks({ userId: hrUser.id, email: hrUser.email }, { instanceId: workflowInstanceId });
      assert.equal(tasks.length, 1, "the HR user (holding manage_employment_change) must be resolved as the ROLE candidate");
      await container.workflow.tasks.decide({ userId: hrUser.id, email: hrUser.email }, tasks[0]!.id, { decision: "APPROVE" });

      const statusRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${hrCase.id}/approval`, { headers: auth });
      const statusBody = await statusRes.json();
      assert.equal(statusRes.status, 200);
      assert.equal(statusBody.data.status, "COMPLETED");
      assert.equal(statusBody.data.submitted, true);

      // IDOR: an unrelated caller with no HRMS read access to this case
      // must get the SAME 404 as a nonexistent case, never a 403 that
      // would confirm the case's existence.
      const unrelated = await container.users.createUser({ email: `hrms.http.workflow.unrelated.${randomUUID()}@example.test`, accountType: "employee" });
      const unrelatedSession = await container.sessions.createSession({ userId: unrelated.id, mfaVerified: true });
      const unrelatedAuth = { authorization: `Bearer ${unrelatedSession.token}` };
      const deniedRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${hrCase.id}/approval`, { headers: unrelatedAuth });
      const nonexistentRes = await fetch(`${baseUrl}/api/v1/hrms/lifecycle/cases/${randomUUID()}/approval`, { headers: unrelatedAuth });
      assert.equal(deniedRes.status, nonexistentRes.status);
      assert.equal(deniedRes.status, 404);
    } finally {
      server.close();
    }
  });
});
