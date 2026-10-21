"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Change } from "@/components/market/Change";
import { StaleMark } from "@/components/market/MarketStatus";
import type { InsightListing } from "@/content/insights/types";
import type { Theme } from "@/content/model/intelligence";
import { formatValue } from "@/lib/market/format";
import { statusPhrase } from "@/lib/market/status";
import type { DataProvenance, InstrumentSnapshot, IntelligenceIndicator } from "@/lib/market/types";
import { routes } from "@/lib/routes";

/** Themes we are watching — each joins research to the markets and indicators behind it. */
export function Themes({
  themes,
  insights,
  instruments,
  indicators,
  provenance,
}: {
  /** Themes with their research already resolved by the relationship engine. */
  themes: Theme[];
  insights: Record<string, InsightListing>;
  instruments: Record<string, InstrumentSnapshot>;
  indicators: Record<string, IntelligenceIndicator>;
  provenance: DataProvenance;
}) {
  const THEMES = themes;
  const [active, setActive] = useState(0);
  const t = THEMES[active];
  if (!t) return null;
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
                className="group flex w-full items-baseline gap-4 border-b border-rule py-4 text-left"
              >
                <span className={`num text-[12px] ${on ? "text-gold-700" : "text-mist"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={`font-serif text-[1.7rem] leading-tight transition-all duration-500 md:text-[2.1rem] ${on ? "translate-x-2 text-teal-900" : "text-stone group-hover:text-teal-900"}`}>{th.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="relative lg:col-span-6 lg:col-start-7">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={t.id} id="theme-panel" role="tabpanel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }} className="relative">
            <p className="font-serif text-[1.8rem] leading-snug text-teal-900 md:text-[2.2rem]">“{t.statement}”</p>
            <p className="eyebrow mt-10 text-stone">Research</p>
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {t.insights.map((s) => insights[s]).filter(Boolean).map((i) => (
                <li key={i.slug}>
                  <Link href={`/insights/${i.slug}`} className="group flex items-baseline justify-between gap-4 py-3">
                    <span className="font-serif text-[1.15rem] text-teal-900 group-hover:text-teal-700">{i.title}</span>
                    <span className="text-gold-600 transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            {(t.instruments.length > 0 || t.indicators.length > 0) && (
              <>
                <p className="eyebrow mt-8 text-stone">Signals behind it · {statusPhrase(provenance)}</p>
                <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {t.instruments.map((id) => instruments[id]).filter(Boolean).map((s) => (
                    <li key={s.instrument.id} className="border-b border-rule text-[13px]">
                      <Link href={routes.market(s.instrument.id)} aria-label={`${s.instrument.shortName}: open market view`} className="group flex items-center justify-between gap-3 py-2">
                        <span className="font-semibold text-teal-900 group-hover:text-teal-700">
                          {s.instrument.shortName} <StaleMark provenance={s.provenance} tone="dark" />
                        </span>
                        <span className="num text-charcoal">
                          {formatValue(s.quote.value, s.instrument.decimals)}
                          {s.instrument.unit === "%" ? "%" : ""}
                        </span>
                        <Change instrument={s.instrument} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} tone="dark" />
                      </Link>
                    </li>
                  ))}
                  {t.indicators.map((id) => indicators[id]).filter(Boolean).map((ind) => (
                    <li key={ind.id} className="flex items-center justify-between gap-3 border-b border-rule py-2 text-[13px]">
                      <span className="flex items-center gap-2 text-teal-900">
                        {ind.title}
                      </span>
                      <span className="num text-charcoal">
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
