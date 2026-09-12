import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { OrganisationRepository } from "../types.ts";
import type { LegalEntity } from "../../domain/entities.ts";

interface LegalEntityRow {
  id: string;
  group_id: string;
  key: string;
  name: string;
  jurisdiction: string;
  currency: string;
  is_group_headquarters: boolean;
}

function mapLegalEntity(row: LegalEntityRow): LegalEntity {
  return {
    id: row.id,
    groupId: row.group_id,
    key: row.key,
    name: row.name,
    jurisdiction: row.jurisdiction,
    currency: row.currency,
    isGroupHeadquarters: row.is_group_headquarters,
  };
}

export function createPgOrganisationRepository(db: DatabaseProvider): OrganisationRepository {
  return {
    async findLegalEntityByKey(key: string): Promise<LegalEntity | null> {
      const result = await db.query<LegalEntityRow>(
        `SELECT id, group_id, key, name, jurisdiction, currency, is_group_headquarters FROM legal_entities WHERE key = $1`,
        [key],
      );
      return result.rows[0] ? mapLegalEntity(result.rows[0]) : null;
    },
    async findLegalEntityById(id: string): Promise<LegalEntity | null> {
      const result = await db.query<LegalEntityRow>(
        `SELECT id, group_id, key, name, jurisdiction, currency, is_group_headquarters FROM legal_entities WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapLegalEntity(result.rows[0]) : null;
    },
    async listLegalEntities(): Promise<LegalEntity[]> {
      const result = await db.query<LegalEntityRow>(
        `SELECT id, group_id, key, name, jurisdiction, currency, is_group_headquarters FROM legal_entities ORDER BY key`,
      );
      return result.rows.map(mapLegalEntity);
    },
  };
}
