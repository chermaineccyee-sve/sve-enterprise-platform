/**
 * Decides the classification ceiling required to read/write an employee
 * scoped to a given legal entity. This is a confirmed, stable STRUCTURAL
 * fact about the SVE Group (which legal entity is SK Lai & Partners) —
 * not a jurisdiction-specific business RULE (leave/payroll/tax regimes),
 * which PR brief item 13 explicitly forbids hardcoding. Isolated to this
 * one file specifically so it is never duplicated or re-derived
 * elsewhere — see docs/architecture/organisation-employee-master.md
 * "SK Lai & Partners treatment".
 */
import type { LegalEntity } from "../../../identity/src/domain/entities.ts";
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";

const RESTRICTED_LEGAL_ENTITY_KEYS = new Set(["sk-lai-partners-my"]);

/**
 * RESTRICTED for SK Lai & Partners — both directory-level and restricted-HR
 * reads/writes require the `.privileged` permission tier there (item 14:
 * "must not expose all SKL employee data automatically ... merely because
 * they have Group-wide technical administration"). INTERNAL for every
 * other (ordinary SVE Group) entity — the normal permission tier suffices.
 */
export function classificationCeilingForEntity(legalEntity: Pick<LegalEntity, "key">): DataClassification {
  return RESTRICTED_LEGAL_ENTITY_KEYS.has(legalEntity.key) ? "RESTRICTED" : "INTERNAL";
}

/** One tier above the base ceiling, for "restricted HR" fields (employment dates/status/probation/termination/history) — see item 19. RESTRICTED entities stay at RESTRICTED (there is no tier above it in use here), so SKL restricted-HR data requires exactly the same privileged permission as SKL directory data — never less. */
export function restrictedFieldClassificationCeiling(baseCeiling: DataClassification): DataClassification {
  return baseCeiling === "RESTRICTED" ? "RESTRICTED" : "CONFIDENTIAL";
}
