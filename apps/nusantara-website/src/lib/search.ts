/**
 * INSIGHTS SEARCH
 *
 * The server builds a compact token index of every visible article — title,
 * summary, body, tags, themes, markets and asset classes — and serves it as a
 * static JSON file (/api/insights/search-index). The browser loads it on the
 * first search and matches locally. This scales to several hundred articles;
 * beyond that, `searchIndex()` is the seam where a hosted search service
 * (or the CMS's own search API) replaces local matching without changing the
 * Insights page.
 */

export const SEARCH_INDEX_PATH = "/api/insights/search-index";

export const SEARCH_FIELDS = ["title", "tags", "themes", "markets", "assetClasses", "summary", "body"] as const;
export type SearchField = (typeof SEARCH_FIELDS)[number];

/** Relevance weights; a match in a title outranks one in the body. */
export const SEARCH_WEIGHTS: Record<SearchField, number> = {
  title: 8,
  tags: 5,
  themes: 4,
  markets: 4,
  assetClasses: 4,
  summary: 3,
  body: 1,
};

export type SearchDoc = { slug: string; fields: Partial<Record<SearchField, string[]>> };
export type SearchIndex = { version: 1; generatedAt: string; docs: SearchDoc[] };

/** Lower-case, accent-free word tokens of two or more characters. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/** Unique tokens per field — the index stores tokens, not text. */
export function buildSearchDoc(slug: string, fields: Partial<Record<SearchField, string | string[]>>): SearchDoc {
  const out: SearchDoc["fields"] = {};
  for (const f of SEARCH_FIELDS) {
    const v = fields[f];
    if (!v) continue;
    const tokens = [...new Set(tokenize(Array.isArray(v) ? v.join(" ") : v))];
    if (tokens.length) out[f] = tokens;
  }
  return { slug, fields: out };
}

/**
 * Every query word must match (as a prefix) somewhere in the article.
 * Returns matching slugs with a relevance score.
 */
export function searchIndex(index: SearchIndex, query: string): Map<string, number> {
  const terms = tokenize(query);
  const hits = new Map<string, number>();
  if (!terms.length) return hits;
  for (const doc of index.docs) {
    let score = 0;
    let all = true;
    for (const term of terms) {
      let best = 0;
      for (const f of SEARCH_FIELDS) {
        const tokens = doc.fields[f];
        if (tokens?.some((t) => t.startsWith(term))) best = Math.max(best, SEARCH_WEIGHTS[f]);
      }
      if (!best) {
        all = false;
        break;
      }
      score += best;
    }
    if (all) hits.set(doc.slug, score);
  }
  return hits;
}
