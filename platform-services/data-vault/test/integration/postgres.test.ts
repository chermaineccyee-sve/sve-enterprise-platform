import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { withTestDb, getTestDatabaseUrl } from "./testDb.ts";
import { createPgUserRepository } from "../../../identity/src/repositories/postgres/pgUserRepository.ts";
import { createPgOrganisationRepository } from "../../../identity/src/repositories/postgres/pgOrganisationRepository.ts";
import { createPgRbacRepository } from "../../../identity/src/repositories/postgres/pgRbacRepository.ts";
import { createPgAuditRepository } from "../../../identity/src/repositories/postgres/pgAuditRepository.ts";
import { createRbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";
import { createPgDataVaultRepository } from "../../src/repositories/postgres/pgDataVaultRepository.ts";
import { createDataVaultService, PERMISSIONS } from "../../src/services/dataVaultService.ts";

const skip: boolean | string = getTestDatabaseUrl()
  ? false
  : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

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
