"use client";

import Link from "next/link";
import { useState } from "react";
import { NStar } from "@/components/identity/NStar";
import { Change } from "@/components/market/Change";
import { formatTimestamp, formatValue } from "@/lib/market/format";
import type { InstrumentSnapshot } from "@/lib/market/types";
import { useOptionalMarketFocus } from "./MarketFocus";

function Item({ s, hidden, on, onSelect }: { s: InstrumentSnapshot; hidden?: boolean; on: boolean; onSelect: ((id: string) => void) | null }) {
  const inst = s.instrument;
  const cls = `group flex h-14 items-center gap-3 border-r border-white/10 px-6 text-left transition-colors ${on ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`;
  const label = `${inst.shortName} ${formatValue(s.quote.value, inst.decimals)}. Open in Market Dashboard`;
  const body = (
    <>
        {on && <NStar className="h-2 w-2 text-gold-400" />}
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white">{inst.shortName}</span>
        <span className="num text-[13px] text-teal-100">
          {formatValue(s.quote.value, inst.decimals)}
          {inst.unit === "%" ? "%" : ""}
        </span>
        <Change instrument={inst} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} tone="dark" />
    </>
  );
  return (
    <li className="relative shrink-0 snap-start" aria-hidden={hidden || undefined}>
      {onSelect ? (
        <button type="button" tabIndex={hidden ? -1 : 0} onClick={() => onSelect(inst.id)} aria-label={label} className={cls}>
          {body}
        </button>
      ) : (
        <Link href={`/market-dashboard?instrument=${inst.id}`} tabIndex={hidden ? -1 : 0} aria-label={label} className={cls}>
          {body}
        </Link>
      )}
    </li>
  );
}

/**
 * Continuous market ribbon. Moves on larger screens (pauses on hover, focus,
 * or via the pause control; static under reduced motion). On mobile it is a
 * swipeable, snap-scrolling carousel. On the dashboard, selecting a market
 * selects it in the workspace; elsewhere it opens the dashboard on that market.
 */
export function MarketRibbon({ instruments }: { instruments: InstrumentSnapshot[] }) {
  const focus = useOptionalMarketFocus();
  const focusId = focus?.focusId ?? "";
  const [paused, setPaused] = useState(false);
  const asOf = instruments[0]?.provenance.asOf;
  const select = focus ? (id: string) => focus.setFocus(id, { scroll: true }) : null;

  return (
    <section aria-label="Market ribbon (illustrative data)" className="on-dark relative z-10 border-y border-white/10 bg-teal-950 text-white">
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center gap-3 border-r border-white/10 bg-teal-950 px-4 md:px-6">
          <NStar className="star-breathe h-2.5 w-2.5 text-gold-400" />
          <span className="leading-tight">
            <span className="block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-gold-300">Illustrative</span>
            <span className="num hidden text-[10.5px] text-teal-200 sm:block">{asOf ? formatTimestamp(asOf) : ""}</span>
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className="ml-1 hidden h-7 w-7 items-center justify-center border border-white/20 text-teal-100 hover:border-gold-300 hover:text-white md:flex"
            aria-label={paused ? "Resume market ribbon" : "Pause market ribbon"}
          >
            {paused ? (
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
                <path d="M2 1l7 4-7 4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
                <rect x="1.5" y="1" width="2.5" height="8" />
                <rect x="6" y="1" width="2.5" height="8" />
              </svg>
            )}
          </button>
        </div>

        {/* Desktop/tablet: continuous ribbon */}
        <div className="ribbon relative hidden min-w-0 flex-1 overflow-hidden md:block" data-paused={paused}>
          <ul className="ribbon-track flex w-max motion-reduce:hidden" style={{ ["--ribbon-duration" as string]: `${instruments.length * 5.5}s` }}>
            {instruments.map((s) => (
              <Item key={s.instrument.id} s={s} on={focusId === s.instrument.id} onSelect={select} />
            ))}
            {instruments.map((s) => (
              <Item key={`dup-${s.instrument.id}`} s={s} hidden on={focusId === s.instrument.id} onSelect={select} />
            ))}
          </ul>
          {/* Reduced motion: plain horizontal scroll */}
          <ul className="no-scrollbar hidden overflow-x-auto motion-reduce:flex">
            {instruments.map((s) => (
              <Item key={`rm-${s.instrument.id}`} s={s} on={focusId === s.instrument.id} onSelect={select} />
            ))}
          </ul>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-teal-950" />
        </div>

        {/* Mobile: swipeable carousel */}
        <ul className="no-scrollbar flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto md:hidden" aria-label="Markets — swipe for more">
          {instruments.map((s) => (
            <Item key={`m-${s.instrument.id}`} s={s} on={focusId === s.instrument.id} onSelect={select} />
          ))}
        </ul>
      </div>
    </section>
  );
}
