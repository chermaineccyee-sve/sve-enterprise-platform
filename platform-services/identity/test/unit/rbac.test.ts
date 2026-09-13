import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryRbacRepository } from "../../src/repositories/memory/inMemoryRbacRepository.ts";
import { createInMemoryOrganisationRepository } from "../../src/repositories/memory/inMemoryOrganisationRepository.ts";
import { createInMemoryUserRepository } from "../../src/repositories/memory/inMemoryUserRepository.ts";
import { createRbacService } from "../../src/services/rbacService.ts";

async function setup() {
  const store = createInMemoryStore();
  const rbac = createInMemoryRbacRepository(store);
  const organisation = createInMemoryOrganisationRepository(store);
  const users = createInMemoryUserRepository(store);
  const rbacService = createRbacService({ rbac, organisation, users });
  const [sg, my, skl] = store.legalEntities;
  const admin = randomUUID(); // "granted by" placeholder — a fictional bootstrap actor id
  return { store, rbac, organisation, users, rbacService, sg: sg!, my: my!, skl: skl!, admin };
}

test("no role assignment at all -> DENY (default-deny)", async () => {
  const { rbacService } = await setup();
  const result = await rbacService.authorize({ userId: randomUUID(), permissionKey: "hr.records.view" });
  assert.equal(result.allowed, false);
});

test("permission granted + entity access covers target -> ALLOW", async () => {
  const { rbac, rbacService, my, admin } = await setup();
  const userId = randomUUID();
  const role = await rbac.createRole({ key: "hr-manager", name: "HR Manager" });
  const permission = await rbac.createPermission({ key: "hr.records.view", maxClassification: "CONFIDENTIAL" });
  await rbac.grantPermissionToRole(role.id, permission.id);
  await rbac.assignRole({ userId, roleId: role.id, grantedBy: admin });
  await rbac.grantEntityAccess({ userId, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin });

  const result = await rbacService.authorize({
    userId,
    permissionKey: "hr.records.view",
    target: { legalEntityId: my.id, recordClassification: "CONFIDENTIAL" },
  });
  assert.equal(result.allowed, true);
});

test("Entity A access does not automatically grant Entity B (SVE Malaysia access does not cover SVE Singapore)", async () => {
  const { rbac, rbacService, my, sg, admin } = await setup();
  const userId = randomUUID();
  const role = await rbac.createRole({ key: "finance-clerk", name: "Finance Clerk" });
  const permission = await rbac.createPermission({ key: "accounting.records.view", maxClassification: "CONFIDENTIAL" });
  await rbac.grantPermissionToRole(role.id, permission.id);
  await rbac.assignRole({ userId, roleId: role.id, grantedBy: admin });
  // Grant only Malaysia entity access.
  await rbac.grantEntityAccess({ userId, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin });

  const resultMY = await rbacService.authorize({
    userId,
    permissionKey: "accounting.records.view",
    target: { legalEntityId: my.id },
  });
  const resultSG = await rbacService.authorize({
    userId,
    permissionKey: "accounting.records.view",
    target: { legalEntityId: sg.id },
  });
  assert.equal(resultMY.allowed, true, "Malaysia access should be allowed");
  assert.equal(resultSG.allowed, false, "Singapore access must NOT be implied by Malaysia access");
});

test("Group-level HQ (Singapore) status does not itself grant SKL access without an explicit grant", async () => {
  const { rbac, rbacService, sg, skl, admin } = await setup();
  // Sanity: Singapore is modelled as HQ in the seed data.
  assert.equal(sg.isGroupHeadquarters, true);

  const userId = randomUUID();
  const role = await rbac.createRole({ key: "group-management", name: "Group Management" });
  const permission = await rbac.createPermission({ key: "legal.records.view", maxClassification: "RESTRICTED" });
  await rbac.grantPermissionToRole(role.id, permission.id);
  await rbac.assignRole({ userId, roleId: role.id, grantedBy: admin });
  // Only Singapore (the HQ entity) access is granted — nothing for SKL.
  await rbac.grantEntityAccess({ userId, scopeType: "legal_entity", legalEntityId: sg.id, grantedBy: admin });

  const result = await rbacService.authorize({
    userId,
    permissionKey: "legal.records.view",
    target: { legalEntityId: skl.id },
  });
  assert.equal(result.allowed, false, "HQ entity access must not imply SKL access");
});

test("a Group-scope entity access grant does cover every legal entity for entity purposes, but not classification", async () => {
  const { rbac, rbacService, skl, admin } = await setup();
  const userId = randomUUID();
  const role = await rbac.createRole({ key: "group-ops", name: "Group Operations" });
  // This permission is capped at CONFIDENTIAL — it must not reach PRIVILEGED SKL records.
  const permission = await rbac.createPermission({ key: "documents.view", maxClassification: "CONFIDENTIAL" });
  await rbac.grantPermissionToRole(role.id, permission.id);
  await rbac.assignRole({ userId, roleId: role.id, grantedBy: admin });
  await rbac.grantEntityAccess({ userId, scopeType: "group", grantedBy: admin });

  const confidentialResult = await rbacService.authorize({
    userId,
    permissionKey: "documents.view",
    target: { legalEntityId: skl.id, recordClassification: "CONFIDENTIAL" },
  });
  const privilegedResult = await rbacService.authorize({
    userId,
    permissionKey: "documents.view",
    target: { legalEntityId: skl.id, recordClassification: "PRIVILEGED" },
  });
  assert.equal(confidentialResult.allowed, true, "group scope + sufficient classification -> allowed");
  assert.equal(
    privilegedResult.allowed,
    false,
    "group-wide entity access must not imply access to PRIVILEGED SKL records",
  );
});

test("System Administrator role does not automatically inherit HR/Finance/Payroll restricted permissions", async () => {
  const { rbac, rbacService, my, admin } = await setup();
  const userId = randomUUID();
  // Administrator role exists and has system-administration permissions only —
  // it is never granted the payroll/HR restricted permission at all.
  const adminRole = await rbac.createRole({ key: "administrator", name: "Administrator" });
  const sysPermission = await rbac.createPermission({ key: "system.users.manage", maxClassification: "INTERNAL" });
  await rbac.grantPermissionToRole(adminRole.id, sysPermission.id);
  await rbac.assignRole({ userId, roleId: adminRole.id, grantedBy: admin });
  await rbac.grantEntityAccess({ userId, scopeType: "group", grantedBy: admin });

  // A different, real permission exists for payroll, but was never granted to this role.
  await rbac.createPermission({ key: "payroll.salary.view", maxClassification: "RESTRICTED" });

  const canManageUsers = await rbacService.authorize({ userId, permissionKey: "system.users.manage" });
  const canViewSalary = await rbacService.authorize({
    userId,
    permissionKey: "payroll.salary.view",
    target: { legalEntityId: my.id, recordClassification: "RESTRICTED" },
  });
  assert.equal(canManageUsers.allowed, true);
  assert.equal(canViewSalary.allowed, false, "Administrator must not automatically inherit payroll/salary access");
});

test("unauthorised user (no assignments) is denied even for INTERNAL data", async () => {
  const { rbacService } = await setup();
  const result = await rbacService.authorize({
    userId: randomUUID(),
    permissionKey: "announcements.view",
    target: { recordClassification: "INTERNAL" },
  });
  assert.equal(result.allowed, false);
});

test("a revoked role assignment no longer authorises", async () => {
  const { rbac, rbacService, admin } = await setup();
  const userId = randomUUID();
  const role = await rbac.createRole({ key: "temp-role", name: "Temporary Role" });
  const permission = await rbac.createPermission({ key: "temp.action", maxClassification: "INTERNAL" });
  await rbac.grantPermissionToRole(role.id, permission.id);
  const assignment = await rbac.assignRole({ userId, roleId: role.id, grantedBy: admin });

  const before = await rbacService.authorize({ userId, permissionKey: "temp.action" });
  await rbac.revokeRoleAssignment(assignment.id, admin);
  const after = await rbacService.authorize({ userId, permissionKey: "temp.action" });

  assert.equal(before.allowed, true);
  assert.equal(after.allowed, false);
});

test("a revoked entity access grant no longer covers its former target", async () => {
  const { rbac, rbacService, my, admin } = await setup();
  const userId = randomUUID();
  const role = await rbac.createRole({ key: "role-x", name: "Role X" });
  const permission = await rbac.createPermission({ key: "action.x", maxClassification: "INTERNAL" });
  await rbac.grantPermissionToRole(role.id, permission.id);
  await rbac.assignRole({ userId, roleId: role.id, grantedBy: admin });
  const grant = await rbac.grantEntityAccess({ userId, scopeType: "legal_entity", legalEntityId: my.id, grantedBy: admin });

  const before = await rbacService.authorize({ userId, permissionKey: "action.x", target: { legalEntityId: my.id } });
  await rbac.revokeEntityAccess(grant.id, admin);
  const after = await rbacService.authorize({ userId, permissionKey: "action.x", target: { legalEntityId: my.id } });

  assert.equal(before.allowed, true);
  assert.equal(after.allowed, false);
});
