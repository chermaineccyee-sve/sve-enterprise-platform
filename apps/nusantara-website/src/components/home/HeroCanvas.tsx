"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ARM_TIPS, Lattice } from "@/components/identity/Lattice";
import { NStar } from "@/components/identity/NStar";
import { Change } from "@/components/market/Change";
import { StaleMark } from "@/components/market/MarketStatus";
import { Sparkline } from "@/components/market/Sparkline";
import { formatTimestamp, formatValue } from "@/lib/market/format";
import { statusTitle } from "@/lib/market/status";
import { useOptionalMarketFocus } from "./MarketFocus";
import type { AssetClass, InstrumentSnapshot } from "@/lib/market/types";

const MLink = m.create(Link);
const ARM_OF: Record<AssetClass, number> = { equities: 0, fx: 1, rates: 2, commodities: 3 };
const ARM_LABEL = ["Equities", "FX", "Rates", "Commodities"];
const W = 1000;
const H = 760;

/** A seamless (periodic) abstract market path across one canvas width. */
function makeWalk(seed: number, points = 120) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const raw: number[] = [0];
  for (let i = 1; i < points; i++) raw.push(raw[i - 1] + (rnd() - 0.5) * 2 + Math.sin(i / 9) * 0.35);
  // remove drift so the end meets the start — the line can loop forever
  const drift = raw[raw.length - 1] / (points - 1);
  const flat = raw.map((v, i) => v - drift * i);
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  return flat.map((v) => 0.62 - ((v - lo) / (hi - lo || 1)) * 0.26);
}

/**
 * Atmospheric market canvas for the hero. The line is abstract (no values);
 * the monitor shows the market the visitor has selected (ribbon, Market
 * Intelligence panel or its own controls) — it never cycles on its own — and
 * highlights the lattice arm of that asset class. With no displayable data
 * the monitor is simply not shown.
 */
export function HeroCanvas({
  instruments,
  monitorIds,
  sparks,
}: {
  /** Every market the homepage can select. */
  instruments: InstrumentSnapshot[];
  /** Representative markets offered by the monitor's own controls. */
  monitorIds: string[];
  sparks: Record<string, number[]>;
}) {
  const reduce = useReducedMotion();
  const focus = useOptionalMarketFocus();
  const [localId, setLocalId] = useState(monitorIds[0] ?? "");
  const selectedId = focus?.focusId ?? localId;
  const select = (id: string) => (focus ? focus.setFocus(id) : setLocalId(id));
  const monitor = monitorIds.map((id) => instruments.find((s) => s.instrument.id === id)).filter((s): s is InstrumentSnapshot => !!s);
  const lineRef = useRef<SVGGElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const walk = useMemo(() => makeWalk(7), []);
  const walk2 = useMemo(() => makeWalk(29), []);
  const current: InstrumentSnapshot | undefined = instruments.find((s) => s.instrument.id === selectedId) ?? monitor[0] ?? instruments[0];
  const arm = current ? ARM_OF[current.instrument.assetClass] : -1;

  const pathFor = (vals: number[], offset = 0) =>
    vals
      .concat(vals[0])
      .map((v, i) => `${i ? "L" : "M"}${(offset + (i / vals.length) * W).toFixed(1)},${(v * H).toFixed(1)}`)
      .join("");

  // Drift the abstract line and ride the reading-head dot along it.
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (wrapRef.current) io.observe(wrapRef.current);
    const start = performance.now();
    const headX = 0.7 * W;
    const tick = (now: number) => {
      if (visible) {
        const off = (((now - start) / 1000) * 14) % W; // px per second
        lineRef.current?.setAttribute("transform", `translate(${-off.toFixed(2)} 0)`);
        const pos = ((headX + off) % W) / W;
        const f = pos * walk.length;
        const i = Math.floor(f) % walk.length;
        const v = walk[i] + (walk[(i + 1) % walk.length] - walk[i]) * (f - Math.floor(f));
        dotRef.current?.setAttribute("cy", (v * H).toFixed(1));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [reduce, walk]);

  const inst = current?.instrument;
  const unit = inst?.unit === "%" ? "%" : "";

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0" aria-hidden={false}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full opacity-40 md:opacity-100" aria-hidden>
        <defs>
          <linearGradient id="hero-fade" x1="0" x2="1">
            <stop offset="0" stopColor="#f7f3ea" stopOpacity="1" />
            <stop offset="0.42" stopColor="#f7f3ea" stopOpacity="0.96" />
            <stop offset="0.66" stopColor="#f7f3ea" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* data coordinates */}
        <g stroke="rgba(18,56,74,0.07)">
          {[0.2, 0.35, 0.5, 0.65, 0.8].map((f) => (
            <line key={f} x1="0" x2={W} y1={f * H} y2={f * H} />
          ))}
          {[0.45, 0.6, 0.75, 0.9].map((f) => (
            <line key={f} y1="0" y2={H} x1={f * W} x2={f * W} />
          ))}
        </g>
        <g className="num hidden md:block" fontSize="10" fill="rgba(18,56,74,0.3)" letterSpacing="1">
          {["+2.0σ", "+1.0σ", "0.0", "−1.0σ", "−2.0σ"].map((l, i) => (
            <text key={l} x={W - 14} y={(0.2 + i * 0.15) * H - 6} textAnchor="end">
              {l}
            </text>
          ))}
          {["T−90", "T−60", "T−30", "T"].map((l, i) => (
            <text key={l} x={(0.45 + i * 0.15) * W + 6} y={H - 18}>
              {l}
            </text>
          ))}
        </g>
        {/* abstract market lines (loop seamlessly) */}
        <g ref={lineRef}>
          <path d={pathFor(walk2) + pathFor(walk2, W).replace("M", "L")} fill="none" stroke="rgba(184,149,90,0.25)" strokeWidth="1" />
          <path d={pathFor(walk) + pathFor(walk, W).replace("M", "L")} fill="none" stroke="rgba(18,56,74,0.4)" strokeWidth="1.2" />
        </g>
        {/* reading head */}
        <line x1={0.7 * W} x2={0.7 * W} y1={0.12 * H} y2={0.88 * H} stroke="rgba(18,56,74,0.18)" strokeDasharray="2 5" />
        <circle ref={dotRef} cx={0.7 * W} cy={walk[Math.floor(0.7 * walk.length)] * H} r="5" fill="#b8955a" stroke="#f7f3ea" strokeWidth="2" />
        <rect width={W} height={H} fill="url(#hero-fade)" />
      </svg>

      {/* Lattice: four asset classes converging on allocation */}
      <div className="absolute right-[-10%] top-1/2 hidden aspect-square w-[min(70vw,620px)] -translate-y-[54%] md:block lg:right-[6%] lg:w-[min(42vw,600px)]">
        <Lattice className="h-full w-full text-teal-800/45" stroke="currentColor" accent="#b8955a" strokeWidth={0.55} activeArm={arm} draw />
        {ARM_TIPS.map(([tx, ty], i) => (
          <span
            key={i}
            className={`absolute -translate-x-1/2 -translate-y-1/2 text-[10.5px] font-semibold uppercase tracking-[0.2em] transition-colors duration-500 ${
              i === arm ? "text-gold-700" : "text-teal-800/45"
            }`}
            style={{ left: `${50 + (tx / 200) * 100 * 1.22}%`, top: `${50 + (ty / 200) * 100 * 1.22}%` }}
          >
            {ARM_LABEL[i]}
          </span>
        ))}
      </div>

      {/* Monitor */}
      {current && inst && (
      <div
        className="pointer-events-auto absolute bottom-8 right-5 hidden w-[300px] md:block border border-teal-800/15 bg-paper/85 p-5 shadow-[0_20px_60px_-30px_rgba(14,45,59,0.45)] backdrop-blur-md md:right-10 lg:bottom-14"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-teal-800">
            <NStar className="star-breathe h-2.5 w-2.5 text-gold-500" />
            Market monitor
          </p>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gold-800">{statusTitle(current.provenance)}</span>
        </div>
        <div className="relative mt-4 h-[92px]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <MLink
              key={inst.id}
              href={`/market-dashboard?instrument=${inst.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex items-end justify-between gap-3 text-left"
              aria-label={`${inst.name}: open in Market Dashboard`}
            >
              <span>
                <span className="block text-[12px] text-stone">
                  {inst.shortName} · {ARM_LABEL[arm]} <StaleMark provenance={current.provenance} />
                </span>
                <span className="num mt-1 block text-[1.9rem] font-medium leading-none tracking-tight text-ink">
                  {formatValue(current.quote.value, inst.decimals)}
                  {unit}
                </span>
                <Change
                  instrument={inst}
                  change={current.quote.change}
                  changePct={current.quote.changePct}
                  changeBp={current.quote.changeBp}
                  showAbsolute={false}
                  className="mt-2"
                />
              </span>
              <Sparkline values={sparks[inst.id] ?? []} width={96} height={40} label={`${inst.shortName} one-month trend`} className="text-teal-800" />
            </MLink>
          </AnimatePresence>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-rule-soft pt-3">
          <div className="flex gap-1.5" role="group" aria-label="Choose market">
            {monitor.map((s) => (
              <button
                key={s.instrument.id}
                type="button"
                onClick={() => select(s.instrument.id)}
                aria-label={s.instrument.shortName}
                aria-pressed={s.instrument.id === current?.instrument.id}
                className={`h-1.5 transition-all duration-300 ${s.instrument.id === current?.instrument.id ? "w-5 bg-gold-500" : "w-1.5 bg-teal-800/25 hover:bg-teal-800/50"}`}
              />
            ))}
          </div>
          <span className="num text-[10.5px] text-stone">{formatTimestamp(current.provenance.asOf)}</span>
        </div>
      </div>
      )}
    </div>
  );
}
