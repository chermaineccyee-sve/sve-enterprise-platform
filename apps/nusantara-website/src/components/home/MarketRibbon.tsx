"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NStar } from "@/components/identity/NStar";
import { Change } from "@/components/market/Change";
import { StaleMark } from "@/components/market/MarketStatus";
import { track } from "@/lib/analytics";
import { useMarketTime } from "@/components/market/MarketTime";
import { formatTimestamp, formatValue } from "@/lib/market/format";
import { statusPhrase, statusTitle } from "@/lib/market/status";
import type { DataProvenance, InstrumentSnapshot } from "@/lib/market/types";
import { routes } from "@/lib/routes";
import { useOptionalMarketFocus } from "./MarketFocus";

/**
 * Market ribbon — the market snapshot ticker and, where a market-focus
 * provider exists (homepage, dashboard), the controller: selecting a market
 * updates the panel that responds to it. Click/tap, previous/next, arrow keys
 * (one tab stop; Home/End), trackpad or swipe; the selected market is kept in
 * view. Elsewhere each item opens that market in the dashboard.
 *
 * Desktop ticker: on wide screens with a hover pointer the strip drifts
 * slowly (~30 px/s) and loops seamlessly. It pauses while hovered, while
 * keyboard focus is inside it, while the visitor drags or scrolls it, and
 * while the tab is hidden (rAF stops); it eases back in about a second after
 * the interaction ends. Selecting a market does not stall it. With reduced
 * motion, and on touch / small screens, it never moves on its own.
 */
const TICKER_PX_PER_S = 30;
const TICKER_RESUME_MS = 1000;
const TICKER_EASE_MS = 600;
const TICKER_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
export function MarketRibbon({ instruments, provenance }: { instruments: InstrumentSnapshot[]; provenance: DataProvenance }) {
  const focus = useOptionalMarketFocus();
  const focusId = focus?.focusId ?? "";
  const listRef = useRef<HTMLUListElement>(null);
  const time = useMarketTime(provenance.status);

  // Ticker: enabled after mount on desktop with motion allowed (the server and first render are always still).
  const [ticker, setTicker] = useState(false);
  const hover = useRef(false);
  const focused = useRef(false);
  const dragging = useRef(false);
  const lastTouch = useRef(0);
  const pos = useRef(0);
  const nudge = () => {
    lastTouch.current = performance.now();
  };
  useEffect(() => {
    const mq = window.matchMedia(TICKER_QUERY);
    const apply = () => setTicker(mq.matches && instruments.length > 3);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [instruments.length]);
  useEffect(() => {
    const list = listRef.current;
    if (!ticker || !list) return;
    pos.current = list.scrollLeft;
    let raf = 0;
    let last = performance.now();
    let resumedAt = 0;
    let wasPaused = true;
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      // A manual scroll (trackpad, scrollbar, keep-in-view) moved the strip: follow it and wait before resuming.
      if (Math.abs(list.scrollLeft - pos.current) > 2) {
        pos.current = list.scrollLeft;
        nudge();
      }
      const paused = hover.current || focused.current || dragging.current || now - lastTouch.current < TICKER_RESUME_MS;
      if (paused) wasPaused = true;
      else {
        if (wasPaused) {
          wasPaused = false;
          resumedAt = now;
        }
        // Ease back to full speed rather than jumping.
        const ease = Math.min(1, (now - resumedAt) / TICKER_EASE_MS);
        const second = list.querySelector<HTMLElement>("li[data-copy='1']");
        const span = second ? second.offsetLeft - (list.firstElementChild as HTMLElement).offsetLeft : list.scrollWidth / 2;
        pos.current += (TICKER_PX_PER_S * ease * ease * dt) / 1000;
        if (pos.current >= span) pos.current -= span;
        list.scrollLeft = pos.current;
        pos.current = Math.abs(list.scrollLeft - pos.current) < 1 ? pos.current : list.scrollLeft;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ticker]);

  // Keep the selected market visible in the strip, whichever surface selected it (nearest copy when looping).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const copies = [...list.querySelectorAll<HTMLElement>(`[data-id="${focusId}"]`)];
    const el = copies.sort((a, b) => Math.abs(a.offsetLeft - list.scrollLeft) - Math.abs(b.offsetLeft - list.scrollLeft))[0];
    if (!el) return;
    const l = el.offsetLeft, r = l + el.offsetWidth;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (l < list.scrollLeft + 48 || r > list.scrollLeft + list.clientWidth - 64) list.scrollTo({ left: Math.max(0, l - 48), behavior });
  }, [focusId]);

  if (!instruments.length) return null;
  const asOf = instruments[0]?.provenance.asOf;
  const index = instruments.findIndex((s) => s.instrument.id === focusId);
  const illustrative = provenance.status === "illustrative";

  // Previous / next market (with a focus provider), otherwise move the strip.
  const select = (i: number, surface: "ribbon", moveFocus = false) => {
    const s = instruments[(i + instruments.length) % instruments.length];
    if (!s || !focus) return;
    focus.setFocus(s.instrument.id);
    track({ name: "market_selected", instrument: s.instrument.id, surface });
    if (moveFocus) listRef.current?.querySelector<HTMLButtonElement>(`li[data-copy='0'][data-id="${s.instrument.id}"] button`)?.focus({ preventScroll: true });
  };
  const page = (dir: 1 | -1) => {
    if (focus) select((index === -1 ? 0 : index) + dir, "ribbon");
    else listRef.current?.scrollBy({ left: dir * listRef.current.clientWidth * 0.8, behavior: "smooth" });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!focus) return;
    const i = index === -1 ? 0 : index;
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? instruments.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    select(to, "ribbon", true);
  };

  return (
    <section
      aria-label={`Market ribbon (${statusPhrase(provenance)} data)`}
      className="ribbon on-dark relative z-10 border-y border-white/10 bg-teal-950 text-white"
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => {
        hover.current = false;
        nudge();
      }}
      onFocus={() => (focused.current = true)}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        focused.current = false;
        nudge();
      }}
    >
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center gap-3 border-r border-white/10 bg-teal-950 px-4 md:px-6">
          <NStar className="star-breathe h-2.5 w-2.5 text-gold-400" />
          {illustrative ? (
            <span className="leading-tight">
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-gold-300">Market snapshot</span>
              <span className="num block text-[10.5px] text-teal-200">
                <span className="hidden sm:inline">{asOf ? `${time.snapshot(asOf)} · ` : ""}</span>Illustrative
              </span>
            </span>
          ) : (
            <span className="leading-tight">
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-gold-300">{statusTitle(provenance)}</span>
              <span className="num hidden text-[10.5px] text-teal-200 sm:block">{asOf ? formatTimestamp(asOf) : ""}</span>
            </span>
          )}
          <span className="ml-1 hidden items-center gap-1 md:flex">
            {([-1, 1] as const).map((d) => {
              const target = focus ? instruments[((index === -1 ? 0 : index) + d + instruments.length) % instruments.length]?.instrument.shortName : null;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => page(d)}
                  aria-label={focus ? `${d < 0 ? "Previous" : "Next"} market: ${target}` : d < 0 ? "Previous markets" : "More markets"}
                  className={`flex h-7 w-7 items-center justify-center border border-white/20 text-teal-100 transition-colors duration-200 hover:border-gold-300 hover:text-white ${d > 0 ? "order-3" : ""}`}
                >
                  <span aria-hidden>{d < 0 ? "‹" : "›"}</span>
                </button>
              );
            })}
            {focus && index !== -1 && (
              <span aria-hidden className="num order-2 w-12 text-center text-[10.5px] text-teal-200">
                {String(index + 1).padStart(2, "0")} / {String(instruments.length).padStart(2, "0")}
              </span>
            )}
          </span>
        </div>
        <div className="relative min-w-0 flex-1">
          <ul
            ref={listRef}
            className={`ribbon-track no-scrollbar flex overflow-x-auto ${ticker ? "" : "snap-x"}`}
            aria-label={focus ? "Markets — use arrow keys to select" : "Markets"}
            onKeyDown={onKeyDown}
            onWheel={nudge}
            onPointerDown={() => {
              dragging.current = true;
              nudge();
            }}
            onPointerUp={() => {
              dragging.current = false;
              nudge();
            }}
            onPointerCancel={() => {
              dragging.current = false;
              nudge();
            }}
          >
            {(ticker ? [0, 1] : [0]).flatMap((copy) =>
              instruments.map((s, i) => (
                <Item
                  key={`${copy}-${s.instrument.id}`}
                  s={s}
                  copy={copy}
                  on={focusId === s.instrument.id}
                  tabStop={copy === 0 && (focus ? (index === -1 ? i === 0 : i === index) : true)}
                  onSelect={focus ? (id) => focus.setFocus(id, { scroll: true }) : null}
                />
              )),
            )}
          </ul>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-teal-950 md:block" />
        </div>
      </div>
    </section>
  );
}

function Item({ s, copy, on, tabStop, onSelect }: { s: InstrumentSnapshot; copy: number; on: boolean; tabStop: boolean; onSelect: ((id: string) => void) | null }) {
  const inst = s.instrument;
  const cls = `group relative flex h-14 items-center gap-3 border-r border-white/10 px-6 text-left transition-colors duration-200 focus-visible:outline-offset-[-3px] ${on ? "bg-white/[0.1]" : "hover:bg-white/[0.05]"}`;
  const body = (
    <>
      {on && <NStar className="h-2 w-2 text-gold-400" />}
      <span className={`text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200 ${on ? "text-gold-200" : "text-white"}`}>{inst.shortName}</span>
      <span className="num text-[13px] text-teal-100">
        {formatValue(s.quote.value, inst.decimals)}
        {inst.unit === "%" ? "%" : ""}
      </span>
      <Change instrument={inst} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} tone="dark" />
      <StaleMark provenance={s.provenance} tone="dark" />
      <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[2px] bg-gold-400 transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0 group-hover:opacity-30"}`} />
    </>
  );
  const value = `${formatValue(s.quote.value, inst.decimals)}${inst.unit === "%" ? "%" : ""}`;
  // The second copy exists only to make the ticker loop seamlessly: hidden from assistive tech and not focusable.
  return (
    <li className="relative shrink-0 snap-start" data-id={inst.id} data-copy={copy} aria-hidden={copy === 1 || undefined} inert={copy === 1 || undefined}>
      {onSelect ? (
        <button
          type="button"
          tabIndex={tabStop ? 0 : -1}
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
