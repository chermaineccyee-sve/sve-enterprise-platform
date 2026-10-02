"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { NStar } from "@/components/identity/NStar";
import { Change } from "@/components/market/Change";
import { StaleMark } from "@/components/market/MarketStatus";
import { track } from "@/lib/analytics";
import { formatTimestamp, formatValue } from "@/lib/market/format";
import { statusPhrase, statusTitle } from "@/lib/market/status";
import type { DataProvenance, InstrumentSnapshot } from "@/lib/market/types";
import { routes } from "@/lib/routes";
import { useOptionalMarketFocus } from "./MarketFocus";

/**
 * Market ribbon — a still, selectable strip (no ticker movement). Where a
 * market-focus provider exists (homepage, dashboard) selecting a market
 * updates the panel that responds to it; elsewhere each item opens that
 * market in the dashboard. Prev/next controls and swipe reveal more markets.
 */
export function MarketRibbon({ instruments, provenance }: { instruments: InstrumentSnapshot[]; provenance: DataProvenance }) {
  const focus = useOptionalMarketFocus();
  const focusId = focus?.focusId ?? "";
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the selected market visible in the strip, whichever surface selected it.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${focusId}"]`);
    const list = listRef.current;
    if (!el || !list) return;
    const l = el.offsetLeft, r = l + el.offsetWidth;
    if (l < list.scrollLeft || r > list.scrollLeft + list.clientWidth) list.scrollTo({ left: l - 24, behavior: "smooth" });
  }, [focusId]);

  if (!instruments.length) return null;
  const asOf = instruments[0]?.provenance.asOf;
  const page = (dir: 1 | -1) => listRef.current?.scrollBy({ left: dir * listRef.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section aria-label={`Market ribbon (${statusPhrase(provenance)} data)`} className="ribbon on-dark relative z-10 border-y border-white/10 bg-teal-950 text-white">
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center gap-3 border-r border-white/10 bg-teal-950 px-4 md:px-6">
          <NStar className="star-breathe h-2.5 w-2.5 text-gold-400" />
          <span className="leading-tight">
            <span className="block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-gold-300">{statusTitle(provenance)}</span>
            <span className="num hidden text-[10.5px] text-teal-200 sm:block">{asOf ? formatTimestamp(asOf) : ""}</span>
          </span>
          <span className="ml-1 hidden gap-1 md:flex">
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => page(d)}
                aria-label={d < 0 ? "Previous markets" : "More markets"}
                className="flex h-7 w-7 items-center justify-center border border-white/20 text-teal-100 hover:border-gold-300 hover:text-white"
              >
                <span aria-hidden>{d < 0 ? "‹" : "›"}</span>
              </button>
            ))}
          </span>
        </div>
        <div className="relative min-w-0 flex-1">
          <ul ref={listRef} className="ribbon-track no-scrollbar flex snap-x overflow-x-auto scroll-smooth" aria-label="Markets">
            {instruments.map((s) => (
              <Item key={s.instrument.id} s={s} on={focusId === s.instrument.id} onSelect={focus ? (id) => focus.setFocus(id, { scroll: true }) : null} />
            ))}
          </ul>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-teal-950 md:block" />
        </div>
      </div>
    </section>
  );
}

function Item({ s, on, onSelect }: { s: InstrumentSnapshot; on: boolean; onSelect: ((id: string) => void) | null }) {
  const inst = s.instrument;
  const cls = `group relative flex h-14 items-center gap-3 border-r border-white/10 px-6 text-left transition-colors duration-300 ${on ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`;
  const body = (
    <>
      {on && <NStar className="h-2 w-2 text-gold-400" />}
      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white">{inst.shortName}</span>
      <span className="num text-[13px] text-teal-100">
        {formatValue(s.quote.value, inst.decimals)}
        {inst.unit === "%" ? "%" : ""}
      </span>
      <Change instrument={inst} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} tone="dark" />
      <StaleMark provenance={s.provenance} tone="dark" />
      <span aria-hidden className={`absolute inset-x-6 bottom-0 h-[2px] bg-gold-400 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`} />
    </>
  );
  const value = `${formatValue(s.quote.value, inst.decimals)}${inst.unit === "%" ? "%" : ""}`;
  return (
    <li className="relative shrink-0 snap-start" data-id={inst.id}>
      {onSelect ? (
        <button
          type="button"
          aria-pressed={on}
          aria-label={`${inst.shortName} ${value}. Show Nusantara view`}
          onClick={() => {
            onSelect(inst.id);
            track({ name: "market_selected", instrument: inst.id, surface: "ribbon" });
          }}
          className={cls}
        >
          {body}
        </button>
      ) : (
        <Link
          href={routes.market(inst.id)}
          aria-label={`${inst.shortName} ${value}. Open market view`}
          className={cls}
          onClick={() => track({ name: "market_selected", instrument: inst.id, surface: "link" })}
        >
          {body}
        </Link>
      )}
    </li>
  );
}
