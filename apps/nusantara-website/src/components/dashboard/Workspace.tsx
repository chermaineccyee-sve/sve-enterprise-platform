"use client";

import { AnimatePresence, m, useInView } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMarketFocus } from "@/components/home/MarketFocus";
import { StateGauge } from "@/components/identity/StateGauge";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Change } from "@/components/market/Change";
import { PRIMARY_LINE_DEEP as PRIMARY_LINE, SERIES_COLORS_DEEP as SERIES_COLORS } from "@/components/market/chart-utils";
import { Provenance, StaleMark, useIsStale } from "@/components/market/MarketStatus";
import { MarketTable } from "@/components/market/MarketTable";
import { MorphChart } from "@/components/market/MorphChart";
import { Sparkline } from "@/components/market/Sparkline";
import { PublicationStamp } from "@/components/ui/PublicationStamp";
import { SAMPLE_LABELS } from "@/content/data/sample";
import type { NusantaraView } from "@/content/model/intelligence";
import { isPastReview } from "@/content/model/publication";
import { useHistories, useMarketHistory } from "@/hooks/useMarketData";
import { useNow } from "@/hooks/useNow";
import { useMarketTime } from "@/components/market/MarketTime";
import { ViewEvidence, type EvidenceTab } from "@/components/market/ViewEvidence";
import { track } from "@/lib/analytics";
import { getUrlParam, setUrlParam } from "@/lib/routes";
import { realisedVol, resample, resampleSeries, seriesChange } from "@/lib/market/analytics";
import { changeOverPeriod, formatPct, formatTimestamp, formatValue, signed } from "@/lib/market/format";
import { ASSET_CLASS_LABELS, OVERVIEW_INSTRUMENT_IDS } from "@/lib/market/instruments";
import { statusPhrase, statusTitle } from "@/lib/market/status";
import {
  CHART_PERIODS,
  type AssetClass,
  type ChartPeriod,
  type DataProvenance,
  type InstrumentDefinition,
  type InstrumentHistory,
  type InstrumentSnapshot,
  type IntelligenceIndicator,
  type MarketSnapshot,
  type UnavailableInstrument,
} from "@/lib/market/types";
import { ConnectedIntel } from "./ConnectedIntel";
import type { DimensionPreview, MarketIntel } from "./types";

type Category = "overview" | AssetClass | "macro";
const CATEGORIES: { id: Category; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "equities", label: ASSET_CLASS_LABELS.equities },
  { id: "fx", label: ASSET_CLASS_LABELS.fx },
  { id: "rates", label: ASSET_CLASS_LABELS.rates },
  { id: "commodities", label: ASSET_CLASS_LABELS.commodities },
  { id: "macro", label: "Macro & structural" },
];
const N = 96;
const MAX_COMPARE = 4;

type Props = {
  snapshot: MarketSnapshot;
  initialHistory: InstrumentHistory[];
  indicators: IntelligenceIndicator[];
  /** Nusantara View, related markets and research per instrument id (resolved on the server). */
  intel: Record<string, MarketIntel>;
  /** Nusantara reading per structural indicator id. */
  readings: Record<string, NusantaraView>;
  /** Published Market State dimensions by id, for the inline preview (empty when no edition may be shown). */
  dimensions: Record<string, DimensionPreview>;
};

type RailRow = InstrumentSnapshot | UnavailableInstrument;
const isAvailable = (r: RailRow): r is InstrumentSnapshot => "quote" in r;

const UNAVAILABLE_REASON: Record<UnavailableInstrument["reason"], string> = {
  "service-unavailable": "The market-data service is currently unavailable.",
  "not-supplied": "No value is available from the current source.",
  "not-licensed": "Not licensed for public display.",
  invalid: "The latest value failed validation and is not shown.",
};

/**
 * The Market Dashboard as an intelligence workspace: a market rail, a centre
 * chart that morphs between datasets, and a Nusantara View panel that
 * responds to every selection. Nothing reloads.
 */
export function Workspace(props: Props) {
  if (!props.snapshot.instruments.length) return <WorkspaceUnavailable provenance={props.snapshot.provenance} />;
  return <WorkspaceBody {...props} />;
}

/** API or provider unavailable: an explicit state, never a broken chart or invented numbers. */
function WorkspaceUnavailable({ provenance }: { provenance: DataProvenance }) {
  return (
    <div className="border-y border-rule bg-white lg:border">
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-6 py-16 text-center" role="status">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-teal-800">Market data unavailable</p>
        <p className="max-w-md text-[15px] leading-relaxed text-charcoal">
          Market data cannot be shown at the moment. No values are displayed rather than out-of-date or estimated figures.
        </p>
        <Provenance provenance={provenance} className="justify-center" />
      </div>
    </div>
  );
}

function WorkspaceBody({ snapshot, initialHistory, indicators, intel, readings, dimensions }: Props) {
  const { focusId, setFocus } = useMarketFocus();
  // Which part of the view's reasoning is shown; kept as the visitor moves between markets.
  const [evidence, setEvidence] = useState<EvidenceTab>("watching");
  // The Market State dimension previewed inline (null = closed).
  const [openDim, setOpenDim] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("overview");
  const [period, setPeriod] = useState<ChartPeriod>("1M");
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [compare, setCompare] = useState<string[]>(["klci", "sti", "spx"]);
  const [indicatorId, setIndicatorId] = useState(indicators[0]?.id ?? "");
  const [view, setView] = useState<"chart" | "table">("chart");
  const { byId, loading, error: historyError } = useMarketHistory(period, { period: "1M", data: initialHistory });
  const dataPhrase = statusPhrase(snapshot.provenance);
  const dataTitle = statusTitle(snapshot.provenance);
  const changePeriod = (p: ChartPeriod) => {
    setPeriod(p);
    track({ name: "period_changed", period: p });
  };

  // Open on a market linked from elsewhere (e.g. /market-dashboard?instrument=gold).
  useEffect(() => {
    const id = getUrlParam("instrument");
    const inst = id
      ? (snapshot.instruments.find((s) => s.instrument.id === id) ?? snapshot.unavailable.find((u) => u.instrument.id === id))?.instrument
      : undefined;
    if (inst) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from URL once on mount
      setCategory(inst.assetClass);
      setFocus(inst.id);
    }
  }, [snapshot.instruments, snapshot.unavailable, setFocus]);

  const all = snapshot.instruments;
  const unavailable = snapshot.unavailable;
  const railRows = useMemo<RailRow[]>(() => {
    const byId = new Map<string, RailRow>([...unavailable, ...all].map((r) => [r.instrument.id, r]));
    if (category === "overview") return OVERVIEW_INSTRUMENT_IDS.map((id) => byId.get(id)).filter((r): r is RailRow => !!r);
    if (category === "macro") return [];
    return [...byId.values()].filter((r) => r.instrument.assetClass === category).sort((a, b) => order(a) - order(b));
    function order(r: RailRow) {
      const i = all.findIndex((s) => s.instrument.id === r.instrument.id);
      return i === -1 ? 1000 + unavailable.findIndex((u) => u.instrument.id === r.instrument.id) : i;
    }
  }, [all, unavailable, category]);
  const rows = useMemo(() => railRows.filter(isAvailable), [railRows]);

  const isMacro = category === "macro" && indicators.length > 0;

  // When a market is chosen elsewhere (ribbon, map, related markets), the rail follows it.
  // Not on first render: the initial category is the visitor's (or the URL's) choice.
  const lastFocus = useRef(focusId);
  useEffect(() => {
    if (lastFocus.current === focusId) return;
    lastFocus.current = focusId;
    const cls = all.find((x) => x.instrument.id === focusId)?.instrument.assetClass;
    if (!cls) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow an external selection
    setCategory((c) => (c === "overview" && OVERVIEW_INSTRUMENT_IDS.includes(focusId)) || c === cls ? c : cls);
  }, [focusId, all]);

  // A previewed dimension stays open while the selected market belongs to it (e.g. chosen from its supporting markets).
  useEffect(() => {
    if (!openDim) return;
    const related = intel[focusId]?.dimensions.some((d) => d.id === openDim) || dimensions[openDim]?.supportingMarkets.includes(focusId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close a preview that no longer relates to the selection
    if (!related) setOpenDim(null);
  }, [focusId, openDim, intel, dimensions]);

  // A brief gold line across the workspace each time the market changes: the analytical environment has moved.
  const [sweep, setSweep] = useState(0);
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    setSweep((n) => n + 1);
  }, [focusId]);

  // The selected instrument persists in the URL, so a market view can be shared, bookmarked or reloaded.
  const urlSynced = useRef(false);
  useEffect(() => {
    if (!urlSynced.current) {
      urlSynced.current = true;
      if (!getUrlParam("instrument")) return; // leave a clean URL until the visitor chooses
    }
    setUrlParam("instrument", focusId);
  }, [focusId]);
  const focusUnavailable = unavailable.find((u) => u.instrument.id === focusId) ?? null;
  const selected = all.find((s) => s.instrument.id === focusId) ?? all[0];
  const focusInst: InstrumentDefinition = focusUnavailable?.instrument ?? selected.instrument;
  const indicator = indicators.find((i) => i.id === indicatorId) ?? indicators[0];
  const names = useMemo(() => Object.fromEntries(all.map((x) => [x.instrument.id, x.instrument.shortName])), [all]);

  // Previous / next market, in the ribbon's order (mobile stepper and swipe).
  const step = (dir: 1 | -1, surface: "stepper" | "swipe") => {
    const i = all.findIndex((x) => x.instrument.id === focusInst.id);
    const next = all[(i + dir + all.length) % all.length];
    if (!next) return;
    setMode("single");
    setView("chart");
    setFocus(next.instrument.id);
    track({ name: "market_selected", instrument: next.instrument.id, surface });
  };

  const pick = (id: string) => {
    if (mode === "compare") {
      const s = all.find((x) => x.instrument.id === id);
      if (s?.instrument.convention === "yield") return;
      setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id]));
    } else {
      setFocus(id);
      track({ name: "market_selected", instrument: id, surface: "rail" });
    }
  };

  return (
    <div className="relative border-y border-rule bg-white lg:border">
      {sweep > 0 && <span key={sweep} aria-hidden className="focus-sweep" />}
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_360px]">
        {/* RAIL */}
        <aside aria-label="Market universe" className="hidden border-rule bg-paper lg:row-span-3 lg:block lg:border-r xl:row-span-2">
          <div role="tablist" aria-label="Category" className="no-scrollbar flex overflow-x-auto lg:flex-col lg:overflow-visible">
            {CATEGORIES.filter((c) => c.id !== "macro" || indicators.length > 0).map((c) => {
              const on = c.id === category;
              return (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setCategory(c.id)}
                  className={`relative flex shrink-0 items-center justify-between gap-3 px-5 py-3 text-left text-[13.5px] font-medium transition-colors lg:border-b lg:border-rule-soft ${
                    on ? "text-teal-900" : "text-stone hover:text-teal-800"
                  }`}
                >
                  {on && <m.span layoutId="rail-cat" className="absolute inset-x-0 bottom-0 h-[2px] bg-gold-500 lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-[2px]" />}
                  <span>{c.label}</span>
                  <span className="num hidden text-[11px] text-mist lg:inline">
                    {c.id === "macro"
                      ? indicators.length
                      : c.id === "overview"
                        ? OVERVIEW_INSTRUMENT_IDS.length
                        : [...all, ...unavailable].filter((s) => s.instrument.assetClass === c.id).length}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-rule">
            <p className="flex items-center justify-between px-5 pt-4 text-[10.5px] font-medium uppercase tracking-[0.08em] text-stone">
              <span>{isMacro ? "Indicators" : mode === "compare" ? `Compare · ${compare.length}/${MAX_COMPARE}` : "Instruments"}</span>
            </p>
            <ul className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:max-h-[560px] lg:space-y-0.5 lg:overflow-y-auto lg:overflow-x-hidden">
              {isMacro
                ? indicators.map((ind) => {
                    const on = ind.id === indicator?.id;
                    return (
                      <li key={ind.id} className="shrink-0 lg:shrink">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setIndicatorId(ind.id)}
                          className={`relative w-full px-3 py-2.5 text-left transition-colors ${on ? "bg-white" : "hover:bg-white/60"}`}
                        >
                          {on && <m.span layoutId="rail-row" className="absolute inset-y-0 left-0 w-[2px] bg-teal-800" />}
                          <span className="block text-[10.5px] uppercase tracking-[0.08em] text-stone">{ind.category}</span>
                          <span className="mt-0.5 block whitespace-nowrap text-[13px] text-ink lg:whitespace-normal">{ind.title}</span>
                        </button>
                      </li>
                    );
                  })
                : railRows.map((s) => {
                    const inst = s.instrument;
                    if (!isAvailable(s)) {
                      return (
                        <li key={inst.id} className="shrink-0 lg:shrink">
                          <div className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-3 py-2.5 opacity-60" title={UNAVAILABLE_REASON[s.reason]}>
                            <span className="whitespace-nowrap text-[13px] font-semibold text-ink">{inst.shortName}</span>
                            <span className="text-right text-[11.5px] text-stone">Unavailable</span>
                          </div>
                        </li>
                      );
                    }
                    const on = mode === "single" ? inst.id === focusInst.id : compare.includes(inst.id);
                    const disabled = mode === "compare" && (inst.convention === "yield" || (!on && compare.length >= MAX_COMPARE));
                    return (
                      <li key={inst.id} className="shrink-0 lg:shrink">
                        <button
                          type="button"
                          aria-pressed={on}
                          disabled={disabled}
                          onClick={() => pick(inst.id)}
                          className={`relative grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
                            on ? "bg-white" : "hover:bg-white/60"
                          }`}
                        >
                          {on && <m.span layoutId="rail-row" className="absolute inset-y-0 left-0 w-[2px] bg-teal-800" />}
                          <span className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-ink">
                            {mode === "compare" && (
                              <span
                                aria-hidden
                                className="block h-2.5 w-2.5 border border-teal-800/40"
                                style={on ? { background: SERIES_COLORS[compare.indexOf(inst.id)], borderColor: "transparent" } : undefined}
                              />
                            )}
                            {inst.shortName}
                            <StaleMark provenance={s.provenance} />
                          </span>
                          <span className="num text-right text-[12.5px] text-charcoal">
                            {formatValue(s.quote.value, inst.decimals)}
                            {inst.unit === "%" ? "%" : ""}
                          </span>
                          <span className="hidden lg:block">
                            <Sparkline values={(byId.get(inst.id) ?? []).map((p) => p.v)} width={110} height={18} baseline={false} area={false} label={`${inst.shortName} trend`} className="text-teal-800" />
                          </span>
                          <Change instrument={inst} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} className="hidden justify-end text-[11.5px] lg:flex" />
                        </button>
                      </li>
                    );
                  })}
            </ul>
          </div>
        </aside>

        {/* Mobile instrument selector */}
        <div className="border-b border-rule bg-paper px-5 py-4 lg:hidden">
          {!focusUnavailable && <MarketStepper all={all} current={selected} onStep={step} />}
          <label htmlFor="ws-instrument" className="mt-4 block text-[11px] font-medium uppercase tracking-[0.08em] text-stone">
            Instrument
          </label>
          <select
            id="ws-instrument"
            value={focusInst.id}
            onChange={(e) => {
              const id = e.target.value;
              const cls = all.find((x) => x.instrument.id === id)?.instrument.assetClass;
              if (cls) setCategory(cls);
              setMode("single");
              setView("chart");
              setFocus(id);
              track({ name: "market_selected", instrument: id, surface: "select" });
            }}
            className="mt-2 block h-12 w-full border border-rule bg-white px-3 text-[16px] font-medium text-ink focus:border-teal-800 focus:outline-none"
          >
            {(["equities", "fx", "rates", "commodities"] as AssetClass[]).map((c) => (
              <optgroup key={c} label={ASSET_CLASS_LABELS[c]}>
                {all
                  .filter((x) => x.instrument.assetClass === c)
                  .map((x) => (
                    <option key={x.instrument.id} value={x.instrument.id}>
                      {x.instrument.shortName} — {x.instrument.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* CENTRE — market data */}
        <section aria-label="Market data" className="min-w-0 lg:col-start-2 xl:row-start-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-soft px-5 py-3 md:px-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-teal-800">
              Market data <span className="font-normal normal-case tracking-normal text-stone">· {isMacro ? "structural indicator" : mode === "compare" ? "comparison, rebased to 100" : "observed"} · {isMacro && indicator ? statusPhrase(indicator.provenance) : dataPhrase}</span>
            </p>
            {!isMacro && (
              <div className="hidden flex-wrap gap-2 lg:flex">
                <Segmented label="View" value={view} options={[["chart", "Chart"], ["table", "Table"]]} onChange={(v) => setView(v as "chart" | "table")} />
                {view === "chart" && <Segmented label="Mode" value={mode} options={[["single", "Single"], ["compare", "Compare"]]} onChange={(v) => setMode(v as "single" | "compare")} />}
                <Segmented label="Period" value={period} options={CHART_PERIODS.map((p) => [p, p])} onChange={(v) => changePeriod(v as ChartPeriod)} />
              </div>
            )}
          </div>
          <div className="px-5 py-6 md:px-8 md:py-8">
            {isMacro && indicator ? (
              <IndicatorCentre indicator={indicator} />
            ) : view === "table" ? (
              <MarketTable
                rows={rows}
                histories={byId}
                period={period}
                selectedId={focusInst.id}
                onSelect={(id) => {
                  setFocus(id);
                  setView("chart");
                  setMode("single");
                  track({ name: "market_selected", instrument: id, surface: "table" });
                }}
                caption={`${dataTitle} market data — ${CATEGORIES.find((c) => c.id === category)?.label}, ${period}`}
              />
            ) : mode === "compare" ? (
              <CompareCentre ids={compare} all={all} byId={byId} period={period} loading={loading} statusLabel={dataTitle} />
            ) : focusUnavailable ? (
              <UnavailableCentre item={focusUnavailable} />
            ) : (
              <InstrumentCentre snap={selected} points={byId.get(selected.instrument.id) ?? []} period={period} loading={loading} historyError={!!historyError} onSwipe={(d) => step(d, "swipe")} />
            )}
            {!isMacro && (
              <div className="mt-5 lg:hidden">
                <Segmented label="Chart period" value={period} options={CHART_PERIODS.map((p) => [p, p])} onChange={(v) => changePeriod(v as ChartPeriod)} />
              </div>
            )}
          </div>
        </section>

        {/* INTELLIGENCE */}
        <aside aria-label="Nusantara View" className="on-dark min-w-0 bg-teal-900 text-white lg:col-start-2 xl:col-start-3 xl:row-span-2 xl:row-start-1">
          {isMacro && indicator ? (
            <IndicatorIntel indicator={indicator} reading={readings[indicator.id] ?? null} />
          ) : (
            <InstrumentIntel
              inst={focusInst}
              intel={intel[focusInst.id]}
              evidence={evidence}
              onEvidence={setEvidence}
              connected={
                <ConnectedIntel
                  intel={intel[focusInst.id]}
                  dimensions={dimensions}
                  openId={openDim}
                  onOpen={setOpenDim}
                  focusId={focusInst.id}
                  names={names}
                  onPickMarket={(id) => {
                    setMode("single");
                    setFocus(id);
                  }}
                />
              }
            />
          )}
        </aside>

        {/* Statistics + related markets (single instrument) */}
        {!isMacro && mode === "single" && view === "chart" && !focusUnavailable && (
          <section aria-label="Market statistics" className="min-w-0 border-t border-rule lg:col-start-2 xl:row-start-2">
            <InstrumentStats
              snap={selected}
              points={byId.get(selected.instrument.id) ?? []}
              period={period}
              related={(intel[selected.instrument.id]?.relatedMarkets ?? []).map((id) => all.find((s) => s.instrument.id === id)).filter((s): s is InstrumentSnapshot => !!s)}
              onPick={(id) => {
                setFocus(id);
                track({ name: "market_selected", instrument: id, surface: "related" });
              }}
            />
            <div className="hidden lg:block">
              <PeriodStrip snap={selected} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} className="relative inline-flex border border-rule bg-paper p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)} className={`num relative h-7 min-w-9 px-2.5 text-[12px] font-medium ${v === value ? "text-white" : "text-charcoal hover:text-teal-800"}`}>
          {v === value && <m.span layoutId={`seg-${label}`} className="absolute inset-0 bg-teal-800" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  );
}

function UnavailableCentre({ item }: { item: UnavailableInstrument }) {
  const inst = item.instrument;
  return (
    <div>
      <p className="text-[13px] text-stone">
        {inst.name} <span className="num">· {inst.ticker}</span>
      </p>
      <div className="mt-6 flex h-[380px] flex-col items-center justify-center gap-2 border border-dashed border-rule px-6 text-center" role="status">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-teal-800">Unavailable</p>
        <p className="max-w-sm text-[14px] text-charcoal">{UNAVAILABLE_REASON[item.reason]} No value is shown.</p>
      </div>
    </div>
  );
}

function InstrumentCentre({
  snap,
  points,
  period,
  loading,
  historyError,
  onSwipe,
}: {
  snap: InstrumentSnapshot;
  points: InstrumentHistory["points"];
  period: ChartPeriod;
  loading: boolean;
  historyError: boolean;
  /** Horizontal swipe on the value (touch screens): -1 previous, 1 next. */
  onSwipe?: (dir: 1 | -1) => void;
}) {
  const inst = snap.instrument;
  const swipe = useSwipe(onSwipe);
  const time = useMarketTime(snap.provenance.status);
  const stale = useIsStale(snap.provenance);
  const { values, stamps } = useMemo(() => resampleSeries(points, N), [points]);
  const raw = points.map((p) => p.v);
  const pc = period === "1D" || raw.length < 2 ? snap.quote : changeOverPeriod(inst, raw[0], raw[raw.length - 1]);
  const unit = inst.unit === "%" ? "%" : "";
  const fmt = (v: number) => `${formatValue(v, inst.decimals)}${unit}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3" {...swipe}>
        <div>
          <AnimatePresence mode="wait" initial={false}>
            <m.p key={inst.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="text-[13px] text-stone">
              {inst.name} <span className="num">· {inst.ticker}</span>
              {inst.unit && inst.unit !== "%" ? ` · ${inst.unit}` : ""}
            </m.p>
          </AnimatePresence>
          <p className="mt-2 text-[2.6rem] font-medium leading-none tracking-tight text-ink md:text-[3rem]">
            <AnimatedNumber value={snap.quote.value} format={fmt} />
          </p>
          {stale && (
            <p className="mt-2 text-[12px] font-medium text-down" role="status">
              Not current — last updated {formatTimestamp(snap.provenance.asOf)}
            </p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.08em] text-stone">{period === "1D" ? "Day change" : `${period} change`}</p>
          <Change instrument={inst} change={pc.change} changePct={pc.changePct} changeBp={pc.changeBp} size="md" className="mt-1 sm:justify-end" />
        </div>
      </div>
      <div className={`mt-6 transition-opacity duration-300 ${loading ? "opacity-50" : ""}`} aria-busy={loading}>
        {values.length > 1 ? (
          <MorphChart
            tone="dark"
            series={[{ id: "main", label: inst.shortName, color: PRIMARY_LINE, values }]}
            labels={stamps.map((t) => time.stamp(t, { time: period === "1D" || period === "1W" }))}
            format={fmt}
            height={340}
            reference={period === "1D" ? { value: snap.quote.previousClose, label: "Previous close" } : undefined}
            ariaLabel={`${inst.name}, ${period}, ${statusPhrase(snap.provenance)}. Latest ${fmt(snap.quote.value)}.`}
          />
        ) : loading && !historyError ? (
          <div className="flex h-[380px] items-center justify-center text-stone">Loading…</div>
        ) : (
          <div className="flex h-[380px] items-center justify-center border border-dashed border-rule px-6 text-center text-[14px] text-stone" role="status">
            {period} history is unavailable for {inst.shortName}. No chart is drawn rather than an incomplete one.
          </div>
        )}
      </div>
    </div>
  );
}

function InstrumentStats({
  snap,
  points,
  period,
  related,
  onPick,
}: {
  snap: InstrumentSnapshot;
  points: InstrumentHistory["points"];
  period: ChartPeriod;
  related: InstrumentSnapshot[];
  onPick: (id: string) => void;
}) {
  const inst = snap.instrument;
  const isYield = inst.convention === "yield";
  const raw = points.map((p) => p.v);
  const unit = inst.unit === "%" ? "%" : "";
  const fmt = (v: number) => `${formatValue(v, inst.decimals)}${unit}`;
  const hi = raw.length ? Math.max(...raw) : snap.quote.value;
  const lo = raw.length ? Math.min(...raw) : snap.quote.value;
  const hasHistory = raw.length > 1;
  const vol = realisedVol(raw, isYield);
  return (
    <div className="px-5 py-6 md:px-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-teal-800">Market statistics</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {[
          ["Previous close", <AnimatedNumber key="pc" value={snap.quote.previousClose} format={fmt} />],
          [`${period} high`, hasHistory ? <AnimatedNumber key="hi" value={hi} format={fmt} /> : "—"],
          [`${period} low`, hasHistory ? <AnimatedNumber key="lo" value={lo} format={fmt} /> : "—"],
          [`Realised vol (${period}, ann.)`, hasHistory ? <AnimatedNumber key="v" value={vol} format={(v) => (isYield ? `${v.toFixed(0)} bp` : `${v.toFixed(1)}%`)} /> : "—"],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-[11.5px] text-stone">{k}</dt>
            <dd className="mt-1 text-[15px] font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {related.length > 0 && <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.08em] text-teal-800">Related markets</p>}
      <ul className={`mt-2 divide-y divide-rule-soft border-y border-rule-soft ${related.length ? "" : "hidden"}`}>
        {related.map((r) => (
          <li key={r.instrument.id}>
            <button type="button" onClick={() => onPick(r.instrument.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-[13.5px] hover:text-teal-800">
              <span className="w-24 font-semibold text-ink">
                {r.instrument.shortName} <StaleMark provenance={r.provenance} />
              </span>
              <span className="num flex-1 text-right text-charcoal">
                {formatValue(r.quote.value, r.instrument.decimals)}
                {r.instrument.unit === "%" ? "%" : ""}
              </span>
              <Change instrument={r.instrument} change={r.quote.change} changePct={r.quote.changePct} changeBp={r.quote.changeBp} showAbsolute={false} className="w-24 justify-end" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Provenance provenance={snap.provenance} />
      </div>
    </div>
  );
}

function CompareCentre({
  ids,
  all,
  byId,
  period,
  loading,
  statusLabel,
}: {
  ids: string[];
  all: InstrumentSnapshot[];
  byId: Map<string, InstrumentHistory["points"]>;
  period: ChartPeriod;
  loading: boolean;
  statusLabel: string;
}) {
  const rows = ids.map((id) => all.find((s) => s.instrument.id === id)).filter((s): s is InstrumentSnapshot => !!s);
  const time = useMarketTime(all[0]?.provenance.status);
  const series = rows
    .map((r, i) => {
      const pts = byId.get(r.instrument.id) ?? [];
      if (pts.length < 2) return null;
      const v = resample(pts, N);
      return { id: r.instrument.id, label: r.instrument.shortName, color: SERIES_COLORS[i], values: v.map((x) => (x / v[0]) * 100) };
    })
    .filter((s): s is NonNullable<typeof s> => !!s);
  const ref = byId.get(rows[0]?.instrument.id ?? "") ?? [];
  const stamps = resampleSeries(ref, N).stamps;

  return (
    <div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Legend">
        {series.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-[13px] text-charcoal">
            <span aria-hidden className="block h-0.5 w-5" style={{ background: s.color }} />
            {s.label}
            <span className="num text-stone">{signed(s.values[s.values.length - 1] - 100, 2, "%")}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {series.length ? (
          <MorphChart
            tone="dark"
            series={series}
            labels={stamps.map((t) => time.stamp(t, { time: period === "1D" || period === "1W" }))}
            format={(v) => formatValue(v, 2)}
            height={380}
            area={false}
            reference={{ value: 100, label: "Start = 100" }}
            ariaLabel={`${statusLabel} ${period} comparison of ${series.map((s) => s.label).join(", ")}, rebased to 100`}
          />
        ) : (
          <div className="flex h-[380px] items-center justify-center border border-dashed border-rule text-stone">Select up to four price instruments in the rail.</div>
        )}
      </div>
      <p className="mt-4 text-[12px] text-stone">Yields are excluded from rebased comparison. {statusLabel} data.</p>
    </div>
  );
}

function IndicatorCentre({ indicator }: { indicator: IntelligenceIndicator }) {
  const values = resample(indicator.series.map((s, i) => ({ t: String(i), v: s.v })), N);
  const labels = values.map((_, i) => indicator.series[Math.round((i / (N - 1)) * (indicator.series.length - 1))].label);
  const fmt = (v: number) => `${formatValue(v, indicator.decimals)}${indicator.unit ?? ""}`;
  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={indicator.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <p className="text-[11px] uppercase tracking-[0.08em] text-stone">{indicator.category}</p>
          <h3 className="mt-2 font-serif text-[1.8rem] leading-tight text-teal-900">{indicator.title}</h3>
          <p className="mt-1 text-[13px] text-stone">{indicator.measure}</p>
        </m.div>
      </AnimatePresence>
      <p className="mt-4 text-[3rem] font-medium leading-none tracking-tight text-ink">
        <AnimatedNumber value={indicator.value} format={fmt} />
      </p>
      <div className="mt-6">
        <MorphChart tone="dark" series={[{ id: "ind", label: indicator.title, color: PRIMARY_LINE, values }]} labels={labels} format={fmt} height={340} ariaLabel={`${indicator.title}, ${statusPhrase(indicator.provenance)} quarterly series`} />
      </div>
      <div className="mt-5">
        <Provenance provenance={indicator.provenance} showTime={false} />
      </div>
    </div>
  );
}

function IntelBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/10 py-4">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-teal-200">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * Interpretation layer, conclusion first: qualification, signal, stance,
 * context and related research stay visible; the reasoning (watching, key
 * risk, what would change the view) is one tab at a time. Collapsed on
 * mobile; always visible from lg.
 */
function InstrumentIntel({
  inst,
  intel,
  evidence,
  onEvidence,
  connected,
}: {
  inst: InstrumentDefinition;
  intel: MarketIntel | undefined;
  evidence: EvidenceTab;
  onEvidence: (t: EvidenceTab) => void;
  connected: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const now = useNow();
  // A view past its review date is withdrawn in the browser too, even if the page was rendered before it expired.
  const view = intel?.view && !(now !== null && isPastReview(intel.view, now)) ? intel.view : null;
  const insight = intel?.insight ?? null;
  // Sample views keep their management-review label; approved views show their publication stamp.
  const subline = view ? (view.sample ? SAMPLE_LABELS.interpretation : null) : "Interpretation";
  const toggle = () => {
    setOpen((o) => !o);
    if (!open) track({ name: "nusantara_view_expanded", instrument: inst.id });
  };
  return (
    <div className="px-5 py-5 md:px-8 lg:py-7">
      <div className="hidden lg:block">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white">Nusantara View</p>
        {subline ? <p className="mt-1 text-[11px] font-medium tracking-[0.04em] text-gold-200">{subline}</p> : view && <PublicationStamp p={view} tone="dark" className="mt-1" />}
      </div>
      <button type="button" aria-expanded={open} aria-controls="intel-body" onClick={toggle} className="flex w-full items-center justify-between text-left lg:hidden">
        <span>
          <span className="block text-[12px] font-medium uppercase tracking-[0.08em] text-white">Nusantara View</span>
          {subline ? <span className="block mt-1 text-[11px] font-medium tracking-[0.04em] text-gold-200">{subline}</span> : view && <PublicationStamp p={view} tone="dark" className="mt-1" />}
          {view?.signal && !open && <span className="mt-2 block font-serif text-[1.35rem] leading-none text-white">{view.signal}</span>}
        </span>
        <span aria-hidden className={`text-xl text-gold-300 transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div id="intel-body" className={`${open ? "block" : "hidden"} lg:block`}>
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={inst.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {view ? (
              <>
                <div className="mt-6 pb-5">
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-gold-300">Signal</p>
                  <p className="mt-1 font-serif text-[2.1rem] leading-none text-white">{view.signal}</p>
                  {view.stance && (
                    <div className="mt-4">
                      <StateGauge id={`ws-${inst.id}`} scale={view.stance.scale} position={view.stance.position} showLabels tone="dark" />
                    </div>
                  )}
                </div>
                <IntelBlock label="Context">
                  <p className="text-[14.5px] leading-snug text-teal-50">{view.context}</p>
                </IntelBlock>
              </>
            ) : (
              <p className="mt-6 border-t border-white/10 pt-4 text-[14px] leading-relaxed text-teal-100" role="status">
                There is no current Nusantara View for {inst.shortName}. Views are shown only while they are approved and within their review date.
              </p>
            )}
            {insight && (
              <IntelBlock label="Related insight">
                <Link href={`/insights/${insight.slug}`} className="group block">
                  <span className="font-serif text-[1.15rem] leading-snug text-white group-hover:text-gold-200">{insight.title} →</span>
                </Link>
              </IntelBlock>
            )}
            {view && <ViewEvidence view={view} tab={evidence} onTab={onEvidence} className="pb-4" />}
          </m.div>
        </AnimatePresence>
        {/* Outside the per-market fade, so an open Market State preview stays steady while markets change within it. */}
        {connected}
      </div>
    </div>
  );
}

/** Mobile: step through markets in the ribbon's order, or swipe; the dropdown below jumps anywhere. */
function MarketStepper({ all, current, onStep }: { all: InstrumentSnapshot[]; current: InstrumentSnapshot; onStep: (dir: 1 | -1, surface: "stepper" | "swipe") => void }) {
  const i = all.findIndex((x) => x.instrument.id === current.instrument.id);
  const prev = all[(i - 1 + all.length) % all.length];
  const next = all[(i + 1) % all.length];
  const inst = current.instrument;
  const swipe = useSwipe((d) => onStep(d, "swipe"));
  const btn = "flex h-11 w-11 shrink-0 items-center justify-center border border-rule bg-white text-[18px] text-teal-900 active:bg-teal-50";
  return (
    <div className="flex items-center gap-3" {...swipe}>
      <button type="button" onClick={() => onStep(-1, "stepper")} aria-label={`Previous market: ${prev.instrument.shortName}`} className={btn}>
        <span aria-hidden>‹</span>
      </button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <m.p key={inst.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }} className="leading-tight">
            <span className="block text-[13px] font-medium uppercase tracking-[0.08em] text-ink">{inst.shortName}</span>
            <span className="mt-0.5 flex items-center justify-center gap-2 text-[12.5px]">
              <span className="num text-charcoal">
                {formatValue(current.quote.value, inst.decimals)}
                {inst.unit === "%" ? "%" : ""}
              </span>
              <Change instrument={inst} change={current.quote.change} changePct={current.quote.changePct} changeBp={current.quote.changeBp} showAbsolute={false} />
            </span>
          </m.p>
        </AnimatePresence>
        <span className="num mt-1 block text-[10.5px] text-mist" aria-hidden>
          {String(i + 1).padStart(2, "0")} / {String(all.length).padStart(2, "0")}
        </span>
      </div>
      <button type="button" onClick={() => onStep(1, "stepper")} aria-label={`Next market: ${next.instrument.shortName}`} className={btn}>
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}

/** Horizontal swipe on touch screens; vertical scrolling is left alone. */
function useSwipe(onSwipe?: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  if (!onSwipe) return {};
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s0 = start.current;
      start.current = null;
      if (!s0) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s0.x, dy = t.clientY - s0.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

function IndicatorIntel({ indicator, reading }: { indicator: IntelligenceIndicator; reading: NusantaraView | null }) {
  const now = useNow();
  const current = reading && !(now !== null && isPastReview(reading, now)) ? reading : null;
  const illustrative = indicator.provenance.status === "illustrative";
  return (
    <div className="p-6 md:p-8">
      <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white">
        Nusantara reading
      </p>
      {current?.sample && <p className="mt-1 text-[11px] font-medium tracking-[0.04em] text-gold-200">{SAMPLE_LABELS.interpretation}</p>}
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={indicator.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
          <p className="mt-6 text-[1.75rem] font-medium capitalize leading-none text-white">{indicator.direction}</p>
          <p className="mt-2 text-[12px] text-teal-200">
            Direction of the {statusPhrase(indicator.provenance)} series · {indicator.period}
          </p>
          {current ? (
            <p className="mt-6 text-[15px] leading-relaxed text-teal-50">{current.context}</p>
          ) : (
            <p className="mt-6 text-[14px] leading-relaxed text-teal-100" role="status">
              There is no current Nusantara reading for this indicator.
            </p>
          )}
          <p className="mt-6 border-t border-white/10 pt-4 text-[12px] leading-relaxed text-teal-200">
            Source: {indicator.provenance.source}.{illustrative ? " Values and directions are placeholders until an approved, attributed source is in place." : ""}
          </p>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/** Historical comparison: change over every period, loaded when scrolled into view. */
function PeriodStrip({ snap }: { snap: InstrumentSnapshot }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "200px" });
  const data = useHistories(CHART_PERIODS, inView);
  const inst = snap.instrument;
  const isYield = inst.convention === "yield";
  const changes = CHART_PERIODS.map((p) => {
    const pts = data[p]?.get(inst.id);
    if (!pts) return null;
    return p === "1D" ? (isYield ? snap.quote.changeBp ?? 0 : snap.quote.changePct ?? 0) : seriesChange(pts.map((x) => x.v), isYield);
  });
  const maxAbs = Math.max(0.01, ...changes.map((c) => Math.abs(c ?? 0)));
  return (
    <div ref={ref} className="border-t border-rule px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-stone">Historical comparison · {inst.shortName}</p>
        <p className="text-[11.5px] text-stone">
          Change over each period · {isYield ? "basis points" : "percent"} · {statusPhrase(snap.provenance)}
        </p>
      </div>
      <ul className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {CHART_PERIODS.map((p, i) => {
          const c = changes[i];
          const h = c === null ? 0 : (Math.abs(c) / maxAbs) * 44;
          return (
            <li key={p} className="flex flex-col items-center">
              <div className="relative h-[96px] w-full">
                <span className="absolute inset-x-0 top-1/2 h-px bg-rule" />
                <m.span
                  className={`absolute left-1/2 w-6 -translate-x-1/2 ${c !== null && c < 0 ? "bg-down/70" : "bg-teal-800"}`}
                  initial={false}
                  animate={{ height: h, top: c !== null && c < 0 ? 48 : 48 - h }}
                  transition={{ type: "spring", stiffness: 160, damping: 22 }}
                />
              </div>
              <span className="num mt-2 text-[13px] font-medium text-ink">{c === null ? "…" : isYield ? signed(c, 1, " bp") : formatPct(c)}</span>
              <span className="num text-[11px] text-stone">{p}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
