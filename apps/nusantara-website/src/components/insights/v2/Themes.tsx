"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Lattice } from "@/components/identity/Lattice";
import { NStar } from "@/components/identity/NStar";
import { Change } from "@/components/market/Change";
import { THEMES } from "@/content/intelligence";
import type { InsightListing } from "@/content/insights/types";
import { formatValue } from "@/lib/market/format";
import type { InstrumentSnapshot, IntelligenceIndicator } from "@/lib/market/types";

/** Themes we are watching — each joins research to the markets and indicators behind it. */
export function Themes({
  insights,
  instruments,
  indicators,
}: {
  insights: Record<string, InsightListing>;
  instruments: Record<string, InstrumentSnapshot>;
  indicators: Record<string, IntelligenceIndicator>;
}) {
  const [active, setActive] = useState(0);
  const t = THEMES[active];
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <ol className="lg:col-span-5" role="tablist" aria-orientation="vertical" aria-label="Themes">
        {THEMES.map((th, i) => {
          const on = i === active;
          return (
            <li key={th.id}>
              <button
                role="tab"
                aria-selected={on}
                aria-controls="theme-panel"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                className="group flex w-full items-baseline gap-4 border-b border-white/10 py-4 text-left"
              >
                <span className={`num text-[12px] ${on ? "text-gold-300" : "text-teal-300/60"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={`font-serif text-[1.7rem] leading-tight transition-all duration-500 md:text-[2.1rem] ${on ? "translate-x-2 text-white" : "text-teal-200/70 group-hover:text-white"}`}>{th.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="relative lg:col-span-6 lg:col-start-7">
        <div aria-hidden className="pointer-events-none absolute -right-28 -top-36 h-72 w-72 text-white/[0.07]">
          <Lattice className="h-full w-full" strokeWidth={0.8} activeArm={active % 4} accent="rgba(205,174,115,0.35)" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={t.id} id="theme-panel" role="tabpanel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }} className="relative">
            <p className="font-serif text-[1.8rem] leading-snug text-gold-200 md:text-[2.2rem]">“{t.statement}”</p>
            <p className="eyebrow mt-10 text-gold-300">Research</p>
            <ul className="mt-3 divide-y divide-white/10 border-y border-white/10">
              {t.insights.map((s) => insights[s]).filter(Boolean).map((i) => (
                <li key={i.slug}>
                  <Link href={`/insights/${i.slug}`} className="group flex items-baseline justify-between gap-4 py-3">
                    <span className="font-serif text-[1.15rem] text-white group-hover:text-gold-200">{i.title}</span>
                    <span className="text-gold-300 transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            {(t.instruments.length > 0 || t.indicators.length > 0) && (
              <>
                <p className="eyebrow mt-8 text-gold-300">Signals behind it · illustrative</p>
                <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {t.instruments.map((id) => instruments[id]).filter(Boolean).map((s) => (
                    <li key={s.instrument.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-[13px]">
                      <span className="font-semibold text-white">{s.instrument.shortName}</span>
                      <span className="num text-teal-100">
                        {formatValue(s.quote.value, s.instrument.decimals)}
                        {s.instrument.unit === "%" ? "%" : ""}
                      </span>
                      <Change instrument={s.instrument} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} tone="dark" />
                    </li>
                  ))}
                  {t.indicators.map((id) => indicators[id]).filter(Boolean).map((ind) => (
                    <li key={ind.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-[13px]">
                      <span className="flex items-center gap-2 text-white">
                        <NStar className="h-2 w-2 text-gold-400" />
                        {ind.title}
                      </span>
                      <span className="num text-teal-100">
                        {formatValue(ind.value, ind.decimals)}
                        {ind.unit ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
