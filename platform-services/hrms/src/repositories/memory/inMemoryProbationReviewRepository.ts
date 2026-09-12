import { randomUUID } from "node:crypto";
import type { ProbationReviewRepository } from "../types.ts";
import type { InMemoryStore } from "./inMemoryStore.ts";
import type { HrProbationReview, ProbationDecision } from "../../domain/lifecycle.ts";

export function createInMemoryProbationReviewRepository(store: InMemoryStore): ProbationReviewRepository {
  return {
    async create(input: { caseId: string; sequenceNumber: number; periodStart: string; expectedReviewDate: string; responsibleManagerUserId: string | null; responsibleHrOwnerUserId: string }): Promise<HrProbationReview> {
      const now = new Date().toISOString();
      const record: HrProbationReview = {
        id: randomUUID(),
        caseId: input.caseId,
        sequenceNumber: input.sequenceNumber,
        periodStart: input.periodStart,
        expectedReviewDate: input.expectedReviewDate,
        responsibleManagerUserId: input.responsibleManagerUserId,
        responsibleHrOwnerUserId: input.responsibleHrOwnerUserId,
        reviewStatus: "PENDING",
        recommendation: null,
        decision: null,
        decisionNotes: null,
        decisionDate: null,
        decidedBy: null,
        createdAt: now,
        updatedAt: now,
      };
      store.probationReviews.push(record);
      return record;
    },
    async findById(id: string): Promise<HrProbationReview | null> {
      return store.probationReviews.find((r) => r.id === id) ?? null;
    },
    async findCurrent(caseId: string): Promise<HrProbationReview | null> {
      const rows = store.probationReviews.filter((r) => r.caseId === caseId);
      if (rows.length === 0) return null;
      return rows.reduce((a, b) => (b.sequenceNumber > a.sequenceNumber ? b : a));
    },
    async listByCase(caseId: string): Promise<HrProbationReview[]> {
      return store.probationReviews.filter((r) => r.caseId === caseId).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    },
    async recordDecision(id: string, input: { decision: ProbationDecision; recommendation: string | null; decisionNotes: string | null; decisionDate: string; decidedBy: string }): Promise<HrProbationReview> {
      const record = store.probationReviews.find((r) => r.id === id);
      if (!record) throw new Error("Probation review not found.");
      if (record.reviewStatus === "COMPLETED") throw new Error("This probation review already has a recorded decision.");
      record.reviewStatus = "COMPLETED";
      record.decision = input.decision;
      record.recommendation = input.recommendation;
      record.decisionNotes = input.decisionNotes;
      record.decisionDate = input.decisionDate;
      record.decidedBy = input.decidedBy;
      record.updatedAt = new Date().toISOString();
      return record;
    },
  };
}
