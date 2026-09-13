import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowDefinitionRepository } from "../types.ts";
import type { WorkflowDefinition } from "../../domain/workflow.ts";

interface Row {
  id: string;
  key: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS = "id, key, name, description, created_by, created_at, updated_at";

function mapRow(r: Row): WorkflowDefinition {
  return { id: r.id, key: r.key, name: r.name, description: r.description, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function createPgWorkflowDefinitionRepository(db: DatabaseProvider): WorkflowDefinitionRepository {
  return {
    async create(input) {
      const result = await db.query<Row>(
        `INSERT INTO workflow_definitions(key, name, description, created_by) VALUES ($1,$2,$3,$4) RETURNING ${COLUMNS}`,
        [input.key, input.name, input.description ?? null, input.createdBy],
      );
      return mapRow(result.rows[0]!);
    },
    async findById(id) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_definitions WHERE id = $1`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async findByIdForUpdate(id) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_definitions WHERE id = $1 FOR UPDATE`, [id]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async findByKey(key) {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_definitions WHERE key = $1`, [key]);
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },
    async list() {
      const result = await db.query<Row>(`SELECT ${COLUMNS} FROM workflow_definitions ORDER BY created_at DESC`);
      return result.rows.map(mapRow);
    },
  };
}
