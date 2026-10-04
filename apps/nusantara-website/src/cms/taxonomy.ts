/**
 * Fixed taxonomies for the Admin Portal, read from the code that already
 * defines them. Administrators choose from these values; they cannot add new
 * ones (B0 decision). Changing a taxonomy remains a code change and review.
 *
 * The market-data registries (instruments, structural indicators) are offered
 * as read-only options for relationship pickers only. Prices, changes,
 * historical series, provider mappings and timestamps stay in src/lib/market
 * and are never CMS content.
 *
 * Relative imports only: this file is also loaded by the Payload CLI.
 */
import { INSIGHT_CATEGORIES, RESEARCH_ASSET_CLASSES } from "../content/insights/types";
import { PUBLICATION_LABEL, PUBLICATION_STATUSES } from "../content/model/publication";
import { CAPABILITY_STATUSES, STATUS_INFO, type StrategyStage } from "../content/strategies";
import { INSTRUMENTS } from "../lib/market/instruments";
import { ILLUSTRATIVE_INDICATORS } from "../lib/market/providers/illustrative-intelligence";

type Option = { label: string; value: string };
const same = (values: readonly string[]): Option[] => values.map((v) => ({ label: v, value: v }));

export const insightCategoryOptions = same(INSIGHT_CATEGORIES);
export const researchAssetClassOptions = same(RESEARCH_ASSET_CLASSES);

export const capabilityStatusOptions = same(CAPABILITY_STATUSES);
export const capabilityStageOptions: Option[] = (Object.keys(STATUS_INFO) as StrategyStage[]).map((v) => ({ label: STATUS_INFO[v].label, value: v }));

/** Legacy per-item publication status (Market State dimensions keep their own). */
export const publicationStatusOptions: Option[] = PUBLICATION_STATUSES.map((v) => ({ label: PUBLICATION_LABEL[v], value: v }));

export const instrumentOptions: Option[] = INSTRUMENTS.map((i) => ({ label: `${i.shortName} (${i.id})`, value: i.id }));
export const indicatorOptions: Option[] = ILLUSTRATIVE_INDICATORS.map((i) => ({ label: `${i.title} (${i.id})`, value: i.id }));

/** Market-data asset classes (subject of an asset-class Nusantara View). */
export const marketAssetClassOptions = same(["equities", "fx", "rates", "commodities"]);

/** The six Market State dimensions (src/content/data/market-state.ts). */
export const MARKET_STATE_DIMENSIONS = ["growth", "rates", "liquidity", "risk", "currencies", "commodities"] as const;
export const marketStateDimensionOptions = same(MARKET_STATE_DIMENSIONS);

/** Article hero motifs (code-controlled artwork). */
export const heroMotifOptions = same(["arcs", "lines", "grid", "bars", "rings"]);

/** Legal pages are code-routed at /legal/[page]; the set of pages is fixed. */
export const LEGAL_PAGE_SLUGS = ["important-information", "disclaimer", "privacy", "terms"] as const;
export const legalPageOptions = same(LEGAL_PAGE_SLUGS);

export const layerOptions = same(["data", "interpretation", "implication"]);
