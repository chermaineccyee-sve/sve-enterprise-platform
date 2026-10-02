/**
 * MARKETS WE MONITOR — each market joins its benchmark index, currency and
 * rate, and the research that discusses it. Describes market monitoring only —
 * not where Nusantara operates.
 */
import type { MonitoredMarket } from "@/content/model/intelligence";

export const MONITORED_MARKETS: MonitoredMarket[] = [
  {
    "id": "us",
    "name": "United States",
    "x": 18,
    "y": 26,
    "index": "spx",
    "currency": null,
    "rate": "us10y",
    "insight": "the-resilience-lens"
  },
  {
    "id": "jp",
    "name": "Japan",
    "x": 84,
    "y": 40,
    "index": "nikkei",
    "currency": "usdjpy",
    "rate": "jgb10y",
    "insight": "rates-currencies-and-the-regional-allocator"
  },
  {
    "id": "cn",
    "name": "China / Hong Kong",
    "x": 66,
    "y": 18,
    "index": "hsi",
    "currency": "usdcnh",
    "rate": null,
    "insight": "q4-2026-market-outlook"
  },
  {
    "id": "my",
    "name": "Malaysia",
    "x": 26,
    "y": 68,
    "index": "klci",
    "currency": "usdmyr",
    "rate": "mgs10y",
    "insight": "rates-currencies-and-the-regional-allocator"
  },
  {
    "id": "sg",
    "name": "Singapore",
    "x": 52,
    "y": 86,
    "index": "sti",
    "currency": "usdsgd",
    "rate": "sgs10y",
    "insight": "rates-currencies-and-the-regional-allocator"
  },
  {
    "id": "id",
    "name": "Indonesia",
    "x": 80,
    "y": 70,
    "index": "jci",
    "currency": "usdidr",
    "rate": null,
    "insight": "q4-2026-market-outlook"
  }
];
