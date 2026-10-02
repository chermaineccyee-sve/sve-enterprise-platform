import type { Publication } from "@/content/model/publication";

/**
 * Nusantara Insights content model.
 *
 * Articles are structured data — not page layouts — so research can be
 * added (or later sourced from a headless CMS returning this same shape)
 * without touching any template. Each article passes through the publication
 * workflow (src/content/model/publication.ts); only states the environment
 * allows are rendered. Relationships to markets, themes, capabilities and
 * Market State dimensions are declared here or on the other side and
 * resolved by src/lib/content/relationships.ts.
 *
 * The model encodes Nusantara's research principle:
 *   DATA + INTERPRETATION + IMPLICATION
 * via the `layer` block, which the template renders as three visually
 * distinct registers.
 */

export const INSIGHT_CATEGORIES = [
  "Market Outlook",
  "Investment Perspectives",
  "Macro & Markets",
  "Alternative Investments",
  "Private Markets",
  "Governance & Allocation",
  "Research Notes",
] as const;
export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export type Layer = "data" | "interpretation" | "implication";

export type ScenarioPath = { label?: string; assumption: string; rate?: number; values?: number[] };

export type ScenarioSpec = {
  id: string;
  title: string;
  /** e.g. "Illustrative allocation pool index" */
  metric: string;
  unit?: string;
  decimals: number;
  baseYear: number;
  baseValue: number;
  /** Years after the base year, inclusive of base. */
  years: number[];
  /** Each path is either a constant annual rate from the base value, or explicit values per year/period. */
  scenarios: {
    downside: ScenarioPath;
    base: ScenarioPath;
    upside: ScenarioPath;
  };
  /** Optional custom x-axis labels (e.g. quarters) instead of years. */
  periodLabels?: string[];
  period: string;
  dataSource: string;
  methodology: string;
};

export type Block =
  | { type: "heading"; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "pullquote"; text: string }
  | { type: "layer"; layer: Layer; title: string; body: string[] }
  | {
      type: "table";
      caption: string;
      columns: string[];
      rows: string[][];
      note?: string;
      layer?: Layer;
    }
  | {
      type: "comparison";
      caption: string;
      left: string;
      right: string;
      rows: [string, string][];
    }
  | {
      type: "chart";
      caption: string;
      kind: "line" | "bar";
      xLabels: string[];
      series: { id: string; label: string; values: number[] }[];
      unit?: string;
      decimals: number;
      source: string;
      illustrative: boolean;
    }
  | { type: "scenario"; scenario: ScenarioSpec }
  | { type: "callout"; title: string; text: string };

/** Research asset-class taxonomy (broader than the market-data asset classes). */
export const RESEARCH_ASSET_CLASSES = [
  "Equities",
  "Fixed income",
  "Currencies",
  "Commodities",
  "Private credit",
  "Private markets",
  "Real assets",
  "Alternatives",
  "Multi-asset",
] as const;
export type ResearchAssetClass = (typeof RESEARCH_ASSET_CLASSES)[number];

/**
 * Source governance: enough metadata for compliance and research review.
 * `label` and `detail` are displayed; the remaining fields are displayed when
 * present and retained for review.
 */
export type InsightSource = {
  label: string;
  detail?: string;
  /** Link, only where the licence permits. */
  url?: string;
  provider?: string;
  /** ISO date the source was published. */
  publishedAt?: string;
  /** ISO date Nusantara retrieved it. */
  retrievedAt?: string;
  licensingNote?: string;
  methodology?: string;
};

export type InsightSeo = {
  /** Overrides the article title in search results and social cards. */
  title?: string;
  description?: string;
  /** Absolute or site-relative image for social cards. */
  image?: string;
};

export type Insight = Omit<Publication, "author"> & {
  slug: string;
  title: string;
  subtitle: string;
  category: InsightCategory;
  /** Edition date shown on the article (ISO date). */
  date: string;
  /** Institutional byline. Individual authors only once approved. */
  author: string;
  summary: string;
  executiveSummary: string[];
  keyTakeaways: string[];
  tags: string[];
  hero: { motif: "arcs" | "lines" | "grid" | "bars" | "rings" };
  featured?: boolean;
  sources: InsightSource[];
  methodology?: string;
  body: Block[];
  /** Curated related research (slugs). Topped up automatically by relationships. */
  related?: string[];
  /** Instrument ids the article discusses; surfaced as margin market signals. */
  markets?: string[];
  /** Theme ids (in addition to themes that list this article). */
  themes?: string[];
  assetClasses?: ResearchAssetClass[];
  /** Capability slugs (in addition to capabilities that list this article). */
  capabilities?: string[];
  /** Market State dimension ids (in addition to dimensions that cite this article). */
  marketStateDimensions?: string[];
  seo?: InsightSeo;
};

/** Lightweight shape for lists and cards (no article body). */
export type InsightListing = Pick<
  Insight,
  "slug" | "title" | "subtitle" | "category" | "date" | "updatedAt" | "author" | "summary" | "tags" | "hero" | "featured" | "status" | "sample"
> & { readingTime: number };

export function formatInsightDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
