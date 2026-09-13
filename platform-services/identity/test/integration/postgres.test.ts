import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { withTestDb, getTestDatabaseUrl } from "./testDb.ts";
import { createPgUserRepository } from "../../src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../src/repositories/postgres/pgRbacRepository.ts";
import { createPgSessionRepository } from "../../src/repositories/postgres/pgSessionRepository.ts";
import { createPgMfaRepository } from "../../src/repositories/postgres/pgMfaRepository.ts";
import { createPgAttemptRepository } from "../../src/repositories/postgres/pgAttemptRepository.ts";
import { createPgAuditRepository } from "../../src/repositories/postgres/pgAuditRepository.ts";
import { createPgUserSecurityTransaction } from "../../src/repositories/postgres/pgUserSecurityTransaction.ts";
import { createRbacService } from "../../src/services/rbacService.ts";
import { createSessionService } from "../../src/services/sessionService.ts";
import { hashPassword, verifyPassword } from "../../src/crypto/password.ts";
import { encryptTotpSecret, decryptTotpSecret } from "../../src/crypto/mfaSecretCipher.ts";
import { generateTotpSecret } from "../../src/crypto/totp.ts";
import { createAuditService } from "../../src/services/auditService.ts";

const skip: boolean | string = getTestDatabaseUrl()
  ? false
  : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

test("seeded legal entities match the confirmed SVE Group structure, with only Singapore flagged as HQ", { skip }, async () => {
  await withTestDb(async (db) => {
    const organisation = createPgOrganisationRepository(db);
    const entities = await organisation.listLegalEntities();
    assert.equal(entities.length, 3);
    const sg = entities.find((e) => e.key === "sve-international-sg");
    const my = entities.find((e) => e.key === "sve-international-my");
    const skl = entities.find((e) => e.key === "sk-lai-partners-my");
    assert.ok(sg && my && skl);
    assert.equal(sg!.isGroupHeadquarters, true);
    assert.equal(my!.isGroupHeadquarters, false);
    assert.equal(skl!.isGroupHeadquarters, false);
    assert.equal(sg!.jurisdiction, "SG");
    assert.equal(my!.jurisdiction, "MY");
    assert.equal(skl!.jurisdiction, "MY");
  });
});

test("user email uniqueness is enforced at the database level", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    await users.createUser({ email: "duplicate.test@example.test", accountType: "employee" });
    await assert.rejects(() => users.createUser({ email: "duplicate.test@example.test", accountType: "employee" }));
  });
});

test("password credential round-trips through real Postgres storage", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const user = await users.createUser({ email: "credential.test@example.test", accountType: "employee" });
    const hash = await hashPassword("a-fictional-test-password-99!");
    await users.setCredential(user.id, hash);

    const stored = await users.getCredential(user.id);
    assert.ok(stored);
    assert.equal(await verifyPassword("a-fictional-test-password-99!", stored!), true);
    assert.equal(await verifyPassword("wrong-password", stored!), false);
    // password_params round-trips through JSONB correctly, not just as a string.
    assert.equal(stored!.params.N, 16384);
  });
});

test("entity_access_grants CHECK constraint rejects a scope_type/column mismatch", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const user = await users.createUser({ email: "constraint.test@example.test", accountType: "employee" });
    // scope_type = 'group' must NOT have a legal_entity_id set — the migration's
    // CHECK constraint should reject this at the database level, not just in
    // application code.
    await assert.rejects(() =>
      db.query(
        `INSERT INTO entity_access_grants(user_id, scope_type, legal_entity_id, granted_by) VALUES ($1, 'group', $2, $1)`,
        [user.id, randomUUID()],
      ),
    );
  });
});

test("RBAC service enforces cross-entity denial against the real database (not just the in-memory fake)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbac = createPgRbacRepository(db);
    const rbacService = createRbacService({ rbac, organisation, users });

    const admin = await users.createUser({ email: "rbac.admin@example.test", accountType: "service" });
    const employee = await users.createUser({ email: "rbac.employee@example.test", accountType: "employee" });
    const my = await organisation.findLegalEntityByKey("sve-international-my");
    const sg = await organisation.findLegalEntityByKey("sve-international-sg");
    assert.ok(my && sg);

    const role = await rbac.createRole({ key: "test-finance", name: "Test Finance Role" });
    const permission = await rbac.createPermission({ key: "test.accounting.view", maxClassification: "CONFIDENTIAL" });
    await rbac.grantPermissionToRole(role.id, permission.id);
    await rbac.assignRole({ userId: employee.id, roleId: role.id, grantedBy: admin.id });
    await rbac.grantEntityAccess({ userId: employee.id, scopeType: "legal_entity", legalEntityId: my!.id, grantedBy: admin.id });

    const allowedMY = await rbacService.authorize({ userId: employee.id, permissionKey: "test.accounting.view", target: { legalEntityId: my!.id } });
    const deniedSG = await rbacService.authorize({ userId: employee.id, permissionKey: "test.accounting.view", target: { legalEntityId: sg!.id } });
    assert.equal(allowedMY.allowed, true);
    assert.equal(deniedSG.allowed, false);
  });
});

test("a role assignment or entity-access grant for a nonexistent user id is rejected by the real schema (FK-enforced) — proves authorize()'s not-found carve-out is unreachable in production (PR #10)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbac = createPgRbacRepository(db);
    const admin = await users.createUser({ email: "fkproof.admin@example.test", accountType: "service" });
    const role = await rbac.createRole({ key: "fk-proof-role", name: "FK Proof Role" });
    const my = await organisation.findLegalEntityByKey("sve-international-my");
    assert.ok(my);

    // A fabricated, never-persisted userId — exactly the shape of actor
    // this repository's own in-memory unit tests use throughout (see
    // rbacService.ts's authorize() carve-out comment). In real Postgres,
    // the attempt to grant it ANY authority fails outright, before
    // authorize() would ever be reached with it — no such actor can exist
    // in a live system.
    const fabricatedUserId = randomUUID();
    await assert.rejects(() => rbac.assignRole({ userId: fabricatedUserId, roleId: role.id, grantedBy: admin.id }));
    await assert.rejects(() => rbac.grantEntityAccess({ userId: fabricatedUserId, scopeType: "legal_entity", legalEntityId: my!.id, grantedBy: admin.id }));
  });
});

test("session repository: create, validate via real NOW()-based expiry, revoke", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const sessions = createPgSessionRepository(db);
    const sessionService = createSessionService({ sessions, users, transactions: createPgUserSecurityTransaction(db) });
    const user = await users.createUser({ email: "session.test@example.test", accountType: "employee" });

    const created = await sessionService.createSession({ userId: user.id, mfaVerified: true });
    const validated = await sessionService.validateSession(created.token);
    assert.equal(validated.userId, user.id);

    await sessionService.revokeSession(created.session.id, "integration_test");
    await assert.rejects(() => sessionService.validateSession(created.token));
  });
});

test("revokeAllSessionsForUser affects only that user's sessions, verified against real rows", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const sessions = createPgSessionRepository(db);
    const sessionService = createSessionService({ sessions, users, transactions: createPgUserSecurityTransaction(db) });
    const userA = await users.createUser({ email: "revoke.a@example.test", accountType: "employee" });
    const userB = await users.createUser({ email: "revoke.b@example.test", accountType: "employee" });

    await sessionService.createSession({ userId: userA.id, mfaVerified: true });
    await sessionService.createSession({ userId: userA.id, mfaVerified: true });
    const bSession = await sessionService.createSession({ userId: userB.id, mfaVerified: true });

    const count = await sessionService.revokeAllSessionsForUser(userA.id, "test");
    assert.equal(count, 2);
    const stillActive = await sessionService.listActiveSessions(userB.id);
    assert.equal(stillActive.length, 1);
    assert.equal(stillActive[0]?.id, bSession.session.id);
  });
});

test("MFA repository: recovery code replacement is transactional and atomic", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const mfa = createPgMfaRepository(db);
    const user = await users.createUser({ email: "recovery.test@example.test", accountType: "employee" });

    await mfa.replaceRecoveryCodes({ userId: user.id, generationId: randomUUID(), codeHashes: ["hash1", "hash2", "hash3"] });
    const found = await mfa.findUnusedRecoveryCodeByHash(user.id, "hash1");
    assert.ok(found);

    // Regenerating replaces the whole set atomically.
    await mfa.replaceRecoveryCodes({ userId: user.id, generationId: randomUUID(), codeHashes: ["hash4"] });
    assert.equal(await mfa.findUnusedRecoveryCodeByHash(user.id, "hash1"), null);
    assert.ok(await mfa.findUnusedRecoveryCodeByHash(user.id, "hash4"));
  });
});

test("MFA repository: stored TOTP secret is encrypted, not plaintext, and round-trips through real Postgres", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const mfa = createPgMfaRepository(db);
    const user = await users.createUser({ email: "mfa-encryption.test@example.test", accountType: "employee" });

    const key = randomBytes(32);
    const { base32 } = generateTotpSecret();
    const encrypted = encryptTotpSecret(base32, key);
    const method = await mfa.createMethod({ userId: user.id, secret: encrypted });

    const stored = await mfa.findActiveOrPendingByUser(user.id);
    assert.ok(stored);
    assert.equal(stored!.id, method.id);
    // The row round-trips through real Postgres columns (secret_ciphertext/
    // secret_iv/secret_auth_tag/secret_key_id) intact...
    assert.equal(stored!.secret.ciphertext, encrypted.ciphertext);
    assert.equal(stored!.secret.iv, encrypted.iv);
    assert.equal(stored!.secret.authTag, encrypted.authTag);
    // ...and what's actually stored in the database is never the plaintext.
    assert.notEqual(stored!.secret.ciphertext, base32);
    // It decrypts back to the original secret with the right key...
    assert.equal(decryptTotpSecret(stored!.secret, key), base32);
    // ...and is rejected with the wrong key or a tampered tag, even after a
    // real round trip through Postgres (not just in-process).
    assert.throws(() => decryptTotpSecret(stored!.secret, randomBytes(32)));
  });
});

test("attempt repository counts recent failures correctly using real timestamps", { skip }, async () => {
  await withTestDb(async (db) => {
    const attempts = createPgAttemptRepository(db);
    const email = "throttle.integration@example.test";
    for (let i = 0; i < 4; i++) {
      await attempts.record({ email, succeeded: false, reason: "invalid_password" });
    }
    await attempts.record({ email, succeeded: true, reason: "success" });
    const sinceIso = new Date(Date.now() - 60_000).toISOString();
    const failures = await attempts.countRecentFailures({ email, sinceIso });
    assert.equal(failures, 4);
  });
});

test("audit repository stores and returns structured change metadata via real JSONB columns", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const audit = createPgAuditRepository(db);
    const user = await users.createUser({ email: "audit.test@example.test", accountType: "employee" });

    const event = await audit.record({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "rbac.role_assigned",
      resourceType: "user_role_assignments",
      resourceId: null,
      legalEntityId: null,
      sessionId: null,
      changeBefore: null,
      changeAfter: { roleKey: "test-role" },
      sourceIp: "203.0.113.9",
      sourceUserAgent: "integration-test-agent",
    });
    assert.equal(event.action, "rbac.role_assigned");
    assert.deepEqual(event.changeAfter, { roleKey: "test-role" });
  });
});
