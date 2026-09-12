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
import { createPgOrgStructureRepository } from "../../src/repositories/postgres/pgOrgStructureRepository.ts";
import { createPgEmployeeRepository } from "../../src/repositories/postgres/pgEmployeeRepository.ts";
import { createPgEmploymentAssignmentRepository } from "../../src/repositories/postgres/pgEmploymentAssignmentRepository.ts";
import { createEmployeeService, PERMISSIONS } from "../../src/services/employeeService.ts";
import { createEmploymentAssignmentService } from "../../src/services/employmentAssignmentService.ts";

const skip: boolean | string = getTestDatabaseUrl()
  ? false
  : "DATABASE_URL not set — run against a real Postgres to exercise this suite (see CI).";

test("Organisation: employee numbers are server-generated from a shared sequence and never collide under concurrent creation", { skip }, async () => {
  await withTestDb(async (db) => {
    const employees = createPgEmployeeRepository(db);
    const admin = await createPgUserRepository(db).createUser({ email: "org.pg.empnum.admin@example.test", accountType: "employee" });

    const seqs = await Promise.all(Array.from({ length: 10 }, () => employees.nextEmployeeNumberSeq()));
    const unique = new Set(seqs);
    assert.equal(unique.size, 10, "concurrent sequence draws must never collide");

    const created = await employees.create({
      legalName: "Fictional PG Employee",
      employmentCountry: "MY",
      employeeNumber: `EMP-${String(seqs[0]).padStart(6, "0")}`,
      createdBy: admin.id,
    });
    assert.match(created.employeeNumber, /^EMP-\d{6}$/);
  });
});

test("Organisation: only one OPEN primary employment assignment per employee is allowed at the database level (partial unique index)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const assignments = createPgEmploymentAssignmentRepository(db);
    const admin = await users.createUser({ email: "org.pg.oneprimary.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();

    const employee = await employees.create({ legalName: "Fictional Primary Test", employmentCountry: "MY", employeeNumber: "EMP-900001", createdBy: admin.id });
    await assignments.create({
      employeeId: employee.id,
      legalEntityId: my!.id,
      employmentType: "full_time",
      status: "ACTIVE",
      isPrimary: true,
      startDate: "2026-01-01",
      effectiveFrom: "2026-01-01",
      createdBy: admin.id,
    } as never);

    await assert.rejects(
      () =>
        assignments.create({
          employeeId: employee.id,
          legalEntityId: my!.id,
          employmentType: "full_time",
          status: "ACTIVE",
          isPrimary: true,
          startDate: "2026-02-01",
          effectiveFrom: "2026-02-01",
          createdBy: admin.id,
        } as never),
      /duplicate key|unique constraint/i,
      "a second OPEN primary assignment for the same employee must be rejected at the DB level",
    );
  });
});

test("Organisation: a non-primary (secondary) assignment can coexist with an open primary assignment at the database level", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const assignments = createPgEmploymentAssignmentRepository(db);
    const admin = await users.createUser({ email: "org.pg.secondary.admin@example.test", accountType: "employee" });
    const entities = await organisation.listLegalEntities();
    const my = entities.find((e) => e.key === "sve-international-my")!;
    const sg = entities.find((e) => e.key === "sve-international-sg")!;

    const employee = await employees.create({ legalName: "Fictional Secondment Test", employmentCountry: "MY", employeeNumber: "EMP-900002", createdBy: admin.id });
    await assignments.create({
      employeeId: employee.id,
      legalEntityId: my.id,
      employmentType: "full_time",
      status: "ACTIVE",
      isPrimary: true,
      startDate: "2026-01-01",
      effectiveFrom: "2026-01-01",
      createdBy: admin.id,
    } as never);
    const secondment = await assignments.create({
      employeeId: employee.id,
      legalEntityId: sg.id,
      employmentType: "secondment",
      status: "ACTIVE",
      isPrimary: false,
      startDate: "2026-06-01",
      effectiveFrom: "2026-06-01",
      createdBy: admin.id,
    } as never);
    assert.equal(secondment.isPrimary, false);
  });
});

test("Organisation: self-reporting is rejected at the database level for positions (CHECK constraint)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const orgStructure = createPgOrgStructureRepository(db);
    await users.createUser({ email: "org.pg.posselfreport.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();
    const dept = await orgStructure.createDepartment({ legalEntityId: my!.id, name: "Fictional Dept", code: `FD-${randomUUID().slice(0, 6)}` });
    const position = await orgStructure.createPosition({ departmentId: dept.id, title: "Fictional Role" });

    await assert.rejects(
      () => db.query(`UPDATE positions SET reports_to_position_id = $1 WHERE id = $1`, [position.id]),
      /check constraint|positions_no_self_report/i,
    );
  });
});

test("Organisation: self-reporting is rejected at the database level for employment assignments (CHECK constraint)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const admin = await users.createUser({ email: "org.pg.assignselfreport.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();
    const employee = await employees.create({ legalName: "Fictional Self Report Test", employmentCountry: "MY", employeeNumber: "EMP-900003", createdBy: admin.id });

    const inserted = await db.query<{ id: string }>(
      `INSERT INTO employment_assignments(employee_id, legal_entity_id, employment_type, status, start_date, effective_from, created_by, updated_by)
       VALUES ($1, $2, 'full_time', 'ACTIVE', '2026-01-01', '2026-01-01', $3, $3) RETURNING id`,
      [employee.id, my!.id, admin.id],
    );
    const assignmentId = inserted.rows[0]!.id;

    await assert.rejects(
      () => db.query(`UPDATE employment_assignments SET reports_to_assignment_id = $1 WHERE id = $1`, [assignmentId]),
      /check constraint|employment_assignments_no_self_report/i,
    );
  });
});

test("Organisation: an unknown legal_entity_id on an employment assignment is rejected at the database level (foreign key)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const employees = createPgEmployeeRepository(db);
    const admin = await users.createUser({ email: "org.pg.badentity.admin@example.test", accountType: "employee" });
    const employee = await employees.create({ legalName: "Fictional Bad Entity Test", employmentCountry: "MY", employeeNumber: "EMP-900004", createdBy: admin.id });

    await assert.rejects(() =>
      db.query(
        `INSERT INTO employment_assignments(employee_id, legal_entity_id, employment_type, status, start_date, effective_from, created_by, updated_by)
         VALUES ($1, $2, 'full_time', 'ACTIVE', '2026-01-01', '2026-01-01', $3, $3)`,
        [employee.id, randomUUID(), admin.id],
      ),
    );
  });
});

test("Organisation: an invalid employment status is rejected at the database level (CHECK constraint)", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const admin = await users.createUser({ email: "org.pg.badstatus.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();
    const employee = await employees.create({ legalName: "Fictional Bad Status Test", employmentCountry: "MY", employeeNumber: "EMP-900005", createdBy: admin.id });

    await assert.rejects(() =>
      db.query(
        `INSERT INTO employment_assignments(employee_id, legal_entity_id, employment_type, status, start_date, effective_from, created_by, updated_by)
         VALUES ($1, $2, 'full_time', 'NOT_A_REAL_STATUS', '2026-01-01', '2026-01-01', $3, $3)`,
        [employee.id, my!.id, admin.id],
      ),
    );
  });
});

test("Organisation: user_employee_links allows only one ACTIVE link per user and per employee, while preserving unlinked history rows", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const employees = createPgEmployeeRepository(db);
    const admin = await users.createUser({ email: "org.pg.link.admin@example.test", accountType: "employee" });
    const [my] = await organisation.listLegalEntities();
    void my;

    const employeeA = await employees.create({ legalName: "Fictional Link Employee A", employmentCountry: "MY", employeeNumber: "EMP-900006", createdBy: admin.id });
    const employeeB = await employees.create({ legalName: "Fictional Link Employee B", employmentCountry: "MY", employeeNumber: "EMP-900007", createdBy: admin.id });
    const userA = await users.createUser({ email: "org.pg.link.usera@example.test", accountType: "employee" });

    await users.linkEmployee({ userId: userA.id, employeeId: employeeA.id, linkedBy: admin.id });

    // Same user, second employee -> must be rejected while the first link is active.
    await assert.rejects(() => users.linkEmployee({ userId: userA.id, employeeId: employeeB.id, linkedBy: admin.id }));

    const activeLink = await users.findActiveLinkByUserId(userA.id);
    assert.ok(activeLink);
    await users.unlinkEmployee(activeLink!.id, admin.id);

    // After unlinking, the same user may be linked to a different employee, and the old row survives as history.
    await users.linkEmployee({ userId: userA.id, employeeId: employeeB.id, linkedBy: admin.id });
    const newActive = await users.findActiveLinkByUserId(userA.id);
    assert.equal(newActive?.employeeId, employeeB.id);

    const historyCount = await db.query<{ count: string }>(`SELECT count(*)::text FROM user_employee_links WHERE user_id = $1`, [userA.id]);
    assert.equal(historyCount.rows[0]!.count, "2", "the unlinked historical row must still exist, not be deleted");
  });
});

test("Organisation end-to-end through real Postgres: SK Lai & Partners requires the privileged permission tier even for an otherwise Group-wide administrator", { skip }, async () => {
  await withTestDb(async (db) => {
    const users = createPgUserRepository(db);
    const organisation = createPgOrganisationRepository(db);
    const rbacRepo = createPgRbacRepository(db);
    const auditRepo = createPgAuditRepository(db);
    const orgStructureRepo = createPgOrgStructureRepository(db);
    const employeeRepo = createPgEmployeeRepository(db);
    const assignmentRepo = createPgEmploymentAssignmentRepository(db);
    const rbac = createRbacService({ rbac: rbacRepo, organisation });
    const audit = createAuditService({ audit: auditRepo });
    const employeeService = createEmployeeService({ employees: employeeRepo, assignments: assignmentRepo, orgStructure: orgStructureRepo, organisation, users, rbac, audit });

    const entities = await organisation.listLegalEntities();
    const skl = entities.find((e) => e.key === "sk-lai-partners-my")!;
    const admin = await users.createUser({ email: "org.pg.skl.admin@example.test", accountType: "employee" });

    // Group-wide, but NOT privileged — the exact "System Administrator !=
    // HR Administrator" scenario the PR brief calls out.
    const groupAdmin = await users.createUser({ email: "org.pg.skl.groupadmin@example.test", accountType: "employee" });
    const role = await rbacRepo.createRole({ key: "org-e2e-group-admin", name: "Group Admin (non-privileged)" });
    const createPerm = await rbacRepo.createPermission({ key: PERMISSIONS.CREATE, maxClassification: "CONFIDENTIAL" });
    await rbacRepo.grantPermissionToRole(role.id, createPerm.id);
    await rbacRepo.assignRole({ userId: groupAdmin.id, roleId: role.id, grantedBy: admin.id });
    await rbacRepo.grantEntityAccess({ userId: groupAdmin.id, scopeType: "group", grantedBy: admin.id });

    await assert.rejects(
      () =>
        employeeService.createEmployee(
          { userId: groupAdmin.id, email: groupAdmin.email },
          {
            legalName: "Fictional SKL Employee",
            employmentCountry: "MY",
            initialAssignment: { legalEntityId: skl.id, employmentType: "full_time", startDate: "2026-01-01" },
          },
        ),
      "Group-wide CONFIDENTIAL-tier access must not be sufficient to create an SKL employee (RESTRICTED tier required)",
    );

    // Now grant the privileged tier explicitly — this must succeed.
    const privilegedPerm = await rbacRepo.createPermission({ key: PERMISSIONS.CREATE_PRIVILEGED, maxClassification: "RESTRICTED" });
    await rbacRepo.grantPermissionToRole(role.id, privilegedPerm.id);
    const employee = await employeeService.createEmployee(
      { userId: groupAdmin.id, email: groupAdmin.email },
      {
        legalName: "Fictional SKL Employee",
        employmentCountry: "MY",
        initialAssignment: { legalEntityId: skl.id, employmentType: "full_time", startDate: "2026-01-01" },
      },
    );
    assert.ok(employee.id);
  });
});
