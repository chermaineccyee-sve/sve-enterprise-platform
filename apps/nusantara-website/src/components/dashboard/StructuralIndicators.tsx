"use client";

import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { NStar } from "@/components/identity/NStar";
import { Sparkline } from "@/components/market/Sparkline";
import { formatValue } from "@/lib/market/format";
import { INTELLIGENCE_CATEGORIES, type IntelligenceCategory, type IntelligenceIndicator } from "@/lib/market/types";

const DIR = { rising: "↗ Rising", stable: "→ Stable", easing: "↘ Easing" } as const;

/** Level B as an editorial index: one line per indicator, reading on demand. */
export function StructuralIndicators({ indicators }: { indicators: IntelligenceIndicator[] }) {
  const [cat, setCat] = useState<IntelligenceCategory | "All">("All");
  const [open, setOpen] = useState<string | null>(indicators[0]?.id ?? null);
  const shown = cat === "All" ? indicators : indicators.filter((i) => i.category === cat);
  return (
    <div>
      <div role="group" aria-label="Category" className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {(["All", ...INTELLIGENCE_CATEGORIES] as const).map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={`relative h-9 shrink-0 px-3.5 text-[12.5px] ${cat === c ? "text-white" : "text-charcoal hover:text-teal-800"}`}>
            {cat === c && <m.span layoutId="si-cat" className="absolute inset-0 bg-teal-800" />}
            <span className="relative">{c}</span>
          </button>
        ))}
      </div>
      <ul className="mt-8 border-t border-teal-800">
        <AnimatePresence initial={false}>
          {shown.map((ind) => {
            const isOpen = open === ind.id;
            return (
              <m.li key={ind.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-rule">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : ind.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-4 text-left md:grid-cols-[200px_minmax(0,1fr)_120px_110px_90px_20px]">
                  <span className="hidden text-[11px] uppercase tracking-[0.14em] text-gold-700 md:block">{ind.category}</span>
                  <span className="font-serif text-[1.15rem] leading-snug text-teal-900">{ind.title}</span>
                  <span className="hidden md:block">
                    <Sparkline values={ind.series.map((s) => s.v)} width={110} height={26} label={`${ind.title} trend`} className="text-teal-800" />
                  </span>
                  <span className="num text-right text-[1.1rem] font-medium text-ink">
                    {formatValue(ind.value, ind.decimals)}
                    {ind.unit ?? ""}
                  </span>
                  <span className="hidden text-[12.5px] text-charcoal md:block">{DIR[ind.direction]}</span>
                  <span aria-hidden className={`hidden text-teal-800 transition-transform md:block ${isOpen ? "rotate-45" : ""}`}>+</span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid gap-4 pb-6 md:grid-cols-[200px_minmax(0,1fr)_340px] md:gap-x-6">
                        <span className="hidden md:block" />
                        <p className="flex gap-3 text-[15px] leading-relaxed text-charcoal">
                          <NStar className="mt-2 h-2 w-2 text-gold-500" />
                          <span>
                            <span className="font-semibold text-teal-900">Nusantara reading. </span>
                            {ind.reading}
                          </span>
                        </p>
                        <p className="text-[12px] leading-relaxed text-stone">
                          {ind.measure} · {ind.period} · Source: {ind.provenance.source}
                        </p>
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
