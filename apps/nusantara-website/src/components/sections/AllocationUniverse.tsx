"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { STAR_PATH } from "@/components/identity/NStar";
import { Change } from "@/components/market/Change";
import { StaleMark } from "@/components/market/MarketStatus";
import type { InsightListing } from "@/content/insights/types";
import { PROFILE_AXES, STATUS_INFO, type Strategy } from "@/content/strategies";
import { track } from "@/lib/analytics";
import { formatValue } from "@/lib/market/format";
import { statusPhrase } from "@/lib/market/status";
import type { DataProvenance, InstrumentSnapshot, IntelligenceIndicator } from "@/lib/market/types";
import { getUrlParam, routes, setUrlParam } from "@/lib/routes";

const LEVEL = ["Lower", "Moderate", "Higher"];

/**
 * The allocation universe: capabilities orbit the Nusantara lattice. Selecting
 * one connects it to the centre and changes the canvas — role, indicative
 * asset-class profile, risks, related markets and research. No capability is
 * presented as an active product.
 */
export function AllocationUniverse({
  strategies,
  instruments,
  indicators,
  insights,
  provenance,
}: {
  strategies: Strategy[];
  instruments: Record<string, InstrumentSnapshot>;
  indicators: Record<string, IntelligenceIndicator>;
  /** The most relevant visible insight per capability slug, resolved by the relationship engine. */
  insights: Record<string, InsightListing | null>;
  provenance: DataProvenance;
}) {
  const [active, setActiveIndex] = useState(0);
  // Deep links (/strategies?capability=precious-metals) open on that capability; choices are kept in the URL.
  useEffect(() => {
    const slug = getUrlParam("capability");
    const i = slug ? strategies.findIndex((x) => x.slug === slug) : -1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from URL once on mount
    if (i >= 0) setActiveIndex(i);
  }, [strategies]);
  const setActive = (i: number, fromUser = true) => {
    setActiveIndex(i);
    if (fromUser) setUrlParam("capability", strategies[i].slug);
  };
  const s = strategies[active];
  const n = strategies.length;
  const nodes = strategies.map((st, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { st, i, x: Math.round(Math.cos(a) * 150 * 100) / 100, y: Math.round(Math.sin(a) * 150 * 100) / 100 };
  });
  const sel = nodes[active];
  const insight = insights[s.slug] ?? null;

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
      {/* Selector */}
      <ol className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5 lg:col-span-3 lg:mx-0 lg:block lg:overflow-visible lg:px-0" role="tablist" aria-orientation="vertical" aria-label="Capabilities">
        {strategies.map((st, i) => {
          const on = i === active;
          return (
            <li key={st.slug} className="shrink-0">
              <button
                role="tab"
                aria-selected={on}
                aria-controls="universe-panel"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i, false)}
                className={`relative flex w-full items-baseline gap-3 border px-3 py-2 text-left lg:border-0 lg:border-b lg:border-rule lg:px-0 lg:py-3.5 ${on ? "border-teal-800" : "border-rule"}`}
              >
                <span className={`num text-[11px] ${on ? "text-gold-700" : "text-mist"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={`whitespace-nowrap font-serif text-[1.15rem] leading-tight transition-all duration-300 lg:whitespace-normal lg:text-[1.35rem] ${on ? "text-teal-900 lg:translate-x-1" : "text-teal-900/55 hover:text-teal-900"}`}>
                  {st.name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Canvas (desktop) */}
      <div className="hidden lg:col-span-4 lg:block">
        <svg viewBox="-200 -200 400 400" className="mx-auto aspect-square w-full max-w-[440px]" role="img" aria-label={`Allocation universe: ${s.name} selected`}>
          <circle r="150" fill="none" stroke="var(--color-rule)" strokeDasharray="1 5" />
          <circle r="96" fill="none" stroke="var(--color-rule-soft)" />
          <path d={STAR_PATH(12)} fill="#b8955a" />
          <m.line x1="0" y1="0" initial={false} animate={{ x2: sel.x, y2: sel.y }} transition={{ type: "spring", stiffness: 140, damping: 20 }} stroke="#b8955a" strokeWidth="1.4" />
          {nodes.map(({ st, i, x, y }) => {
            const on = i === active;
            const future = st.stage === "future-development";
            return (
              <g key={st.slug} transform={`translate(${x} ${y})`} onClick={() => setActive(i)} onMouseEnter={() => setActive(i, false)} className="cursor-pointer" aria-hidden>
                <circle r={on ? 20 : 15} fill={on ? "var(--color-teal-800)" : "var(--color-paper)"} stroke={future ? "var(--color-mist)" : "var(--color-teal-800)"} strokeDasharray={future ? "3 3" : undefined} style={{ transition: "r 300ms, fill 300ms" }} />
                <text dy="0.35em" textAnchor="middle" fontSize="11" fontWeight="600" fill={on ? "#fff" : "var(--color-teal-800)"} className="num">
                  {String(i + 1).padStart(2, "0")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Panel */}
      <div className="lg:col-span-5" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={s.slug} id="universe-panel" role="tabpanel" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.35 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone">
              {STATUS_INFO[s.stage].label}
              {s.status === "active-product" ? "" : " · not an offered product"}
            </p>
            <h3 className="display-m mt-3 text-teal-900">{s.name}</h3>
            <p className="mt-4 font-serif text-[1.35rem] italic leading-snug text-gold-700">{s.role}</p>

            <p className="eyebrow mt-8 text-stone">Key considerations</p>
            <ul className="mt-3 space-y-1.5">
              {s.characteristics.map((c) => (
                <li key={c} className="text-[15px] text-charcoal">
                  {c}
                </li>
              ))}
            </ul>

            {(s.markets.some((id) => instruments[id]) || s.indicators.some((id) => indicators[id])) && (
              <>
                <p className="eyebrow mt-8 text-stone">Market relationships · {statusPhrase(provenance)}</p>
                <ul className="mt-2">
                  {s.markets.map((id) => instruments[id]).filter(Boolean).map((x) => (
                    <li key={x.instrument.id} className="border-b border-rule-soft text-[13px]">
                      <Link
                        href={routes.market(x.instrument.id)}
                        aria-label={`${x.instrument.shortName}: open market view`}
                        className="group flex items-center justify-between gap-2 py-1.5 transition-colors hover:bg-white/70"
                      >
                        <span className="font-semibold group-hover:text-teal-700">
                          {x.instrument.shortName} <StaleMark provenance={x.provenance} />
                        </span>
                        <span className="num">
                          {formatValue(x.quote.value, x.instrument.decimals)}
                          {x.instrument.unit === "%" ? "%" : ""}
                        </span>
                        <Change instrument={x.instrument} change={x.quote.change} changePct={x.quote.changePct} changeBp={x.quote.changeBp} showAbsolute={false} />
                      </Link>
                    </li>
                  ))}
                  {s.indicators.map((id) => indicators[id]).filter(Boolean).map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2 border-b border-rule-soft py-1.5 text-[13px]">
                      <span>{x.title}</span>
                      <span className="num">
                        {formatValue(x.value, x.decimals)}
                        {x.unit ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {insight && (
              <Link href={`/insights/${insight.slug}`} className="group mt-8 block border-l-2 border-teal-800 bg-white px-5 py-4 hover:border-gold-500">
                <span className="eyebrow text-stone">Related insight</span>
                <span className="mt-1 block font-serif text-[1.2rem] text-teal-900 group-hover:text-teal-700">{insight.title} →</span>
              </Link>
            )}

            <Link
              href={`/strategies/${s.slug}`}
              onClick={() => track({ name: "capability_explored", capability: s.slug })}
              className="btn-fill mt-8 inline-flex h-11 items-center gap-3 border border-teal-800/40 px-5 text-[14px] font-medium text-teal-800 hover:text-white [--fill:var(--color-teal-800)]">
              Explore capability <span aria-hidden>→</span>
            </Link>

            <details className="group mt-8 border-t border-rule pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-teal-800 [&::-webkit-details-marker]:hidden">
                More detail
                <span aria-hidden className="transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 space-y-6">
                <p className="text-[14.5px] leading-relaxed text-charcoal">{s.overview}</p>
                <div>
                  <p className="eyebrow text-stone">Risk considerations</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] text-charcoal marker:text-gold-500">
                    {s.riskConsiderations.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow text-stone">Time horizon</p>
                  <p className="mt-2 text-[13.5px] text-stone">{s.timeHorizon ?? "To be confirmed on approval."}</p>
                </div>
        {/* Indicative profile */}
                <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-stone">Indicative asset-class profile</p>
          {s.profile ? (
            <dl className="mt-3 space-y-3">
              {PROFILE_AXES.map((ax) => {
                const v = s.profile![ax.key];
                return (
                  <div key={ax.key} className="grid grid-cols-[130px_1fr] items-center gap-3">
                    <dt className="text-[12.5px] text-charcoal">{ax.label}</dt>
                    <dd className="flex items-center gap-1" aria-label={`${ax.label}: ${v === 0 ? ax.low : v === 2 ? ax.high : "Moderate"}`}>
                      {[0, 1, 2].map((k) => (
                        <m.span key={k} className="block h-1.5 flex-1" initial={false} animate={{ backgroundColor: k <= v ? "#12384a" : "#e7e1d4" }} transition={{ duration: 0.4, delay: k * 0.05 }} />
                      ))}
                      <span className="ml-2 w-16 text-right text-[11px] text-stone">{v === 0 ? ax.low : v === 2 ? ax.high : LEVEL[1]}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="mt-3 text-[13px] text-stone">Not profiled — future review only.</p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-stone">General characteristics of the asset class, for orientation only. Not product terms; subject to management review.</p>
        </div>
              </div>
            </details>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
