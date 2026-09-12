import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryRbacRepository } from "../../src/repositories/memory/inMemoryRbacRepository.ts";
import { createInMemoryOrganisationRepository } from "../../src/repositories/memory/inMemoryOrganisationRepository.ts";
import { createInMemoryDataVaultRepository } from "../../src/repositories/memory/inMemoryDataVaultRepository.ts";
import { createInMemoryAuditRepository } from "../../src/repositories/memory/inMemoryAuditRepository.ts";
import { createRbacService } from "../../src/services/rbacService.ts";
import { createAuditService } from "../../src/services/auditService.ts";
import { createDataVaultService, PERMISSIONS } from "../../src/services/dataVaultService.ts";
import { NotFoundError, ForbiddenError, ValidationError } from "../../src/domain/errors.ts";

const ADMIN = randomUUID(); // fictional "granted by" bootstrap actor id, matches rbac.test.ts's convention

async function setup() {
  const store = createInMemoryStore();
  const rbacRepo = createInMemoryRbacRepository(store);
  const organisation = createInMemoryOrganisationRepository(store);
  const dataVaultRepo = createInMemoryDataVaultRepository(store);
  const auditRepo = createInMemoryAuditRepository(store);
  const rbac = createRbacService({ rbac: rbacRepo, organisation });
  const audit = createAuditService({ audit: auditRepo });
  const dataVault = createDataVaultService({ dataVault: dataVaultRepo, rbac, organisation, audit });
  const [sg, my, skl] = store.legalEntities;
  return { store, rbacRepo, organisation, dataVault, rbac, sg: sg!, my: my!, skl: skl! };
}

async function grantRole(
  rbacRepo: ReturnType<typeof createInMemoryRbacRepository>,
  userId: string,
  permissions: { key: string; maxClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PRIVILEGED" }[],
  entityGrant: { scopeType: "group" } | { scopeType: "legal_entity"; legalEntityId: string },
) {
  const role = await rbacRepo.createRole({ key: `role-${randomUUID()}`, name: "Test role" });
  for (const p of permissions) {
    const existing = await rbacRepo.findPermissionByKey(p.key);
    const permission = existing ?? (await rbacRepo.createPermission({ key: p.key, maxClassification: p.maxClassification }));
    await rbacRepo.grantPermissionToRole(role.id, permission.id);
  }
  await rbacRepo.assignRole({ userId, roleId: role.id, grantedBy: ADMIN });
  await rbacRepo.grantEntityAccess({ userId, ...entityGrant, grantedBy: ADMIN } as Parameters<typeof rbacRepo.grantEntityAccess>[0]);
}

function actor(userId: string) {
  return { userId, email: `${userId}@example.test` };
}

const baseInput = (legalEntityId: string, classification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "PRIVILEGED" = "INTERNAL") => ({
  legalEntityId,
  jurisdiction: "Malaysia",
  category: "Regulatory",
  topic: "Test evidence topic",
  source: "Official authority",
  tier: "Tier 1",
  confidence: "High",
  classification,
});

test("unauthenticated/unauthorised user (no role assignments) cannot create a record", async () => {
  const { dataVault, my } = await setup();
  await assert.rejects(() => dataVault.createRecord(actor(randomUUID()), baseInput(my.id)), ForbiddenError);
});

test("authorised create, then authorised read by the creator", async () => {
  const { dataVault, rbacRepo, my } = await setup();
  const userId = randomUUID();
  await grantRole(rbacRepo, userId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const created = await dataVault.createRecord(actor(userId), baseInput(my.id, "CONFIDENTIAL"));
  assert.match(created.recordCode, /^SVE-DV-MY-REG-\d{4}$/);
  assert.equal(created.status, "Requires Review");

  const fetched = await dataVault.getRecord(actor(userId), created.id);
  assert.equal(fetched.id, created.id);
});

test("a record created with an unknown legalEntityId is rejected", async () => {
  const { dataVault, rbacRepo } = await setup();
  const userId = randomUUID();
  await grantRole(rbacRepo, userId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  await assert.rejects(() => dataVault.createRecord(actor(userId), baseInput(randomUUID())), ValidationError);
});

test("missing required fields are rejected (malformed input)", async () => {
  const { dataVault, rbacRepo, my } = await setup();
  const userId = randomUUID();
  await grantRole(rbacRepo, userId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });
  await assert.rejects(() => dataVault.createRecord(actor(userId), { ...baseInput(my.id), topic: "" }), ValidationError);
});

test("Entity A (SVE Malaysia) access does not grant Entity B (SVE Singapore) access", async () => {
  const { dataVault, rbacRepo, my, sg } = await setup();
  const creatorId = randomUUID();
  await grantRole(rbacRepo, creatorId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: sg.id,
  });
  const sgRecord = await dataVault.createRecord(actor(creatorId), baseInput(sg.id));

  const myOnlyUser = randomUUID();
  await grantRole(rbacRepo, myOnlyUser, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });

  await assert.rejects(() => dataVault.getRecord(actor(myOnlyUser), sgRecord.id), NotFoundError, "SVE MY access must not imply SVE SG access");
});

test("Group/HQ authority does not automatically grant SKL PRIVILEGED access", async () => {
  const { dataVault, rbacRepo, sg, skl } = await setup();
  assert.equal(sg.isGroupHeadquarters, true);

  const creatorId = randomUUID();
  // A privileged creator authorised specifically for SKL creates a PRIVILEGED record there.
  await grantRole(
    rbacRepo,
    creatorId,
    [
      { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "PRIVILEGED" },
    ],
    { scopeType: "legal_entity", legalEntityId: skl.id },
  );
  const privilegedRecord = await dataVault.createRecord(actor(creatorId), baseInput(skl.id, "PRIVILEGED"));

  // A Group-scope, HQ-adjacent user with only the ordinary (non-privileged) read permission.
  const groupUser = randomUUID();
  await grantRole(rbacRepo, groupUser, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });

  await assert.rejects(
    () => dataVault.getRecord(actor(groupUser), privilegedRecord.id),
    NotFoundError,
    "Group scope + ordinary read permission must not reach a PRIVILEGED SKL record",
  );
});

test("System Administrator role does not automatically gain PRIVILEGED access", async () => {
  const { dataVault, rbacRepo, skl } = await setup();
  const creatorId = randomUUID();
  await grantRole(
    rbacRepo,
    creatorId,
    [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "PRIVILEGED" }],
    { scopeType: "legal_entity", legalEntityId: skl.id },
  );
  const privileged = await dataVault.createRecord(actor(creatorId), baseInput(skl.id, "PRIVILEGED"));

  const adminId = randomUUID();
  // "Administrator" here only ever receives the ordinary read permission, group-wide —
  // exactly the scenario item 6/19 forbids being sufficient for PRIVILEGED data.
  await grantRole(rbacRepo, adminId, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });

  await assert.rejects(() => dataVault.getRecord(actor(adminId), privileged.id), NotFoundError);
});

test("classification ceiling is enforced independently of entity access breadth", async () => {
  const { dataVault, rbacRepo, my } = await setup();
  const creatorId = randomUUID();
  await grantRole(
    rbacRepo,
    creatorId,
    [{ key: PERMISSIONS.CREATE, maxClassification: "RESTRICTED" }],
    { scopeType: "legal_entity", legalEntityId: my.id },
  );
  const restricted = await dataVault.createRecord(actor(creatorId), baseInput(my.id, "RESTRICTED"));

  const cappedUser = randomUUID();
  // Full entity access, but the permission itself is capped at CONFIDENTIAL.
  await grantRole(rbacRepo, cappedUser, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });

  await assert.rejects(() => dataVault.getRecord(actor(cappedUser), restricted.id), NotFoundError);
});

test("list/search excludes records the caller is not authorised to see, without revealing they exist", async () => {
  const { dataVault, rbacRepo, my, sg } = await setup();
  const creatorId = randomUUID();
  await grantRole(rbacRepo, creatorId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const myRecord = await dataVault.createRecord(actor(creatorId), baseInput(my.id));
  const sgRecord = await dataVault.createRecord(actor(creatorId), baseInput(sg.id));

  const myOnlyUser = randomUUID();
  await grantRole(rbacRepo, myOnlyUser, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });

  const results = await dataVault.listRecords(actor(myOnlyUser), {});
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes(myRecord.id));
  assert.ok(!ids.includes(sgRecord.id), "an SG record must not appear in a MY-only user's list");
});

test("direct request by a known UUID is still denied when the caller lacks access (IDOR)", async () => {
  const { dataVault, rbacRepo, sg } = await setup();
  const creatorId = randomUUID();
  await grantRole(rbacRepo, creatorId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: sg.id });
  const record = await dataVault.createRecord(actor(creatorId), baseInput(sg.id));

  const strangerId = randomUUID(); // no role assignments at all
  await assert.rejects(() => dataVault.getRecord(actor(strangerId), record.id), NotFoundError);
  // A genuinely nonexistent id produces the identical error type/shape.
  await assert.rejects(() => dataVault.getRecord(actor(strangerId), randomUUID()), NotFoundError);
});

test("unauthorised update is denied and the record is left unchanged", async () => {
  const { dataVault, rbacRepo, my } = await setup();
  const creatorId = randomUUID();
  await grantRole(rbacRepo, creatorId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const record = await dataVault.createRecord(actor(creatorId), baseInput(my.id));

  // A stranger with no role assignments at all cannot even see the record -> NotFoundError (hides existence).
  const strangerId = randomUUID();
  await assert.rejects(() => dataVault.updateRecord(actor(strangerId), record.id, { topic: "Hijacked" }), NotFoundError);

  // A user who CAN see the record (has read access) but was never granted update -> ForbiddenError (honest, since they already know it exists).
  const readOnlyId = randomUUID();
  await grantRole(rbacRepo, readOnlyId, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });
  await assert.rejects(() => dataVault.updateRecord(actor(readOnlyId), record.id, { topic: "Hijacked" }), ForbiddenError);

  const stillThere = await dataVault.getRecord(actor(creatorId), record.id);
  assert.equal(stillThere.topic, "Test evidence topic");
});

test("authorised update creates a version snapshot of the prior state", async () => {
  const { dataVault, rbacRepo, my } = await setup();
  const userId = randomUUID();
  await grantRole(
    rbacRepo,
    userId,
    [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.UPDATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }],
    { scopeType: "legal_entity", legalEntityId: my.id },
  );
  const record = await dataVault.createRecord(actor(userId), baseInput(my.id));
  const updated = await dataVault.updateRecord(actor(userId), record.id, { topic: "Revised topic", changeNote: "Correcting typo" });
  assert.equal(updated.topic, "Revised topic");
  assert.equal(updated.version, 2);
});

test("reclassifying a record to PRIVILEGED requires the privileged update permission, not just ordinary update", async () => {
  const { dataVault, rbacRepo, my } = await setup();
  const userId = randomUUID();
  await grantRole(
    rbacRepo,
    userId,
    [
      { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.UPDATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" },
    ],
    { scopeType: "legal_entity", legalEntityId: my.id },
  );
  const record = await dataVault.createRecord(actor(userId), baseInput(my.id, "CONFIDENTIAL"));
  await assert.rejects(() => dataVault.updateRecord(actor(userId), record.id, { classification: "PRIVILEGED" }), ForbiddenError);
});

test("archiving is soft (status transition, not row deletion) and requires archive permission", async () => {
  const { dataVault, rbacRepo, store, my } = await setup();
  const userId = randomUUID();
  await grantRole(
    rbacRepo,
    userId,
    [
      { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.ARCHIVE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" },
    ],
    { scopeType: "legal_entity", legalEntityId: my.id },
  );
  const record = await dataVault.createRecord(actor(userId), baseInput(my.id));
  const archived = await dataVault.archiveRecord(actor(userId), record.id);
  assert.equal(archived.status, "Archived");
  assert.ok(archived.archivedAt);
  assert.equal(store.dataVaultRecords.find((r) => r.id === record.id)?.id, record.id, "the row still exists — archiving never deletes it");
});

test("archiving without archive permission is denied", async () => {
  const { dataVault, rbacRepo, my } = await setup();
  const userId = randomUUID();
  // Has read+create (so the record is visible to them) but was never granted archive.
  await grantRole(rbacRepo, userId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const record = await dataVault.createRecord(actor(userId), baseInput(my.id));
  await assert.rejects(() => dataVault.archiveRecord(actor(userId), record.id), ForbiddenError);
});

test("audit events are created for create/view(sensitive)/update/archive, and never contain full record content", async () => {
  const { dataVault, rbacRepo, store, my } = await setup();
  const userId = randomUUID();
  await grantRole(
    rbacRepo,
    userId,
    [
      { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.UPDATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.ARCHIVE, maxClassification: "CONFIDENTIAL" },
    ],
    { scopeType: "legal_entity", legalEntityId: my.id },
  );
  const record = await dataVault.createRecord(actor(userId), { ...baseInput(my.id, "CONFIDENTIAL"), topic: "Secret client strategy detail" });
  await dataVault.getRecord(actor(userId), record.id); // CONFIDENTIAL -> should be audited
  await dataVault.updateRecord(actor(userId), record.id, { topic: "Updated secret detail" });
  await dataVault.archiveRecord(actor(userId), record.id);

  const actions = store.auditEvents.map((e) => e.action);
  assert.ok(actions.includes("data_vault.record.created"));
  assert.ok(actions.includes("data_vault.record.viewed"));
  assert.ok(actions.includes("data_vault.record.updated"));
  assert.ok(actions.includes("data_vault.record.archived"));

  const serialized = JSON.stringify(store.auditEvents);
  assert.ok(!serialized.includes("Secret client strategy detail"), "audit log must never contain full record content");
  assert.ok(!serialized.includes("Updated secret detail"), "audit log must never contain full record content");
});

test("a denied direct-access attempt is itself audited as an access denial", async () => {
  const { dataVault, rbacRepo, store, sg } = await setup();
  const creatorId = randomUUID();
  await grantRole(rbacRepo, creatorId, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: sg.id });
  const record = await dataVault.createRecord(actor(creatorId), baseInput(sg.id));

  const strangerId = randomUUID();
  await assert.rejects(() => dataVault.getRecord(actor(strangerId), record.id), NotFoundError);

  const denial = store.auditEvents.find((e) => e.action === "data_vault.access.denied" && e.resourceId === record.id);
  assert.ok(denial, "the denied access attempt must be audited");
  assert.equal(denial!.actorUserId, strangerId);
});
