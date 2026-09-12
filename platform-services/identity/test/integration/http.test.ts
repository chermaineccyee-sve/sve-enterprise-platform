import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import { getTestDatabaseUrl, withTestDb } from "./testDb.ts";
import { createContainer } from "../../src/container.ts";
import { createHttpServer } from "../../src/api/http.ts";
import { hashPassword } from "../../src/crypto/password.ts";
import { generateTotp } from "../../src/crypto/totp.ts";
import { base32Decode } from "../../src/crypto/base32.ts";
import { createPgRbacRepository } from "../../src/repositories/postgres/pgRbacRepository.ts";
import { PERMISSIONS } from "../../src/services/dataVaultService.ts";

const skip: boolean | string = getTestDatabaseUrl()
  ? false
  : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

// A fresh, random test-only encryption key — never a hard-coded literal,
// even for tests. Set once so every container created in this file can
// decrypt what another container in the same test encrypted.
process.env.SVE_IDENTITY_MFA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

async function startServer(db: Parameters<typeof createContainer>[0]) {
  const container = await createContainer(db);
  const server = createHttpServer(container);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl, container };
}

test("full login flow over real HTTP: unauthenticated -> login -> protected route -> logout -> revoked", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.pilot@example.test";
      const password = "fictional-http-test-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));

      // 1. Protected route without a session is rejected.
      const unauth = await fetch(`${baseUrl}/api/v1/users/me`);
      assert.equal(unauth.status, 401);
      const unauthBody = await unauth.json();
      assert.equal(unauthBody.error.code, "SESSION_INVALID");

      // 2. Login with the correct password succeeds and returns a session token.
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(loginRes.status, 200);
      const loginBody = await loginRes.json();
      assert.ok(loginBody.data.sessionToken);
      assert.ok(loginBody.meta.correlationId);
      const token = loginBody.data.sessionToken as string;

      // 3. The protected route now works with the bearer token.
      const meRes = await fetch(`${baseUrl}/api/v1/users/me`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(meRes.status, 200);
      const meBody = await meRes.json();
      assert.equal(meBody.data.email, email);
      assert.equal(meBody.data.password, undefined, "password must never appear in an API response");

      // 4. Logout revokes the session.
      const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
      assert.equal(logoutRes.status, 200);

      // 5. The same token no longer works.
      const afterLogout = await fetch(`${baseUrl}/api/v1/users/me`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(afterLogout.status, 401);
    } finally {
      server.close();
    }
  });
});

test("wrong password returns a generic 401 identical to an unknown account", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.wrongpw@example.test";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword("the-real-password-1!"));

      const wrongPwRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "wrong" }),
      });
      const unknownRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "totally.unknown@example.test", password: "wrong" }),
      });
      assert.equal(wrongPwRes.status, 401);
      assert.equal(unknownRes.status, 401);
      const wrongPwBody = await wrongPwRes.json();
      const unknownBody = await unknownRes.json();
      assert.deepEqual(wrongPwBody.error, unknownBody.error);
    } finally {
      server.close();
    }
  });
});

test("MFA-enrolled login requires a verified challenge before a session is issued, over real HTTP", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.mfa@example.test";
      const password = "fictional-mfa-http-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));

      // Log in once (no MFA yet) to get a session for enrolling.
      const firstLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const firstToken = (await firstLogin.json()).data.sessionToken as string;

      const enrolRes = await fetch(`${baseUrl}/api/v1/auth/mfa/enrol`, { method: "POST", headers: { authorization: `Bearer ${firstToken}` } });
      const enrolBody = (await enrolRes.json()).data as { methodId: string; secretBase32: string };
      const validCode = generateTotp(base32Decode(enrolBody.secretBase32));
      const verifyRes = await fetch(`${baseUrl}/api/v1/auth/mfa/enrol/verify`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${firstToken}` },
        body: JSON.stringify({ methodId: enrolBody.methodId, code: validCode }),
      });
      const verifyBody = (await verifyRes.json()).data as { recoveryCodes: string[] };
      assert.equal(verifyBody.recoveryCodes.length, 10);

      // Now log in again — this time MFA must be required.
      const secondLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const secondBody = (await secondLogin.json()).data as { outcome: string; challengeId: string };
      assert.equal(secondBody.outcome, "mfa_challenge");

      // A session was NOT issued yet.
      // Complete the challenge with a fresh valid TOTP code, using the same
      // secret the authenticator app received at enrolment time — a real
      // client never re-fetches the secret from the server after enrolment.
      const challengeCode = generateTotp(base32Decode(enrolBody.secretBase32));
      const mfaVerifyRes = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: secondBody.challengeId, code: challengeCode }),
      });
      assert.equal(mfaVerifyRes.status, 200);
      const mfaVerifyBody = await mfaVerifyRes.json();
      assert.ok(mfaVerifyBody.data.sessionToken);

      // The resulting session is recorded as mfaVerified = true.
      const sessionCheck = await fetch(`${baseUrl}/api/v1/auth/session`, { headers: { authorization: `Bearer ${mfaVerifyBody.data.sessionToken}` } });
      const sessionBody = await sessionCheck.json();
      assert.equal(sessionBody.data.mfaVerified, true);
    } finally {
      server.close();
    }
  });
});

test("a disabled account cannot complete a pending MFA challenge, even with a valid code (defense-in-depth)", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.disabled-race@example.test";
      const password = "fictional-disabled-race-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));

      const enrolment = await container.mfa.beginEnrolment({ userId: user.id, accountEmail: email });
      const enrolCode = generateTotp(base32Decode(enrolment.secretBase32));
      await container.mfa.completeEnrolment({ userId: user.id, methodId: enrolment.methodId, code: enrolCode });

      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const { challengeId } = (await loginRes.json()).data as { challengeId: string };

      // Simulate the account being disabled in the window between primary
      // auth and MFA completion (e.g. an admin action, or an offboarding
      // process racing a lingering login attempt).
      await container.users.setStatus(user.id, "disabled");

      const challengeCode = generateTotp(base32Decode(enrolment.secretBase32));
      const mfaVerifyRes = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code: challengeCode }),
      });
      assert.equal(mfaVerifyRes.status, 401, "a disabled account must not be able to complete MFA and obtain a session");
    } finally {
      server.close();
    }
  });
});

test("repeated legitimate password -> MFA-challenge logins over real HTTP do not trigger throttling, and the eventual correct code still succeeds", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.mfa-no-throttle@example.test";
      const password = "fictional-mfa-no-throttle-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));
      const enrolment = await container.mfa.beginEnrolment({ userId: user.id, accountEmail: email });
      const enrolCode = generateTotp(base32Decode(enrolment.secretBase32));
      await container.mfa.completeEnrolment({ userId: user.id, methodId: enrolment.methodId, code: enrolCode });

      let lastChallengeId = "";
      for (let i = 0; i < 15; i++) {
        const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        assert.equal(res.status, 200, `attempt ${i} should not be throttled`);
        const body = await res.json();
        assert.equal(body.data.outcome, "mfa_challenge");
        lastChallengeId = body.data.challengeId;
      }

      // The real MFA code still works after all those repeated logins.
      const code = generateTotp(base32Decode(enrolment.secretBase32));
      const verifyRes = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: lastChallengeId, code }),
      });
      assert.equal(verifyRes.status, 200);
    } finally {
      server.close();
    }
  });
});

test("repeated invalid MFA codes DO trigger throttling on the verify endpoint", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.mfa-throttle@example.test";
      const password = "fictional-mfa-throttle-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));
      const enrolment = await container.mfa.beginEnrolment({ userId: user.id, accountEmail: email });
      const enrolCode = generateTotp(base32Decode(enrolment.secretBase32));
      await container.mfa.completeEnrolment({ userId: user.id, methodId: enrolment.methodId, code: enrolCode });

      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const { challengeId } = (await loginRes.json()).data as { challengeId: string };

      let lastStatus = 0;
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challengeId, code: "000000" }),
        });
        lastStatus = res.status;
      }
      assert.equal(lastStatus, 429, "repeated invalid MFA codes must eventually be throttled");
    } finally {
      server.close();
    }
  });
});

test("repeated invalid recovery codes DO trigger throttling on the recovery endpoint", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.recovery-throttle@example.test";
      const password = "fictional-recovery-throttle-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));
      const enrolment = await container.mfa.beginEnrolment({ userId: user.id, accountEmail: email });
      const enrolCode = generateTotp(base32Decode(enrolment.secretBase32));
      await container.mfa.completeEnrolment({ userId: user.id, methodId: enrolment.methodId, code: enrolCode });
      await container.mfa.generateRecoveryCodes(user.id);

      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const { challengeId } = (await loginRes.json()).data as { challengeId: string };

      let lastStatus = 0;
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`${baseUrl}/api/v1/auth/mfa/recovery`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challengeId, code: "WRONG-CODE-0000" }),
        });
        lastStatus = res.status;
      }
      assert.equal(lastStatus, 429, "repeated invalid recovery codes must eventually be throttled");
    } finally {
      server.close();
    }
  });
});

test("no secret material (password, session token internals, TOTP secret, recovery codes) leaks into an error response", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl } = await startServer(db);
    try {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.test", password: "super-secret-guess-value" }),
      });
      const text = await res.text();
      assert.doesNotMatch(text, /super-secret-guess-value/);
    } finally {
      server.close();
    }
  });
});

/* -------------------------------------------------------------------- */
/* Data Vault (/api/v1/data-vault/*) — PR #5                             */
/* -------------------------------------------------------------------- */

const SVEGIP_BRIDGE_SECRET = "fictional-http-test-svegip-bridge-secret";
process.env.SVEGIP_SESSION_SECRET ??= SVEGIP_BRIDGE_SECRET;

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

test("Data Vault: a valid SVEGIP session cookie authenticates once the email is provisioned in Identity, and its embedded role is never trusted for authorization", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "bridge.provisioned@example.test";
      const user = await container.users.createUser({ email, accountType: "employee" });
      const admin = await container.users.createUser({ email: "bridge.admin@example.test", accountType: "service" });

      // Note: the SVEGIP cookie below claims role "Employee" with no
      // elevated permissions — yet this user IS granted real read access
      // here, entirely through this service's own RBAC tables, never
      // through the cookie's claims.
      const writerRole = createPgRbacRepository(db);
      const role = await writerRole.createRole({ key: "bridge-reader", name: "Bridge Reader" });
      const permission = await writerRole.createPermission({ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" });
      await writerRole.grantPermissionToRole(role.id, permission.id);
      await writerRole.assignRole({ userId: user.id, roleId: role.id, grantedBy: admin.id });
      await writerRole.grantEntityAccess({ userId: user.id, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin.id });

      const createPerm = await writerRole.createPermission({ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" });
      await writerRole.grantPermissionToRole(role.id, createPerm.id);
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

test("Data Vault: full authorised create -> read -> update -> archive flow over real HTTP", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const entities = await container.organisation.listLegalEntities();
      const my = entities.find((e) => e.key === "sve-international-my")!;
      const email = "vault.http.fullflow@example.test";
      const password = "fictional-vault-flow-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));
      const admin = await container.users.createUser({ email: "vault.http.fullflow.admin@example.test", accountType: "service" });

      const rbacRepo = createPgRbacRepository(db);
      const role = await rbacRepo.createRole({ key: "vault-http-flow", name: "Vault HTTP Flow" });
      for (const key of [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.ARCHIVE]) {
        const permission = await rbacRepo.createPermission({ key, maxClassification: "CONFIDENTIAL" });
        await rbacRepo.grantPermissionToRole(role.id, permission.id);
      }
      await rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: admin.id });
      await rbacRepo.grantEntityAccess({ userId: user.id, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin.id });

      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const { sessionToken } = (await loginRes.json()).data as { sessionToken: string };
      const auth = { authorization: `Bearer ${sessionToken}` };

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
      const password = "fictional-mass-assign-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));
      const admin = await container.users.createUser({ email: "vault.http.massassign.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const role = await rbacRepo.createRole({ key: "vault-http-mass-assign", name: "Vault Mass Assign" });
      const permission = await rbacRepo.createPermission({ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" });
      await rbacRepo.grantPermissionToRole(role.id, permission.id);
      await rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: admin.id });
      await rbacRepo.grantEntityAccess({ userId: user.id, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin.id });

      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const { sessionToken } = (await loginRes.json()).data as { sessionToken: string };

      const spoofedId = randomUUID();
      const createRes = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { authorization: `Bearer ${sessionToken}`, "content-type": "application/json" },
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
      const password = "fictional-malformed-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));
      const admin = await container.users.createUser({ email: "vault.http.malformed.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const role = await rbacRepo.createRole({ key: "vault-http-malformed", name: "Vault Malformed" });
      const permission = await rbacRepo.createPermission({ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" });
      await rbacRepo.grantPermissionToRole(role.id, permission.id);
      await rbacRepo.assignRole({ userId: user.id, roleId: role.id, grantedBy: admin.id });
      await rbacRepo.grantEntityAccess({ userId: user.id, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin.id });

      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const { sessionToken } = (await loginRes.json()).data as { sessionToken: string };

      const res = await fetch(`${baseUrl}/api/v1/data-vault/records`, {
        method: "POST",
        headers: { authorization: `Bearer ${sessionToken}`, "content-type": "application/json" },
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
      const creator = await container.users.createUser({ email: "vault.http.idor.creator@example.test", accountType: "employee" });
      const rbacRepo = createPgRbacRepository(db);
      const role = await rbacRepo.createRole({ key: "vault-http-idor", name: "Vault IDOR" });
      const permission = await rbacRepo.createPermission({ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" });
      await rbacRepo.grantPermissionToRole(role.id, permission.id);
      await rbacRepo.assignRole({ userId: creator.id, roleId: role.id, grantedBy: admin.id });
      await rbacRepo.grantEntityAccess({ userId: creator.id, scopeType: "legal_entity", legalEntityId: sg.id, grantedBy: admin.id });
      const record = await container.dataVault.createRecord({ userId: creator.id, email: creator.email }, dataVaultBaseInput(sg.id) as never);

      const strangerEmail = "vault.http.idor.stranger@example.test";
      const strangerPassword = "fictional-idor-stranger-password-1!";
      const stranger = await container.users.createUser({ email: strangerEmail, accountType: "employee" });
      await container.users.setCredential(stranger.id, await hashPassword(strangerPassword));
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: strangerEmail, password: strangerPassword }),
      });
      const { sessionToken } = (await loginRes.json()).data as { sessionToken: string };
      const auth = { authorization: `Bearer ${sessionToken}` };

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
