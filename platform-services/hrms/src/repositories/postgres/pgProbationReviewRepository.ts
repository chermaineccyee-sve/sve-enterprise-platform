import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { ProbationReviewRepository } from "../types.ts";
import type { HrProbationReview, ProbationDecision } from "../../domain/lifecycle.ts";

interface ReviewRow {
  id: string;
  case_id: string;
  sequence_number: number;
  period_start: string;
  expected_review_date: string;
  responsible_manager_user_id: string | null;
  responsible_hr_owner_user_id: string;
  review_status: "PENDING" | "COMPLETED";
  recommendation: string | null;
  decision: ProbationDecision | null;
  decision_notes: string | null;
  decision_date: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
}

const REVIEW_COLUMNS =
  "id, case_id, sequence_number, period_start, expected_review_date, responsible_manager_user_id, responsible_hr_owner_user_id, review_status, recommendation, decision, decision_notes, decision_date, decided_by, created_at, updated_at";

function mapReview(r: ReviewRow): HrProbationReview {
  return {
    id: r.id,
    caseId: r.case_id,
    sequenceNumber: r.sequence_number,
    periodStart: r.period_start,
    expectedReviewDate: r.expected_review_date,
    responsibleManagerUserId: r.responsible_manager_user_id,
    responsibleHrOwnerUserId: r.responsible_hr_owner_user_id,
    reviewStatus: r.review_status,
    recommendation: r.recommendation,
    decision: r.decision,
    decisionNotes: r.decision_notes,
    decisionDate: r.decision_date,
    decidedBy: r.decided_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createPgProbationReviewRepository(db: DatabaseProvider): ProbationReviewRepository {
  return {
    async create(input: { caseId: string; sequenceNumber: number; periodStart: string; expectedReviewDate: string; responsibleManagerUserId: string | null; responsibleHrOwnerUserId: string }): Promise<HrProbationReview> {
      const result = await db.query<ReviewRow>(
        `INSERT INTO hr_probation_reviews(case_id, sequence_number, period_start, expected_review_date, responsible_manager_user_id, responsible_hr_owner_user_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${REVIEW_COLUMNS}`,
        [input.caseId, input.sequenceNumber, input.periodStart, input.expectedReviewDate, input.responsibleManagerUserId, input.responsibleHrOwnerUserId],
      );
      return mapReview(result.rows[0]!);
    },
    async findById(id: string): Promise<HrProbationReview | null> {
      const result = await db.query<ReviewRow>(`SELECT ${REVIEW_COLUMNS} FROM hr_probation_reviews WHERE id = $1`, [id]);
      return result.rows[0] ? mapReview(result.rows[0]) : null;
    },
    async findCurrent(caseId: string): Promise<HrProbationReview | null> {
      const result = await db.query<ReviewRow>(`SELECT ${REVIEW_COLUMNS} FROM hr_probation_reviews WHERE case_id = $1 ORDER BY sequence_number DESC LIMIT 1`, [caseId]);
      return result.rows[0] ? mapReview(result.rows[0]) : null;
    },
    async listByCase(caseId: string): Promise<HrProbationReview[]> {
      const result = await db.query<ReviewRow>(`SELECT ${REVIEW_COLUMNS} FROM hr_probation_reviews WHERE case_id = $1 ORDER BY sequence_number ASC`, [caseId]);
      return result.rows.map(mapReview);
    },
    async recordDecision(id: string, input: { decision: ProbationDecision; recommendation: string | null; decisionNotes: string | null; decisionDate: string; decidedBy: string }): Promise<HrProbationReview> {
      // Guarded by `review_status = 'PENDING'` so a decision can only ever
      // be recorded once — a second attempt returns zero rows and the
      // service layer treats that as an error, never silently overwriting
      // a prior decision. See docs/architecture/hrms-employee-lifecycle.md
      // "Probation decision recorded once".
      const result = await db.query<ReviewRow>(
        `UPDATE hr_probation_reviews SET
           review_status = 'COMPLETED', decision = $2, recommendation = $3, decision_notes = $4, decision_date = $5, decided_by = $6, updated_at = NOW()
         WHERE id = $1 AND review_status = 'PENDING' RETURNING ${REVIEW_COLUMNS}`,
        [id, input.decision, input.recommendation, input.decisionNotes, input.decisionDate, input.decidedBy],
      );
      if (!result.rows[0]) throw new Error("This probation review does not exist or already has a recorded decision.");
      return mapReview(result.rows[0]);
    },
  };
}
