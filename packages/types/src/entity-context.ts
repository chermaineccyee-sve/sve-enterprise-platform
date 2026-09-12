/**
 * Shared organisation/entity model.
 *
 * Contract only — no implementation. Replaces SVEGIP's current flat, free-text
 * `unit` field (values observed today: "SVE", "SKL", "Group") with a real,
 * layered scoping model. See docs/architecture/platform-architecture.md
 * ("Multi-entity model") for the rationale.
 *
 * Nothing in apps/svegip is changed to use this yet — this is the contract
 * future platform-services modules (starting with `organisation`) are meant
 * to implement.
 */

/** The top of the hierarchy. Exactly one group exists today: SVE Group. */
export interface Group {
  id: string;
  name: string;
}

/**
 * A distinct legal entity under the group. Each has its own jurisdiction,
 * currency, and statutory rules — never assume one country/currency/tax
 * system/leave policy applies to all of them.
 *
 * Known entities at design time (not hard-coded anywhere — this is the shape,
 * not the data): SVE International Sdn. Bhd. (Malaysia), SVE International
 * Pte. Ltd. (Singapore), SK Lai & Partners (Malaysia).
 */
export interface LegalEntity {
  id: string;
  groupId: string;
  name: string;
  jurisdiction: string; // e.g. "MY", "SG" — ISO 3166-1 alpha-2, not free text
  currency: string; // e.g. "MYR", "SGD" — ISO 4217, not free text
}

/** A business unit within a legal entity (e.g. a practice area, a division). */
export interface BusinessUnit {
  id: string;
  legalEntityId: string;
  name: string;
}

/** A department/team within a business unit. */
export interface Department {
  id: string;
  businessUnitId: string;
  name: string;
  parentDepartmentId?: string; // supports a reporting hierarchy, not just a flat list
}

/**
 * The classification levels referenced throughout docs/architecture/. Access
 * decisions should consult a record's classification, not only its owning
 * module — see security-architecture.md.
 */
export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED"
  | "PRIVILEGED";

/**
 * The context every authenticated API request is expected to carry once
 * identity/organisation services exist. This is what a future request-scoped
 * `core` composition root builds and passes down to domain services — domain
 * services should receive this, not re-derive it from raw session data
 * themselves.
 */
export interface EntityContext {
  groupId: string;
  legalEntityId: string;
  businessUnitId?: string;
  departmentId?: string;
}

/**
 * An explicit grant of access to an entity scope, distinct from a role.
 * A user's role determines *what* they can do; entity access determines
 * *where* (which legal entity / business unit / department) they can do it.
 * Neither should imply the other.
 */
export interface EntityAccessGrant {
  userId: string;
  legalEntityId: string;
  businessUnitId?: string;
  departmentId?: string;
  grantedBy: string;
  grantedAt: string; // ISO 8601
}
