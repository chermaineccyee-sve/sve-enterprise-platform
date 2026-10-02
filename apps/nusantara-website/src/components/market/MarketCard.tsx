import { changeOverPeriod, formatValue } from "@/lib/market/format";
import type { ChartPeriod, InstrumentSnapshot, PricePoint } from "@/lib/market/types";
import { Change } from "./Change";
import { Sparkline } from "./Sparkline";
import { MarketStatus } from "./MarketStatus";

type MarketCardProps = {
  snapshot: InstrumentSnapshot;
  history?: PricePoint[];
  period: ChartPeriod;
  selected?: boolean;
  onSelect?: () => void;
  compareChecked?: boolean;
  onCompareToggle?: () => void;
  compareDisabled?: boolean;
  density?: "regular" | "compact";
};

/**
 * Instrument card: name, ticker, value, change over the selected period,
 * sparkline, period and status. Daily change is used for 1D.
 */
export function MarketCard({
  snapshot,
  history,
  period,
  selected,
  onSelect,
  compareChecked,
  onCompareToggle,
  compareDisabled,
  density = "regular",
}: MarketCardProps) {
  const { instrument: inst, quote, provenance } = snapshot;
  const values = history?.map((p) => p.v) ?? [];
  const periodChange =
    period === "1D" || values.length < 2 ? quote : changeOverPeriod(inst, values[0], values[values.length - 1]);
  const Tag = onSelect ? "button" : "div";

  return (
    <article
      className={`group relative flex h-full flex-col border bg-white transition-[border-color,box-shadow] duration-200 ${
        selected ? "border-teal-800 shadow-[inset_0_2px_0_var(--color-gold-500)]" : "border-rule-soft hover:border-teal-300"
      }`}
    >
      <Tag
        {...(onSelect ? { type: "button" as const, onClick: onSelect, "aria-pressed": selected } : {})}
        className={`flex flex-1 flex-col p-4 text-left ${density === "regular" ? "md:p-5" : ""} ${onSelect ? "cursor-pointer" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-semibold text-ink">{inst.shortName}</h3>
            <p className="num mt-0.5 truncate text-[11.5px] text-stone">
              {inst.ticker}
              {inst.unit && inst.unit !== "%" ? ` · ${inst.unit}` : ""}
            </p>
          </div>
          {density === "regular" && (
            <span className="num shrink-0 border border-rule-soft px-1.5 py-0.5 text-[10.5px] text-stone">{period}</span>
          )}
        </div>
        <div className={density === "regular" ? "mt-4 flex items-end justify-between gap-3" : "mt-3 flex flex-col gap-3"}>
          <div className="min-w-0">
            <p className={`num font-medium leading-none tracking-tight text-ink ${density === "regular" ? "text-[1.5rem]" : "text-[1.3rem]"}`}>
              {formatValue(quote.value, inst.decimals)}
              {inst.unit === "%" && <span className="ml-0.5 text-[0.7em] text-stone">%</span>}
            </p>
            <Change
              instrument={inst}
              change={periodChange.change}
              changePct={periodChange.changePct}
              changeBp={periodChange.changeBp}
              showAbsolute={density === "regular"}
              className="mt-2"
            />
          </div>
          {values.length > 1 && (
            <Sparkline
              values={values}
              width={density === "regular" ? 104 : 140}
              height={density === "regular" ? 38 : 30}
              label={`${inst.shortName} ${period} trend`}
              className="shrink-0 text-teal-800"
            />
          )}
        </div>
        {density === "regular" && (
          <div className="mt-4 flex min-h-5 items-center justify-between gap-2 border-t border-rule-soft pt-3">
            <MarketStatus status={provenance.status} delayMinutes={provenance.delayMinutes} variant="subtle" />
            <span className="sr-only">Source: {provenance.source}</span>
          </div>
        )}
      </Tag>
      {onCompareToggle && (
        <label
          className={`absolute bottom-[15px] right-4 flex items-center gap-1.5 text-[11.5px] md:bottom-[19px] md:right-5 ${
            compareDisabled && !compareChecked ? "cursor-not-allowed text-mist" : "cursor-pointer text-stone hover:text-teal-800"
          }`}
        >
          <input
            type="checkbox"
            checked={!!compareChecked}
            disabled={compareDisabled && !compareChecked}
            onChange={onCompareToggle}
            className="h-3.5 w-3.5 accent-teal-800"
          />
          Compare
          <span className="sr-only"> {inst.shortName}</span>
        </label>
      )}
    </article>
  );
}
