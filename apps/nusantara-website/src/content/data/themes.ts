/**
 * THEMES — the threads that run through Nusantara research. Each joins
 * curated research to the markets and indicators behind it. Sample content.
 */
import type { Theme } from "@/content/model/intelligence";
import { SAMPLE } from "./sample";

export const THEMES: Theme[] = [
  {
    "id": "governed-allocation",
    "title": "Governed allocation",
    "statement": "Access is no longer scarce. Selection, governance and monitoring are.",
    "insights": ["from-access-to-governed-allocation", "shariah-capable-allocation-shared-principles"],
    "instruments": [],
    "indicators": ["pw-pool", "fo-formation"],
    ...SAMPLE
  },
  {
    "id": "rates-currencies",
    "title": "Rates & currencies",
    "statement": "Duration across paths, and currency exposure as a decision.",
    "insights": ["rates-currencies-and-the-regional-allocator", "q4-2026-market-outlook"],
    "instruments": ["us10y", "mgs10y", "usdmyr", "usdsgd"],
    "indicators": ["macro-policy"],
    ...SAMPLE
  },
  {
    "id": "alternatives",
    "title": "Alternatives & private markets",
    "statement": "As alternatives move to the core, liquidity and valuation discipline decide outcomes.",
    "insights": ["alternatives-require-more-discipline", "private-credit-the-terms-behind-the-yield"],
    "instruments": [],
    "indicators": ["pm-credit", "am-alt-share"],
    ...SAMPLE
  },
  {
    "id": "resilience",
    "title": "Resilience",
    "statement": "Resilience is designed in advance; it cannot be added during stress.",
    "insights": ["the-resilience-lens", "precious-metals-and-portfolio-resilience"],
    "instruments": ["gold", "silver"],
    "indicators": ["alt-precious"],
    ...SAMPLE
  },
  {
    "id": "regional-markets",
    "title": "Regional markets",
    "statement": "Breadth and flows, read separately from headline indices.",
    "insights": ["q4-2026-market-outlook", "rates-currencies-and-the-regional-allocator"],
    "instruments": ["klci", "sti", "jci"],
    "indicators": ["cf-portfolio", "macro-growth"],
    ...SAMPLE
  }
];
