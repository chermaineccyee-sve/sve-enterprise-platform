/**
 * LATEST SIGNALS — short, dated readings. Sample content for management review.
 */
import type { Signal } from "@/content/model/intelligence";
import { SAMPLE } from "./sample";

export const SIGNALS: Signal[] = [
  {
    "id": "s1",
    "date": "2026-10-02",
    "theme": "Precious metals",
    "headline": "Gold: we keep the resilience frame",
    "reading": "We continue to treat precious metals as a resilience component, not a tactical trade.",
    "instrument": "gold",
    "insight": "precious-metals-and-portfolio-resilience",
    ...SAMPLE
  },
  {
    "id": "s2",
    "date": "2026-10-01",
    "theme": "Rates",
    "headline": "Path over direction",
    "reading": "For income allocation, sequencing matters more than whether the next move is up or down.",
    "instrument": "us10y",
    "insight": "rates-currencies-and-the-regional-allocator",
    ...SAMPLE
  },
  {
    "id": "s3",
    "date": "2026-09-30",
    "theme": "Currencies",
    "headline": "Regional currencies are not a bloc",
    "reading": "We assess each currency exposure on its own drivers rather than as a regional basket.",
    "instrument": "usdmyr",
    "insight": "rates-currencies-and-the-regional-allocator",
    ...SAMPLE
  },
  {
    "id": "s4",
    "date": "2026-09-26",
    "theme": "Equities",
    "headline": "Concentration is a risk input",
    "reading": "When leadership narrows, we treat index concentration as part of the risk assessment.",
    "instrument": "spx",
    "insight": "the-resilience-lens",
    ...SAMPLE
  },
  {
    "id": "s5",
    "date": "2026-09-22",
    "theme": "Private markets",
    "headline": "Terms before yield",
    "reading": "Where capital is plentiful, covenant quality and structure deserve the closest attention.",
    "insight": "private-credit-the-terms-behind-the-yield",
    ...SAMPLE
  },
  {
    "id": "s6",
    "date": "2026-09-17",
    "theme": "Commodities",
    "headline": "Palm oil and the inflation link",
    "reading": "We watch regional agricultural commodities for their pass-through to food inflation.",
    "instrument": "cpo",
    "insight": "q4-2026-market-outlook",
    ...SAMPLE
  }
];
