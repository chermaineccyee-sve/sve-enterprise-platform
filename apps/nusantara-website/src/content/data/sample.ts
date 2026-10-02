import type { Publication } from "@/content/model/publication";

/**
 * Publication record shared by every item written for the management-review
 * prototype: in review, unapproved, unpublished, labelled as sample content
 * and never rendered outside the prototype environment.
 */
export const SAMPLE: Publication = {
  status: "review",
  sample: true,
  author: "Nusantara Investment Team",
  approvedBy: null,
  publishedAt: null,
  updatedAt: "2026-10-02T09:00:00.000Z",
  reviewAt: null,
};

/** Labels shown with sample content. Kept visually secondary to the banner. */
export const SAMPLE_LABELS = {
  label: "Management review · Illustrative",
  interpretation: "Interpretation · illustrative · management review",
} as const;
