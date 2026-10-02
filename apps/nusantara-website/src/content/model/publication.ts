/**
 * Publication governance — shared by every public-facing Nusantara
 * interpretation: Nusantara Views, the Market State, signals, themes and
 * research.
 *
 *   DRAFT → REVIEW → APPROVED → PUBLISHED → ARCHIVED
 *
 * Which states may be rendered is decided by the environment (see
 * src/lib/config.ts), never by a component. Time-sensitive content carries a
 * `reviewAt` date: once it passes, the item is treated as withdrawn until it
 * is re-reviewed, so a house view can never stay "current" simply because
 * nobody updated the website.
 */

export const PUBLICATION_STATUSES = ["draft", "review", "approved", "published", "archived"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export type Publication = {
  status: PublicationStatus;
  /**
   * True for content written for the management-review prototype. Sample
   * content is labelled as such and can never render outside the prototype.
   */
  sample: boolean;
  /** Institutional byline; individual names only once approved for publication. */
  author: string | null;
  /** Approver of record. Null until an approval process exists. */
  approvedBy: string | null;
  /** ISO date-time first published. Null until published. */
  publishedAt: string | null;
  /** ISO date-time of the latest substantive change. */
  updatedAt: string;
  /**
   * ISO date-time by which the item must be re-reviewed. Required for
   * published time-sensitive interpretation; after it passes the item is
   * withdrawn from display automatically.
   */
  reviewAt: string | null;
};

export const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  draft: "Draft",
  review: "In review",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};

export type VisibilityRules = { visibleStatuses: readonly string[]; allowSampleContent: boolean };

/** Past its review date? Evaluated on the server at render and again in the browser. */
export function isPastReview(p: Pick<Publication, "reviewAt">, now: number = Date.now()): boolean {
  return !!p.reviewAt && Date.parse(p.reviewAt) <= now;
}

/** May this item be rendered publicly under these rules, at this time? */
export function isVisible(p: Publication, rules: VisibilityRules, now: number = Date.now()): boolean {
  if (p.sample && !rules.allowSampleContent) return false;
  if (!rules.visibleStatuses.includes(p.status)) return false;
  if (isPastReview(p, now)) return false;
  return true;
}

/**
 * Integrity rules applied when content is loaded. A violation is a content
 * error, reported at build time rather than shown to the public.
 */
export function publicationProblems(id: string, p: Publication, opts: { timeSensitive: boolean }): string[] {
  const out: string[] = [];
  if (p.status === "published" && !p.publishedAt) out.push(`${id}: published without publishedAt`);
  if (p.status === "published" && !p.sample && !p.approvedBy) out.push(`${id}: published without approvedBy`);
  if (opts.timeSensitive && p.status === "published" && !p.reviewAt) out.push(`${id}: time-sensitive content published without reviewAt`);
  if (p.sample && p.status === "published") out.push(`${id}: sample content cannot be published`);
  return out;
}
