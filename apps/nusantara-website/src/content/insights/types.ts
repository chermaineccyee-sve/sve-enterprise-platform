/**
 * Nusantara Insights content model.
 *
 * Articles are structured data — not page layouts — so research can be
 * added (or later sourced from a headless CMS returning this same shape)
 * without touching any template. To publish a new article, add a file in
 * this folder exporting an `Insight` and register it in `index.ts`.
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

export type InsightSource = { label: string; detail?: string; url?: string };

export type Insight = {
  slug: string;
  title: string;
  subtitle: string;
  category: InsightCategory;
  /** ISO date. */
  date: string;
  /** Institutional byline. Individual authors only once approved. */
  author: string;
  summary: string;
  executiveSummary: string[];
  keyTakeaways: string[];
  tags: string[];
  hero: { motif: "arcs" | "lines" | "grid" | "bars" | "rings" };
  featured?: boolean;
  /** "sample" = written for management review; not yet approved for publication. */
  status: "sample" | "approved";
  sources: InsightSource[];
  methodology?: string;
  body: Block[];
  related?: string[];
  /** Instruments surfaced as margin "market signal" pull-outs. */
  relatedInstruments?: string[];
};

/** Lightweight shape for lists and cards (no article body). */
export type InsightListing = Pick<
  Insight,
  "slug" | "title" | "subtitle" | "category" | "date" | "author" | "summary" | "tags" | "hero" | "featured" | "status"
> & { readingTime: number };

export function formatInsightDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
