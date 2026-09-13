import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createInMemoryStore as createIdentityInMemoryStore } from "../../../identity/src/repositories/memory/inMemoryStore.ts";
import { createInMemoryRbacRepository } from "../../../identity/src/repositories/memory/inMemoryRbacRepository.ts";
import { createInMemoryOrganisationRepository } from "../../../identity/src/repositories/memory/inMemoryOrganisationRepository.ts";
import { createInMemoryAuditRepository } from "../../../identity/src/repositories/memory/inMemoryAuditRepository.ts";
import { createInMemoryUserRepository } from "../../../identity/src/repositories/memory/inMemoryUserRepository.ts";
import { createRbacService } from "../../../identity/src/services/rbacService.ts";
import { createAuditService } from "../../../identity/src/services/auditService.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { createInMemoryStore } from "../../src/repositories/memory/inMemoryStore.ts";
import { createInMemoryOrgStructureRepository } from "../../src/repositories/memory/inMemoryOrgStructureRepository.ts";
import { createInMemoryEmployeeRepository } from "../../src/repositories/memory/inMemoryEmployeeRepository.ts";
import { createInMemoryEmploymentAssignmentRepository } from "../../src/repositories/memory/inMemoryEmploymentAssignmentRepository.ts";
import { createInMemoryEmployeeCreationTransaction } from "../../src/repositories/memory/inMemoryEmployeeCreationTransaction.ts";
import { createEmployeeService, PERMISSIONS } from "../../src/services/employeeService.ts";
import { NotFoundError, ValidationError } from "../../src/domain/errors.ts";

const ADMIN = randomUUID();

async function setup() {
  const identityStore = createIdentityInMemoryStore();
  const store = createInMemoryStore();
  const rbacRepo = createInMemoryRbacRepository(identityStore);
  const organisation = createInMemoryOrganisationRepository(identityStore);
  const auditRepo = createInMemoryAuditRepository(identityStore);
  const users = createInMemoryUserRepository(identityStore);
  const orgStructure = createInMemoryOrgStructureRepository(store);
  const employeeRepo = createInMemoryEmployeeRepository(store);
  const assignmentRepo = createInMemoryEmploymentAssignmentRepository(store);

  const rbac = createRbacService({ rbac: rbacRepo, organisation, users });
  const audit = createAuditService({ audit: auditRepo });
  const employeeCreation = createInMemoryEmployeeCreationTransaction({ employees: employeeRepo, assignments: assignmentRepo });
  const employees = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure, organisation, users, rbac, audit, employeeCreation });

  const [sg, my, skl] = identityStore.legalEntities;
  return { identityStore, store, rbacRepo, organisation, users, employees, assignmentRepo, sg: sg!, my: my!, skl: skl! };
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

const baseHire = (legalEntityId: string) => ({
  legalName: "Fictional Test Employee",
  employmentCountry: "MY",
  initialAssignment: {
    legalEntityId,
    employmentType: "full_time",
    startDate: "2026-01-01",
  },
});

test("unauthenticated/unauthorised user (no role assignments) cannot create an employee", async () => {
  const { employees, my } = await setup();
  await assert.rejects(() => employees.createEmployee(actor(randomUUID()), baseHire(my.id)), ForbiddenError);
});

test("employee creation by an authorised HR actor succeeds, without requiring an Identity user account for the employee", async () => {
  const { employees, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  assert.match(employee.employeeNumber, /^EMP-\d{6}$/);
  assert.equal(employee.status, "PRE_HIRE");
  // Employee exists with no linked Identity user account at all — supported.
  const view = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(view.employee.id, employee.id);
});

test("an Identity user without any linked employee is still a valid, functioning user (not exercised here beyond: linking is optional)", async () => {
  const { users, identityStore } = await setup();
  const user = await users.createUser({ email: "user.without.employee@example.test", accountType: "employee" });
  const link = await users.findActiveLinkByUserId(user.id);
  assert.equal(link, null);
  assert.ok(identityStore.users.find((u) => u.id === user.id));
});

test("Malaysia employee scoped to the Malaysia entity is visible to MY-scoped HR, Singapore employee is not", async () => {
  const { employees, rbacRepo, my, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const myEmployee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const sgEmployee = await employees.createEmployee(actor(hrUser), baseHire(sg.id));

  const myOnlyHr = randomUUID();
  await grantRole(rbacRepo, myOnlyHr, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });

  const fetchedMy = await employees.getEmployee(actor(myOnlyHr), myEmployee.id);
  assert.equal(fetchedMy.employee.id, myEmployee.id);
  await assert.rejects(() => employees.getEmployee(actor(myOnlyHr), sgEmployee.id), NotFoundError, "SVE Malaysia HR must not automatically read SVE Singapore employee data");
});

test("Group technical administrator (system.users.manage only) does not automatically gain restricted HR access", async () => {
  const { employees, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));

  const sysAdmin = randomUUID();
  await grantRole(rbacRepo, sysAdmin, [{ key: "system.users.manage", maxClassification: "INTERNAL" }], { scopeType: "group" });
  await assert.rejects(() => employees.getEmployee(actor(sysAdmin), employee.id), NotFoundError, "a pure system-administration permission must not grant employee visibility at all");
});

test("directory read without the restricted permission returns canReadRestricted = false", async () => {
  const { employees, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));

  const directoryOnlyUser = randomUUID();
  await grantRole(rbacRepo, directoryOnlyUser, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });
  const view = await employees.getEmployee(actor(directoryOnlyUser), employee.id);
  assert.equal(view.canReadRestricted, false);
});

test("a caller holding both read and read.restricted sees canReadRestricted = true", async () => {
  const { employees, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(
    rbacRepo,
    hrUser,
    [
      { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" },
    ],
    { scopeType: "legal_entity", legalEntityId: my.id },
  );
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const view = await employees.getEmployee(actor(hrUser), employee.id);
  assert.equal(view.canReadRestricted, true);
});

test("SKL employee record remains separately scoped: ordinary (non-privileged) Group-wide read does not reach it", async () => {
  const { employees, rbacRepo, skl } = await setup();
  const privilegedHr = randomUUID();
  await grantRole(
    rbacRepo,
    privilegedHr,
    [{ key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" }, { key: PERMISSIONS.READ_PRIVILEGED, maxClassification: "RESTRICTED" }],
    { scopeType: "legal_entity", legalEntityId: skl.id },
  );
  const sklEmployee = await employees.createEmployee(actor(privilegedHr), baseHire(skl.id));

  const ordinaryGroupHr = randomUUID();
  await grantRole(rbacRepo, ordinaryGroupHr, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  await assert.rejects(() => employees.getEmployee(actor(ordinaryGroupHr), sklEmployee.id), NotFoundError);

  // The privileged HR actor, however, can read it.
  const fetched = await employees.getEmployee(actor(privilegedHr), sklEmployee.id);
  assert.equal(fetched.employee.id, sklEmployee.id);
});

test("System Administrator (Group-wide, ordinary permission) does not automatically gain SKL privileged access", async () => {
  const { employees, rbacRepo, skl } = await setup();
  const privilegedHr = randomUUID();
  await grantRole(rbacRepo, privilegedHr, [{ key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" }], { scopeType: "legal_entity", legalEntityId: skl.id });
  const sklEmployee = await employees.createEmployee(actor(privilegedHr), baseHire(skl.id));

  const groupAdmin = randomUUID();
  // Broad Group-wide scope AND the ordinary (non-privileged) read permission — still must not reach SKL.
  await grantRole(rbacRepo, groupAdmin, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  await assert.rejects(() => employees.getEmployee(actor(groupAdmin), sklEmployee.id), NotFoundError);
});

test("employee without an Identity user account is fully supported end-to-end", async () => {
  const { employees, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  assert.ok(employee.id);
  // No linkIdentity call was ever made — this is the default, expected state.
});

test("controlled user-to-employee linkage: link succeeds, duplicate primary link is prevented on both sides", async () => {
  const { employees, rbacRepo, users, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.LINK_IDENTITY, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const employeeA = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const employeeB = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const someUser = await users.createUser({ email: "linkable.user@example.test", accountType: "employee" });

  await employees.linkIdentity(actor(hrUser), employeeA.id, someUser.id);
  const link = await users.findActiveLinkByUserId(someUser.id);
  assert.equal(link?.employeeId, employeeA.id);

  // Same user cannot be linked to a second employee.
  await assert.rejects(() => employees.linkIdentity(actor(hrUser), employeeB.id, someUser.id), ValidationError);

  // A different user cannot be linked to the already-linked employeeA.
  const anotherUser = await users.createUser({ email: "another.user@example.test", accountType: "employee" });
  await assert.rejects(() => employees.linkIdentity(actor(hrUser), employeeA.id, anotherUser.id), ValidationError);
});

test("unlinking then relinking is supported (controlled unlinkage, then a fresh link)", async () => {
  const { employees, rbacRepo, users, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.LINK_IDENTITY, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const user = await users.createUser({ email: "relink.user@example.test", accountType: "employee" });

  await employees.linkIdentity(actor(hrUser), employee.id, user.id);
  await employees.unlinkIdentity(actor(hrUser), employee.id);
  assert.equal(await users.findActiveLinkByUserId(user.id), null);

  // Relink now succeeds.
  await employees.linkIdentity(actor(hrUser), employee.id, user.id);
  const link = await users.findActiveLinkByUserId(user.id);
  assert.equal(link?.employeeId, employee.id);
});

test("linking without employee_master.link_identity permission is denied even if the actor can read/update the employee", async () => {
  const { employees, rbacRepo, users, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.UPDATE, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const user = await users.createUser({ email: "no.link.perm@example.test", accountType: "employee" });
  await assert.rejects(() => employees.linkIdentity(actor(hrUser), employee.id, user.id), ForbiddenError);
});

test("self-access: an employee linked to their own Identity user can read their own record, including restricted fields, without any entity grant", async () => {
  const { employees, rbacRepo, users, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }, { key: PERMISSIONS.LINK_IDENTITY, maxClassification: "CONFIDENTIAL" }], {
    scopeType: "legal_entity",
    legalEntityId: my.id,
  });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const selfUser = await users.createUser({ email: "self.employee@example.test", accountType: "employee" });
  await employees.linkIdentity(actor(hrUser), employee.id, selfUser.id);

  // selfUser has NO role assignments and NO entity access grants at all.
  const view = await employees.getEmployee(actor(selfUser.id), employee.id);
  assert.equal(view.employee.id, employee.id);
  assert.equal(view.canReadRestricted, true, "an employee may see their own restricted profile fields");
});

test("malformed/mass-assignment-style input is rejected (missing required fields)", async () => {
  const { employees, rbacRepo, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });
  await assert.rejects(
    () => employees.createEmployee(actor(hrUser), { legalName: "", employmentCountry: "MY", initialAssignment: { legalEntityId: my.id, employmentType: "full_time", startDate: "2026-01-01" } }),
    ValidationError,
  );
});

test("creating an employee against an unknown legalEntityId is rejected", async () => {
  const { employees, rbacRepo } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  await assert.rejects(() => employees.createEmployee(actor(hrUser), baseHire(randomUUID())), ValidationError);
});

test("a denied caller requesting a known-existing employee id gets the same NotFoundError as a nonexistent one (IDOR/existence-leak protection)", async () => {
  const { employees, rbacRepo, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: sg.id });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(sg.id));

  const stranger = randomUUID();
  let knownErr: unknown, unknownErr: unknown;
  try {
    await employees.getEmployee(actor(stranger), employee.id);
  } catch (e) {
    knownErr = e;
  }
  try {
    await employees.getEmployee(actor(stranger), randomUUID());
  } catch (e) {
    unknownErr = e;
  }
  assert.ok(knownErr instanceof NotFoundError);
  assert.ok(unknownErr instanceof NotFoundError);
  assert.equal((knownErr as Error).message, (unknownErr as Error).message);
});

test("list excludes employees the caller is not authorised to see", async () => {
  const { employees, rbacRepo, my, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "group" });
  const myEmployee = await employees.createEmployee(actor(hrUser), baseHire(my.id));
  const sgEmployee = await employees.createEmployee(actor(hrUser), baseHire(sg.id));

  const myOnly = randomUUID();
  await grantRole(rbacRepo, myOnly, [{ key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: my.id });
  const views = await employees.listEmployees(actor(myOnly), {});
  const ids = views.map((v) => v.employee.id);
  assert.ok(ids.includes(myEmployee.id));
  assert.ok(!ids.includes(sgEmployee.id));
});

test("audit event created for employee creation, update, and identity linkage; no full restricted record copied into audit metadata", async () => {
  const { employees, rbacRepo, users, identityStore, my } = await setup();
  const hrUser = randomUUID();
  await grantRole(
    rbacRepo,
    hrUser,
    [
      { key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.READ_RESTRICTED, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.UPDATE, maxClassification: "CONFIDENTIAL" },
      { key: PERMISSIONS.LINK_IDENTITY, maxClassification: "CONFIDENTIAL" },
    ],
    { scopeType: "legal_entity", legalEntityId: my.id },
  );
  const employee = await employees.createEmployee(actor(hrUser), { ...baseHire(my.id), personalEmail: "confidential.personal@example.test" });
  await employees.getEmployee(actor(hrUser), employee.id);
  await employees.updateEmployee(actor(hrUser), employee.id, { legalName: "Updated Fictional Name" });
  const user = await users.createUser({ email: "audit.link.user@example.test", accountType: "employee" });
  await employees.linkIdentity(actor(hrUser), employee.id, user.id);

  const actions = identityStore.auditEvents.map((e) => e.action);
  assert.ok(actions.includes("employee_master.employee.created"));
  assert.ok(actions.includes("employee_master.employee.restricted_viewed"));
  assert.ok(actions.includes("employee_master.employee.updated"));
  assert.ok(actions.includes("employee_master.identity.linked"));

  const serialized = JSON.stringify(identityStore.auditEvents);
  assert.ok(!serialized.includes("confidential.personal@example.test"), "personal email must never be copied into the generic audit log");
});

test("a denied direct-access attempt is itself audited as an access denial", async () => {
  const { employees, rbacRepo, identityStore, sg } = await setup();
  const hrUser = randomUUID();
  await grantRole(rbacRepo, hrUser, [{ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" }], { scopeType: "legal_entity", legalEntityId: sg.id });
  const employee = await employees.createEmployee(actor(hrUser), baseHire(sg.id));

  const stranger = randomUUID();
  await assert.rejects(() => employees.getEmployee(actor(stranger), employee.id), NotFoundError);
  const denial = identityStore.auditEvents.find((e) => e.action === "employee_master.access.denied" && e.resourceId === employee.id);
  assert.ok(denial);
});
