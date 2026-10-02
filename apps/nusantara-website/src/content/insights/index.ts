import { alternativesRequireDiscipline } from "./alternatives-require-more-discipline";
import { fromAccessToGovernedAllocation } from "./from-access-to-governed-allocation";
import { privateCreditTerms } from "./private-credit-the-terms-behind-the-yield";
import { q4MarketOutlook } from "./q4-2026-market-outlook";
import { ratesCurrencies } from "./rates-currencies-and-the-regional-allocator";
import { resilienceLens } from "./the-resilience-lens";
import { shariahCapable } from "./shariah-capable-allocation";
import { tokenisation } from "./tokenisation-a-framework-first-approach";
import type { Block, Insight, InsightListing } from "./types";

export * from "./types";

/** Register new articles here. Order does not matter; lists sort by date. */
const ALL: Insight[] = [
  fromAccessToGovernedAllocation,
  q4MarketOutlook,
  alternativesRequireDiscipline,
  privateCreditTerms,
  resilienceLens,
  ratesCurrencies,
  tokenisation,
  shariahCapable,
];

export function getAllInsights(): Insight[] {
  return [...ALL].sort((a, b) => b.date.localeCompare(a.date));
}

export function getInsight(slug: string): Insight | undefined {
  return ALL.find((i) => i.slug === slug);
}

export function getFeaturedInsight(): Insight {
  return getAllInsights().find((i) => i.featured) ?? getAllInsights()[0];
}

export function getRelatedInsights(insight: Insight, limit = 3): Insight[] {
  const explicit = (insight.related ?? []).map(getInsight).filter((i): i is Insight => !!i);
  const fallback = getAllInsights().filter(
    (i) => i.slug !== insight.slug && !explicit.includes(i) && i.category === insight.category,
  );
  const rest = getAllInsights().filter((i) => i.slug !== insight.slug && !explicit.includes(i) && !fallback.includes(i));
  return [...explicit, ...fallback, ...rest].slice(0, limit);
}

function blockText(b: Block): string {
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
    author: i.author,
    summary: i.summary,
    tags: i.tags,
    hero: i.hero,
    featured: i.featured,
    status: i.status,
    readingTime: readingMinutes(i),
  };
}

export function getAllListings(): InsightListing[] {
  return getAllInsights().map(toListing);
}
