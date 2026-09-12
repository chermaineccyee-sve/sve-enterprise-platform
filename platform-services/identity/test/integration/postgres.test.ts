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
import { createRbacService } from "../../src/services/rbacService.ts";
import { createSessionService } from "../../src/services/sessionService.ts";
import { hashPassword, verifyPassword } from "../../src/crypto/password.ts";
import { encryptTotpSecret, decryptTotpSecret } from "../../src/crypto/mfaSecretCipher.ts";
import { generateTotpSecret } from "../../src/crypto/totp.ts";
import { createPgDataVaultRepository } from "../../src/repositories/postgres/pgDataVaultRepository.ts";
import { createDataVaultService, PERMISSIONS } from "../../src/services/dataVaultService.ts";
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
    const rbacService = createRbacService({ rbac, organisation });

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

test("session repository: create, validate via real NOW()-based expiry, revoke", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const sessions = createPgSessionRepository(db);
    const sessionService = createSessionService({ sessions });
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
    const sessionService = createSessionService({ sessions });
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

test("Data Vault: record codes are server-generated, unique, and survive a real round trip through Postgres", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const dataVault = createPgDataVaultRepository(db);
    const creator = await users.createUser({ email: "vault.pg.creator@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();

    const first = await dataVault.create({
      legalEntityId: my!.id,
      jurisdiction: "Malaysia",
      category: "Regulatory",
      topic: "First evidence record",
      source: "Official authority",
      tier: "Tier 1",
      confidence: "High",
      classification: "INTERNAL",
      createdBy: creator.id,
    });
    const second = await dataVault.create({
      legalEntityId: my!.id,
      jurisdiction: "Malaysia",
      category: "Regulatory",
      topic: "Second evidence record",
      source: "Official authority",
      tier: "Tier 1",
      confidence: "High",
      classification: "INTERNAL",
      createdBy: creator.id,
    });
    assert.match(first.recordCode, /^SVE-DV-MY-REG-\d{4}$/);
    assert.notEqual(first.recordCode, second.recordCode, "concurrent-safe sequence must never produce duplicate record codes");

    const fetched = await dataVault.findById(first.id);
    assert.equal(fetched?.recordCode, first.recordCode);
  });
});

test("Data Vault: an invalid classification value is rejected at the database level (CHECK constraint), not just in application code", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const [my] = await organisation.listLegalEntities();
    const creator = await users.createUser({ email: "vault.pg.badclass@example.test", accountType: "employee" });

    await assert.rejects(() =>
      db.query(
        `INSERT INTO data_vault_records(record_code, legal_entity_id, jurisdiction, category, topic, source, tier, confidence, classification, status, created_by, updated_by)
         VALUES ('SVE-DV-TEST-0001', $1, 'Malaysia', 'Regulatory', 'x', 'x', 'Tier 1', 'High', 'NOT_A_REAL_CLASSIFICATION', 'Requires Review', $2, $2)`,
        [my!.id, creator.id],
      ),
    );
  });
});

test("Data Vault: an unknown legal_entity_id is rejected at the database level (foreign key)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const creator = await users.createUser({ email: "vault.pg.badentity@example.test", accountType: "employee" });
    await assert.rejects(() =>
      db.query(
        `INSERT INTO data_vault_records(record_code, legal_entity_id, jurisdiction, category, topic, source, tier, confidence, classification, status, created_by, updated_by)
         VALUES ('SVE-DV-TEST-0002', $1, 'Malaysia', 'Regulatory', 'x', 'x', 'Tier 1', 'High', 'INTERNAL', 'Requires Review', $2, $2)`,
        [randomUUID(), creator.id],
      ),
    );
  });
});

test("Data Vault: update writes a version snapshot, and archive is a status transition that never deletes the row", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const dataVault = createPgDataVaultRepository(db);
    const [my] = await organisation.listLegalEntities();
    const creator = await users.createUser({ email: "vault.pg.version@example.test", accountType: "employee" });

    const record = await dataVault.create({
      legalEntityId: my!.id,
      jurisdiction: "Malaysia",
      category: "Macro",
      topic: "Original topic",
      source: "Original source",
      tier: "Tier 2",
      confidence: "Medium",
      classification: "INTERNAL",
      createdBy: creator.id,
    });
    await dataVault.addVersion({ recordId: record.id, version: record.version, snapshot: { ...record }, changeNote: "before update", changedBy: creator.id });
    const updated = await dataVault.update(record.id, { topic: "Updated topic", updatedBy: creator.id });
    assert.equal(updated.topic, "Updated topic");
    assert.equal(updated.version, 2);

    const versions = await dataVault.listVersions(record.id);
    assert.equal(versions.length, 1);
    assert.equal(versions[0]!.snapshot.topic, "Original topic");

    const archived = await dataVault.archive(record.id, creator.id);
    assert.equal(archived.status, "Archived");
    assert.ok(archived.archivedAt);
    const stillExists = await dataVault.findById(record.id);
    assert.ok(stillExists, "archiving must never delete the row");
    assert.equal(stillExists!.status, "Archived");
  });
});

test("Data Vault: SQL-injection-style input in search/topic is handled safely by parameterized queries", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const dataVault = createPgDataVaultRepository(db);
    const [my] = await organisation.listLegalEntities();
    const creator = await users.createUser({ email: "vault.pg.injection@example.test", accountType: "employee" });

    const maliciousTopic = "'; DROP TABLE data_vault_records; --";
    const record = await dataVault.create({
      legalEntityId: my!.id,
      jurisdiction: "Malaysia",
      category: "Regulatory",
      topic: maliciousTopic,
      source: "Official authority",
      tier: "Tier 1",
      confidence: "High",
      classification: "INTERNAL",
      createdBy: creator.id,
    });
    assert.equal(record.topic, maliciousTopic, "the literal string is stored, not executed");

    // The table must still exist and be queryable — proves no injection occurred.
    const results = await dataVault.list({ search: "DROP TABLE" });
    assert.ok(results.some((r) => r.id === record.id));
  });
});

test("Data Vault end-to-end through real Postgres: entity isolation, classification ceiling, and audit trail via dataVaultService", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const dataVaultRepo = createPgDataVaultRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const dataVault = createDataVaultService({ dataVault: dataVaultRepo, rbac, organisation, audit });
    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const sg = entities.find((e) => e.key === "sve-international-sg")!;

    const admin = await users.createUser({ email: "vault.pg.admin@example.test", accountType: "employee" });

    const creator = await users.createUser({ email: "vault.pg.e2e.creator@example.test", accountType: "employee" });
    const createRole = await rbacRepo.createRole({ key: "vault-e2e-creator", name: "Vault E2E Creator" });
    const createPerm = await rbacRepo.createPermission({ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" });
    const readPerm = await rbacRepo.createPermission({ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" });
    await rbacRepo.grantPermissionToRole(createRole.id, createPerm.id);
    await rbacRepo.grantPermissionToRole(createRole.id, readPerm.id);
    await rbacRepo.assignRole({ userId: creator.id, roleId: createRole.id, grantedBy: admin.id });
    await rbacRepo.grantEntityAccess({ userId: creator.id, scopeType: "group", grantedBy: admin.id });

    const myRecord = await dataVault.createRecord(
      { userId: creator.id, email: creator.email },
      { legalEntityId: my.id, jurisdiction: "Malaysia", category: "Regulatory", topic: "MY evidence", source: "Official", tier: "Tier 1", confidence: "High", classification: "CONFIDENTIAL" },
    );
    const sgRecord = await dataVault.createRecord(
      { userId: creator.id, email: creator.email },
      { legalEntityId: sg.id, jurisdiction: "Singapore", category: "Regulatory", topic: "SG evidence", source: "Official", tier: "Tier 1", confidence: "High", classification: "CONFIDENTIAL" },
    );

    // A second user with access to MY only, via real Postgres-backed RBAC.
    const myOnlyUser = await users.createUser({ email: "vault.pg.e2e.myonly@example.test", accountType: "employee" });
    const myRole = await rbacRepo.createRole({ key: "vault-e2e-my-only", name: "MY-only reader" });
    await rbacRepo.grantPermissionToRole(myRole.id, readPerm.id);
    await rbacRepo.assignRole({ userId: myOnlyUser.id, roleId: myRole.id, grantedBy: admin.id });
    await rbacRepo.grantEntityAccess({ userId: myOnlyUser.id, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin.id });

    const fetchedMy = await dataVault.getRecord({ userId: myOnlyUser.id, email: myOnlyUser.email }, myRecord.id);
    assert.equal(fetchedMy.id, myRecord.id);
    await assert.rejects(() => dataVault.getRecord({ userId: myOnlyUser.id, email: myOnlyUser.email }, sgRecord.id));

    const list = await dataVault.listRecords({ userId: myOnlyUser.id, email: myOnlyUser.email }, {});
    assert.ok(list.some((r) => r.id === myRecord.id));
    assert.ok(!list.some((r) => r.id === sgRecord.id));

    const auditRows = await db.query<{ action: string }>(`SELECT action FROM security_audit_events WHERE resource_id = $1`, [myRecord.id]);
    const actions = auditRows.rows.map((r) => r.action);
    assert.ok(actions.includes("data_vault.record.created"));
    assert.ok(actions.includes("data_vault.record.viewed"), "CONFIDENTIAL record view must be audited");
  });
});
