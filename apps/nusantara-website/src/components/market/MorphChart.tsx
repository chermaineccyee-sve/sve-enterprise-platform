"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { decimalsForStep, niceTicks } from "./chart-utils";

export type MorphSeries = { id: string; label: string; color: string; values: number[] };

/**
 * A chart that *morphs* between datasets instead of redrawing: every series is
 * resampled to the same number of points upstream, so the path command
 * structure is stable and motion can interpolate it. Crosshair and value
 * follow the pointer; arrow keys step through points.
 */
export function MorphChart({
  series,
  labels,
  format,
  height = 360,
  area = true,
  reference,
  tone = "light",
  ariaLabel,
  showLegend = false,
}: {
  series: MorphSeries[];
  labels: string[];
  format: (v: number) => string;
  height?: number;
  area?: boolean;
  reference?: { value: number; label: string };
  tone?: "light" | "dark";
  ariaLabel: string;
  showLegend?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const dark = tone === "dark";

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = series[0]?.values.length ?? 0;
  const compact = w < 520;
  const M = { t: 18, r: compact ? 52 : 64, b: 28, l: 8 };
  const iw = w - M.l - M.r;
  const ih = height - M.t - M.b;

  const { ticks, min, max, step } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    if (reference) all.push(reference.value);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1;
    return niceTicks(lo - pad, hi + pad, compact ? 3 : 5);
  }, [series, reference, compact]);

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const x = (i: number) => r2(M.l + (n <= 1 ? 0 : (i / (n - 1)) * iw));
  const y = (v: number) => r2(M.t + (1 - (v - min) / (max - min || 1)) * ih);
  const dec = decimalsForStep(step);
  const tickFmt = (v: number) => new Intl.NumberFormat("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);

  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const areaPath = (vals: number[]) => `${path(vals)}L${x(n - 1)},${M.t + ih}L${x(0)},${M.t + ih}Z`;

  const ink = dark ? "rgba(196,213,219,0.75)" : "var(--color-stone)";
  const grid = dark ? "rgba(255,255,255,0.08)" : "var(--color-rule-soft)";

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / iw) * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const d = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1);
    setHover((h) => Math.max(0, Math.min(n - 1, (h ?? n - 1) + d)));
  };

  const xTickIdx = compact ? [0, Math.round((n - 1) / 2), n - 1] : [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((3 * (n - 1)) / 4), n - 1];
  const spring = { type: "spring" as const, stiffness: 120, damping: 22, mass: 0.8 };

  return (
    <div>
      {showLegend && series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1" aria-label="Legend">
          {series.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 text-[12.5px] ${dark ? "text-teal-100" : "text-charcoal"}`}>
              <span aria-hidden className="block h-0.5 w-4" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={wrap} className="relative w-full" style={{ height }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${w} ${height}`}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          className="block touch-pan-y select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-500"
        >
          <AnimatePresence initial={false}>
            {ticks.map((t) => (
              <m.g key={t} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <m.line x1={M.l} x2={M.l + iw} initial={false} animate={{ y1: y(t), y2: y(t) }} transition={spring} stroke={grid} />
                <m.text
                  x={M.l + iw + 10}
                  initial={false}
                  animate={{ y: y(t) }}
                  transition={spring}
                  dy="0.32em"
                  fontSize={11}
                  fill={ink}
                  className="num"
                >
                  {tickFmt(t)}
                </m.text>
              </m.g>
            ))}
          </AnimatePresence>
          {xTickIdx.map((i, k) => (
            <text
              key={k}
              x={x(i)}
              y={height - 8}
              fontSize={11}
              fill={ink}
              textAnchor={k === 0 ? "start" : k === xTickIdx.length - 1 ? "end" : "middle"}
              className="num"
            >
              {labels[i]?.split(",")[0]}
            </text>
          ))}
          {reference && (
            <m.line
              x1={M.l}
              x2={M.l + iw}
              initial={false}
              animate={{ y1: y(reference.value), y2: y(reference.value) }}
              transition={spring}
              stroke={dark ? "rgba(205,174,115,0.5)" : "var(--color-mist)"}
              strokeDasharray="2 4"
            />
          )}
          {series.map((s, idx) => (
            <g key={s.id}>
              {area && series.length === 1 && (
                <m.path initial={false} animate={{ d: areaPath(s.values) }} transition={spring} fill={s.color} fillOpacity={dark ? 0.12 : 0.08} />
              )}
              <m.path
                initial={false}
                animate={{ d: path(s.values) }}
                transition={{ ...spring, delay: idx * 0.04 }}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <m.circle initial={false} animate={{ cx: x(n - 1), cy: y(s.values[n - 1]) }} transition={spring} r={4} fill={s.color} stroke={dark ? "#0e2d3b" : "#fbf9f4"} strokeWidth={2} />
            </g>
          ))}
          {hover !== null && (
            <g aria-hidden>
              <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} stroke={dark ? "rgba(255,255,255,0.35)" : "rgba(18,56,74,0.35)"} />
              {series.map((s) => (
                <circle key={s.id} cx={x(hover)} cy={y(s.values[hover])} r={5} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={M.l}
            y={M.t}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && (
          <div
            role="status"
            className={`pointer-events-none absolute top-0 z-10 min-w-[140px] -translate-x-1/2 border px-3 py-2 text-[12px] shadow-lg ${
              dark ? "border-white/15 bg-teal-950/95 text-teal-50" : "border-rule bg-white/95 text-ink"
            }`}
            style={{ left: `${Math.min(Math.max((x(hover) / w) * 100, 10), 88)}%` }}
          >
            <p className={dark ? "text-teal-200" : "text-stone"}>{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.id} className="mt-0.5 flex items-center justify-between gap-3">
                {series.length > 1 && (
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="block h-0.5 w-3" style={{ background: s.color }} />
                    {s.label}
                  </span>
                )}
                <strong className="num font-semibold">{format(s.values[hover])}</strong>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
