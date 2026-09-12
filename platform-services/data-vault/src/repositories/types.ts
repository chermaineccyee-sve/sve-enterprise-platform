/**
 * Data Vault's own repository interface. Moved out of platform-services/
 * identity (where it was originally added) so Identity's repository
 * contracts do not carry Data Vault's business shape — see
 * docs/architecture/data-vault-foundation.md "Module ownership and
 * dependency direction". dataVaultService depends on this interface, never
 * on a concrete DatabaseProvider/SQL client directly, mirroring Identity's
 * own repository-pattern convention.
 */
import type {
  DataVaultRecord,
  DataVaultRecordVersion,
  CreateDataVaultRecordInput,
  UpdateDataVaultRecordInput,
  DataVaultRecordFilter,
} from "../domain/dataVault.ts";

export interface DataVaultRepository {
  create(input: CreateDataVaultRecordInput & { createdBy: string }): Promise<DataVaultRecord>;
  findById(id: string): Promise<DataVaultRecord | null>;
  list(filter: DataVaultRecordFilter): Promise<DataVaultRecord[]>;
  update(id: string, input: UpdateDataVaultRecordInput & { updatedBy: string }): Promise<DataVaultRecord>;
  archive(id: string, archivedBy: string): Promise<DataVaultRecord>;
  addVersion(input: {
    recordId: string;
    version: number;
    snapshot: Record<string, unknown>;
    changeNote?: string | null;
    changedBy: string;
  }): Promise<DataVaultRecordVersion>;
  listVersions(recordId: string): Promise<DataVaultRecordVersion[]>;
}
