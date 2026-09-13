/**
 * accountSecurityService (PR #10) — real Postgres tests for the generic
 * disable/enable domain operation: atomicity (status + session revocation
 * + audit in ONE transaction), idempotency, the central active-account
 * invariant it exists to serve, and the login/session-creation race this
 * review specifically asked to be proven. See docs/architecture/
 * identity-offboarding-revocation.md.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { withTestDb, getTestDatabaseUrl } from "./testDb.ts";

// See test/integration/http.test.ts's identical line — every container
// created in this file needs a decryption key for its MFA service, even
// though these tests never touch MFA directly.
process.env.SVE_IDENTITY_MFA_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
import { createContainer } from "../../src/container.ts";
import { createPgRbacRepository } from "../../src/repositories/postgres/pgRbacRepository.ts";
import { createPgUserSecurityTransaction } from "../../src/repositories/postgres/pgUserSecurityTransaction.ts";
import { PERMISSIONS } from "../../src/services/accountSecurityService.ts";
import { ForbiddenError, SessionInvalidError, AccountDisabledError } from "../../src/domain/errors.ts";

const skip: boolean | string = getTestDatabaseUrl() ? false : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

async function grantManageAccount(db: Parameters<typeof createPgRbacRepository>[0], userId: string, grantedBy: string) {
  const rbacRepo = createPgRbacRepository(db);
  const role = await rbacRepo.createRole({ key: `manage-account-${randomUUID()}`, name: "Manage Account Test Role" });
  const permission = (await rbacRepo.findPermissionByKey(PERMISSIONS.MANAGE_ACCOUNT)) ?? (await rbacRepo.createPermission({ key: PERMISSIONS.MANAGE_ACCOUNT, maxClassification: "INTERNAL" }));
  await rbacRepo.grantPermissionToRole(role.id, permission.id);
  await rbacRepo.assignRole({ userId, roleId: role.id, grantedBy });
}

test("disableAccount: revokes every active session and records exactly one audit entry, atomically; re-running is idempotent (no error, no duplicate audit)", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createContainer(db);
    const admin = await container.users.createUser({ email: "accsec.disable.admin@example.test", accountType: "service" });
    await grantManageAccount(db, admin.id, admin.id);
    const adminActor = { userId: admin.id, email: admin.email };

    const target = await container.users.createUser({ email: "accsec.disable.target@example.test", accountType: "employee" });
    await container.sessions.createSession({ userId: target.id, mfaVerified: true });
    await container.sessions.createSession({ userId: target.id, mfaVerified: true });
    assert.equal((await container.sessions.listActiveSessions(target.id)).length, 2);

    const result = await container.accountSecurity.disableAccount(adminActor, target.id, { reason: "test_offboarding", sourceSystem: "hrms", sourceRequestId: "req-1" });
    assert.equal(result.user.status, "disabled");
    assert.equal(result.sessionsRevoked, 2);
    assert.equal(result.alreadyInState, false);
    assert.equal((await container.sessions.listActiveSessions(target.id)).length, 0, "every active session must be revoked");

    const auditRows = await db.query<{ actor_user_id: string; action: string; resource_id: string; change_after: Record<string, unknown> }>(
      `SELECT actor_user_id, action, resource_id, change_after FROM security_audit_events WHERE resource_id = $1 AND action = 'account.disabled'`,
      [target.id],
    );
    assert.equal(auditRows.rows.length, 1, "exactly one audit entry for the disable action");
    assert.equal(auditRows.rows[0]!.actor_user_id, admin.id);
    assert.equal(auditRows.rows[0]!.change_after.sessionsRevoked, 2);
    assert.equal(auditRows.rows[0]!.change_after.sourceSystem, "hrms");
    assert.equal(auditRows.rows[0]!.change_after.sourceRequestId, "req-1");

    // Idempotent re-run: no error, reports alreadyInState, no duplicate audit.
    const second = await container.accountSecurity.disableAccount(adminActor, target.id, { reason: "test_offboarding_retry" });
    assert.equal(second.alreadyInState, true);
    assert.equal(second.sessionsRevoked, 0);
    const auditRowsAfterRetry = await db.query<{ count: string }>(`SELECT count(*)::text FROM security_audit_events WHERE resource_id = $1 AND action = 'account.disabled'`, [target.id]);
    assert.equal(auditRowsAfterRetry.rows[0]!.count, "1", "a repeated disable must never write a second audit entry");
  });
});

test("enableAccount: idempotent, and does NOT restore/unrevoke any previously-revoked session — reactivation requires a fresh authentication", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createContainer(db);
    const admin = await container.users.createUser({ email: "accsec.enable.admin@example.test", accountType: "service" });
    await grantManageAccount(db, admin.id, admin.id);
    const adminActor = { userId: admin.id, email: admin.email };

    const target = await container.users.createUser({ email: "accsec.enable.target@example.test", accountType: "employee" });
    const oldSession = await container.sessions.createSession({ userId: target.id, mfaVerified: true });
    await container.accountSecurity.disableAccount(adminActor, target.id, { reason: "test" });

    const enabled = await container.accountSecurity.enableAccount(adminActor, target.id, { reason: "test_reactivation" });
    assert.equal(enabled.user.status, "active");
    assert.equal(enabled.alreadyInState, false);

    // The account is active again, but the OLD session must remain revoked forever.
    await assert.rejects(() => container.sessions.validateSession(oldSession.token), SessionInvalidError);
    assert.equal((await container.sessions.listActiveSessions(target.id)).length, 0, "re-enabling must never un-revoke a historical session");

    // A brand new session, issued fresh after reactivation, works normally.
    const newSession = await container.sessions.createSession({ userId: target.id, mfaVerified: true });
    const validated = await container.sessions.validateSession(newSession.token);
    assert.equal(validated.userId, target.id);

    const secondEnable = await container.accountSecurity.enableAccount(adminActor, target.id, { reason: "retry" });
    assert.equal(secondEnable.alreadyInState, true);
  });
});

test("manual disable requires identity.security.manage_account, and a DISABLED actor cannot manage any account (denied centrally by authorize())", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createContainer(db);
    const target = await container.users.createUser({ email: "accsec.permcheck.target@example.test", accountType: "employee" });

    const unprivileged = await container.users.createUser({ email: "accsec.permcheck.unprivileged@example.test", accountType: "employee" });
    await assert.rejects(() => container.accountSecurity.disableAccount({ userId: unprivileged.id, email: unprivileged.email }, target.id, { reason: "x" }), ForbiddenError);

    // An admin who legitimately holds the permission, but whose OWN account has since been disabled, must also be denied — the central invariant applies to every actor, not just business-module actors.
    const laterDisabledAdmin = await container.users.createUser({ email: "accsec.permcheck.laterdisabled@example.test", accountType: "service" });
    await grantManageAccount(db, laterDisabledAdmin.id, laterDisabledAdmin.id);
    await container.users.setStatus(laterDisabledAdmin.id, "disabled");
    await assert.rejects(
      () => container.accountSecurity.disableAccount({ userId: laterDisabledAdmin.id, email: laterDisabledAdmin.email }, target.id, { reason: "x" }),
      ForbiddenError,
    );

    // But an ACTIVE admin can still manage a DISABLED target — actor status and target status are independent.
    const activeAdmin = await container.users.createUser({ email: "accsec.permcheck.activeadmin@example.test", accountType: "service" });
    await grantManageAccount(db, activeAdmin.id, activeAdmin.id);
    await container.users.setStatus(target.id, "disabled");
    const result = await container.accountSecurity.enableAccount({ userId: activeAdmin.id, email: activeAdmin.email }, target.id, { reason: "x" });
    assert.equal(result.user.status, "active", "an active administrator must still be able to manage a disabled target account");
  });
});

test("central invariant: a session created BEFORE disableAccount() is rejected IMMEDIATELY after the disable transaction commits — no waiting for expiry", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createContainer(db);
    const admin = await container.users.createUser({ email: "accsec.immediate.admin@example.test", accountType: "service" });
    await grantManageAccount(db, admin.id, admin.id);
    const adminActor = { userId: admin.id, email: admin.email };

    const target = await container.users.createUser({ email: "accsec.immediate.target@example.test", accountType: "employee" });
    const session = await container.sessions.createSession({ userId: target.id, mfaVerified: true });
    const validatedBefore = await container.sessions.validateSession(session.token);
    assert.equal(validatedBefore.userId, target.id, "sanity: the session is genuinely usable before disable");

    await container.accountSecurity.disableAccount(adminActor, target.id, { reason: "test" });

    await assert.rejects(() => container.sessions.validateSession(session.token), SessionInvalidError, "the same, still-unexpired session token must be rejected the instant after disable commits");
  });
});

test("Login/session-creation race: a session cannot become usable if it is created concurrently with a disableAccount() transaction, regardless of lock-acquisition order — real Postgres, run several times", { skip }, async () => {
  await withTestDb(async (db) => {
    const container = await createContainer(db);
    const admin = await container.users.createUser({ email: "accsec.race.admin@example.test", accountType: "service" });
    await grantManageAccount(db, admin.id, admin.id);
    const adminActor = { userId: admin.id, email: admin.email };

    for (let i = 0; i < 8; i++) {
      const target = await container.users.createUser({ email: `accsec.race.target.${i}@example.test`, accountType: "employee" });

      const [disableResult, sessionResult] = await Promise.allSettled([
        container.accountSecurity.disableAccount(adminActor, target.id, { reason: "race_test" }),
        container.sessions.createSession({ userId: target.id, mfaVerified: true }),
      ]);

      assert.equal(disableResult.status, "fulfilled", `iteration ${i}: disableAccount must always succeed regardless of interleaving`);

      if (sessionResult.status === "fulfilled") {
        // The session-creation transaction won the row-lock race and committed
        // BEFORE disableAccount's own lock acquisition succeeded — so
        // disableAccount's OWN revokeAllForUser (which only runs after that
        // lock is held) must have seen and revoked it too.
        await assert.rejects(
          () => container.sessions.validateSession(sessionResult.value.token),
          SessionInvalidError,
          `iteration ${i}: a session that raced its way into existence must still end up revoked by the disable it raced`,
        );
      } else {
        // disableAccount won the race — session creation must have been
        // denied outright by createSession's own lock-and-recheck.
        assert.ok(sessionResult.reason instanceof AccountDisabledError, `iteration ${i}: a session denied by the race must be denied for the right reason`);
      }

      const activeSessions = await container.sessions.listActiveSessions(target.id);
      assert.equal(activeSessions.length, 0, `iteration ${i}: no active session may survive a racing disable, whichever side won the lock`);
    }
  });
});

test("Rollback: a failure anywhere inside the shared transaction rolls back the account status change together with everything else — never a disabled status with sessions still valid", { skip }, async () => {
  await withTestDb(async (db) => {
    const { users, sessions } = await createContainer(db);
    const target = await users.createUser({ email: "accsec.rollback.target@example.test", accountType: "employee" });
    const session = await sessions.createSession({ userId: target.id, mfaVerified: true });

    const transactions = createPgUserSecurityTransaction(db);
    await assert.rejects(
      () =>
        transactions.run(async (repos) => {
          await repos.users.setStatus(target.id, "disabled");
          await repos.sessions.revokeAllForUser(target.id, "forced_failure_test");
          throw new Error("forced failure after status change and session revocation, before commit");
        }),
      /forced failure/,
    );

    const afterRollback = await users.findById(target.id);
    assert.equal(afterRollback!.status, "active", "the account status change must roll back when a later step in the SAME transaction fails");
    const validated = await sessions.validateSession(session.token);
    assert.equal(validated.userId, target.id, "the session revocation must roll back too — a disabled-looking-but-uncommitted state must never leave a real committed session revoked");
  });
});
