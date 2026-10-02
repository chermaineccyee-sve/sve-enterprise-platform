"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMarketHistory, useMarketSnapshot } from "@/hooks/useMarketData";
import { ASSET_CLASS_LABELS, OVERVIEW_INSTRUMENT_IDS } from "@/lib/market/instruments";
import { CHART_PERIODS, type AssetClass, type ChartPeriod, type InstrumentHistory, type MarketSnapshot } from "@/lib/market/types";
import { ComparisonChart, MarketChart } from "./MarketChart";
import { MarketCard } from "./MarketCard";
import { Provenance } from "./MarketStatus";
import { MarketTable } from "./MarketTable";

type Tab = "overview" | AssetClass;
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "equities", label: ASSET_CLASS_LABELS.equities },
  { id: "fx", label: ASSET_CLASS_LABELS.fx },
  { id: "rates", label: ASSET_CLASS_LABELS.rates },
  { id: "commodities", label: ASSET_CLASS_LABELS.commodities },
];
const REGIONS = ["All", "Asia", "Americas", "Europe", "Global"] as const;
type Region = (typeof REGIONS)[number];
const MAX_COMPARE = 4;

type Props = {
  initialSnapshot: MarketSnapshot;
  initialHistory: { period: ChartPeriod; data: InstrumentHistory[] };
  refreshIntervalMs: number | null;
};

export function MarketDashboard({ initialSnapshot, initialHistory, refreshIntervalMs }: Props) {
  const snapshot = useMarketSnapshot(initialSnapshot, refreshIntervalMs);
  const [tab, setTab] = useState<Tab>("overview");
  const [region, setRegion] = useState<Region>("All");
  const [period, setPeriod] = useState<ChartPeriod>(initialHistory.period);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [selectedId, setSelectedId] = useState("klci");
  const [compareIds, setCompareIds] = useState<string[]>(["klci", "sti", "spx"]);
  const { byId, loading, error } = useMarketHistory(period, initialHistory);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const base =
      tab === "overview"
        ? OVERVIEW_INSTRUMENT_IDS.map((id) => snapshot.instruments.find((s) => s.instrument.id === id)!).filter(Boolean)
        : snapshot.instruments.filter((s) => s.instrument.assetClass === tab);
    return region === "All" ? base : base.filter((s) => s.instrument.region === region);
  }, [snapshot, tab, region]);

  const availableRegions = useMemo(() => {
    const base =
      tab === "overview"
        ? snapshot.instruments.filter((s) => OVERVIEW_INSTRUMENT_IDS.includes(s.instrument.id))
        : snapshot.instruments.filter((s) => s.instrument.assetClass === tab);
    return new Set(base.map((s) => s.instrument.region));
  }, [snapshot, tab]);

  const selected = snapshot.instruments.find((s) => s.instrument.id === selectedId) ?? snapshot.instruments[0];
  const compareRows = compareIds
    .map((id) => snapshot.instruments.find((s) => s.instrument.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const selectInstrument = (id: string) => {
    setSelectedId(id);
    setMode("single");
    if (chartRef.current && chartRef.current.getBoundingClientRect().top < 0) {
      chartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const toggleCompare = (id: string) =>
    setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_COMPARE ? ids : [...ids, id]));

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = TABS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setTab(TABS[next].id);
      setRegion("All");
      tabRefs.current[next]?.focus();
    }
  };

  return (
    <div>
      {/* Chart panel */}
      <section ref={chartRef} aria-labelledby="chart-heading" className="scroll-mt-28 border border-rule-soft bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule-soft px-5 py-3 md:px-8">
          <h2 id="chart-heading" className="eyebrow text-gold-700">
            {mode === "single" ? "Instrument detail" : "Comparison mode"}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Chart mode"
              value={mode}
              onChange={(v) => setMode(v as "single" | "compare")}
              options={[
                { value: "single", label: "Single" },
                { value: "compare", label: "Compare" },
              ]}
            />
            <Segmented
              label="Chart period"
              value={period}
              onChange={(v) => setPeriod(v as ChartPeriod)}
              options={CHART_PERIODS.map((p) => ({ value: p, label: p }))}
            />
          </div>
        </div>
        <div className="px-5 py-6 md:px-8 md:py-8">
          {mode === "single" ? (
            <MarketChart snapshot={selected} points={byId.get(selected.instrument.id) ?? []} period={period} loading={loading} />
          ) : (
            <ComparisonChart rows={compareRows} histories={byId} period={period} loading={loading} />
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-down">
              Chart data for {period} could not be loaded. Showing the last available period.
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4 border-t border-rule-soft pt-4">
            <Provenance provenance={selected.provenance} />
            {mode === "single" && <p className="max-w-md text-[12px] leading-relaxed text-stone">{selected.instrument.description}</p>}
            {mode === "compare" && (
              <p className="max-w-md text-[12px] leading-relaxed text-stone">
                Up to four price instruments. Yields are excluded from rebased comparison; see the Rates tab for changes in basis points.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Controls */}
      <div className="mt-12 flex flex-col gap-5 border-b border-rule pb-0 lg:flex-row lg:items-end lg:justify-between">
        <div role="tablist" aria-label="Market category" className="scrollbar-thin -mb-px flex overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="market-panel"
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => {
                setTab(t.id);
                setRegion("All");
              }}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`shrink-0 border-b-2 px-4 pb-3 pt-1 text-[14px] font-medium transition-colors md:px-5 ${
                tab === t.id ? "border-teal-800 text-teal-900" : "border-transparent text-stone hover:text-teal-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <fieldset className="flex min-w-0 flex-wrap items-center gap-1.5">
            <legend className="sr-only">Region</legend>
            {REGIONS.filter((r) => r === "All" || availableRegions.has(r)).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={region === r}
                onClick={() => setRegion(r)}
                className={`h-8 border px-3 text-[12.5px] transition-colors ${
                  region === r ? "border-teal-800 bg-teal-800 text-white" : "border-rule text-charcoal hover:border-teal-600"
                }`}
              >
                {r}
              </button>
            ))}
          </fieldset>
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-rule sm:block" />
          <Segmented
            label="Layout"
            value={view}
            onChange={(v) => setView(v as "cards" | "table")}
            options={[
              { value: "cards", label: "Cards" },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
      </div>

      <div id="market-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
        <p className="sr-only" aria-live="polite">
          Showing {rows.length} instruments, {period} period.
        </p>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone">No instruments for this filter.</p>
        ) : view === "cards" ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((s) => {
              const isYield = s.instrument.convention === "yield";
              return (
                <li key={s.instrument.id}>
                  <MarketCard
                    snapshot={s}
                    history={byId.get(s.instrument.id)}
                    period={period}
                    selected={mode === "single" && s.instrument.id === selectedId}
                    onSelect={() => selectInstrument(s.instrument.id)}
                    compareChecked={compareIds.includes(s.instrument.id)}
                    onCompareToggle={isYield ? undefined : () => toggleCompare(s.instrument.id)}
                    compareDisabled={compareIds.length >= MAX_COMPARE}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <MarketTable
            rows={rows}
            histories={byId}
            period={period}
            selectedId={mode === "single" ? selectedId : undefined}
            onSelect={selectInstrument}
            caption={`Illustrative market data, ${TABS.find((t) => t.id === tab)?.label}`}
          />
        )}
      </div>
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex border border-rule bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`num h-7 min-w-9 px-2.5 text-[12px] font-medium transition-colors ${
            value === o.value ? "bg-teal-800 text-white" : "text-charcoal hover:text-teal-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
