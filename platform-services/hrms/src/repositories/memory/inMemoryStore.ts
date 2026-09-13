import type { HrLifecycleCase, HrLifecycleEvent, HrLifecycleMilestone, HrProbationReview } from "../../domain/lifecycle.ts";

/** This package's own isolated in-memory store — mirrors platform-services/organisation's inMemoryStore.ts. Does not merge with Identity's or Organisation's own in-memory stores. */
export interface InMemoryStore {
  cases: HrLifecycleCase[];
  events: HrLifecycleEvent[];
  milestones: HrLifecycleMilestone[];
  probationReviews: HrProbationReview[];
  caseNumberSeq: number;
}

export function createInMemoryStore(): InMemoryStore {
  return { cases: [], events: [], milestones: [], probationReviews: [], caseNumberSeq: 0 };
}
