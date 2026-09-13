import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { LifecycleMilestoneRepository } from "../types.ts";
import type { HrLifecycleMilestone, MilestoneStatus, CreateMilestoneInput } from "../../domain/lifecycle.ts";

interface MilestoneRow {
  id: string;
  case_id: string;
  milestone_type: string;
  status: MilestoneStatus;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const MILESTONE_COLUMNS = "id, case_id, milestone_type, status, due_date, completed_at, completed_by, reference, notes, created_at, updated_at";

function mapMilestone(r: MilestoneRow): HrLifecycleMilestone {
  return {
    id: r.id,
    caseId: r.case_id,
    milestoneType: r.milestone_type,
    status: r.status,
    dueDate: r.due_date,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    reference: r.reference,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createPgLifecycleMilestoneRepository(db: DatabaseProvider): LifecycleMilestoneRepository {
  return {
    async create(caseId: string, input: CreateMilestoneInput): Promise<HrLifecycleMilestone> {
      const result = await db.query<MilestoneRow>(
        `INSERT INTO hr_lifecycle_milestones(case_id, milestone_type, due_date, reference, notes)
         VALUES ($1,$2,$3,$4,$5) RETURNING ${MILESTONE_COLUMNS}`,
        [caseId, input.milestoneType, input.dueDate ?? null, input.reference ?? null, input.notes ?? null],
      );
      return mapMilestone(result.rows[0]!);
    },
    async findById(id: string): Promise<HrLifecycleMilestone | null> {
      const result = await db.query<MilestoneRow>(`SELECT ${MILESTONE_COLUMNS} FROM hr_lifecycle_milestones WHERE id = $1`, [id]);
      return result.rows[0] ? mapMilestone(result.rows[0]) : null;
    },
    async listByCase(caseId: string): Promise<HrLifecycleMilestone[]> {
      const result = await db.query<MilestoneRow>(`SELECT ${MILESTONE_COLUMNS} FROM hr_lifecycle_milestones WHERE case_id = $1 ORDER BY created_at ASC`, [caseId]);
      return result.rows.map(mapMilestone);
    },
    async updateStatus(id: string, input: { status: MilestoneStatus; completedBy?: string | null; notes?: string | null }): Promise<HrLifecycleMilestone> {
      const current = await db.query<MilestoneRow>(`SELECT ${MILESTONE_COLUMNS} FROM hr_lifecycle_milestones WHERE id = $1`, [id]);
      const existing = current.rows[0];
      if (!existing) throw new Error("Milestone not found.");
      const result = await db.query<MilestoneRow>(
        `UPDATE hr_lifecycle_milestones SET
           status = $2,
           completed_by = $3,
           notes = $4,
           completed_at = CASE WHEN $2 = 'COMPLETED' THEN NOW() ELSE NULL END,
           updated_at = NOW()
         WHERE id = $1 RETURNING ${MILESTONE_COLUMNS}`,
        [id, input.status, input.completedBy === undefined ? existing.completed_by : input.completedBy, input.notes === undefined ? existing.notes : input.notes],
      );
      return mapMilestone(result.rows[0]!);
    },
  };
}
