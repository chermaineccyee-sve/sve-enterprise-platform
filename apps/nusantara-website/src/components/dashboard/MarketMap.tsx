"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Change } from "@/components/market/Change";
import { StaleMark } from "@/components/market/MarketStatus";
import type { InsightListing } from "@/content/insights/types";
import type { MonitoredMarket } from "@/content/model/intelligence";
import { formatValue } from "@/lib/market/format";
import { statusTitle } from "@/lib/market/status";
import type { DataProvenance, InstrumentSnapshot } from "@/lib/market/types";

/**
 * Markets we monitor — a schematic (not geographic) map used as an interface.
 * Nodes are joined by orthogonal lattice paths; hover or select a market to
 * see its index, currency, benchmark rate and related research.
 * This describes market monitoring only — not where Nusantara operates.
 */
export function MarketMap({
  markets,
  instruments,
  insights,
  provenance,
  prototype,
}: {
  markets: MonitoredMarket[];
  instruments: Record<string, InstrumentSnapshot>;
  insights: Record<string, InsightListing>;
  provenance: DataProvenance;
  prototype: boolean;
}) {
  const [active, setActive] = useState("my");
  const node = markets.find((n) => n.id === active) ?? markets[0];
  if (!node) return null;
  const insight = node.insight ? insights[node.insight] : undefined;
  const row = (id: string | null, label: string) => {
    const s = id ? instruments[id] : null;
    return (
      <div className="flex items-center justify-between gap-3 border-b border-rule-soft py-2.5">
        <span className="w-20 text-[11px] uppercase tracking-[0.12em] text-stone">{label}</span>
        {s ? (
          <>
            <span className="flex-1 text-[13px] font-semibold text-ink">
              {s.instrument.shortName} <StaleMark provenance={s.provenance} />
            </span>
            <span className="num text-[13px] text-ink">
              {formatValue(s.quote.value, s.instrument.decimals)}
              {s.instrument.unit === "%" ? "%" : ""}
            </span>
            <Change instrument={s.instrument} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} className="w-16 justify-end" />
          </>
        ) : (
          <span className="flex-1 text-right text-[12px] text-mist">{id ? "Unavailable" : prototype ? "Not in prototype dataset" : "Not monitored"}</span>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-8 md:grid-cols-12">
      <div className="relative md:col-span-7">
        <svg viewBox="0 0 100 100" className="aspect-[4/3] w-full md:aspect-square" role="img" aria-label="Schematic map of monitored markets">
          {/* lattice connectors: every market routes through the centre axis */}
          <g fill="none" stroke="var(--color-rule)" strokeWidth="0.35">
            <line x1="0" y1="50" x2="100" y2="50" strokeDasharray="0.6 1.4" />
            <line x1="50" y1="0" x2="50" y2="100" strokeDasharray="0.6 1.4" />
            {markets.map((n) => (
              <path key={n.id} d={`M50,50 L${n.x},50 L${n.x},${n.y}`} stroke={n.id === active ? "#b8955a" : "var(--color-rule)"} strokeWidth={n.id === active ? 0.6 : 0.35} style={{ transition: "stroke 300ms" }} />
            ))}
          </g>
          <path d="M50,46 Q50.7,49.3 54,50 Q50.7,50.7 50,54 Q49.3,50.7 46,50 Q49.3,49.3 50,46Z" fill="#b8955a" />
        </svg>
        {markets.map((n) => {
          const idx = n.index ? instruments[n.index] : null;
          const on = n.id === active;
          return (
            <button
              key={n.id}
              type="button"
              aria-pressed={on}
              onMouseEnter={() => setActive(n.id)}
              onFocus={() => setActive(n.id)}
              onClick={() => setActive(n.id)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 text-left"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <span className={`flex items-center gap-2 whitespace-nowrap border px-2.5 py-1.5 transition-all duration-300 ${on ? "scale-105 border-teal-800 bg-teal-800 text-white shadow-lg" : "border-rule bg-white text-ink hover:border-teal-600"}`}>
                <span className="whitespace-nowrap text-[12px] font-semibold">{n.name}</span>
                {idx && (
                  <span className={`num hidden text-[11px] sm:inline ${on ? "text-teal-100" : "text-stone"}`}>
                    {idx.quote.change >= 0 ? "▲" : "▼"} {Math.abs(idx.quote.changePct ?? 0).toFixed(2)}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="md:col-span-5" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={node.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone">Market</p>
            <h3 className="mt-2 font-serif text-[2rem] leading-tight text-teal-900">{node.name}</h3>
            <div className="mt-5 border-t border-rule">
              {row(node.index, "Index")}
              {row(node.currency, "Currency")}
              {row(node.rate, "10Y rate")}
            </div>
            {insight && (
              <Link href={`/insights/${insight.slug}`} className="group mt-6 block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone">Related insight</span>
                <span className="mt-1 block font-serif text-[1.2rem] leading-snug text-teal-900 group-hover:text-teal-700">{insight.title} →</span>
              </Link>
            )}
            <p className="mt-6 text-[11.5px] text-stone">{statusTitle(provenance)} data · day change. Market monitoring only.</p>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
