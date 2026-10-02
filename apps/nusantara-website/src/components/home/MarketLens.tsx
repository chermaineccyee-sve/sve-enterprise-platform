"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { NStar } from "@/components/identity/NStar";
import { StateGauge } from "@/components/identity/StateGauge";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Change } from "@/components/market/Change";
import { PRIMARY_LINE } from "@/components/market/chart-utils";
import { MorphChart } from "@/components/market/MorphChart";
import { getInstrumentView, INTELLIGENCE_STATUS } from "@/content/intelligence";
import type { InsightListing } from "@/content/insights/types";
import { useMarketHistory } from "@/hooks/useMarketData";
import { resampleSeries } from "@/lib/market/analytics";
import { changeOverPeriod, formatTimestamp, formatValue } from "@/lib/market/format";
import type { ChartPeriod, InstrumentHistory, InstrumentSnapshot } from "@/lib/market/types";
import { useMarketFocus } from "./MarketFocus";

const PERIODS: ChartPeriod[] = ["1M", "3M", "YTD", "1Y"];
const N = 72;

function Step({ n, label, q }: { n: string; label: string; q: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="num text-[11px] text-gold-700">{n}</span>
      <span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-800">{label}</span>
        <span className="block font-serif text-[1.05rem] italic text-stone">{q}</span>
      </span>
    </div>
  );
}

/**
 * MARKET → SIGNAL → INSIGHT. Selecting a market (here, in the ribbon or in the
 * hero monitor) shows what happened, what Nusantara is watching, and the
 * research that considers what it may mean.
 */
export function MarketLens({
  instruments,
  initialHistory,
  insights,
}: {
  instruments: InstrumentSnapshot[];
  initialHistory: InstrumentHistory[];
  insights: Record<string, InsightListing>;
}) {
  const { focusId, setFocus } = useMarketFocus();
  const [period, setPeriod] = useState<ChartPeriod>("1M");
  const { byId, loading } = useMarketHistory(period, { period: "1M", data: initialHistory });
  const snap = instruments.find((s) => s.instrument.id === focusId) ?? instruments[0];
  const inst = snap.instrument;
  const view = getInstrumentView(inst.id, inst.assetClass);
  const insight = insights[view.insight];
  const points = useMemo(() => byId.get(inst.id) ?? [], [byId, inst.id]);
  const { values, stamps } = useMemo(() => resampleSeries(points, N), [points]);
  const pc = values.length > 1 ? changeOverPeriod(inst, points[0].v, points[points.length - 1].v) : snap.quote;
  const unit = inst.unit === "%" ? "%" : "";
  const fmt = (v: number) => `${formatValue(v, inst.decimals)}${unit}`;

  return (
    <div>
      {/* Selector */}
      <div role="group" aria-label="Choose a market" className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {instruments.map((s) => {
          const on = s.instrument.id === inst.id;
          return (
            <button
              key={s.instrument.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFocus(s.instrument.id)}
              className={`relative h-9 shrink-0 px-3.5 text-[12.5px] font-medium transition-colors ${on ? "text-white" : "text-charcoal hover:text-teal-800"}`}
            >
              {on && <m.span layoutId="lens-pill" className="absolute inset-0 bg-teal-800" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative">{s.instrument.shortName}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid border-t border-teal-800 lg:grid-cols-12">
        {/* 1 — What happened */}
        <div className="border-b border-rule py-8 lg:col-span-6 lg:border-b-0 lg:border-r lg:pr-10">
          <Step n="01" label="Market data" q="What happened?" />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12.5px] text-stone">
                {inst.name} <span className="num">· {inst.ticker}</span>
              </p>
              <p className="mt-1 text-[2.6rem] font-medium leading-none tracking-tight text-ink">
                <AnimatedNumber value={snap.quote.value} format={fmt} />
              </p>
              <Change instrument={inst} change={pc.change} changePct={pc.changePct} changeBp={pc.changeBp} size="md" className="mt-2" />
              <span className="ml-2 text-[12px] text-stone">over {period}</span>
            </div>
            <div role="group" aria-label="Period" className="flex border border-rule">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={p === period}
                  onClick={() => setPeriod(p)}
                  className={`num h-8 px-3 text-[12px] ${p === period ? "bg-teal-800 text-white" : "text-charcoal hover:text-teal-800"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className={`mt-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
            {values.length > 1 && (
              <MorphChart
                series={[{ id: "s", label: inst.shortName, color: PRIMARY_LINE, values }]}
                labels={stamps.map((t) => formatTimestamp(t, { time: false }))}
                format={fmt}
                height={260}
                ariaLabel={`${inst.name}, ${period}, illustrative`}
              />
            )}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11.5px] text-stone">
            <NStar className="h-2 w-2 text-gold-500" />
            Illustrative · Source: {snap.provenance.source} · As at {formatTimestamp(snap.provenance.asOf)}
          </p>
        </div>

        {/* 2 — What we are watching */}
        <div className="border-b border-rule py-8 lg:col-span-3 lg:border-b-0 lg:border-r lg:px-8">
          <Step n="02" label="Nusantara signal" q="What are we watching?" />
          <AnimatePresence mode="wait" initial={false}>
            <m.div key={inst.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.35 }}>
              <p className="mt-6 font-serif text-[2rem] leading-none text-teal-900">{view.signal}</p>
              <div className="mt-4">
                <StateGauge id={`lens-${inst.id}`} scale={view.scale} position={view.position} showLabels />
              </div>
              <p className="mt-6 text-[14.5px] leading-relaxed text-charcoal">{view.context}</p>
              <dl className="mt-5 space-y-4 text-[13.5px]">
                <div>
                  <dt className="eyebrow text-stone">Watching</dt>
                  <dd className="mt-1 text-charcoal">{view.watching}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-stone">Key risk</dt>
                  <dd className="mt-1 text-charcoal">{view.risk}</dd>
                </div>
              </dl>
            </m.div>
          </AnimatePresence>
        </div>

        {/* 3 — What it may mean */}
        <div className="py-8 lg:col-span-3 lg:pl-8">
          <Step n="03" label="Nusantara insight" q="What may it mean?" />
          <AnimatePresence mode="wait" initial={false}>
            {insight && (
              <m.div key={insight.slug} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.35, delay: 0.05 }}>
                <p className="eyebrow mt-6 text-gold-700">{insight.category}</p>
                <Link href={`/insights/${insight.slug}`} className="group mt-3 block">
                  <span className="block font-serif text-[1.45rem] leading-snug text-teal-900 group-hover:text-teal-700">{insight.title}</span>
                  <span className="mt-3 block text-[14px] leading-relaxed text-stone">{insight.summary}</span>
                  <span className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-teal-800">
                    Read the research <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
                </Link>
                <p className="mt-6 text-[11.5px] text-stone">Theme: {view.theme}</p>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="mt-4 text-[11.5px] text-stone">{INTELLIGENCE_STATUS.label}. Signals are sample readings, not recommendations.</p>
    </div>
  );
}
