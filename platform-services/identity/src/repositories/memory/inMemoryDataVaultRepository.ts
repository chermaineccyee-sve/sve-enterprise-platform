import { randomUUID } from "node:crypto";
import type { DataVaultRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type {
  DataVaultRecord,
  DataVaultRecordVersion,
  CreateDataVaultRecordInput,
  UpdateDataVaultRecordInput,
  DataVaultRecordFilter,
} from "../../domain/dataVault.ts";
import { buildRecordCode } from "../../domain/dataVaultRecordCode.ts";

export function createInMemoryDataVaultRepository(store: InMemoryStore): DataVaultRepository {
  return {
    async create(input: CreateDataVaultRecordInput & { createdBy: string }): Promise<DataVaultRecord> {
      store.dataVaultRecordSeq += 1;
      const now = new Date().toISOString();
      const record: DataVaultRecord = {
        id: randomUUID(),
        recordCode: buildRecordCode(input.jurisdiction, input.category, store.dataVaultRecordSeq),
        legalEntityId: input.legalEntityId,
        jurisdiction: input.jurisdiction,
        category: input.category,
        topic: input.topic,
        source: input.source,
        tier: input.tier,
        confidence: input.confidence,
        checkedDate: input.checkedDate ?? null,
        classification: input.classification,
        status: "Requires Review",
        version: 1,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        archivedBy: null,
      };
      store.dataVaultRecords.push(record);
      return record;
    },
    async findById(id: string): Promise<DataVaultRecord | null> {
      return store.dataVaultRecords.find((r) => r.id === id) ?? null;
    },
    async list(filter: DataVaultRecordFilter): Promise<DataVaultRecord[]> {
      const q = filter.search?.trim().toLowerCase();
      return store.dataVaultRecords.filter((r) => {
        if (filter.legalEntityId && r.legalEntityId !== filter.legalEntityId) return false;
        if (filter.classification && r.classification !== filter.classification) return false;
        if (filter.status && r.status !== filter.status) return false;
        if (filter.tier && r.tier !== filter.tier) return false;
        if (filter.checkedFrom && (!r.checkedDate || r.checkedDate < filter.checkedFrom)) return false;
        if (filter.checkedTo && (!r.checkedDate || r.checkedDate > filter.checkedTo)) return false;
        if (q) {
          const haystack = `${r.recordCode} ${r.jurisdiction} ${r.category} ${r.topic} ${r.source}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
    },
    async update(id: string, input: UpdateDataVaultRecordInput & { updatedBy: string }): Promise<DataVaultRecord> {
      const record = store.dataVaultRecords.find((r) => r.id === id);
      if (!record) throw new Error("Data Vault record not found.");
      if (input.legalEntityId !== undefined) record.legalEntityId = input.legalEntityId;
      if (input.jurisdiction !== undefined) record.jurisdiction = input.jurisdiction;
      if (input.category !== undefined) record.category = input.category;
      if (input.topic !== undefined) record.topic = input.topic;
      if (input.source !== undefined) record.source = input.source;
      if (input.tier !== undefined) record.tier = input.tier;
      if (input.confidence !== undefined) record.confidence = input.confidence;
      if (input.checkedDate !== undefined) record.checkedDate = input.checkedDate;
      if (input.classification !== undefined) record.classification = input.classification;
      if (input.status !== undefined) record.status = input.status;
      record.version += 1;
      record.updatedBy = input.updatedBy;
      record.updatedAt = new Date().toISOString();
      return record;
    },
    async archive(id: string, archivedBy: string): Promise<DataVaultRecord> {
      const record = store.dataVaultRecords.find((r) => r.id === id);
      if (!record) throw new Error("Data Vault record not found.");
      record.status = "Archived";
      record.archivedAt = new Date().toISOString();
      record.archivedBy = archivedBy;
      record.version += 1;
      record.updatedBy = archivedBy;
      record.updatedAt = record.archivedAt;
      return record;
    },
    async addVersion(input: {
      recordId: string;
      version: number;
      snapshot: Record<string, unknown>;
      changeNote?: string | null;
      changedBy: string;
    }): Promise<DataVaultRecordVersion> {
      const versionRow: DataVaultRecordVersion = {
        id: randomUUID(),
        recordId: input.recordId,
        version: input.version,
        snapshot: input.snapshot,
        changeNote: input.changeNote ?? null,
        changedBy: input.changedBy,
        changedAt: new Date().toISOString(),
      };
      store.dataVaultRecordVersions.push(versionRow);
      return versionRow;
    },
    async listVersions(recordId: string): Promise<DataVaultRecordVersion[]> {
      return store.dataVaultRecordVersions.filter((v) => v.recordId === recordId).sort((a, b) => b.version - a.version);
    },
  };
}
