import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowDefinitionVersionRepository } from "../types.ts";
import type { WorkflowDefinitionVersion, DefinitionVersionStatus } from "../../domain/workflow.ts";

interface Row {
  id: string;
  definition_id: string;
  version_number: number;
  status: DefinitionVersionStatus;
  allow_parallel_steps: boolean;
  published_at: string | null;
  retired_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id, definition_id, version_number, status, allow_parallel_steps, published_at, retired_at, created_by, created_at, updated_at";

function mapRow(r: Row): WorkflowDefinitionVersion {
  return {
    id: r.id,
    definitionId: r.definition_id,
    versionNumber: r.version_number,
    status: r.status,
    allowParallelSteps: r.allow_parallel_steps,
    publishedAt: r.published_at,
    retiredAt: r.retired_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createPgWorkflowDefinitionVersionRepository(db: DatabaseProvider): WorkflowDefinitionVersionRepository {
  return {
    async create(input) {
      const result = await db.query<Row>(
        `INSERT INTO workflow_definition_versions(definition_id, version_number, created_by) VALUES ($1,$2,$3) RETURNING ${COLUMNS}`,
        [input.definitionId, input.versionNumber, input.createdBy],
      );
      return mapRow(result.rows[0]!);
    },
    async findById(id) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_definition_versions WHERE id = $1`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async findByIdForUpdate(id) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_definition_versions WHERE id = $1 FOR UPDATE`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async listByDefinition(definitionId) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_definition_versions WHERE definition_id = $1 ORDER BY version_number DESC`, [definitionId]);
      return result.rows.map(mapRow);
    },
    async maxVersionNumber(definitionId) {
      const result = await db.query<{ max: number | null }>(`SELECT MAX(version_number) as max FROM workflow_definition_versions WHERE definition_id = $1`, [definitionId]);
      return result.rows[0]?.max ?? 0;
    },
    async updateStatus(id, input) {
      const result = await db.query<Row>(
        `UPDATE workflow_definition_versions SET
           status = $2,
           published_at = CASE WHEN $2 = 'PUBLISHED' THEN NOW() ELSE published_at END,
           retired_at = CASE WHEN $2 = 'RETIRED' THEN NOW() ELSE retired_at END,
           updated_at = NOW()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, input.status],
      );
      if (!result.rows[0]) throw new Error("Workflow definition version not found.");
      return mapRow(result.rows[0]);
    },
  };
}
