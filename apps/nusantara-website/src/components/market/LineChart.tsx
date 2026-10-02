"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { decimalsForStep, linePath, niceTicks } from "./chart-utils";

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  values: number[];
  /** Emphasised series draw thicker (e.g. base scenario). */
  emphasis?: boolean;
};

type LineChartProps = {
  series: ChartSeries[];
  /** Full label for each x position (tooltip / table). */
  xLabels: string[];
  /** Short tick label for each x position; ticks are thinned automatically. */
  xTickLabels?: string[];
  formatValue: (v: number) => string;
  height?: number;
  area?: boolean;
  markers?: boolean;
  endLabels?: boolean;
  reference?: { value: number; label: string };
  yAxis?: "left" | "right";
  ariaLabel: string;
  tableCaption?: string;
  /** Changing this replays the draw animation. */
  animationKey?: string;
  className?: string;
};

export function LineChart({
  series,
  xLabels,
  xTickLabels,
  formatValue,
  height = 300,
  area = false,
  markers = false,
  endLabels = false,
  reference,
  yAxis = "right",
  ariaLabel,
  tableCaption,
  animationKey,
  className = "",
}: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const descId = useId();
  const n = xLabels.length;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const compact = width < 480;
  const m = {
    top: 16,
    bottom: 30,
    left: yAxis === "left" ? (compact ? 44 : 56) : n <= (compact ? 6 : 12) ? 22 : 4,
    right: (yAxis === "right" ? (compact ? 48 : 60) : 12) + (endLabels ? (compact ? 0 : 84) : 0),
  };
  const innerW = Math.max(10, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;

  const { ticks, min, max, step } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    if (reference) all.push(reference.value);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.01 || 1;
    return niceTicks(lo - pad, hi + pad, compact ? 3 : 4);
  }, [series, reference, compact]);

  // Coordinates are rounded so server and browser render identical markup.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const x = (i: number) => r2(m.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW));
  const y = (v: number) => r2(m.top + (1 - (v - min) / (max - min)) * innerH);
  const tickDecimals = decimalsForStep(step);
  const tickFmt = (v: number) =>
    new Intl.NumberFormat("en-GB", { minimumFractionDigits: tickDecimals, maximumFractionDigits: tickDecimals }).format(v);

  const xTicks = useMemo(() => {
    const labels = xTickLabels ?? xLabels;
    const count = compact ? 3 : 5;
    if (n <= (compact ? 6 : 12)) return labels.map((l, i) => ({ i, l }));
    const out: { i: number; l: string }[] = [];
    for (let k = 0; k < count; k++) {
      const i = Math.round((k / (count - 1)) * (n - 1));
      out.push({ i, l: labels[i] });
    }
    return out;
  }, [xTickLabels, xLabels, n, compact]);

  const xs = useMemo(() => Array.from({ length: n }, (_, i) => x(i)), [n, innerW, m.left]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((px - m.left) / innerW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, idx)));
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? Math.max(1, Math.round(n / 10)) : 1);
      setActive((a) => Math.max(0, Math.min(n - 1, (a ?? n - 1) + delta)));
    } else if (e.key === "Home") {
      setActive(0);
    } else if (e.key === "End") {
      setActive(n - 1);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  };

  const tooltipLeft = active !== null ? (x(active) / width) * 100 : 0;
  const flip = active !== null && x(active) > width * 0.6;

  return (
    <figure className={`relative ${className}`}>
      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={ariaLabel}
          aria-describedby={descId}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className="block touch-pan-y select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-500"
        >
          {/* Grid + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--color-rule-soft)" strokeWidth={1} />
              <text
                x={yAxis === "right" ? m.left + innerW + 8 : m.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor={yAxis === "right" ? "start" : "end"}
                className="num fill-stone text-[11px]"
              >
                {tickFmt(t)}
              </text>
            </g>
          ))}
          {/* Baseline */}
          <line x1={m.left} x2={m.left + innerW} y1={m.top + innerH} y2={m.top + innerH} stroke="var(--color-rule)" strokeWidth={1} />
          {/* X ticks */}
          {xTicks.map(({ i, l }, k) => (
            <text
              key={`${i}-${k}`}
              x={x(i)}
              y={height - 8}
              textAnchor={n <= (compact ? 6 : 12) ? "middle" : k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}
              className="num fill-stone text-[11px]"
            >
              {l}
            </text>
          ))}
          {/* Reference line (e.g. previous close / base value) */}
          {reference && (
            <g>
              <line
                x1={m.left}
                x2={m.left + innerW}
                y1={y(reference.value)}
                y2={y(reference.value)}
                stroke="var(--color-mist)"
                strokeWidth={1}
              />
              <text x={m.left + 4} y={y(reference.value) - 6} className="fill-stone text-[10.5px]">
                {reference.label}
              </text>
            </g>
          )}
          {/* Series */}
          <g key={animationKey}>
            {series.map((s) => {
              const ys = s.values.map(y);
              const d = linePath(xs, ys);
              return (
                <g key={s.id}>
                  {area && series.length === 1 && (
                    <path
                      d={`${d}L${xs[n - 1].toFixed(2)},${m.top + innerH}L${xs[0].toFixed(2)},${m.top + innerH}Z`}
                      fill={s.color}
                      fillOpacity={0.08}
                    />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.emphasis ? 2.5 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    pathLength={1000}
                    className="chart-draw"
                  />
                  {markers &&
                    s.values.map((v, i) => (
                      <circle key={i} cx={xs[i]} cy={ys[i]} r={4} fill={s.color} stroke="var(--color-paper)" strokeWidth={2} />
                    ))}
                  {!markers && (
                    <circle cx={xs[n - 1]} cy={ys[n - 1]} r={4} fill={s.color} stroke="var(--color-paper)" strokeWidth={2} />
                  )}
                </g>
              );
            })}
          </g>
          {/* End labels (text in ink; identity from the adjacent mark) */}
          {endLabels &&
            !compact &&
            series.map((s) => (
              <text
                key={s.id}
                x={xs[n - 1] + (yAxis === "right" ? 60 : 12)}
                y={y(s.values[n - 1])}
                dy="0.32em"
                className="num fill-charcoal text-[11.5px] font-medium"
              >
                {formatValue(s.values[n - 1])}
              </text>
            ))}
          {/* Crosshair */}
          {active !== null && (
            <g aria-hidden>
              <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + innerH} stroke="var(--color-teal-800)" strokeOpacity={0.35} strokeWidth={1} />
              {series.map((s) => (
                <circle key={s.id} cx={x(active)} cy={y(s.values[active])} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={m.left}
            y={m.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {active !== null && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-2 z-10 min-w-[150px] border border-rule bg-white/95 px-3 py-2 shadow-[0_8px_24px_-12px_rgba(14,45,59,0.35)] backdrop-blur"
            style={flip ? { right: `${100 - tooltipLeft + 1.5}%` } : { left: `${tooltipLeft + 1.5}%` }}
          >
            <p className="text-[11px] text-stone">{xLabels[active]}</p>
            <ul className="mt-1 space-y-0.5">
              {series.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 text-[12.5px]">
                  <span className="flex items-center gap-2 text-stone">
                    {series.length > 1 && <span aria-hidden className="block h-0.5 w-3" style={{ background: s.color }} />}
                    {series.length > 1 ? s.label : null}
                  </span>
                  <strong className="num font-semibold text-ink">{formatValue(s.values[active])}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p id={descId} className="sr-only">
        Use left and right arrow keys to move through data points. A data table follows the chart.
      </p>

      {tableCaption && (
        <details className="group mt-3" data-print="hide">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-[12px] text-stone hover:text-teal-800">
            <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5 transition-transform group-open:rotate-90" fill="currentColor">
              <path d="M3 1l4 4-4 4z" />
            </svg>
            View data table
          </summary>
          <div className="scrollbar-thin mt-3 max-h-72 overflow-auto border border-rule-soft">
            <table className="w-full text-left text-[12.5px]">
              <caption className="sr-only">{tableCaption}</caption>
              <thead className="sticky top-0 bg-ivory">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium text-stone">
                    Point
                  </th>
                  {series.map((s) => (
                    <th key={s.id} scope="col" className="px-3 py-2 text-right font-medium text-stone">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {xLabels.map((l, i) => (
                  <tr key={i} className="border-t border-rule-soft">
                    <th scope="row" className="px-3 py-1.5 font-normal text-charcoal">
                      {l}
                    </th>
                    {series.map((s) => (
                      <td key={s.id} className="num px-3 py-1.5 text-right text-ink">
                        {formatValue(s.values[i])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
