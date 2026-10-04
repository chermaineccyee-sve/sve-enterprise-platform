/**
 * Where an item appears on the public website — used for the Admin Portal's
 * Preview button and by the preview route, which always computes the path
 * from the stored document (never from the request), so it cannot be used as
 * an open redirect.
 */
export const PREVIEWABLE = ["insights", "nusantaraViews", "marketStateEditions", "signals", "themes", "capabilities"] as const;
export type PreviewableCollection = (typeof PREVIEWABLE)[number];

type Doc = Record<string, unknown> & { slug?: string; subject?: { kind?: string; instrument?: string }; dimensions?: { dimension?: string }[] };

export function publicPathFor(collection: string, doc: Doc): string | null {
  switch (collection) {
    case "insights":
      return doc.slug ? `/insights/${doc.slug}` : null;
    case "nusantaraViews":
      return doc.subject?.kind === "instrument" && doc.subject.instrument ? `/market-dashboard?instrument=${encodeURIComponent(doc.subject.instrument)}` : "/market-dashboard";
    case "marketStateEditions":
      return `/?dimension=${encodeURIComponent(doc.dimensions?.[0]?.dimension ?? "growth")}#market-state`;
    case "signals":
    case "themes":
      return "/insights";
    case "capabilities":
      return doc.slug ? `/strategies/${doc.slug}` : null;
    default:
      return null;
  }
}

/** The Admin Portal's Preview button opens this route (app/(payload)/api/preview). */
export const previewLink = (collection: string) => (doc: Record<string, unknown>) =>
  doc?.id ? `/api/preview?collection=${collection}&id=${doc.id}` : null;
