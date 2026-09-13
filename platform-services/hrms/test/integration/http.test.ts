import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { getTestDatabaseUrl, withTestDb } from "./testDb.ts";
import { createHrmsContainer } from "../../src/composition/container.ts";
import { createHttpServer } from "../../src/api/http.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { PERMISSIONS } from "../../src/services/access.ts";
import { PERMISSIONS as ORG_PERMISSIONS } from "../../../organisation/src/services/employeeService.ts";

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
    } finally {
      server.close();
    }
  });
});
