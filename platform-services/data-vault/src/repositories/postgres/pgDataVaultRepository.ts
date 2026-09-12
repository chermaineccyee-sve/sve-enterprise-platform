import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { DataVaultRepository } from "../types.ts";
import type {
  DataVaultRecord,
  DataVaultRecordVersion,
  DataVaultStatus,
  CreateDataVaultRecordInput,
  UpdateDataVaultRecordInput,
  DataVaultRecordFilter,
} from "../../domain/dataVault.ts";
import type { DataClassification } from "../../../../../packages/types/src/entity-context.ts";
import { buildRecordCode } from "../../domain/dataVaultRecordCode.ts";

interface RecordRow {
  id: string;
  record_code: string;
  legal_entity_id: string;
  jurisdiction: string;
  category: string;
  topic: string;
  source: string;
  tier: string;
  confidence: string;
  checked_date: string | null;
  classification: DataClassification;
  status: DataVaultStatus;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
}

interface VersionRow {
  id: string;
  record_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  change_note: string | null;
  changed_by: string;
  changed_at: string;
}

const RECORD_COLUMNS =
  "id, record_code, legal_entity_id, jurisdiction, category, topic, source, tier, confidence, checked_date, classification, status, version, created_by, updated_by, created_at, updated_at, archived_at, archived_by";

function mapRecord(row: RecordRow): DataVaultRecord {
  return {
    id: row.id,
    recordCode: row.record_code,
    legalEntityId: row.legal_entity_id,
    jurisdiction: row.jurisdiction,
    category: row.category,
    topic: row.topic,
    source: row.source,
    tier: row.tier,
    confidence: row.confidence,
    checkedDate: row.checked_date,
    classification: row.classification,
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
  };
}

function mapVersion(row: VersionRow): DataVaultRecordVersion {
  return {
    id: row.id,
    recordId: row.record_id,
    version: row.version,
    snapshot: row.snapshot,
    changeNote: row.change_note,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
  };
}

export function createPgDataVaultRepository(db: DatabaseProvider): DataVaultRepository {
  return {
    async create(input: CreateDataVaultRecordInput & { createdBy: string }): Promise<DataVaultRecord> {
      const seqResult = await db.query<{ nextval: string }>(`SELECT nextval('data_vault_record_seq')`);
      const seq = Number(seqResult.rows[0]!.nextval);
      const recordCode = buildRecordCode(input.jurisdiction, input.category, seq);
      const result = await db.query<RecordRow>(
        `INSERT INTO data_vault_records(
           record_code, legal_entity_id, jurisdiction, category, topic, source, tier, confidence,
           checked_date, classification, status, created_by, updated_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Requires Review',$11,$11)
         RETURNING ${RECORD_COLUMNS}`,
        [
          recordCode,
          input.legalEntityId,
          input.jurisdiction,
          input.category,
          input.topic,
          input.source,
          input.tier,
          input.confidence,
          input.checkedDate ?? null,
          input.classification,
          input.createdBy,
        ],
      );
      return mapRecord(result.rows[0]!);
    },

    async findById(id: string): Promise<DataVaultRecord | null> {
      const result = await db.query<RecordRow>(`SELECT ${RECORD_COLUMNS} FROM data_vault_records WHERE id = $1`, [id]);
      return result.rows[0] ? mapRecord(result.rows[0]) : null;
    },

    async list(filter: DataVaultRecordFilter): Promise<DataVaultRecord[]> {
      const clauses: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (filter.legalEntityId) {
        clauses.push(`legal_entity_id = $${i++}`);
        params.push(filter.legalEntityId);
      }
      if (filter.classification) {
        clauses.push(`classification = $${i++}`);
        params.push(filter.classification);
      }
      if (filter.status) {
        clauses.push(`status = $${i++}`);
        params.push(filter.status);
      }
      if (filter.tier) {
        clauses.push(`tier = $${i++}`);
        params.push(filter.tier);
      }
      if (filter.checkedFrom) {
        clauses.push(`checked_date >= $${i++}`);
        params.push(filter.checkedFrom);
      }
      if (filter.checkedTo) {
        clauses.push(`checked_date <= $${i++}`);
        params.push(filter.checkedTo);
      }
      if (filter.search) {
        clauses.push(
          `(record_code ILIKE $${i} OR jurisdiction ILIKE $${i} OR category ILIKE $${i} OR topic ILIKE $${i} OR source ILIKE $${i})`,
        );
        params.push(`%${filter.search}%`);
        i++;
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await db.query<RecordRow>(
        `SELECT ${RECORD_COLUMNS} FROM data_vault_records ${where} ORDER BY updated_at DESC`,
        params,
      );
      return result.rows.map(mapRecord);
    },

    async update(id: string, input: UpdateDataVaultRecordInput & { updatedBy: string }): Promise<DataVaultRecord> {
      const current = await db.query<RecordRow>(`SELECT ${RECORD_COLUMNS} FROM data_vault_records WHERE id = $1`, [id]);
      const existing = current.rows[0];
      if (!existing) throw new Error("Data Vault record not found.");
      const result = await db.query<RecordRow>(
        `UPDATE data_vault_records SET
           legal_entity_id = $2, jurisdiction = $3, category = $4, topic = $5, source = $6, tier = $7,
           confidence = $8, checked_date = $9, classification = $10, status = $11, version = version + 1,
           updated_by = $12, updated_at = NOW()
         WHERE id = $1
         RETURNING ${RECORD_COLUMNS}`,
        [
          id,
          input.legalEntityId ?? existing.legal_entity_id,
          input.jurisdiction ?? existing.jurisdiction,
          input.category ?? existing.category,
          input.topic ?? existing.topic,
          input.source ?? existing.source,
          input.tier ?? existing.tier,
          input.confidence ?? existing.confidence,
          input.checkedDate === undefined ? existing.checked_date : input.checkedDate,
          input.classification ?? existing.classification,
          input.status ?? existing.status,
          input.updatedBy,
        ],
      );
      return mapRecord(result.rows[0]!);
    },

    async archive(id: string, archivedBy: string): Promise<DataVaultRecord> {
      const result = await db.query<RecordRow>(
        `UPDATE data_vault_records SET
           status = 'Archived', archived_at = NOW(), archived_by = $2,
           version = version + 1, updated_by = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING ${RECORD_COLUMNS}`,
        [id, archivedBy],
      );
      if (!result.rows[0]) throw new Error("Data Vault record not found.");
      return mapRecord(result.rows[0]);
    },

    async addVersion(input: {
      recordId: string;
      version: number;
      snapshot: Record<string, unknown>;
      changeNote?: string | null;
      changedBy: string;
    }): Promise<DataVaultRecordVersion> {
      const result = await db.query<VersionRow>(
        `INSERT INTO data_vault_record_versions(record_id, version, snapshot, change_note, changed_by)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, record_id, version, snapshot, change_note, changed_by, changed_at`,
        [input.recordId, input.version, JSON.stringify(input.snapshot), input.changeNote ?? null, input.changedBy],
      );
      return mapVersion(result.rows[0]!);
    },

    async listVersions(recordId: string): Promise<DataVaultRecordVersion[]> {
      const result = await db.query<VersionRow>(
        `SELECT id, record_id, version, snapshot, change_note, changed_by, changed_at
         FROM data_vault_record_versions WHERE record_id = $1 ORDER BY version DESC`,
        [recordId],
      );
      return result.rows.map(mapVersion);
    },
  };
}
