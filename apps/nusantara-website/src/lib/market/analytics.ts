/**
 * Derived, transparent measures computed from whatever dataset the provider
 * supplies. With the illustrative provider these are illustrative too; the
 * point is that cross-asset states are *calculated*, not asserted.
 */
import type { AssetClass, InstrumentSnapshot, PricePoint } from "./types";

/** Resample to a fixed number of points (linear interpolation) so paths can morph. */
export function resample(points: PricePoint[], n: number): number[] {
  if (points.length === 0) return [];
  if (points.length === 1) return Array(n).fill(points[0].v);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const pos = (i / (n - 1)) * (points.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(points.length - 1, lo + 1);
    const f = pos - lo;
    out.push(points[lo].v * (1 - f) + points[hi].v * f);
  }
  return out;
}

/** Percentage change (price) or basis-point change (yield) over a series. */
export function seriesChange(values: number[], isYield: boolean) {
  if (values.length < 2) return 0;
  const a = values[0];
  const b = values[values.length - 1];
  return isYield ? (b - a) * 100 : ((b - a) / a) * 100;
}

/** Annualised volatility of daily changes (percent, or bp for yields). */
export function realisedVol(values: number[], isYield: boolean) {
  if (values.length < 3) return 0;
  const r: number[] = [];
  for (let i = 1; i < values.length; i++) r.push(isYield ? (values[i] - values[i - 1]) * 100 : Math.log(values[i] / values[i - 1]) * 100);
  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const sd = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / (r.length - 1));
  return sd * Math.sqrt(252);
}

export type CrossAssetMeasure = {
  momentum: { value: number; label: "Positive" | "Flat" | "Negative" };
  volatility: { value: number; label: "Subdued" | "Normal" | "Elevated" };
  direction: { up: number; down: number; label: "Broadly higher" | "Mixed" | "Broadly lower" };
  unit: "%" | "bp";
  members: string[];
};

const VOL_BANDS: Record<AssetClass, [number, number]> = {
  equities: [12, 20],
  fx: [5, 9],
  rates: [60, 100], // bp, annualised
  commodities: [15, 25],
};

/**
 * Momentum = average 1M change; volatility = average 3M realised volatility;
 * direction = count of members up vs down over 1M. Thresholds are documented
 * above and shown in the UI methodology note.
 */
export function crossAsset(
  snapshots: InstrumentSnapshot[],
  oneMonth: Map<string, PricePoint[]>,
  threeMonth: Map<string, PricePoint[]>,
): Record<AssetClass, CrossAssetMeasure> {
  const classes: AssetClass[] = ["equities", "fx", "rates", "commodities"];
  const out = {} as Record<AssetClass, CrossAssetMeasure>;
  for (const c of classes) {
    const members = snapshots.filter((s) => s.instrument.assetClass === c);
    const isYield = c === "rates";
    const changes = members.map((m) => seriesChange((oneMonth.get(m.instrument.id) ?? []).map((p) => p.v), isYield));
    const vols = members.map((m) => realisedVol((threeMonth.get(m.instrument.id) ?? []).map((p) => p.v), isYield));
    // For FX, a falling USD/xxx means regional currency strength; sign is kept as quoted.
    const mom = changes.reduce((s, x) => s + x, 0) / Math.max(changes.length, 1);
    const vol = vols.reduce((s, x) => s + x, 0) / Math.max(vols.length, 1);
    const up = changes.filter((x) => x > 0).length;
    const down = changes.filter((x) => x < 0).length;
    const flatBand = isYield ? 5 : c === "fx" ? 0.3 : 1;
    const [lo, hi] = VOL_BANDS[c];
    out[c] = {
      momentum: { value: mom, label: mom > flatBand ? "Positive" : mom < -flatBand ? "Negative" : "Flat" },
      volatility: { value: vol, label: vol < lo ? "Subdued" : vol > hi ? "Elevated" : "Normal" },
      direction: { up, down, label: up >= down * 2 ? "Broadly higher" : down >= up * 2 ? "Broadly lower" : "Mixed" },
      unit: isYield ? "bp" : "%",
      members: members.map((m) => m.instrument.shortName),
    };
  }
  return out;
}

/** Resample and keep the nearest original timestamp for each resampled point. */
export function resampleSeries(points: PricePoint[], n: number) {
  const values = resample(points, n);
  const stamps = values.map((_, i) => points[Math.round((i / Math.max(n - 1, 1)) * (points.length - 1))]?.t ?? "");
  return { values, stamps };
}
