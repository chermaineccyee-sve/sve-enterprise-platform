/**
 * NUSANTARA VIEWS — Nusantara's interpretation of markets, asset classes and
 * structural indicators. Content, not market data: values come from the
 * market-data service; these records say how Nusantara reads them.
 *
 * Every record here is SAMPLE CONTENT FOR MANAGEMENT REVIEW (status "review").
 * Resolution: an instrument's own view, else its asset-class view, else none
 * (src/lib/content/repository.ts).
 */
import type { NusantaraView } from "@/content/model/intelligence";
import { SAMPLE } from "./sample";

export const MARKET_VIEWS: NusantaraView[] = [
  {
    "id": "view-equities",
    "subject": { "kind": "assetClass", "id": "equities" },
    "signal": "Selective",
    "stance": {
      "scale": ["Defensive", "Cautious", "Selective", "Constructive", "Expansive"],
      "position": 2
    },
    "summary": "Breadth over headline indices; sizing that reflects concentration.",
    "context": "Breadth and valuation dispersion matter more than the index level.",
    "whatWeAreWatching": ["Breadth of participation and earnings revisions."],
    "keyRisk": "Narrow leadership.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["klci", "sti", "jci", "nikkei", "hsi", "spx", "nasdaq"],
    "relatedInsight": "q4-2026-market-outlook",
    "theme": "Regional markets",
    ...SAMPLE
  },
  {
    "id": "view-fx",
    "subject": { "kind": "assetClass", "id": "fx" },
    "signal": "Deliberate",
    "stance": {
      "scale": ["Defensive", "Cautious", "Deliberate", "Constructive", "Expansive"],
      "position": 2
    },
    "summary": "Currency exposure as a documented decision.",
    "context": "Currency exposure should be a documented decision, not a by-product.",
    "whatWeAreWatching": ["Rate differentials and portfolio flows."],
    "keyRisk": "Currency moves rivalling asset returns.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["usdmyr", "usdsgd", "usdidr", "sgdmyr", "eurusd", "usdcnh", "usdjpy"],
    "relatedInsight": "rates-currencies-and-the-regional-allocator",
    "theme": "Rates & currencies",
    ...SAMPLE
  },
  {
    "id": "view-rates",
    "subject": { "kind": "assetClass", "id": "rates" },
    "signal": "Path-dependent",
    "stance": {
      "scale": ["Short duration", "Cautious", "Path-dependent", "Constructive", "Long duration"],
      "position": 2
    },
    "summary": "Duration assessed across several policy paths.",
    "context": "For income allocation, the path of policy matters more than its direction.",
    "whatWeAreWatching": ["Shape of the yield curve and inflation breadth."],
    "keyRisk": "Positions that only work under one policy path.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["us10y", "us2y", "mgs10y", "jgb10y", "sgs10y"],
    "relatedInsight": "rates-currencies-and-the-regional-allocator",
    "theme": "Rates & currencies",
    ...SAMPLE
  },
  {
    "id": "view-commodities",
    "subject": { "kind": "assetClass", "id": "commodities" },
    "signal": "Divergent",
    "stance": {
      "scale": ["Weak", "Soft", "Divergent", "Firm", "Tight"],
      "position": 2
    },
    "summary": "Precious metals for resilience; energy through the inflation lens.",
    "context": "Supply and inventories matter as much as demand.",
    "whatWeAreWatching": ["Supply conditions and inventories."],
    "keyRisk": "Volatility; custody and title for physical exposure.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["gold", "silver", "brent", "cpo", "copper"],
    "relatedInsight": "precious-metals-and-portfolio-resilience",
    "theme": "Resilience",
    ...SAMPLE
  },
  {
    "id": "view-klci",
    "subject": { "kind": "instrument", "id": "klci" },
    "signal": "Selective",
    "stance": {
      "scale": ["Defensive", "Cautious", "Selective", "Constructive", "Expansive"],
      "position": 2
    },
    "summary": null,
    "context": "A concentrated benchmark, read alongside the ringgit.",
    "whatWeAreWatching": ["Domestic earnings breadth and USD/MYR."],
    "keyRisk": "Narrow leadership.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["sti", "jci", "nikkei", "hsi"],
    "relatedInsight": "q4-2026-market-outlook",
    "theme": "Regional markets",
    ...SAMPLE
  },
  {
    "id": "view-sti",
    "subject": { "kind": "instrument", "id": "sti" },
    "signal": "Selective",
    "stance": {
      "scale": ["Defensive", "Cautious", "Selective", "Constructive", "Expansive"],
      "position": 2
    },
    "summary": null,
    "context": "Weighted to financials and real estate; sensitive to the rate path.",
    "whatWeAreWatching": ["Bank margins and real-estate income durability."],
    "keyRisk": "Narrow leadership.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["klci", "jci", "nikkei", "hsi"],
    "relatedInsight": "q4-2026-market-outlook",
    "theme": "Regional markets",
    ...SAMPLE
  },
  {
    "id": "view-jci",
    "subject": { "kind": "instrument", "id": "jci" },
    "signal": "Selective",
    "stance": {
      "scale": ["Defensive", "Cautious", "Selective", "Constructive", "Expansive"],
      "position": 2
    },
    "summary": null,
    "context": "Flows can move prices ahead of fundamentals.",
    "whatWeAreWatching": ["Portfolio flows and USD/IDR."],
    "keyRisk": "Abrupt flow reversals.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["klci", "sti", "nikkei", "hsi"],
    "relatedInsight": "q4-2026-market-outlook",
    "theme": "Regional markets",
    ...SAMPLE
  },
  {
    "id": "view-spx",
    "subject": { "kind": "instrument", "id": "spx" },
    "signal": "Concentrated",
    "stance": {
      "scale": ["Broad", "Balanced", "Selective", "Concentrated", "Narrow"],
      "position": 3
    },
    "summary": null,
    "context": "Index moves are dominated by a few very large companies.",
    "whatWeAreWatching": ["Equal-weight versus cap-weight performance."],
    "keyRisk": "Narrow leadership.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["klci", "sti", "jci", "nikkei"],
    "relatedInsight": "the-resilience-lens",
    "theme": "Regional markets",
    ...SAMPLE
  },
  {
    "id": "view-nasdaq",
    "subject": { "kind": "instrument", "id": "nasdaq" },
    "signal": "Concentrated",
    "stance": {
      "scale": ["Broad", "Balanced", "Selective", "Concentrated", "Narrow"],
      "position": 3
    },
    "summary": null,
    "context": "Growth-oriented, concentrated and sensitive to long-end yields.",
    "whatWeAreWatching": ["Valuation dispersion and long-end yields."],
    "keyRisk": "Narrow leadership.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["klci", "sti", "jci", "nikkei"],
    "relatedInsight": "the-resilience-lens",
    "theme": "Regional markets",
    ...SAMPLE
  },
  {
    "id": "view-usdmyr",
    "subject": { "kind": "instrument", "id": "usdmyr" },
    "signal": "Deliberate",
    "stance": {
      "scale": ["Defensive", "Cautious", "Deliberate", "Constructive", "Expansive"],
      "position": 2
    },
    "summary": null,
    "context": "Shapes the ringgit outcome of every US-dollar asset.",
    "whatWeAreWatching": ["Rate differentials and trade balances."],
    "keyRisk": "Currency moves rivalling asset returns.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["usdsgd", "usdidr", "sgdmyr", "eurusd"],
    "relatedInsight": "rates-currencies-and-the-regional-allocator",
    "theme": "Rates & currencies",
    ...SAMPLE
  },
  {
    "id": "view-usdsgd",
    "subject": { "kind": "instrument", "id": "usdsgd" },
    "signal": "Deliberate",
    "stance": {
      "scale": ["Defensive", "Cautious", "Deliberate", "Constructive", "Expansive"],
      "position": 2
    },
    "summary": null,
    "context": "A managed regime; measured moves still compound across portfolios.",
    "whatWeAreWatching": ["Rate differentials and portfolio flows."],
    "keyRisk": "Currency moves rivalling asset returns.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["usdmyr", "usdidr", "sgdmyr", "eurusd"],
    "relatedInsight": "rates-currencies-and-the-regional-allocator",
    "theme": "Rates & currencies",
    ...SAMPLE
  },
  {
    "id": "view-usdidr",
    "subject": { "kind": "instrument", "id": "usdidr" },
    "signal": "Deliberate",
    "stance": {
      "scale": ["Defensive", "Cautious", "Deliberate", "Constructive", "Expansive"],
      "position": 2
    },
    "summary": null,
    "context": "Sensitive to portfolio flows and the global dollar.",
    "whatWeAreWatching": ["Rate differentials and portfolio flows."],
    "keyRisk": "Flow-driven volatility.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["usdmyr", "usdsgd", "sgdmyr", "eurusd"],
    "relatedInsight": "rates-currencies-and-the-regional-allocator",
    "theme": "Rates & currencies",
    ...SAMPLE
  },
  {
    "id": "view-gold",
    "subject": { "kind": "instrument", "id": "gold" },
    "signal": "Resilience role",
    "stance": {
      "scale": ["Tactical", "Opportunistic", "Strategic", "Resilience role", "Core reserve"],
      "position": 3
    },
    "summary": null,
    "context": "A portfolio-resilience component, not a tactical position.",
    "whatWeAreWatching": ["Official-sector demand and real yields."],
    "keyRisk": "No income; volatility; custody and title.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["silver", "brent", "cpo", "copper"],
    "relatedInsight": "precious-metals-and-portfolio-resilience",
    "theme": "Resilience",
    ...SAMPLE
  },
  {
    "id": "view-silver",
    "subject": { "kind": "instrument", "id": "silver" },
    "signal": "Divergent",
    "stance": {
      "scale": ["Weak", "Soft", "Divergent", "Firm", "Tight"],
      "position": 2
    },
    "summary": null,
    "context": "Part precious, part industrial — more volatile than gold.",
    "whatWeAreWatching": ["Supply conditions and inventories."],
    "keyRisk": "Volatility; custody and title for physical exposure.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["gold", "brent", "cpo", "copper"],
    "relatedInsight": "precious-metals-and-portfolio-resilience",
    "theme": "Resilience",
    ...SAMPLE
  },
  {
    "id": "view-brent",
    "subject": { "kind": "instrument", "id": "brent" },
    "signal": "Soft",
    "stance": {
      "scale": ["Weak", "Soft", "Divergent", "Firm", "Tight"],
      "position": 1
    },
    "summary": null,
    "context": "Feeds directly into inflation and regional trade balances.",
    "whatWeAreWatching": ["Supply decisions and inventories."],
    "keyRisk": "Volatility; custody and title for physical exposure.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["gold", "silver", "cpo", "copper"],
    "relatedInsight": "q4-2026-market-outlook",
    "theme": "Resilience",
    ...SAMPLE
  },
  {
    "id": "view-cpo",
    "subject": { "kind": "instrument", "id": "cpo" },
    "signal": "Divergent",
    "stance": {
      "scale": ["Weak", "Soft", "Divergent", "Firm", "Tight"],
      "position": 2
    },
    "summary": null,
    "context": "Linked to food inflation and commodity-exporting economies.",
    "whatWeAreWatching": ["Production, inventories and export demand."],
    "keyRisk": "Volatility; custody and title for physical exposure.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["gold", "silver", "brent", "copper"],
    "relatedInsight": "q4-2026-market-outlook",
    "theme": "Resilience",
    ...SAMPLE
  },
  {
    "id": "view-us10y",
    "subject": { "kind": "instrument", "id": "us10y" },
    "signal": "Path-dependent",
    "stance": {
      "scale": ["Short duration", "Cautious", "Path-dependent", "Constructive", "Long duration"],
      "position": 2
    },
    "summary": null,
    "context": "The global reference for duration and valuations.",
    "whatWeAreWatching": ["Term premium and inflation breadth."],
    "keyRisk": "Positions that only work under one policy path.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["us2y", "mgs10y", "jgb10y", "sgs10y"],
    "relatedInsight": "rates-currencies-and-the-regional-allocator",
    "theme": "Rates & currencies",
    ...SAMPLE
  },
  {
    "id": "view-us2y",
    "subject": { "kind": "instrument", "id": "us2y" },
    "signal": "Path-dependent",
    "stance": {
      "scale": ["Short duration", "Cautious", "Path-dependent", "Constructive", "Long duration"],
      "position": 2
    },
    "summary": null,
    "context": "The most policy-sensitive part of the US curve.",
    "whatWeAreWatching": ["Policy expectations."],
    "keyRisk": "Positions that only work under one policy path.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["us10y", "mgs10y", "jgb10y", "sgs10y"],
    "relatedInsight": "rates-currencies-and-the-regional-allocator",
    "theme": "Rates & currencies",
    ...SAMPLE
  },
  {
    "id": "view-mgs10y",
    "subject": { "kind": "instrument", "id": "mgs10y" },
    "signal": "Path-dependent",
    "stance": {
      "scale": ["Short duration", "Cautious", "Path-dependent", "Constructive", "Long duration"],
      "position": 2
    },
    "summary": null,
    "context": "The reference for ringgit duration.",
    "whatWeAreWatching": ["Spread to US Treasuries."],
    "keyRisk": "Positions that only work under one policy path.",
    "whatWouldChangeOurView": null,
    "relatedMarkets": ["us10y", "us2y", "jgb10y", "sgs10y"],
    "relatedInsight": "rates-currencies-and-the-regional-allocator",
    "theme": "Rates & currencies",
    ...SAMPLE
  },
  {
    "id": "reading-am-assets",
    "subject": { "kind": "indicator", "id": "am-assets" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "A larger pool of managed assets widens the opportunity set, but also intensifies competition. Scale alone does not differentiate; selection and governance do.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-am-alt-share",
    "subject": { "kind": "indicator", "id": "am-alt-share" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Where alternatives move from the periphery towards the core of portfolios, the bar rises for liquidity alignment, valuation discipline and due diligence.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-pm-fundraising",
    "subject": { "kind": "indicator", "id": "pm-fundraising" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Slower fundraising tends to favour allocators with patient capital and places greater weight on manager and transaction selection.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-pm-undeployed",
    "subject": { "kind": "indicator", "id": "pm-undeployed" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Large undeployed commitments can support transaction activity, but may also pressure entry discipline. We watch pricing as closely as volume.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-pm-credit",
    "subject": { "kind": "indicator", "id": "pm-credit" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Continued deployment can support income opportunities. Terms, covenants and underwriting standards matter more than the headline yield.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-alt-real-assets",
    "subject": { "kind": "indicator", "id": "alt-real-assets" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Stable activity suggests price discovery is functioning. Income durability and the quality of the underlying asset remain the primary tests.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-alt-precious",
    "subject": { "kind": "indicator", "id": "alt-precious" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "If sustained, reserve-diversification demand supports viewing precious metals as a resilience component of a portfolio rather than a tactical position.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-cf-portfolio",
    "subject": { "kind": "indicator", "id": "cf-portfolio" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Portfolio flows can reverse quickly. We distinguish flow-driven price moves from changes in underlying fundamentals before drawing conclusions.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-cf-direct",
    "subject": { "kind": "indicator", "id": "cf-direct" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Direct investment commitments are slower-moving than portfolio flows and can indicate longer-horizon positioning around supply chains and infrastructure.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-pw-pool",
    "subject": { "kind": "indicator", "id": "pw-pool" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Larger private wealth pools raise expectations for governance, reporting and clear communication — not only for access to opportunity.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-pw-advised",
    "subject": { "kind": "indicator", "id": "pw-advised" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "As information becomes more abundant, demand shifts towards judgement, context and accountability rather than product availability.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-fo-formation",
    "subject": { "kind": "indicator", "id": "fo-formation" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Family offices increasingly expect institutional process: documented governance, reporting discipline and succession-aware decision-making.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-inst-alts",
    "subject": { "kind": "indicator", "id": "inst-alts" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Higher target allocations are a statement of intent; implementation depends on liquidity budgets, pacing and the availability of suitable opportunities.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-macro-growth",
    "subject": { "kind": "indicator", "id": "macro-growth" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "A reading close to neutral suggests uneven momentum. Dispersion across sectors and economies matters more than the aggregate.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-macro-inflation",
    "subject": { "kind": "indicator", "id": "macro-inflation" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "Easing inflation pressure can widen the room for policy flexibility, but the path and breadth of disinflation matter as much as the level.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  },
  {
    "id": "reading-macro-policy",
    "subject": { "kind": "indicator", "id": "macro-policy" },
    "signal": null,
    "stance": null,
    "summary": null,
    "context": "A negative reading would indicate more central banks easing than tightening. Easing phases can support income assets, though the sequencing matters.",
    "whatWeAreWatching": [],
    "keyRisk": null,
    "whatWouldChangeOurView": null,
    "relatedMarkets": [],
    "relatedInsight": null,
    "theme": null,
    ...SAMPLE
  }
];
