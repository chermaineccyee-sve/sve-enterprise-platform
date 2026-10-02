import { formatValue } from "@/lib/market/format";
import type { IntelligenceIndicator } from "@/lib/market/types";
import { MarketStatus } from "./MarketStatus";
import { Sparkline } from "./Sparkline";

const DIRECTION: Record<IntelligenceIndicator["direction"], { label: string; glyph: string }> = {
  rising: { label: "Rising", glyph: "↗" },
  stable: { label: "Stable", glyph: "→" },
  easing: { label: "Easing", glyph: "↘" },
};

/**
 * Strategic indicator: the DATA layer (value, measure, trend, provenance)
 * visually separated from the INTERPRETATION layer (Nusantara reading).
 */
export function EconomicIndicator({ indicator, showReading = true }: { indicator: IntelligenceIndicator; showReading?: boolean }) {
  const dir = DIRECTION[indicator.direction];
  const values = indicator.series.map((s) => s.v);
  return (
    <article className="flex h-full flex-col border border-rule-soft bg-white">
      <div className="p-5">
        <p className="eyebrow text-gold-700">{indicator.category}</p>
        <h3 className="mt-3 font-serif text-[1.25rem] leading-snug text-teal-900">{indicator.title}</h3>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[2rem] font-medium leading-none tracking-tight text-ink">
              {formatValue(indicator.value, indicator.decimals)}
              {indicator.unit && <span className="ml-0.5 text-[0.55em] text-stone">{indicator.unit}</span>}
            </p>
            <p className="mt-2 text-[12px] leading-snug text-stone">{indicator.measure}</p>
          </div>
          <Sparkline
            values={values}
            width={112}
            height={44}
            label={`${indicator.title}: ${indicator.series[0].label} to ${indicator.series[indicator.series.length - 1].label} trend`}
            className="shrink-0 text-teal-800"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-stone">
          <span className="inline-flex items-center gap-1.5 font-medium text-charcoal">
            <span aria-hidden>{dir.glyph}</span>
            {dir.label}
          </span>
          <span aria-hidden className="text-rule">|</span>
          <span className="num">{indicator.period}</span>
          <span aria-hidden className="text-rule">|</span>
          <MarketStatus status={indicator.provenance.status} variant="subtle" />
        </div>
      </div>
      {showReading && (
        <div className="mt-auto border-t border-rule-soft bg-ivory/60 p-5">
          <p className="eyebrow text-teal-700">Nusantara reading</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-charcoal">{indicator.reading}</p>
          <p className="mt-3 text-[11px] text-stone">Source: {indicator.provenance.source}</p>
        </div>
      )}
    </article>
  );
}
