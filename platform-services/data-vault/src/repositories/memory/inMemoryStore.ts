/**
 * A fresh, isolated in-memory store per test for Data Vault's OWN records
 * only — deliberately separate from platform-services/identity's
 * InMemoryStore (users/roles/entity grants/etc.), since Data Vault does
 * not own or need to hold Identity's data structures; it only calls
 * Identity's own repositories/services for that. Tests that exercise
 * dataVaultService construct both stores independently and wire them
 * together via the service's dependency injection — see
 * test/unit/dataVault.test.ts.
 */
import type { DataVaultRecord, DataVaultRecordVersion } from "../../domain/dataVault.ts";

export interface InMemoryStore {
  dataVaultRecords: DataVaultRecord[];
  dataVaultRecordVersions: DataVaultRecordVersion[];
  dataVaultRecordSeq: number;
}

export function createInMemoryStore(): InMemoryStore {
  return {
    dataVaultRecords: [],
    dataVaultRecordVersions: [],
    dataVaultRecordSeq: 0,
  };
}
