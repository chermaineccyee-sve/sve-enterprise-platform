"use client";

import { changeOverPeriod, formatAxisTime, formatTimestamp, formatValue, signed } from "@/lib/market/format";
import type { ChartPeriod, InstrumentSnapshot, PricePoint } from "@/lib/market/types";
import { Change } from "./Change";
import { PRIMARY_LINE, SERIES_COLORS } from "./chart-utils";
import { LineChart } from "./LineChart";

function axisMode(period: ChartPeriod): "time" | "day" | "month" {
  if (period === "1D") return "time";
  if (period === "1W" || period === "1M" || period === "3M") return "day";
  return "month";
}

/** Single-instrument chart with headline figures. */
export function MarketChart({
  snapshot,
  points,
  period,
  loading,
  height = 320,
}: {
  snapshot: InstrumentSnapshot;
  points: PricePoint[];
  period: ChartPeriod;
  loading?: boolean;
  height?: number;
}) {
  const { instrument: inst, quote } = snapshot;
  const values = points.map((p) => p.v);
  const pc = period === "1D" || values.length < 2 ? quote : changeOverPeriod(inst, values[0], values[values.length - 1]);
  const mode = axisMode(period);
  const fmt = (v: number) => `${formatValue(v, inst.decimals)}${inst.unit === "%" ? "%" : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-[12.5px] text-stone">
            {inst.name} <span className="num">· {inst.ticker}</span>
            {inst.unit && inst.unit !== "%" ? ` · ${inst.unit}` : ""}
          </p>
          <p className="mt-2 text-[2.5rem] font-medium leading-none tracking-tight text-ink">{fmt(quote.value)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.12em] text-stone">{period === "1D" ? "Day change" : `${period} change`}</p>
          <Change
            instrument={inst}
            change={pc.change}
            changePct={pc.changePct}
            changeBp={pc.changeBp}
            size="md"
            className="mt-1"
          />
        </div>
      </div>
      <div className={`mt-6 transition-opacity duration-300 ${loading ? "opacity-40" : ""}`} aria-busy={loading}>
        {values.length > 1 ? (
          <LineChart
            series={[{ id: inst.id, label: inst.shortName, color: PRIMARY_LINE, values }]}
            xLabels={points.map((p) => formatTimestamp(p.t, { time: period === "1D" || period === "1W" }))}
            xTickLabels={points.map((p) => formatAxisTime(p.t, mode))}
            formatValue={fmt}
            area
            height={height}
            reference={period === "1D" ? { value: quote.previousClose, label: "Previous close" } : undefined}
            ariaLabel={`${inst.name}, ${period} illustrative price chart. Latest ${fmt(quote.value)}.`}
            tableCaption={`${inst.name} — ${period} illustrative data`}
            animationKey={`${inst.id}-${period}`}
          />
        ) : (
          <div className="flex items-center justify-center text-sm text-stone" style={{ height }}>
            Loading chart…
          </div>
        )}
      </div>
    </div>
  );
}

/** Comparison mode: performance rebased to 100 at the start of the period (single axis). */
export function ComparisonChart({
  rows,
  histories,
  period,
  loading,
  height = 320,
}: {
  rows: InstrumentSnapshot[];
  histories: Map<string, PricePoint[]>;
  period: ChartPeriod;
  loading?: boolean;
  height?: number;
}) {
  const withData = rows.filter((r) => (histories.get(r.instrument.id)?.length ?? 0) > 1);
  const len = Math.min(...withData.map((r) => histories.get(r.instrument.id)!.length));
  const ref = withData[0] ? histories.get(withData[0].instrument.id)!.slice(-len) : [];
  const series = withData.map((r, i) => {
    const pts = histories.get(r.instrument.id)!.slice(-len);
    const base = pts[0].v;
    return {
      id: r.instrument.id,
      label: r.instrument.shortName,
      color: SERIES_COLORS[i],
      values: pts.map((p) => (p.v / base) * 100),
    };
  });
  const mode = axisMode(period);
  const fmt = (v: number) => formatValue(v, 2);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] text-stone">Comparison · performance rebased to 100 at the start of the period</p>
          <p className="mt-2 font-serif text-[1.75rem] leading-tight text-teal-900">
            {series.map((s) => s.label).join(" · ") || "Select instruments to compare"}
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {series.map((s) => {
            const last = s.values[s.values.length - 1];
            return (
              <li key={s.id} className="flex items-center gap-2 text-[12.5px] text-charcoal">
                <span aria-hidden className="block h-0.5 w-4" style={{ background: s.color }} />
                {s.label}
                <span className="num text-stone">{signed(last - 100, 2, "%")}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={`mt-6 transition-opacity duration-300 ${loading ? "opacity-40" : ""}`} aria-busy={loading}>
        {series.length > 0 ? (
          <LineChart
            series={series}
            xLabels={ref.map((p) => formatTimestamp(p.t, { time: period === "1D" || period === "1W" }))}
            xTickLabels={ref.map((p) => formatAxisTime(p.t, mode))}
            formatValue={fmt}
            height={height}
            reference={{ value: 100, label: "Start of period = 100" }}
            ariaLabel={`Illustrative ${period} comparison of ${series.map((s) => s.label).join(", ")}, rebased to 100.`}
            tableCaption={`Illustrative ${period} comparison, rebased to 100`}
            animationKey={`${series.map((s) => s.id).join("-")}-${period}`}
          />
        ) : (
          <div className="flex items-center justify-center border border-dashed border-rule text-sm text-stone" style={{ height }}>
            Tick “Compare” on up to four instruments below.
          </div>
        )}
      </div>
    </div>
  );
}
