/**
 * NUSANTARA MARKET STATE — an editorial dataset, published as a whole edition.
 * Updating the market state means publishing a new edition, not editing the
 * homepage. The current edition is a DEMONSTRATION FRAMEWORK for management
 * review — not a current Nusantara house view.
 */
import type { MarketStateEdition } from "@/content/model/intelligence";
import { SAMPLE } from "./sample";

export const MARKET_STATE_EDITIONS: MarketStateEdition[] = [{
  "id": "market-state-2026-10",
  "edition": "October 2026",
  "framing": {
    "title": "Demonstration framework",
    "note": "Illustrative readings for management review — not a current Nusantara house view, a recommendation or a forecast."
  },
  "dimensions": [
    {
      "id": "growth",
      "label": "Growth",
      "state": "Moderating",
      "stance": {
        "scale": ["Contracting", "Slowing", "Moderating", "Steady", "Accelerating"],
        "position": 2
      },
      "summary": "We read momentum as uneven rather than uniformly weak. Breadth across sectors and economies matters more to us than the headline aggregate.",
      "watchItems": ["Breadth of activity indicators", "Direction of earnings revisions", "Labour-market resilience"],
      "changeConditions": "Broad-based improvement in activity and revisions would move our reading towards Steady.",
      "supportingMarkets": ["klci", "jci", "spx"],
      "relatedInsight": "q4-2026-market-outlook",
      "updatedAt": "2026-10-02T09:00:00.000Z",
      "status": "review"
    },
    {
      "id": "rates",
      "label": "Rates",
      "state": "Restrictive",
      "stance": {
        "scale": ["Accommodative", "Easing", "Neutral", "Restrictive", "Tightening"],
        "position": 3
      },
      "summary": "Policy settings still lean restrictive in our framework. For income allocation, the speed and sequencing of change matter more than the direction alone.",
      "watchItems": ["Front-end versus long-end yields", "Sequencing across central banks", "Inflation breadth"],
      "changeConditions": "A sustained, broad decline in inflation pressure would move our reading towards Neutral.",
      "supportingMarkets": ["us10y", "us2y", "mgs10y"],
      "relatedInsight": "rates-currencies-and-the-regional-allocator",
      "updatedAt": "2026-10-02T09:00:00.000Z",
      "status": "review"
    },
    {
      "id": "liquidity",
      "label": "Liquidity",
      "state": "Neutral",
      "stance": {
        "scale": ["Tight", "Tightening", "Neutral", "Improving", "Abundant"],
        "position": 2
      },
      "summary": "Funding conditions appear neither a tailwind nor a headwind. We focus on whether liquidity terms in private markets remain aligned with investor needs.",
      "watchItems": ["Funding spreads", "Private-market redemption terms", "Cross-border portfolio flows"],
      "changeConditions": "Widening funding spreads or tighter redemption terms would move our reading towards Tightening.",
      "supportingMarkets": ["usdmyr", "usdsgd"],
      "relatedInsight": "alternatives-require-more-discipline",
      "updatedAt": "2026-10-02T09:00:00.000Z",
      "status": "review"
    },
    {
      "id": "risk",
      "label": "Risk",
      "state": "Elevated",
      "stance": {
        "scale": ["Low", "Contained", "Moderate", "Elevated", "Stressed"],
        "position": 3
      },
      "summary": "Concentration and valuation dispersion keep our risk reading elevated. This argues for sizing that reflects uncertainty rather than conviction alone.",
      "watchItems": ["Equity concentration", "Realised versus implied volatility", "Credit terms in private lending"],
      "changeConditions": "Broader market leadership and stable volatility would move our reading towards Moderate.",
      "supportingMarkets": ["nasdaq", "spx", "hsi"],
      "relatedInsight": "the-resilience-lens",
      "updatedAt": "2026-10-02T09:00:00.000Z",
      "status": "review"
    },
    {
      "id": "currencies",
      "label": "Currencies",
      "state": "Mixed",
      "stance": {
        "scale": ["Weakening", "Softer", "Mixed", "Firmer", "Strengthening"],
        "position": 2
      },
      "summary": "Regional currencies are not moving as a bloc in our framework. We treat currency exposure as a documented decision, not a by-product of asset selection.",
      "watchItems": ["Rate differentials versus the US dollar", "Portfolio flows into the region", "Trade balances"],
      "changeConditions": "A consistent move across regional currencies would shift our reading towards Firmer or Softer.",
      "supportingMarkets": ["usdmyr", "usdsgd", "usdidr"],
      "relatedInsight": "rates-currencies-and-the-regional-allocator",
      "updatedAt": "2026-10-02T09:00:00.000Z",
      "status": "review"
    },
    {
      "id": "commodities",
      "label": "Commodities",
      "state": "Divergent",
      "stance": {
        "scale": ["Weak", "Soft", "Divergent", "Firm", "Tight"],
        "position": 2
      },
      "summary": "Precious metals and energy are telling different stories. We consider precious metals principally through a resilience lens, and energy through its link to inflation.",
      "watchItems": ["Reserve demand for precious metals", "Energy supply and inventories", "Agricultural commodities and regional inflation"],
      "changeConditions": "Energy and precious metals moving together would resolve our reading towards Firm or Soft.",
      "supportingMarkets": ["gold", "brent", "cpo"],
      "relatedInsight": "precious-metals-and-portfolio-resilience",
      "updatedAt": "2026-10-02T09:00:00.000Z",
      "status": "review"
    }
  ],
  ...SAMPLE
}];
