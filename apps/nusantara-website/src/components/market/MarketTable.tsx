import { changeOverPeriod, formatChange, formatPct, formatValue } from "@/lib/market/format";
import type { ChartPeriod, InstrumentSnapshot, PricePoint } from "@/lib/market/types";
import { Change } from "./Change";
import { MarketStatus, StaleMark } from "./MarketStatus";
import { Sparkline } from "./Sparkline";

type MarketTableProps = {
  rows: InstrumentSnapshot[];
  histories: Map<string, PricePoint[]>;
  period: ChartPeriod;
  selectedId?: string;
  onSelect?: (id: string) => void;
  caption: string;
};

/**
 * Tabular market view on larger screens; on mobile it becomes a list of
 * readable rows rather than a shrunken table.
 */
export function MarketTable({ rows, histories, period, selectedId, onSelect, caption }: MarketTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto border border-rule-soft bg-white md:block">
        <table className="w-full text-left text-[13.5px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-rule bg-ivory/70 text-[11px] uppercase tracking-[0.08em] text-stone">
              <th scope="col" className="px-5 py-3 font-semibold">Instrument</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Last</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Day chg</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Day %</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">{period} chg</th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">{period} trend</span>
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ instrument: inst, quote, provenance }) => {
              const pts = histories.get(inst.id) ?? [];
              const vals = pts.map((p) => p.v);
              const pc = period === "1D" || vals.length < 2 ? quote : changeOverPeriod(inst, vals[0], vals[vals.length - 1]);
              const selected = inst.id === selectedId;
              return (
                <tr
                  key={inst.id}
                  className={`border-b border-rule-soft last:border-0 ${selected ? "bg-teal-50" : "hover:bg-ivory/50"}`}
                >
                  <th scope="row" className="px-5 py-3 font-normal">
                    {onSelect ? (
                      <button
                        type="button"
                        onClick={() => onSelect(inst.id)}
                        aria-pressed={selected}
                        className="text-left"
                      >
                        <span className="block font-semibold text-ink hover:text-teal-800">{inst.shortName}</span>
                        <span className="num block text-[11.5px] text-stone">
                          {inst.ticker} <StaleMark provenance={provenance} />
                        </span>
                      </button>
                    ) : (
                      <>
                        <span className="block font-semibold text-ink">{inst.shortName}</span>
                        <span className="num block text-[11.5px] text-stone">
                          {inst.ticker} <StaleMark provenance={provenance} />
                        </span>
                      </>
                    )}
                  </th>
                  <td className="num px-4 py-3 text-right font-medium text-ink">
                    {formatValue(quote.value, inst.decimals)}
                    {inst.unit === "%" ? "%" : ""}
                  </td>
                  <td className="num px-4 py-3 text-right text-charcoal">{formatChange(inst, quote)}</td>
                  <td className="num px-4 py-3 text-right text-charcoal">{inst.convention === "yield" ? "—" : formatPct(quote.changePct)}</td>
                  <td className="px-4 py-3 text-right">
                    <Change instrument={inst} change={pc.change} changePct={pc.changePct} changeBp={pc.changeBp} showAbsolute={false} />
                  </td>
                  <td className="px-4 py-2">
                    {vals.length > 1 && (
                      <Sparkline values={vals} width={96} height={28} label={`${inst.shortName} ${period} trend`} className="text-teal-800" />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <MarketStatus status={provenance.status} delayMinutes={provenance.delayMinutes} variant="subtle" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: readable rows */}
      <ul className="divide-y divide-rule-soft border border-rule-soft bg-white md:hidden" aria-label={caption}>
        {rows.map(({ instrument: inst, quote, provenance }) => {
          const vals = (histories.get(inst.id) ?? []).map((p) => p.v);
          const pc = period === "1D" || vals.length < 2 ? quote : changeOverPeriod(inst, vals[0], vals[vals.length - 1]);
          const content = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-ink">{inst.shortName}</span>
                <span className="num block text-[11.5px] text-stone">
                  {inst.ticker} <StaleMark provenance={provenance} />
                </span>
              </span>
              {vals.length > 1 && (
                <Sparkline values={vals} width={64} height={26} label={`${inst.shortName} ${period} trend`} className="shrink-0 text-teal-800" />
              )}
              <span className="w-[112px] shrink-0 text-right">
                <span className="num block text-[14px] font-medium text-ink">
                  {formatValue(quote.value, inst.decimals)}
                  {inst.unit === "%" ? "%" : ""}
                </span>
                <Change instrument={inst} change={pc.change} changePct={pc.changePct} changeBp={pc.changeBp} showAbsolute={false} />
              </span>
            </>
          );
          return (
            <li key={inst.id}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(inst.id)}
                  aria-pressed={inst.id === selectedId}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${inst.id === selectedId ? "bg-teal-50" : ""}`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
