/** Validated categorical palette (light surface) — fixed order, never cycled. */
export const SERIES_COLORS = ["#0E6C95", "#B07F1C", "#17A08C", "#C04B30"] as const;

/** Scenario palette, ordered Downside → Base → Upside (validated). */
export const SCENARIO_COLORS = { downside: "#C04B30", base: "#0E6C95", upside: "#17A08C" } as const;

/** Single-series ink. */
export const PRIMARY_LINE = "#12384A";

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
