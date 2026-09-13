import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { getTestDatabaseUrl, withTestDb } from "./testDb.ts";
import { createWorkflowContainer } from "../../src/composition/container.ts";
import { createHttpServer } from "../../src/api/http.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { PERMISSIONS } from "../../src/services/access.ts";

const skip: boolean | string = getTestDatabaseUrl() ? false : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

async function startServer(db: Parameters<typeof createWorkflowContainer>[0]) {
  const container = await createWorkflowContainer(db);
  const server = createHttpServer(container);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl, container };
}

async function provisionUser(container: Awaited<ReturnType<typeof createWorkflowContainer>>, rbacRepo: ReturnType<typeof createPgRbacRepository>, email: string, adminId: string) {
  const user = await container.users.createUser({ email, accountType: "employee" });
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: `Role for ${email}` });
  for (const key of [
    PERMISSIONS.DEFINITION_READ, PERMISSIONS.DEFINITION_CREATE, PERMISSIONS.DEFINITION_UPDATE, PERMISSIONS.DEFINITION_PUBLISH, PERMISSIONS.DEFINITION_RETIRE,
    PERMISSIONS.INSTANCE_START, PERMISSIONS.INSTANCE_READ, PERMISSIONS.INSTANCE_CANCEL, PERMISSIONS.APPROVAL_DECIDE,
  ]) {
    const existing = await rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: adminId });
  await rbacRepo.grantEntityAccess({ userId: user.id, scopeType: "group", grantedBy: adminId });
  const session = await container.sessions.createSession({ userId: user.id, mfaVerified: true });
  return { user, token: session.token };
}

test("Workflow HTTP: an unauthenticated request is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/workflow/instances`);
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, "SESSION_INVALID");
    } finally {
      server.close();
    }
  });
});

test("Workflow HTTP: an invalid bearer token is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/workflow/instances`, { headers: { authorization: "Bearer not-a-real-token" } });
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });
});

test("Workflow HTTP: full flow — create draft, add step, publish, start, decide, and read history over real HTTP", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "workflow.http.fullflow.admin@example.test", accountType: "service" });
      const { user: hrUser, token } = await provisionUser(container, rbacRepo, "workflow.http.fullflow.hr@example.test", admin.id);
      const { user: approverUser, token: approverToken } = await provisionUser(container, rbacRepo, "workflow.http.fullflow.approver@example.test", admin.id);
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const auth = { authorization: `Bearer ${token}` };
      const approverAuth = { authorization: `Bearer ${approverToken}` };

      const createRes = await fetch(`${baseUrl}/api/v1/workflow/definitions`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ key: "test.http.fullflow", name: "HTTP Full Flow" }),
      });
      const createBody = await createRes.json();
      assert.equal(createRes.status, 201, JSON.stringify(createBody));
      const versionId = createBody.data.version.id;

      const stepRes = await fetch(`${baseUrl}/api/v1/workflow/versions/${versionId}/steps`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ sequenceNumber: 1, stepType: "APPROVAL", name: "Approve", assignmentMode: "USER", permittedDecisions: ["APPROVE", "REJECT"] }),
      });
      assert.equal(stepRes.status, 201);

      const publishRes = await fetch(`${baseUrl}/api/v1/workflow/versions/${versionId}/publish`, { method: "POST", headers: auth });
      const publishBody = await publishRes.json();
      assert.equal(publishRes.status, 200, JSON.stringify(publishBody));
      assert.equal(publishBody.data.version.status, "PUBLISHED");

      const startRes = await fetch(`${baseUrl}/api/v1/workflow/instances`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ definitionKey: "test.http.fullflow", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: my.id, stepAssignments: { 1: { userId: approverUser.id } } }),
      });
      const startBody = await startRes.json();
      assert.equal(startRes.status, 201, JSON.stringify(startBody));
      assert.equal(startBody.data.instance.status, "ACTIVE");
      const instanceId = startBody.data.instance.id;

      const tasksRes = await fetch(`${baseUrl}/api/v1/workflow/tasks?instanceId=${instanceId}`, { headers: approverAuth });
      const tasksBody = await tasksRes.json();
      assert.equal(tasksBody.data.tasks.length, 1);
      const taskId = tasksBody.data.tasks[0].id;

      const decideRes = await fetch(`${baseUrl}/api/v1/workflow/tasks/${taskId}/decide`, {
        method: "POST",
        headers: { ...approverAuth, "content-type": "application/json" },
        body: JSON.stringify({ decision: "APPROVE", comment: "Fictional approval comment" }),
      });
      const decideBody = await decideRes.json();
      assert.equal(decideRes.status, 200, JSON.stringify(decideBody));

      const finalRes = await fetch(`${baseUrl}/api/v1/workflow/instances/${instanceId}`, { headers: auth });
      const finalBody = await finalRes.json();
      assert.equal(finalBody.data.instance.status, "COMPLETED");
      assert.equal(finalBody.data.instance.outcome, "APPROVED");

      const historyRes = await fetch(`${baseUrl}/api/v1/workflow/instances/${instanceId}/events`, { headers: auth });
      const historyBody = await historyRes.json();
      const eventTypes = historyBody.data.events.map((e: { eventType: string }) => e.eventType);
      assert.ok(eventTypes.includes("instance_started"));
      assert.ok(eventTypes.includes("decision_recorded"));
      assert.ok(eventTypes.includes("instance_completed"));
    } finally {
      server.close();
    }
  });
});

test("Workflow HTTP: create rejects mass-assignment of server-controlled fields (id, status)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "workflow.http.massassign.admin@example.test", accountType: "service" });
      const { token } = await provisionUser(container, rbacRepo, "workflow.http.massassign.hr@example.test", admin.id);
      const auth = { authorization: `Bearer ${token}` };

      const spoofedId = randomUUID();
      const spoofedCreatedBy = randomUUID();
      const res = await fetch(`${baseUrl}/api/v1/workflow/definitions`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ key: "test.http.massassign", name: "Mass assignment test", id: spoofedId, createdBy: spoofedCreatedBy }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.notEqual(body.data.definition.id, spoofedId);
      assert.notEqual(body.data.definition.createdBy, spoofedCreatedBy, "createdBy must always be the real authenticated actor, never a client-supplied value");
    } finally {
      server.close();
    }
  });
});

test("Workflow HTTP: a denied caller requesting a known-existing instance id gets the same 404 as a nonexistent one (no IDOR / existence leak)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "workflow.http.idor.admin@example.test", accountType: "service" });
      const { user: hrUser, token: hrToken } = await provisionUser(container, rbacRepo, "workflow.http.idor.hr@example.test", admin.id);
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      void hrUser;

      const createRes = await fetch(`${baseUrl}/api/v1/workflow/definitions`, { method: "POST", headers: { authorization: `Bearer ${hrToken}`, "content-type": "application/json" }, body: JSON.stringify({ key: "test.http.idor", name: "IDOR test" }) });
      const versionId = (await createRes.json()).data.version.id;
      await fetch(`${baseUrl}/api/v1/workflow/versions/${versionId}/steps`, { method: "POST", headers: { authorization: `Bearer ${hrToken}`, "content-type": "application/json" }, body: JSON.stringify({ sequenceNumber: 1, stepType: "APPROVAL", name: "Approve", assignmentMode: "USER", permittedDecisions: ["APPROVE"] }) });
      await fetch(`${baseUrl}/api/v1/workflow/versions/${versionId}/publish`, { method: "POST", headers: { authorization: `Bearer ${hrToken}` } });
      const startRes = await fetch(`${baseUrl}/api/v1/workflow/instances`, {
        method: "POST",
        headers: { authorization: `Bearer ${hrToken}`, "content-type": "application/json" },
        body: JSON.stringify({ definitionKey: "test.http.idor", subjectType: "test.fixture", subjectId: randomUUID(), legalEntityId: my.id, stepAssignments: { 1: { userId: admin.id } } }),
      });
      const instanceId = (await startRes.json()).data.instance.id;

      const stranger = await container.users.createUser({ email: "workflow.http.idor.stranger@example.test", accountType: "employee" });
      const strangerSession = await container.sessions.createSession({ userId: stranger.id, mfaVerified: true });
      const auth = { authorization: `Bearer ${strangerSession.token}` };

      const knownRes = await fetch(`${baseUrl}/api/v1/workflow/instances/${instanceId}`, { headers: auth });
      const unknownRes = await fetch(`${baseUrl}/api/v1/workflow/instances/${randomUUID()}`, { headers: auth });
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

test("Workflow HTTP: malformed instance-start input (missing required fields) is rejected with 400", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const rbacRepo = createPgRbacRepository(db);
      const admin = await container.users.createUser({ email: "workflow.http.malformed.admin@example.test", accountType: "service" });
      const { token } = await provisionUser(container, rbacRepo, "workflow.http.malformed.hr@example.test", admin.id);

      const res = await fetch(`${baseUrl}/api/v1/workflow/instances`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ subjectType: "test.fixture" }),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
    } finally {
      server.close();
    }
  });
});
