/**
 * Organisation structure domain types, mirroring database/migrations/
 * 003_organisation-employee-master/migration.sql. Group and LegalEntity
 * are NOT redefined here — they remain owned by platform-services/
 * identity (imported from there where needed) since Identity's RBAC
 * schema is built directly against them. This package owns only the
 * layers PR #3's own scaffolding note anticipated it would: business
 * unit -> department -> position. See docs/architecture/
 * organisation-employee-master.md "Organisation model".
 */
export type OrgStatus = "active" | "inactive";

export interface BusinessUnit {
  id: string;
  legalEntityId: string;
  name: string;
  code: string;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  legalEntityId: string;
  /** Nullable — a legal entity with no business-unit layer attaches departments directly to itself. */
  businessUnitId: string | null;
  name: string;
  code: string;
  status: OrgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  departmentId: string;
  title: string;
  status: OrgStatus;
  /** Structural reporting line: this position's role reports to that position's role, independent of who holds either. */
  reportsToPositionId: string | null;
  /** Placeholder reference only — no cost-centre master table exists yet. */
  costCentreCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessUnitInput {
  legalEntityId: string;
  name: string;
  code: string;
}

export interface CreateDepartmentInput {
  legalEntityId: string;
  businessUnitId?: string | null;
  name: string;
  code: string;
}

export interface CreatePositionInput {
  departmentId: string;
  title: string;
  reportsToPositionId?: string | null;
  costCentreCode?: string | null;
}
