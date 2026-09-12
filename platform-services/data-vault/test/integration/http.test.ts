import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import { getTestDatabaseUrl, withTestDb } from "./testDb.ts";
import { createDataVaultContainer } from "../../src/composition/container.ts";
import { createHttpServer } from "../../src/api/http.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { PERMISSIONS } from "../../src/services/dataVaultService.ts";

const skip: boolean | string = getTestDatabaseUrl()
  ? false
  : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

const SVEGIP_BRIDGE_SECRET = "fictional-http-test-svegip-bridge-secret";
process.env.SVEGIP_SESSION_SECRET ??= SVEGIP_BRIDGE_SECRET;

const TRUSTED_ORIGIN = "https://portal.sve-http-test.example";
process.env.SVE_DATA_VAULT_TRUSTED_ORIGINS ??= TRUSTED_ORIGIN;

async function startServer(db: Parameters<typeof createDataVaultContainer>[0]) {
  const container = await createDataVaultContainer(db);
  const server = createHttpServer(container);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl, container };
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function buildSvegipCookie(email: string, secret = SVEGIP_BRIDGE_SECRET): string {
  const payload = toBase64Url(Buffer.from(JSON.stringify({ email, role: "Employee", exp: Date.now() + 3600_000 }), "utf8"));
  const signature = toBase64Url(createHmac("sha256", secret).update(payload, "utf8").digest());
  return `svegip_session=${payload}.${signature}`;
}

const dataVaultBaseInput = (legalEntityId: string, overrides: Record<string, unknown> = {}) => ({
  legalEntityId,
  jurisdiction: "Malaysia",
  category: "Regulatory",
  topic: "HTTP integration evidence",
  source: "Official authority",
  tier: "Tier 1",
  confidence: "High",
  classification: "INTERNAL",
  ...overrides,
});

/** Grants a fresh role with the given Data Vault permissions, scoped to one legal entity, and returns the user. */
async function provisionUser(
  container: Awaited<ReturnType<typeof createDataVaultContainer>>,
  rbacRepo: ReturnType<typeof createPgRbacRepository>,
  email: string,
  permissionKeys: string[],
  legalEntityId: string,
  adminId: string,
) {
  const user = await container.users.createUser({ email, accountType: "employee" });
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: `Role for ${email}` });
  for (const key of permissionKeys) {
    const permission = await rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" });
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: adminId });
  await rbacRepo.grantEntityAccess({ userId: user.id, scopeType: "legal_entity", legalEntityId, grantedBy: adminId });
  return user;
}

test("Data Vault: an unauthenticated request is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, "SESSION_INVALID");
    } finally {
      server.close();
    }
  });
});

test("Data Vault: an invalid/garbage bearer token is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, { headers: { authorization: "Bearer not-a-real-token" } });
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });
});

test("Data Vault: a revoked session is denied", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const user = await container.users.createUser({ email: "vault.http.revoked@example.test", accountType: "employee" });
      const created = await container.sessions.createSession({ userId: user.id, mfaVerified: false });
      await container.sessions.revokeSession(created.session.id, "test");
      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, { headers: { authorization: `Bearer ${created.token}` } });
      assert.equal(res.status, 401);
    } finally {
      server.close();
    }
  });
});

test("Data Vault: a SVEGIP-authenticated caller with no corresponding Identity user is denied provisioning, never trusted", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      // GET — safe method, so this exercises provisioning denial without the origin check being a factor.
      const cookie = buildSvegipCookie("not.provisioned@example.test");
      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, { headers: { cookie } });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error.code, "IDENTITY_NOT_PROVISIONED");
    } finally {
      server.close();
    }
  });
});

test("Data Vault: a valid SVEGIP session cookie authenticates a GET once provisioned in Identity, and its embedded role is never trusted for authorization", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "bridge.provisioned@example.test";
      const admin = await container.users.createUser({ email: "bridge.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);

      // Note: the SVEGIP cookie below claims role "Employee" with no
      // elevated permissions — yet this user IS granted real read+create
      // access here, entirely through this service's own RBAC tables,
      // never through the cookie's claims.
      const user = await provisionUser(container, rbacRepo, email, [PERMISSIONS.READ, PERMISSIONS.CREATE], my.id, admin.id);
      const created = await container.dataVault.createRecord({ userId: user.id, email }, dataVaultBaseInput(my.id) as never);

      const cookie = buildSvegipCookie(email);
      const res = await fetch(`${baseUrl}/api/v1/data-vault/records/${created.id}`, { headers: { cookie } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.record.id, created.id);
    } finally {
      server.close();
    }
  });
});

test("Data Vault CSRF/origin protection: cookie-authenticated POST with a trusted Origin succeeds when RBAC permits", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "csrf.trusted.origin@example.test";
      const admin = await container.users.createUser({ email: "csrf.trusted.origin.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      await provisionUser(container, rbacRepo, email, [PERMISSIONS.CREATE], my.id, admin.id);

      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { cookie: buildSvegipCookie(email), origin: TRUSTED_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify(dataVaultBaseInput(my.id)),
      });
      const body = await res.json();
      assert.equal(res.status, 201, JSON.stringify(body));
      const record = body.data.record;
      assert.match(record.recordCode, /^SVE-DV-MY-REG-\d{4}$/);
    } finally {
      server.close();
    }
  });
});

test("Data Vault CSRF/origin protection: cookie-authenticated POST with a missing Origin is rejected before reaching RBAC/business logic", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "csrf.missing.origin@example.test";
      const admin = await container.users.createUser({ email: "csrf.missing.origin.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      // Fully authorised (would succeed if not for the missing origin) — proves the origin check, not a permission gap, is what blocks this.
      await provisionUser(container, rbacRepo, email, [PERMISSIONS.CREATE], my.id, admin.id);

      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { cookie: buildSvegipCookie(email), "content-type": "application/json" },
        body: JSON.stringify(dataVaultBaseInput(my.id)),
      });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).error.code, "CSRF_ORIGIN_REJECTED");

      const listRes = await fetch(`${baseUrl}/api/v1/data-vault/records`, { headers: { cookie: buildSvegipCookie(email) } });
      const list = (await listRes.json()).data.records as unknown[];
      assert.equal(list.length, 0, "the rejected request must never have reached record creation");
    } finally {
      server.close();
    }
  });
});

test("Data Vault CSRF/origin protection: cookie-authenticated POST with a hostile Origin is rejected", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "csrf.hostile.origin@example.test";
      const admin = await container.users.createUser({ email: "csrf.hostile.origin.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      await provisionUser(container, rbacRepo, email, [PERMISSIONS.CREATE], my.id, admin.id);

      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { cookie: buildSvegipCookie(email), origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify(dataVaultBaseInput(my.id)),
      });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).error.code, "CSRF_ORIGIN_REJECTED");
    } finally {
      server.close();
    }
  });
});

test("Data Vault CSRF/origin protection: native bearer-token POST succeeds with no Origin header at all", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "csrf.bearer.no-origin@example.test";
      const admin = await container.users.createUser({ email: "csrf.bearer.no-origin.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const user = await provisionUser(container, rbacRepo, email, [PERMISSIONS.CREATE], my.id, admin.id);
      const session = await container.sessions.createSession({ userId: user.id, mfaVerified: true });

      // Deliberately no Origin/Referer header — must not matter for bearer auth.
      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
        body: JSON.stringify(dataVaultBaseInput(my.id)),
      });
      assert.equal(res.status, 201, await res.text());
    } finally {
      server.close();
    }
  });
});

test("Data Vault: full authorised create -> read -> update -> archive flow over real HTTP (native bearer session)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "vault.http.fullflow@example.test";
      const admin = await container.users.createUser({ email: "vault.http.fullflow.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const user = await provisionUser(container, rbacRepo, email, [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.ARCHIVE], my.id, admin.id);
      const session = await container.sessions.createSession({ userId: user.id, mfaVerified: true });
      const auth = { authorization: `Bearer ${session.token}` };

      const createRes = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify(dataVaultBaseInput(my.id)),
      });
      assert.equal(createRes.status, 201);
      const created = (await createRes.json()).data.record;
      assert.match(created.recordCode, /^SVE-DV-MY-REG-\d{4}$/);
      assert.equal(created.status, "Requires Review");

      const listRes = await fetch(`${baseUrl}/api/v1/data-vault/records`, { headers: auth });
      assert.equal(listRes.status, 200);
      const list = (await listRes.json()).data.records as Array<{ id: string }>;
      assert.ok(list.some((r) => r.id === created.id));

      const updateRes = await fetch(`${baseUrl}/api/v1/data-vault/records/${created.id}`, {
        method: "PATCH",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ topic: "Revised via HTTP", changeNote: "HTTP integration test" }),
      });
      assert.equal(updateRes.status, 200);
      assert.equal((await updateRes.json()).data.record.topic, "Revised via HTTP");

      const archiveRes = await fetch(`${baseUrl}/api/v1/data-vault/records/${created.id}/archive`, { method: "POST", headers: auth });
      assert.equal(archiveRes.status, 200);
      assert.equal((await archiveRes.json()).data.record.status, "Archived");
    } finally {
      server.close();
    }
  });
});

test("Data Vault: create rejects mass-assignment of server-controlled fields (id, status, recordCode)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "vault.http.massassign@example.test";
      const admin = await container.users.createUser({ email: "vault.http.massassign.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const user = await provisionUser(container, rbacRepo, email, [PERMISSIONS.CREATE], my.id, admin.id);
      const session = await container.sessions.createSession({ userId: user.id, mfaVerified: true });

      const spoofedId = randomUUID();
      const createRes = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
        body: JSON.stringify({ ...dataVaultBaseInput(my.id), id: spoofedId, status: "Report Ready", recordCode: "SVE-DV-FAKE-0001", createdBy: "someone-else" }),
      });
      assert.equal(createRes.status, 201);
      const record = (await createRes.json()).data.record;
      assert.notEqual(record.id, spoofedId, "client-supplied id must never be honoured");
      assert.notEqual(record.recordCode, "SVE-DV-FAKE-0001", "client-supplied recordCode must never be honoured");
      assert.equal(record.status, "Requires Review", "status is always server-assigned at creation, regardless of client input");
    } finally {
      server.close();
    }
  });
});

test("Data Vault: malformed create input (missing required fields) is rejected with 400", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "vault.http.malformed@example.test";
      const admin = await container.users.createUser({ email: "vault.http.malformed.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const user = await provisionUser(container, rbacRepo, email, [PERMISSIONS.CREATE], my.id, admin.id);
      const session = await container.sessions.createSession({ userId: user.id, mfaVerified: true });

      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
        body: JSON.stringify({ legalEntityId: my.id }), // missing topic/source/etc.
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
    } finally {
      server.close();
    }
  });
});

test("Data Vault: a denied caller requesting a known-existing record UUID gets the same 404 as a nonexistent one (no IDOR / existence leak)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const sg = entities.find((e) => e.key === "sve-international-sg")!;
      const admin = await container.users.createUser({ email: "vault.http.idor.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const creator = await provisionUser(container, rbacRepo, "vault.http.idor.creator@example.test", [PERMISSIONS.CREATE], sg.id, admin.id);
      const record = await container.dataVault.createRecord({ userId: creator.id, email: creator.email }, dataVaultBaseInput(sg.id) as never);

      const stranger = await container.users.createUser({ email: "vault.http.idor.stranger@example.test", accountType: "employee" });
      const strangerSession = await container.sessions.createSession({ userId: stranger.id, mfaVerified: true });
      const auth = { authorization: `Bearer ${strangerSession.token}` };

      const knownIdRes = await fetch(`${baseUrl}/api/v1/data-vault/records/${record.id}`, { headers: auth });
      const unknownIdRes = await fetch(`${baseUrl}/api/v1/data-vault/records/${randomUUID()}`, { headers: auth });
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

test("Data Vault: legal-entities reference endpoint requires authentication but no special permission", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const unauth = await fetch(`${baseUrl}/api/v1/data-vault/legal-entities`);
      assert.equal(unauth.status, 401);

      const user = await container.users.createUser({ email: "vault.http.entities@example.test", accountType: "employee" });
      const created = await container.sessions.createSession({ userId: user.id, mfaVerified: false });
      const res = await fetch(`${baseUrl}/api/v1/data-vault/legal-entities`, { headers: { authorization: `Bearer ${created.token}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.legalEntities.length, 3);
    } finally {
      server.close();
    }
  });
});
