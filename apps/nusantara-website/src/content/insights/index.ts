import { alternativesRequireDiscipline } from "./alternatives-require-more-discipline";
import { fromAccessToGovernedAllocation } from "./from-access-to-governed-allocation";
import { preciousMetals } from "./precious-metals-and-portfolio-resilience";
import { privateCreditTerms } from "./private-credit-the-terms-behind-the-yield";
import { q4MarketOutlook } from "./q4-2026-market-outlook";
import { ratesCurrencies } from "./rates-currencies-and-the-regional-allocator";
import { resilienceLens } from "./the-resilience-lens";
import { shariahCapable } from "./shariah-capable-allocation";
import type { Block, Insight, InsightListing } from "./types";

export * from "./types";

/**
 * LOCAL CONTENT SOURCE for research. Pages never read this directly — they
 * use src/lib/content/repository.ts, which applies publication rules. A CMS
 * adapter replaces this registry without touching any page or component.
 *
 * Register new articles here. Order does not matter; lists sort by date.
 */
const ALL: Insight[] = [
  fromAccessToGovernedAllocation,
  q4MarketOutlook,
  alternativesRequireDiscipline,
  privateCreditTerms,
  resilienceLens,
  ratesCurrencies,
  shariahCapable,
  preciousMetals,
];

export function getAllInsights(): Insight[] {
  return [...ALL].sort((a, b) => b.date.localeCompare(a.date));
}

export function getInsight(slug: string): Insight | undefined {
  return ALL.find((i) => i.slug === slug);
}

export function blockText(b: Block): string {
  switch (b.type) {
    case "heading":
    case "paragraph":
    case "pullquote":
      return b.text;
    case "list":
      return b.items.join(" ");
    case "layer":
      return `${b.title} ${b.body.join(" ")}`;
    case "table":
      return b.rows.flat().join(" ");
    case "comparison":
      return b.rows.flat().join(" ");
    case "callout":
      return `${b.title} ${b.text}`;
    default:
      return "";
  }
}

/** Reading time from word count (approx. 220 words per minute, minimum 2). */
export function readingMinutes(insight: Insight): number {
  const text = [insight.summary, ...insight.executiveSummary, ...insight.keyTakeaways, ...insight.body.map(blockText)].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 220));
}

export function toListing(i: Insight): InsightListing {
  return {
    slug: i.slug,
    title: i.title,
    subtitle: i.subtitle,
    category: i.category,
    date: i.date,
    updatedAt: i.updatedAt,
    author: i.author,
    summary: i.summary,
    tags: i.tags,
    hero: i.hero,
    featured: i.featured,
    status: i.status,
    sample: i.sample,
    readingTime: readingMinutes(i),
  };
}
