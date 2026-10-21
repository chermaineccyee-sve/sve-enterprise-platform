"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StateGauge } from "@/components/identity/StateGauge";
import { PRIMARY_LINE_DEEP as PRIMARY_LINE } from "@/components/market/chart-utils";
import { useMarketTime } from "@/components/market/MarketTime";
import { ViewEvidence, type EvidenceTab } from "@/components/market/ViewEvidence";
import { Change } from "@/components/market/Change";
import { Provenance, StaleMark } from "@/components/market/MarketStatus";
import { MorphChart } from "@/components/market/MorphChart";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { PublicationStamp } from "@/components/ui/PublicationStamp";
import { SAMPLE_LABELS } from "@/content/data/sample";
import type { MarketIntel } from "@/content/model/market-intel";
import { isPastReview } from "@/content/model/publication";
import { useNow } from "@/hooks/useNow";
import { track } from "@/lib/analytics";
import { resampleSeries } from "@/lib/market/analytics";
import { formatValue } from "@/lib/market/format";
import { ASSET_CLASS_LABELS } from "@/lib/market/instruments";
import { statusPhrase } from "@/lib/market/status";
import type { AssetClass, DataProvenance, InstrumentSnapshot, PricePoint } from "@/lib/market/types";
import { routes } from "@/lib/routes";
import { useMarketFocus } from "./MarketFocus";

const CLASSES: AssetClass[] = ["equities", "fx", "rates", "commodities"];
const N = 64;

/**
 * MARKET INTELLIGENCE — the homepage's market presence as one interactive
 * surface. Select a market (here, in the ribbon or in the hero monitor) and
 * the observed data and Nusantara's interpretation of it update together,
 * with routes onward to the dashboard, the Market State, research and
 * capabilities. Values come from the market-data service via props;
 * interpretation and relationships come from the content repository.
 */
export function MarketIntelligence({
  instruments,
  histories,
  intel,
  provenance,
}: {
  instruments: InstrumentSnapshot[];
  histories: Record<string, PricePoint[]>;
  intel: Record<string, MarketIntel>;
  provenance: DataProvenance;
}) {
  const { focusId, setFocus } = useMarketFocus();
  // Which part of the view's reasoning is shown; kept as the visitor moves between markets.
  const [evidence, setEvidence] = useState<EvidenceTab>("watching");
  // A brief gold line across the panel each time the market changes.
  const [sweep, setSweep] = useState(0);
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    setSweep((n) => n + 1);
  }, [focusId]);
  const selected = instruments.find((s) => s.instrument.id === focusId) ?? instruments[0];
  const classes = CLASSES.filter((c) => instruments.some((s) => s.instrument.assetClass === c));
  if (!selected) return null;
  const inst = selected.instrument;
  const pick = (id: string) => {
    setFocus(id);
    track({ name: "market_selected", instrument: id, surface: "rail" });
  };

  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)] border-t border-teal-800 lg:grid-cols-12">
      {sweep > 0 && <span key={sweep} aria-hidden className="focus-sweep" />}
      {/* SELECT MARKET */}
      <div className="border-b border-rule py-5 lg:col-span-3 lg:border-b-0 lg:border-r lg:py-6 lg:pr-6">
        <label htmlFor="mi-select" className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone lg:hidden">
          Select market
        </label>
        <select
          id="mi-select"
          value={inst.id}
          onChange={(e) => pick(e.target.value)}
          className="mt-2 block h-12 w-full border border-rule bg-white px-3 text-[16px] font-medium text-ink focus:border-teal-800 focus:outline-none lg:hidden"
        >
          {classes.map((c) => (
            <optgroup key={c} label={ASSET_CLASS_LABELS[c]}>
              {instruments
                .filter((s) => s.instrument.assetClass === c)
                .map((s) => (
                  <option key={s.instrument.id} value={s.instrument.id}>
                    {s.instrument.shortName} — {s.instrument.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        <div className="hidden lg:block">
          <div role="group" aria-label="Asset class" className="flex flex-wrap gap-1">
            {classes.map((c) => {
              const on = c === inst.assetClass;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pick(instruments.find((s) => s.instrument.assetClass === c)!.instrument.id)}
                  className={`relative h-8 px-3 text-[12px] font-medium ${on ? "text-white" : "text-charcoal hover:text-teal-800"}`}
                >
                  {on && <m.span layoutId="mi-class" className="absolute inset-0 bg-teal-800" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                  <span className="relative">{ASSET_CLASS_LABELS[c]}</span>
                </button>
              );
            })}
          </div>
          <ul role="group" aria-label="Markets" className="mt-4 border-t border-rule-soft">
            {instruments
              .filter((s) => s.instrument.assetClass === inst.assetClass)
              .map((s) => {
                const on = s.instrument.id === inst.id;
                return (
                  <li key={s.instrument.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => pick(s.instrument.id)}
                      className={`relative grid w-full grid-cols-[1fr_auto] items-center gap-x-3 border-b border-rule-soft px-3 py-3 text-left lg:py-2.5 transition-colors duration-300 ${on ? "bg-white" : "hover:bg-white/60"}`}
                    >
                      {on && <m.span layoutId="mi-row" className="absolute inset-y-0 left-0 w-[2px] bg-teal-800" />}
                      <span className="text-[13.5px] font-semibold text-ink">
                        {s.instrument.shortName} <StaleMark provenance={s.provenance} />
                      </span>
                      <Change instrument={s.instrument} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} className="justify-end text-[12px]" />
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>

      {/* OBSERVED — market data */}
      <Observed snap={selected} points={histories[inst.id] ?? []} provenance={provenance} />

      {/* INTERPRETATION — Nusantara View */}
      <Interpretation id={inst.id} name={inst.shortName} intel={intel[inst.id]} evidence={evidence} onEvidence={setEvidence} />
    </div>
  );
}

function Observed({ snap, points, provenance }: { snap: InstrumentSnapshot; points: PricePoint[]; provenance: DataProvenance }) {
  const inst = snap.instrument;
  const unit = inst.unit === "%" ? "%" : "";
  const fmt = (v: number) => `${formatValue(v, inst.decimals)}${unit}`;
  const { values, stamps } = useMemo(() => resampleSeries(points, N), [points]);
  const time = useMarketTime(snap.provenance.status);
  return (
    <section aria-label="Market data" className="min-w-0 py-6 lg:col-span-5 lg:px-8 lg:py-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-teal-800">
        Market data <span className="font-normal normal-case tracking-normal text-stone">· observed · {statusPhrase(provenance)}</span>
      </p>
      <p className="mt-4 text-[13px] text-stone lg:mt-3">
        {inst.name} <span className="num">· {inst.ticker}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="text-[2.4rem] font-medium leading-none tracking-tight text-ink md:text-[2.8rem] lg:text-[2.5rem]">
          <AnimatedNumber value={snap.quote.value} format={fmt} />
        </p>
        <div className="sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.08em] text-stone">Day change</p>
          <Change instrument={inst} change={snap.quote.change} changePct={snap.quote.changePct} changeBp={snap.quote.changeBp} size="md" className="mt-1 sm:justify-end" />
        </div>
      </div>
      <div className="mt-5 lg:mt-4">
        {values.length > 1 ? (
          <MorphChart
            tone="dark"
            series={[{ id: "mi", label: inst.shortName, color: PRIMARY_LINE, values }]}
            labels={stamps.map((t) => time.stamp(t, { time: false }))}
            format={fmt}
            height={170}
            ariaLabel={`${inst.name}, one month, ${statusPhrase(snap.provenance)}. Hover or use arrow keys to read values.`}
          />
        ) : (
          <div className="flex h-[170px] items-center justify-center border border-dashed border-rule text-[13px] text-stone">One-month history is unavailable.</div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:mt-3">
        <Provenance provenance={snap.provenance} />
        <Link href={routes.market(inst.id)} className="link-underline text-[13.5px] font-medium text-teal-800" onClick={() => track({ name: "market_selected", instrument: inst.id, surface: "link" })}>
          Open market view →
        </Link>
      </div>
    </section>
  );
}

/** Conclusion first (signal, stance, context, related research); the reasoning one tab at a time. */
function Interpretation({
  id,
  name,
  intel,
  evidence,
  onEvidence,
}: {
  id: string;
  name: string;
  intel: MarketIntel | undefined;
  evidence: EvidenceTab;
  onEvidence: (t: EvidenceTab) => void;
}) {
  const now = useNow();
  const view = intel?.view && !(now !== null && isPastReview(intel.view, now)) ? intel.view : null;
  return (
    <section aria-label="Nusantara View" className="on-dark min-w-0 bg-teal-900 px-5 py-6 text-white md:px-8 lg:col-span-4 lg:py-6">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white">Nusantara View</p>
      {view && !view.sample ? <PublicationStamp p={view} tone="dark" className="mt-1" /> : <p className="mt-1 text-[11px] font-medium tracking-[0.04em] text-gold-200">{SAMPLE_LABELS.interpretation}</p>}
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {view ? (
            <>
              {view.signal && (
                <div className="mt-6 lg:mt-4">
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-gold-300">Signal</p>
                  <p className="mt-1 font-serif text-[2rem] leading-none text-white lg:text-[1.8rem]">{view.signal}</p>
                  {view.stance && (
                    <div className="mt-4 lg:mt-3">
                      <StateGauge id={`mi-${id}`} scale={view.stance.scale} position={view.stance.position} showLabels tone="dark" />
                    </div>
                  )}
                </div>
              )}
              <Block label="Context">{view.context}</Block>
            </>
          ) : (
            <p className="mt-6 text-[14px] leading-relaxed text-teal-100" role="status">
              There is no current Nusantara View for {name}.
            </p>
          )}
          {intel?.insight && (
            <div className="mt-5 border-t border-white/10 pt-4 lg:mt-3.5 lg:pt-3">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-teal-200">Related insight</p>
              <Link href={`/insights/${intel.insight.slug}`} className="group mt-1.5 block font-serif text-[1.12rem] leading-snug text-white hover:text-gold-200">
                {intel.insight.title} →
              </Link>
            </div>
          )}
          {view && <ViewEvidence view={view} tab={evidence} onTab={onEvidence} className="mt-5 lg:mt-3.5" />}
          <Connected intel={intel} />
        </m.div>
      </AnimatePresence>
    </section>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-white/10 pt-4 lg:mt-3.5 lg:pt-3">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-teal-200">{label}</p>
      <p className="mt-1.5 text-[14.5px] leading-snug text-teal-50">{children}</p>
    </div>
  );
}

/** Where this market leads next in the information chain. Rendered only when there is something to connect. */
export function Connected({ intel, className = "" }: { intel: MarketIntel | undefined; className?: string }) {
  if (!intel || (!intel.dimensions.length && !intel.capabilities.length)) return null;
  return (
    <dl className={`mt-5 grid gap-2 border-t border-white/10 pt-4 text-[12.5px] lg:mt-3.5 lg:gap-1.5 lg:pt-3 ${className}`}>
      {intel.dimensions.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-teal-200">Market State</dt>
          <dd className="flex flex-wrap gap-x-2">
            {intel.dimensions.map((d, i) => (
              <span key={d.id}>
                <Link href={routes.dimension(d.id)} className="link-underline text-white hover:text-gold-200">
                  {d.label}: {d.state.toLowerCase()}
                </Link>
                {i < intel.dimensions.length - 1 ? <span className="text-teal-300"> ·</span> : null}
              </span>
            ))}
          </dd>
        </div>
      )}
      {intel.capabilities.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-teal-200">Capability</dt>
          <dd className="flex flex-wrap gap-x-2">
            {intel.capabilities.map((c, i) => (
              <span key={c.slug}>
                <Link href={routes.capability(c.slug)} className="link-underline text-white hover:text-gold-200">
                  {c.name}
                </Link>
                {i < intel.capabilities.length - 1 ? <span className="text-teal-300"> ·</span> : null}
              </span>
            ))}
          </dd>
        </div>
      )}
    </dl>
  );
}
