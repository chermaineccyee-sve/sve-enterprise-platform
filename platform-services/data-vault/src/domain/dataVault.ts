/**
 * Data Vault domain types, mirroring database/migrations/
 * 002_data-vault-foundation/migration.sql. Field set is derived from the
 * actual current apps/svegip/data-vault/index.html "Evidence Record" model
 * (`sveRecords` / #recordModal), plus the classification and legal-entity
 * fields this PR adds to make the record RBAC/entity-aware — see
 * docs/architecture/data-vault-foundation.md "Evidence-based inventory"
 * and "Server-side record model". No fields beyond that inventory (no
 * tags, no matter/client linkage, no risk metadata) — none of those exist
 * in the current Data Vault functionality this PR remediates.
 */
import type { DataClassification } from "../../../../packages/types/src/entity-context.ts";

export type DataVaultStatus = "Requires Review" | "Report Ready" | "Monitoring" | "Archived";

export interface DataVaultRecord {
  id: string;
  recordCode: string;
  legalEntityId: string;
  jurisdiction: string;
  category: string;
  topic: string;
  source: string;
  tier: string;
  confidence: string;
  checkedDate: string | null;
  classification: DataClassification;
  status: DataVaultStatus;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archivedBy: string | null;
}

export interface DataVaultRecordVersion {
  id: string;
  recordId: string;
  version: number;
  snapshot: Record<string, unknown>;
  changeNote: string | null;
  changedBy: string;
  changedAt: string;
}

/** Fields a caller may supply when creating a record — everything else (id, code, status, audit fields) is server-assigned. */
export interface CreateDataVaultRecordInput {
  legalEntityId: string;
  jurisdiction: string;
  category: string;
  topic: string;
  source: string;
  tier: string;
  confidence: string;
  checkedDate?: string | null;
  classification: DataClassification;
}

/** Fields a caller may update. Classification and legal entity ARE updatable (e.g. reclassification, correction) but each change is independently authorized — see dataVaultService.ts. */
export interface UpdateDataVaultRecordInput {
  legalEntityId?: string;
  jurisdiction?: string;
  category?: string;
  topic?: string;
  source?: string;
  tier?: string;
  confidence?: string;
  checkedDate?: string | null;
  classification?: DataClassification;
  status?: DataVaultStatus;
  changeNote?: string;
}

export interface DataVaultRecordFilter {
  legalEntityId?: string;
  classification?: DataClassification;
  status?: DataVaultStatus;
  tier?: string;
  search?: string;
  checkedFrom?: string;
  checkedTo?: string;
}
