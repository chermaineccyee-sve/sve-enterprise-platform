"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { StateGauge } from "@/components/identity/StateGauge";
import { Change } from "@/components/market/Change";
import { Sparkline } from "@/components/market/Sparkline";
import { MARKET_STATE } from "@/content/intelligence";
import type { InsightListing } from "@/content/insights/types";
import { formatValue } from "@/lib/market/format";
import type { InstrumentSnapshot } from "@/lib/market/types";

/**
 * NUSANTARA MARKET STATE — a visual interpretation layer over market data.
 * Six dimensions, each a qualitative reading on a five-step scale. Selecting a
 * dimension reveals the reading, what would change it, the indicators behind
 * it and the research that develops it. A demonstration framework for
 * management review — not a house view.
 */
export function MarketState({
  instruments,
  sparks,
  insights,
}: {
  instruments: Record<string, InstrumentSnapshot>;
  sparks: Record<string, number[]>;
  insights: Record<string, InsightListing>;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const d = MARKET_STATE[active];
  const insight = insights[d.insight];

  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const n = (next + MARKET_STATE.length) % MARKET_STATE.length;
    setActive(n);
    refs.current[n]?.focus();
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-12 lg:gap-0">
      {/* Dimensions */}
      <div className="lg:col-span-7 lg:border-r lg:border-rule lg:pr-12">
        {/* Mobile: one dimension at a time */}
        <div role="tablist" aria-label="Market state dimensions" className="no-scrollbar -mx-5 flex snap-x gap-1 overflow-x-auto px-5 md:hidden">
          {MARKET_STATE.map((dim, i) => (
            <button
              key={dim.id}
              role="tab"
              aria-selected={i === active}
              aria-controls="state-panel"
              onClick={() => setActive(i)}
              className={`h-10 shrink-0 snap-start border px-4 text-[13px] font-medium ${i === active ? "border-teal-800 bg-teal-800 text-white" : "border-rule text-charcoal"}`}
            >
              {dim.label}
            </button>
          ))}
        </div>
        <div className="mt-6 md:hidden">
          <p className="font-serif text-[2.4rem] leading-none text-teal-900">{d.state}</p>
          <div className="mt-4">
            <StateGauge id={`m-${d.id}`} scale={d.scale} position={d.position} showLabels />
          </div>
        </div>

        <div role="tablist" aria-orientation="vertical" aria-label="Market state dimensions" className="hidden md:block">
          {MARKET_STATE.map((dim, i) => {
            const on = i === active;
            return (
              <button
                key={dim.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="tab"
                id={`state-tab-${dim.id}`}
                aria-selected={on}
                aria-controls="state-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onKeyDown={(e) => onKey(e, i)}
                className="group relative grid w-full grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 border-b border-rule py-5 text-left md:grid-cols-[150px_minmax(0,1fr)_200px]"
              >
                {on && (
                  <m.span
                    layoutId="state-active"
                    aria-hidden
                    className="absolute -left-4 top-0 bottom-0 w-[2px] bg-gold-500 md:-left-6"
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                )}
                <span className={`text-[11.5px] font-semibold uppercase tracking-[0.18em] ${on ? "text-teal-800" : "text-stone"}`}>{dim.label}</span>
                <span
                  className={`font-serif leading-none tracking-tight transition-all duration-500 md:order-none ${
                    on ? "text-[2.1rem] text-teal-900 md:text-[2.6rem]" : "text-[1.6rem] text-teal-900/55 md:text-[2rem]"
                  }`}
                >
                  {dim.state}
                </span>
                <span className="col-span-2 md:col-span-1">
                  <StateGauge id={dim.id} scale={dim.scale} position={dim.position} showLabels={on} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reading panel */}
      <div className="lg:col-span-5 lg:pl-12">
        <div className="lg:sticky lg:top-28">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone">Illustrative reading</p>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={d.id}
              id="state-panel"
              role="tabpanel"
              aria-labelledby={`state-tab-${d.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              <h3 className="display-s mt-4 hidden text-teal-900 md:block">
                {d.label}: <em className="text-gold-700">{d.state.toLowerCase()}</em>
              </h3>
              <p className="mt-4 text-[16px] leading-relaxed text-charcoal">{d.reading}</p>

              <p className="eyebrow mt-8 text-stone">What we are watching</p>
              <ul className="mt-3 space-y-2">
                {d.watching.map((w) => (
                  <li key={w} className="flex items-start gap-3 text-[14.5px] text-charcoal">
                    {w}
                  </li>
                ))}
              </ul>

              <div className="hidden md:block">
              <p className="eyebrow mt-8 text-stone">What would change our reading</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-charcoal">{d.wouldChange}</p>

              <p className="eyebrow mt-8 text-stone">Market data behind it</p>
              <ul className="mt-3 divide-y divide-rule-soft border-y border-rule-soft">
                {d.instruments.map((id) => {
                  const s = instruments[id];
                  if (!s) return null;
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="w-20 text-[13px] font-semibold text-ink">{s.instrument.shortName}</span>
                      <Sparkline values={sparks[id] ?? []} width={72} height={22} label={`${s.instrument.shortName} trend`} className="text-teal-800" />
                      <span className="num w-20 text-right text-[13px] text-ink">
                        {formatValue(s.quote.value, s.instrument.decimals)}
                        {s.instrument.unit === "%" ? "%" : ""}
                      </span>
                      <Change instrument={s.instrument} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} className="w-20 justify-end" />
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-stone">Illustrative data · day change</p>
              </div>

              {insight && (
                <Link href={`/insights/${insight.slug}`} className="group mt-8 block border-l-2 border-teal-800 bg-white px-5 py-4 transition-colors hover:border-gold-500">
                  <span className="eyebrow text-stone">What it may mean · {insight.category}</span>
                  <span className="mt-2 block font-serif text-[1.25rem] leading-snug text-teal-900 group-hover:text-teal-700">{insight.title}</span>
                  <span className="mt-2 inline-flex items-center gap-2 text-[13px] text-teal-800">
                    Read the research <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
                </Link>
              )}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
