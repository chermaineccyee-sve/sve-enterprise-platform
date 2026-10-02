/**
 * Illustrative market data provider.
 *
 * Generates deterministic, seeded series so that every render (server or
 * client, any build) shows the same numbers. Levels are rounded, plausible
 * placeholders chosen for layout realism only — they are NOT market data,
 * are always labelled "Illustrative" and must never be presented as live.
 */
import { INSTRUMENTS } from "../instruments";
import { ILLUSTRATIVE_INDICATORS } from "./illustrative-intelligence";
import type {
  ChartPeriod,
  DataProvenance,
  InstrumentDefinition,
  InstrumentHistory,
  MarketDataProvider,
  PricePoint,
} from "../types";

/** Fixed reference time for the illustrative dataset (not a live timestamp). */
export const ILLUSTRATIVE_AS_OF = "2026-10-02T09:00:00.000Z";

export const ILLUSTRATIVE_DISCLAIMER =
  "Market information displayed in this prototype is illustrative and is provided for demonstration purposes only.";

const PROVENANCE: DataProvenance = {
  source: "Illustrative dataset (prototype)",
  status: "illustrative",
  asOf: ILLUSTRATIVE_AS_OF,
  attribution: "Generated for demonstration. Not sourced from any exchange or data vendor.",
};

/** Illustrative closing level and annualised volatility per instrument. */
const PARAMS: Record<string, { level: number; vol: number; drift: number }> = {
  klci: { level: 1621.4, vol: 0.11, drift: 0.04 },
  sti: { level: 4248.7, vol: 0.12, drift: 0.09 },
  jci: { level: 7852.3, vol: 0.16, drift: 0.05 },
  nikkei: { level: 44516.2, vol: 0.2, drift: 0.12 },
  hsi: { level: 26204.5, vol: 0.22, drift: 0.14 },
  spx: { level: 6548.9, vol: 0.16, drift: 0.11 },
  nasdaq: { level: 21812.6, vol: 0.21, drift: 0.13 },
  usdmyr: { level: 4.2155, vol: 0.06, drift: -0.05 },
  usdsgd: { level: 1.2884, vol: 0.05, drift: -0.04 },
  usdidr: { level: 16418, vol: 0.06, drift: 0.01 },
  sgdmyr: { level: 3.2719, vol: 0.04, drift: -0.01 },
  eurusd: { level: 1.1726, vol: 0.07, drift: 0.06 },
  usdjpy: { level: 147.62, vol: 0.1, drift: -0.02 },
  us10y: { level: 4.118, vol: 0.055, drift: -0.25 },
  us2y: { level: 3.574, vol: 0.06, drift: -0.6 },
  mgs10y: { level: 3.418, vol: 0.025, drift: -0.15 },
  sgs10y: { level: 2.046, vol: 0.04, drift: -0.3 },
  gold: { level: 3641.5, vol: 0.15, drift: 0.32 },
  silver: { level: 41.82, vol: 0.26, drift: 0.3 },
  brent: { level: 67.38, vol: 0.2, drift: -0.08 },
  cpo: { level: 4385, vol: 0.18, drift: 0.02 },
  copper: { level: 9946, vol: 0.2, drift: 0.07 },
};

const TRADING_DAYS = 280;
const INTRADAY_STEPS = 26; // 20-minute steps
const DAY_MS = 86_400_000;

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function businessDays(endIso: string, count: number): Date[] {
  const days: Date[] = [];
  const d = new Date(endIso);
  while (days.length < count) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.unshift(new Date(d));
    d.setTime(d.getTime() - DAY_MS);
  }
  return days;
}

const round = (v: number, decimals: number) => {
  const f = 10 ** (decimals + 1);
  return Math.round(v * f) / f;
};

type Series = { daily: PricePoint[]; intraday: PricePoint[][] };

const cache = new Map<string, Series>();

function buildSeries(inst: InstrumentDefinition): Series {
  const hit = cache.get(inst.id);
  if (hit) return hit;
  const p = PARAMS[inst.id];
  const rand = mulberry32(hashSeed(inst.id));
  const days = businessDays(ILLUSTRATIVE_AS_OF, TRADING_DAYS);
  const isYield = inst.convention === "yield";
  const dailyVol = p.vol / Math.sqrt(252);

  // Walk backwards from the final level so the latest close is exact.
  const closes = new Array<number>(TRADING_DAYS);
  closes[TRADING_DAYS - 1] = p.level;
  for (let i = TRADING_DAYS - 1; i > 0; i--) {
    const shock = normal(rand) * dailyVol + p.drift / 252;
    closes[i - 1] = isYield ? closes[i] - shock : closes[i] / Math.exp(shock);
  }

  const daily = days.map((d, i) => ({ t: d.toISOString(), v: round(closes[i], inst.decimals) }));

  // Intraday paths for the last five sessions (Brownian bridge between closes).
  const intraday: PricePoint[][] = [];
  for (let k = TRADING_DAYS - 5; k < TRADING_DAYS; k++) {
    const a = closes[k - 1];
    const b = closes[k];
    const sessionEnd = days[k].getTime();
    const stepMs = 20 * 60_000;
    const w: number[] = [0];
    for (let j = 1; j <= INTRADAY_STEPS; j++) w.push(w[j - 1] + normal(rand));
    const scale = (isYield ? 1 : a) * dailyVol * 0.45;
    const path: PricePoint[] = [];
    for (let j = 0; j <= INTRADAY_STEPS; j++) {
      const frac = j / INTRADAY_STEPS;
      const bridge = (w[j] - frac * w[INTRADAY_STEPS]) / Math.sqrt(INTRADAY_STEPS);
      const v = a + (b - a) * frac + bridge * scale;
      path.push({
        t: new Date(sessionEnd - (INTRADAY_STEPS - j) * stepMs).toISOString(),
        v: round(j === INTRADAY_STEPS ? b : v, inst.decimals),
      });
    }
    intraday.push(path);
  }

  const series = { daily, intraday };
  cache.set(inst.id, series);
  return series;
}

function every<T>(arr: T[], n: number): T[] {
  if (n <= 1) return arr;
  const out = arr.filter((_, i) => (arr.length - 1 - i) % n === 0);
  return out;
}

function historyFor(inst: InstrumentDefinition, period: ChartPeriod): PricePoint[] {
  const { daily, intraday } = buildSeries(inst);
  switch (period) {
    case "1D":
      return intraday[intraday.length - 1];
    case "1W":
      return every(intraday.flat(), 2);
    case "1M":
      return daily.slice(-23);
    case "3M":
      return daily.slice(-65);
    case "YTD": {
      const year = new Date(ILLUSTRATIVE_AS_OF).getUTCFullYear();
      const firstIdx = daily.findIndex((p) => new Date(p.t).getUTCFullYear() === year);
      return every(daily.slice(Math.max(firstIdx - 1, 0)), 2);
    }
    case "1Y":
      return every(daily.slice(-262), 3);
  }
}

export const illustrativeProvider: MarketDataProvider = {
  id: "illustrative",
  refreshIntervalMs: null, // Static dataset — never polled, never presented as live.

  async getSnapshot() {
    return {
      provenance: PROVENANCE,
      disclaimer: ILLUSTRATIVE_DISCLAIMER,
      instruments: INSTRUMENTS.map((instrument) => {
        const { daily } = buildSeries(instrument);
        const value = daily[daily.length - 1].v;
        const previousClose = daily[daily.length - 2].v;
        const change = value - previousClose;
        const isYield = instrument.convention === "yield";
        return {
          instrument,
          quote: {
            value,
            previousClose,
            change,
            changePct: isYield ? null : (change / previousClose) * 100,
            changeBp: isYield ? change * 100 : null,
          },
          provenance: PROVENANCE,
        };
      }),
    };
  },

  async getHistory(period, instrumentIds) {
    const list = instrumentIds ? INSTRUMENTS.filter((i) => instrumentIds.includes(i.id)) : INSTRUMENTS;
    return list.map<InstrumentHistory>((inst) => ({
      instrumentId: inst.id,
      period,
      points: historyFor(inst, period),
    }));
  },

  async getIntelligence() {
    return {
      provenance: { ...PROVENANCE, asOf: "2026-06-30T00:00:00.000Z" },
      disclaimer:
        "Strategic indicators are illustrative placeholders demonstrating the dashboard architecture. Values, directions and sources will be replaced with approved, attributed research data before publication.",
      indicators: ILLUSTRATIVE_INDICATORS,
    };
  },
};
