import type { InstrumentDefinition, Quote } from "./types";

export { STATUS_LABEL } from "./status";

const nf = (min: number, max = min) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: min, maximumFractionDigits: max });

export function formatValue(v: number, decimals: number) {
  const s = nf(decimals).format(Math.abs(v));
  return v < 0 && s !== nf(decimals).format(0) ? `\u2212${s}` : s;
}

/** Signed value using a true minus sign (U+2212) for typographic alignment. */
export function signed(v: number, decimals: number, suffix = "") {
  const abs = nf(decimals).format(Math.abs(v));
  if (Math.abs(v) < 0.5 * 10 ** -decimals) return `${nf(decimals).format(0)}${suffix}`;
  return `${v > 0 ? "+" : "−"}${abs}${suffix}`;
}

export function formatChange(inst: InstrumentDefinition, quote: Pick<Quote, "change" | "changeBp">) {
  if (inst.convention === "yield") return signed(quote.changeBp ?? quote.change * 100, 1, " bp");
  return signed(quote.change, inst.decimals);
}

export function formatPct(pct: number | null) {
  if (pct === null || Number.isNaN(pct)) return "—";
  return signed(pct, 2, "%");
}

export function direction(v: number): "up" | "down" | "flat" {
  if (v > 1e-9) return "up";
  if (v < -1e-9) return "down";
  return "flat";
}

export function changeOverPeriod(inst: InstrumentDefinition, first: number, last: number) {
  const change = last - first;
  return {
    change,
    changePct: inst.convention === "yield" ? null : (change / first) * 100,
    changeBp: inst.convention === "yield" ? change * 100 : null,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic UTC formatting (identical on server and client). */
export function formatTimestamp(iso: string, opts: { time?: boolean } = { time: true }) {
  const d = new Date(iso);
  const date = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (!opts.time) return date;
  return `${date}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

/** Market snapshot stamp, e.g. "02 OCT 2026 · 09:00 UTC" (always UTC; formatting only). */
export function formatSnapshot(iso: string) {
  const d = new Date(iso);
  const date = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCFullYear()}`;
  return `${date} · ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export function formatAxisTime(iso: string, mode: "time" | "day" | "month") {
  const d = new Date(iso);
  if (mode === "time") return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  if (mode === "day") return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

export function formatDate(iso: string) {
  return formatTimestamp(iso, { time: false });
}
