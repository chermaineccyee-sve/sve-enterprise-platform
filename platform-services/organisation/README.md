# platform-services/organisation

**Status: implemented (PR #6), own package. This PR is not the full
HRMS.** This package now owns the organisational backbone (Group → Legal
Entity → Business Unit → Department → Position) and the Employee Master
(employee identity + effective-dated employment assignments/reporting) that
future HRMS/Payroll/Payslips/iClaims/Accounting modules will build on. See
`docs/architecture/organisation-employee-master.md` for the full
before/after write-up, the database model, the RBAC/classification
enforcement model, the User-vs-Employee distinction, SK Lai & Partners
segregation, and the future-HRMS/Payroll boundary.

## Module ownership and dependency direction

Organisation structure and Employee Master live together in this one
package — not split in two — because PR #3's own pre-existing scaffold
README already declared this the intended home for both, and the two are
tightly coupled at this stage (an assignment always references both a
legal entity/department/position *and* an employee). See the architecture
doc §5 for the full reasoning. Identity is an upstream security capability
this package *consumes*, never the other way round:

```
platform-services/
├── identity/        (identity/access/session/MFA/audit — no Organisation/
│                      Employee-Master knowledge)
└── organisation/     (organisation structure + Employee Master: domain,
                        repositories, services, API/routes, tests — this
                        package)
```

Concretely: `platform-services/identity/src/container.ts` and
`src/api/http.ts` have no import of, or knowledge of, anything in this
package. This package's own composition root
(`src/composition/container.ts`) is where Identity and Organisation are
wired together — the glue lives on the dependent side, not inside Identity
— importing Identity's Postgres repositories (`pgUserRepository`,
`pgOrganisationRepository`, `pgRbacRepository`, `pgSessionRepository`,
`pgAuditRepository`), its `sessionService`/`rbacService`/`auditService`,
and its migration runner — all by relative source import, the same
documented cross-package coupling `platform-services/data-vault` already
established (this monorepo has no package-registry/workspace boundary
between sibling `platform-services/*` yet). Nothing Identity-owned is
reimplemented here: no second session-validation, RBAC-evaluation,
audit-redaction, or Postgres-pool implementation exists in this package.

**Unlike Data Vault, this package includes no SVEGIP session-cookie
bridge.** No existing `apps/svegip` page authenticates against Employee
Master today, so the only authentication path is a native Identity bearer
session (`src/api/middleware/actor.ts`). Adding a SVEGIP bridge later,
following Data Vault's exact pattern, remains straightforward if a future
PR wires an `apps/svegip` page into this API.

**A known consequence of source-path imports (not an oversight, and not
unique to this package):** because this package's composition root imports
Identity's `.ts` files directly rather than through an installed package,
Node resolves those files' own dependencies (`pg`) relative to *their*
location — inside `platform-services/identity/node_modules`. This
package's own `package.json` therefore has **zero runtime dependencies**.
Running or CI-testing this package requires `platform-services/identity`'s
own `npm ci` to have been run too — see `.github/workflows/ci.yml`'s
`validate-organisation` job, which installs both before testing. If this
coupling becomes a maintenance burden across a third dependent package, the
fix is an npm workspace or an installable internal package for Identity's
consumed pieces — not duplicating their implementation here.

## What's here

- `src/domain/organisation.ts`, `src/domain/employee.ts` — `BusinessUnit`/
  `Department`/`Position` and `Employee`/`EmploymentAssignment`, matching
  `003_organisation-employee-master`'s schema.
- `src/repositories/` — `OrgStructureRepository`/`EmployeeRepository`/
  `EmploymentAssignmentRepository` interfaces plus Postgres and in-memory
  implementations.
- `src/services/employeeService.ts`, `employmentAssignmentService.ts`,
  `organisationStructureService.ts` — the RBAC/entity/classification
  enforcement (directory-vs-restricted field masking, SK Lai & Partners'
  privileged tier, effective-dated transitions, reporting-cycle
  prevention, Identity linkage), and audit integration. Depend on
  Identity's `RbacService`/`AuditService`/`OrganisationRepository`/
  `UserRepository` *contracts* only.
- `src/services/entityClassification.ts` — the one file that knows SK Lai
  & Partners' legal-entity key, isolated deliberately (see the
  architecture doc §10).
- `src/api/middleware/actor.ts` — resolves the caller via a native Identity
  bearer session only.
- `src/api/routes/organisation.ts`, `src/api/routes/employees.ts`,
  `src/api/http.ts`, `src/server.ts` — the `/api/v1/organisation/*` and
  `/api/v1/employees/*` HTTP surface, served by this package's own
  standalone HTTP server (not mounted into Identity's or Data Vault's).
- `test/unit/`, `test/integration/` — see the architecture doc's test
  summary for what each file covers.

**Depends on:** `platform-services/identity`'s session/RBAC/audit
services, repositories, and migration runner (by source import — see
above); the shared Postgres schema those repositories operate against
(`legal_entities`, `users`, `entity_access_grants`, `user_employee_links`,
`permissions` from `001_identity-foundation`, plus this package's own
`003_organisation-employee-master` tables).
**Must not depend on:** `hrms`/`payroll` internal schemas — those depend on
this package for entity/employee context, never the other way round; no
payroll/compensation/salary/bank/tax/statutory/medical data is stored here.
**API namespace:** `/api/v1/organisation/*`, `/api/v1/employees/*`.
**Data classification range in use:** INTERNAL (default) through RESTRICTED
(SK Lai & Partners, `.privileged` tier only).
