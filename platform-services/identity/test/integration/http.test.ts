import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { getTestDatabaseUrl, withTestDb } from "./testDb.ts";
import { createContainer } from "../../src/container.ts";
import { createHttpServer } from "../../src/api/http.ts";
import { hashPassword } from "../../src/crypto/password.ts";
import { generateTotp } from "../../src/crypto/totp.ts";
import { base32Decode } from "../../src/crypto/base32.ts";
import { createPgRbacRepository } from "../../src/repositories/postgres/pgRbacRepository.ts";
import { PERMISSIONS } from "../../src/services/accountSecurityService.ts";

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

test("PR #10: an MFA challenge issued while active, followed by a real accountSecurity.disableAccount() (not a raw setStatus), then a CORRECT TOTP code, is denied and creates no session", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.pr10-mfa-disable.totp@example.test";
      const password = "fictional-pr10-mfa-disable-password-1!";
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

      // Disable through the REAL, PR #10 domain operation (not a raw
      // repository setStatus call) — the operation an administrator or
      // HRMS's own offboarding integration actually uses.
      const admin = await container.users.createUser({ email: "http.pr10-mfa-disable.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const role = await rbacRepo.createRole({ key: "http-pr10-manage-account", name: "Manage Account" });
      const permission = await rbacRepo.createPermission({ key: PERMISSIONS.MANAGE_ACCOUNT, maxClassification: "INTERNAL" });
      await rbacRepo.grantPermissionToRole(role.id, permission.id);
      await rbacRepo.assignRole({ userId: admin.id, roleId: role.id, grantedBy: admin.id });
      const disableResult = await container.accountSecurity.disableAccount({ userId: admin.id, email: admin.email }, user.id, { reason: "test_offboarding" });
      assert.equal(disableResult.user.status, "disabled");

      // The TOTP code submitted below is genuinely correct for this method.
      const correctCode = generateTotp(base32Decode(enrolment.secretBase32));
      const mfaVerifyRes = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code: correctCode }),
      });
      assert.equal(mfaVerifyRes.status, 401, "a CORRECT code must still be denied once the account is disabled");
      assert.equal((await container.sessions.listActiveSessions(user.id)).length, 0, "completing MFA on a disabled account must never create a session");
    } finally {
      server.close();
    }
  });
});

test("PR #10: a pending MFA challenge, then disableAccount(), then a CORRECT recovery code, is denied and creates no session", { skip }, async () => {
  await withTestDb(async (db) => {
    const { server, baseUrl, container } = await startServer(db);
    try {
      const email = "http.pr10-mfa-disable.recovery@example.test";
      const password = "fictional-pr10-mfa-disable-recovery-password-1!";
      const user = await container.users.createUser({ email, accountType: "employee" });
      await container.users.setCredential(user.id, await hashPassword(password));
      const enrolment = await container.mfa.beginEnrolment({ userId: user.id, accountEmail: email });
      const enrolCode = generateTotp(base32Decode(enrolment.secretBase32));
      await container.mfa.completeEnrolment({ userId: user.id, methodId: enrolment.methodId, code: enrolCode });
      const [recoveryCode] = await container.mfa.generateRecoveryCodes(user.id);

      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const { challengeId } = (await loginRes.json()).data as { challengeId: string };

      const admin = await container.users.createUser({ email: "http.pr10-mfa-disable-recovery.admin@example.test", accountType: "service" });
      const rbacRepo = createPgRbacRepository(db);
      const role = await rbacRepo.createRole({ key: "http-pr10-manage-account-recovery", name: "Manage Account" });
      const permission = await rbacRepo.createPermission({ key: PERMISSIONS.MANAGE_ACCOUNT, maxClassification: "INTERNAL" });
      await rbacRepo.grantPermissionToRole(role.id, permission.id);
      await rbacRepo.assignRole({ userId: admin.id, roleId: role.id, grantedBy: admin.id });
      await container.accountSecurity.disableAccount({ userId: admin.id, email: admin.email }, user.id, { reason: "test_offboarding" });

      const recoveryRes = await fetch(`${baseUrl}/api/v1/auth/mfa/recovery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code: recoveryCode }),
      });
      assert.equal(recoveryRes.status, 401, "a genuinely valid, unused recovery code must still be denied once the account is disabled");
      assert.equal((await container.sessions.listActiveSessions(user.id)).length, 0, "a recovery-code completion on a disabled account must never create a session");
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
