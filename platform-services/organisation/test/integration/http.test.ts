import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { getTestDatabaseUrl, withTestDb } from "./testDb.ts";
import { createOrganisationContainer } from "../../src/composition/container.ts";
import { createHttpServer } from "../../src/api/http.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { PERMISSIONS } from "../../src/services/employeeService.ts";

const skip: boolean | string = getTestDatabaseUrl()
  ? false
  : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

async function startServer(db: Parameters<typeof createOrganisationContainer>[0]) {
  const container = await createOrganisationContainer(db);
  const server = createHttpServer(container);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl, container };
}

/** Grants a fresh role with the given Employee Master permissions, scoped to one legal entity, and returns the user + a bearer session token. */
async function provisionUser(
  container: Awaited<ReturnType<typeof createOrganisationContainer>>,
  rbacRepo: ReturnType<typeof createPgRbacRepository>,
  email: string,
  permissionKeys: string[],
  scope: { scopeType: "group" } | { scopeType: "legal_entity"; legalEntityId: string },
  adminId: string,
  maxClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PRIVILEGED" = "CONFIDENTIAL",
) {
  const user = await container.users.createUser({ email, accountType: "employee" });
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: `Role for ${email}` });
  for (const key of permissionKeys) {
    const existing = await rbacRepo.findPermissionByKey(key);
    const permission = existing ?? (await rbacRepo.createPermission({ key, maxClassification }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: adminId });
  await rbacRepo.grantEntityAccess({ userId: user.id, ...scope, grantedBy: adminId } as Parameters<typeof rbacRepo.grantEntityAccess>[0]);
  const session = await container.sessions.createSession({ userId: user.id, mfaVerified: true });
  return { user, token: session.token };
}

const FULL_PERMS = [
  PERMISSIONS.CREATE,
  PERMISSIONS.READ,
  PERMISSIONS.READ_RESTRICTED,
  PERMISSIONS.UPDATE,
  PERMISSIONS.MANAGE_ASSIGNMENT,
  PERMISSIONS.MANAGE_REPORTING,
  PERMISSIONS.LINK_IDENTITY,
];

const hireBody = (legalEntityId: string, overrides: Record<string, unknown> = {}) => ({
  legalName: "Fictional HTTP Test Employee",
  employmentCountry: "MY",
  initialAssignment: { legalEntityId, employmentType: "full_time", startDate: "2026-01-01" },
  ...overrides,
});

test("Organisation: an unauthenticated request to the employees API is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/employees`);
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, "SESSION_INVALID");
    } finally {
      server.close();
    }
  });
});

test("Organisation: an invalid/garbage bearer token is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/employees`, { headers: { authorization: "Bearer not-a-real-token" } });
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });
});

test("Organisation: a revoked session is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const user = await container.users.createUser({ email: "org.http.revoked@example.test", accountType: "employee" });
      const created = await container.sessions.createSession({ userId: user.id, mfaVerified: false });
      await container.sessions.revokeSession(created.session.id, "test");
      const res = await fetch(`${baseUrl}/api/v1/employees`, { headers: { authorization: `Bearer ${created.token}` } });
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });
});

test("Organisation: legal-entities reference endpoint requires authentication but no special permission", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const unauth = await fetch(`${baseUrl}/api/v1/organisation/legal-entities`);
      assert.equal(unauth.status, 401);

      const user = await container.users.createUser({ email: "org.http.entities@example.test", accountType: "employee" });
      const created = await container.sessions.createSession({ userId: user.id, mfaVerified: false });
      const res = await fetch(`${baseUrl}/api/v1/organisation/legal-entities`, { headers: { authorization: `Bearer ${created.token}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.legalEntities.length, 3);
    } finally {
      server.close();
    }
  });
});

test("Organisation: full authorised hire -> read -> transfer -> end-of-employment flow over real HTTP", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const sg = entities.find((e) => e.key === "sve-international-sg")!;
      const admin = await container.users.createUser({ email: "org.http.fullflow.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { token } = await provisionUser(container, rbacRepo, "org.http.fullflow.hr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);
      const auth = { authorization: `Bearer ${token}` };

      const createRes = await fetch(`${baseUrl}/api/v1/employees`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify(hireBody(my.id)),
      });
      const createBody = await createRes.json();
      assert.equal(createRes.status, 201, JSON.stringify(createBody));
      const employee = createBody.data.employee;
      assert.match(employee.employeeNumber, /^EMP-\d{6}$/);

      const getRes = await fetch(`${baseUrl}/api/v1/employees/${employee.id}`, { headers: auth });
      assert.equal(getRes.status, 200);
      const view = (await getRes.json()).data.employee;
      assert.equal(view.restricted.currentAssignment.status, "PRE_HIRE");

      const transferRes = await fetch(`${baseUrl}/api/v1/employees/${employee.id}/assignments`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ legalEntityId: sg.id, employmentType: "full_time", status: "ACTIVE", startDate: "2027-01-01", effectiveFrom: "2027-01-01", changeReason: "HTTP test transfer" }),
      });
      assert.equal(transferRes.status, 201, await transferRes.text());

      const historyRes = await fetch(`${baseUrl}/api/v1/employees/${employee.id}/assignments`, { headers: auth });
      const history = (await historyRes.json()).data.assignments as Array<{ legalEntityId: string; effectiveTo: string | null }>;
      assert.equal(history.length, 2, "the original MY assignment row must be preserved as history, not overwritten");
      assert.ok(history.some((a) => a.legalEntityId === my.id && a.effectiveTo !== null));
      assert.ok(history.some((a) => a.legalEntityId === sg.id && a.effectiveTo === null));

      const endRes = await fetch(`${baseUrl}/api/v1/employees/${employee.id}/end-assignment`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ endDate: "2027-06-30", status: "RESIGNED" }),
      });
      const endBody = await endRes.json();
      assert.equal(endRes.status, 200, JSON.stringify(endBody));
      assert.equal(endBody.data.assignment.status, "RESIGNED");
    } finally {
      server.close();
    }
  });
});

test("Organisation: create rejects mass-assignment of server-controlled fields (id, employeeNumber, status)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const admin = await container.users.createUser({ email: "org.http.massassign.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { token } = await provisionUser(container, rbacRepo, "org.http.massassign.hr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);
      const spoofedId = randomUUID();

      const createRes = await fetch(`${baseUrl}/api/v1/employees`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(hireBody(my.id, { id: spoofedId, employeeNumber: "EMP-999999", createdBy: "someone-else", initialAssignment: { legalEntityId: my.id, employmentType: "full_time", startDate: "2026-01-01", status: "ACTIVE" } })),
      });
      assert.equal(createRes.status, 201);
      const employee = (await createRes.json()).data.employee;
      assert.notEqual(employee.id, spoofedId, "client-supplied id must never be honoured");
      assert.notEqual(employee.employeeNumber, "EMP-999999", "client-supplied employeeNumber must never be honoured");
    } finally {
      server.close();
    }
  });
});

test("Organisation: malformed create input (missing required fields) is rejected with 400", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const admin = await container.users.createUser({ email: "org.http.malformed.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { token } = await provisionUser(container, rbacRepo, "org.http.malformed.hr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);

      const res = await fetch(`${baseUrl}/api/v1/employees`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ legalName: "Missing Fields Test" }),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
    } finally {
      server.close();
    }
  });
});

test("Organisation: a denied caller requesting a known-existing employee id gets the same 404 as a nonexistent one (no IDOR / existence leak)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const admin = await container.users.createUser({ email: "org.http.idor.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { user: hr, token: hrToken } = await provisionUser(container, rbacRepo, "org.http.idor.hr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);
      void hr;

      const createRes = await fetch(`${baseUrl}/api/v1/employees`, {
        method: "POST",
        headers: { authorization: `Bearer ${hrToken}`, "content-type": "application/json" },
        body: JSON.stringify(hireBody(my.id)),
      });
      const employee = (await createRes.json()).data.employee;

      const stranger = await container.users.createUser({ email: "org.http.idor.stranger@example.test", accountType: "employee" });
      const strangerSession = await container.sessions.createSession({ userId: stranger.id, mfaVerified: true });
      const auth = { authorization: `Bearer ${strangerSession.token}` };

      const knownIdRes = await fetch(`${baseUrl}/api/v1/employees/${employee.id}`, { headers: auth });
      const unknownIdRes = await fetch(`${baseUrl}/api/v1/employees/${randomUUID()}`, { headers: auth });
      assert.equal(knownIdRes.status, 404);
      assert.equal(unknownIdRes.status, 404);
      const knownBody = await knownIdRes.json();
      const unknownBody = await unknownIdRes.json();
      assert.equal(knownBody.error.code, unknownBody.error.code);
      assert.equal(knownBody.error.message, unknownBody.error.message, "identical error for existing-but-forbidden vs. genuinely nonexistent");
    } finally {
      server.close();
    }
  });
});

test("Organisation: entity isolation — a legal-entity-scoped caller cannot list or read employees outside their entity", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const sg = entities.find((e) => e.key === "sve-international-sg")!;
      const admin = await container.users.createUser({ email: "org.http.isolation.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { token: groupHrToken } = await provisionUser(container, rbacRepo, "org.http.isolation.grouphr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);

      const myCreateRes = await fetch(`${baseUrl}/api/v1/employees`, {
        method: "POST",
        headers: { authorization: `Bearer ${groupHrToken}`, "content-type": "application/json" },
        body: JSON.stringify(hireBody(my.id)),
      });
      const myEmployee = (await myCreateRes.json()).data.employee;
      const sgCreateRes = await fetch(`${baseUrl}/api/v1/employees`, {
        method: "POST",
        headers: { authorization: `Bearer ${groupHrToken}`, "content-type": "application/json" },
        body: JSON.stringify(hireBody(sg.id)),
      });
      const sgEmployee = (await sgCreateRes.json()).data.employee;

      const { token: myOnlyToken } = await provisionUser(
        container,
        rbacRepo,
        "org.http.isolation.myonly@example.test",
        [PERMISSIONS.READ, PERMISSIONS.READ_RESTRICTED],
        { scopeType: "legal_entity", legalEntityId: my.id },
        admin.id,
      );
      const auth = { authorization: `Bearer ${myOnlyToken}` };

      const listRes = await fetch(`${baseUrl}/api/v1/employees`, { headers: auth });
      const list = (await listRes.json()).data.employees as Array<{ id: string }>;
      assert.ok(list.some((e) => e.id === myEmployee.id), "MY employee must be visible to a MY-scoped caller");
      assert.ok(!list.some((e) => e.id === sgEmployee.id), "SG employee must not be visible to a MY-scoped caller");

      const sgReadRes = await fetch(`${baseUrl}/api/v1/employees/${sgEmployee.id}`, { headers: auth });
      assert.equal(sgReadRes.status, 404, "reading an out-of-scope employee must be denied as not-found, not forbidden");
    } finally {
      server.close();
    }
  });
});

test("Organisation: directory vs. restricted field masking — a caller with base read but not read_restricted never receives restricted-HR fields", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const admin = await container.users.createUser({ email: "org.http.masking.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { token: hrToken } = await provisionUser(container, rbacRepo, "org.http.masking.hr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);

      const createRes = await fetch(`${baseUrl}/api/v1/employees`, {
        method: "POST",
        headers: { authorization: `Bearer ${hrToken}`, "content-type": "application/json" },
        body: JSON.stringify(hireBody(my.id, { personalEmail: "fictional.personal@example.test" })),
      });
      const employee = (await createRes.json()).data.employee;

      const { token: directoryOnlyToken } = await provisionUser(
        container,
        rbacRepo,
        "org.http.masking.directoryonly@example.test",
        [PERMISSIONS.READ],
        { scopeType: "group" },
        admin.id,
      );
      const getRes = await fetch(`${baseUrl}/api/v1/employees/${employee.id}`, { headers: { authorization: `Bearer ${directoryOnlyToken}` } });
      assert.equal(getRes.status, 200);
      const view = (await getRes.json()).data.employee;
      assert.equal(view.restricted, null, "restricted-HR fields must never be present without read_restricted");
      assert.ok(view.legalName, "directory-level fields must still be visible");
      assert.equal(JSON.stringify(view).includes("fictional.personal@example.test"), false, "personalEmail is a restricted field and must not leak into the directory-level view");
    } finally {
      server.close();
    }
  });
});

test("Organisation: identity link/unlink — an employee can be linked to and unlinked from a user account, and audited", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const admin = await container.users.createUser({ email: "org.http.link.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { token: hrToken } = await provisionUser(container, rbacRepo, "org.http.link.hr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);
      const auth = { authorization: `Bearer ${hrToken}` };

      const createRes = await fetch(`${baseUrl}/api/v1/employees`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(hireBody(my.id)) });
      const employee = (await createRes.json()).data.employee;
      const targetUser = await container.users.createUser({ email: "org.http.link.target@example.test", accountType: "employee" });

      const linkRes = await fetch(`${baseUrl}/api/v1/employees/${employee.id}/link-identity`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id }),
      });
      assert.equal(linkRes.status, 200, await linkRes.text());

      const activeLink = await container.users.findActiveLinkByEmployeeId(employee.id);
      assert.equal(activeLink?.userId, targetUser.id);

      const unlinkRes = await fetch(`${baseUrl}/api/v1/employees/${employee.id}/unlink-identity`, { method: "POST", headers: auth });
      assert.equal(unlinkRes.status, 200, await unlinkRes.text());
      const afterUnlink = await container.users.findActiveLinkByEmployeeId(employee.id);
      assert.equal(afterUnlink, null);

      const auditRows = await db.query<{ action: string }>(`SELECT action FROM security_audit_events WHERE resource_id = $1 AND resource_type = 'employee'`, [employee.id]);
      const actions = auditRows.rows.map((r) => r.action);
      assert.ok(actions.includes("employee_master.identity.linked"));
      assert.ok(actions.includes("employee_master.identity.unlinked"));
    } finally {
      server.close();
    }
  });
});

test("Organisation: an employee cannot be linked to a user account that already has an active link (one primary user-account per employee)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const admin = await container.users.createUser({ email: "org.http.doublelink.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { token: hrToken } = await provisionUser(container, rbacRepo, "org.http.doublelink.hr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);
      const auth = { authorization: `Bearer ${hrToken}` };

      const employeeA = (await (await fetch(`${baseUrl}/api/v1/employees`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(hireBody(my.id)) })).json()).data.employee;
      const employeeB = (await (await fetch(`${baseUrl}/api/v1/employees`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(hireBody(my.id)) })).json()).data.employee;
      const sharedUser = await container.users.createUser({ email: "org.http.doublelink.shared@example.test", accountType: "employee" });

      const firstLink = await fetch(`${baseUrl}/api/v1/employees/${employeeA.id}/link-identity`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ userId: sharedUser.id }) });
      assert.equal(firstLink.status, 200);

      const secondLink = await fetch(`${baseUrl}/api/v1/employees/${employeeB.id}/link-identity`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ userId: sharedUser.id }) });
      assert.equal(secondLink.status, 400);
      assert.equal((await secondLink.json()).error.code, "VALIDATION_ERROR");
    } finally {
      server.close();
    }
  });
});

test("Organisation: creating an Employee Master record never provisions an Identity login account", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const admin = await container.users.createUser({ email: "org.http.noautologin.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const { token: hrToken } = await provisionUser(container, rbacRepo, "org.http.noautologin.hr@example.test", FULL_PERMS, { scopeType: "group" }, admin.id);

      const beforeCount = await db.query<{ count: string }>(`SELECT count(*)::text FROM users`);
      const createRes = await fetch(`${baseUrl}/api/v1/employees`, {
        method: "POST",
        headers: { authorization: `Bearer ${hrToken}`, "content-type": "application/json" },
        body: JSON.stringify(hireBody(my.id, { workEmail: "org.http.noautologin.newhire@example.test" })),
      });
      assert.equal(createRes.status, 201);
      const afterCount = await db.query<{ count: string }>(`SELECT count(*)::text FROM users`);
      assert.equal(afterCount.rows[0]!.count, beforeCount.rows[0]!.count, "creating an employee must never insert a new Identity user row");
    } finally {
      server.close();
    }
  });
});

test("Organisation: organisation-structure write (create department) requires the manage permission, distinct from read access", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const admin = await container.users.createUser({ email: "org.http.deptperm.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const readOnlyUser = await container.users.createUser({ email: "org.http.deptperm.readonly@example.test", accountType: "employee" });
      const readOnlySession = await container.sessions.createSession({ userId: readOnlyUser.id, mfaVerified: true });

      const deniedRes = await fetch(`${baseUrl}/api/v1/organisation/departments`, {
        method: "POST",
        headers: { authorization: `Bearer ${readOnlySession.token}`, "content-type": "application/json" },
        body: JSON.stringify({ legalEntityId: my.id, name: "Fictional Dept", code: `FD-${randomUUID().slice(0, 6)}` }),
      });
      assert.equal(deniedRes.status, 403);

      const { token: managerToken } = await provisionUser(container, rbacRepo, "org.http.deptperm.manager@example.test", ["organisation.manage"], { scopeType: "legal_entity", legalEntityId: my.id }, admin.id);
      const allowedRes = await fetch(`${baseUrl}/api/v1/organisation/departments`, {
        method: "POST",
        headers: { authorization: `Bearer ${managerToken}`, "content-type": "application/json" },
        body: JSON.stringify({ legalEntityId: my.id, name: "Fictional Dept", code: `FD-${randomUUID().slice(0, 6)}` }),
      });
      assert.equal(allowedRes.status, 201, await allowedRes.text());
    } finally {
      server.close();
    }
  });
});
