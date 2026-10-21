import type { Publication } from "@/content/model/publication";

/**
 * Publication record for research written for the management-review
 * prototype: in review, unapproved and unpublished. The article keeps its own
 * institutional byline.
 */
export function researchSample(date: string): Omit<Publication, "author"> {
  return {
    status: "review",
    sample: true,
    approvedBy: null,
    publishedAt: null,
    updatedAt: `${date}T00:00:00.000Z`,
    reviewAt: null,
  };
}
