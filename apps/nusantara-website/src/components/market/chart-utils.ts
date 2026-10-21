/**
 * Restrained Nusantara palette — deep teal, light teal, gold, neutral grey.
 * Fixed order, never cycled. Adjacent-pair separation and contrast validated;
 * deep teal and grey sit outside the generic lightness/chroma bands by brand
 * choice, so multi-series charts always carry a legend.
 */
export const SERIES_COLORS = ["#12384A", "#5E9DB3", "#B07F1C", "#5F676B"] as const;

/** Scenario palette, Downside → Base → Upside: grey, deep teal, gold (validated). */
export const SCENARIO_COLORS = { downside: "#7A8387", base: "#12384A", upside: "#B07F1C" } as const;

/** Single-series ink. */
export const PRIMARY_LINE = "#12384A";

/** The same roles on the deep-teal surface (Market Dashboard, homepage market intelligence): ivory ink, light teal, gold, grey. */
export const SERIES_COLORS_DEEP = ["#E8E1D1", "#6FB0C6", "#CDAE73", "#98A5AA"] as const;
export const PRIMARY_LINE_DEEP = "#E8E1D1";

export function niceStep(range: number, targetTicks: number) {
  const raw = range / Math.max(targetTicks, 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1;
  return step * mag;
}

export function niceTicks(min: number, max: number, target = 4) {
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, target);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { ticks, min: start, max: end, step };
}

export function decimalsForStep(step: number) {
  if (step >= 1) return 0;
  return Math.min(4, Math.ceil(-Math.log10(step)));
}

export function linePath(xs: number[], ys: number[]) {
  let d = "";
  for (let i = 0; i < xs.length; i++) d += `${i ? "L" : "M"}${xs[i].toFixed(2)},${ys[i].toFixed(2)}`;
  return d;
}
