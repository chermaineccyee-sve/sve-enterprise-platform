import Link from "next/link";
import { Change } from "@/components/market/Change";
import { StaleMark } from "@/components/market/MarketStatus";
import type { Signal } from "@/content/model/intelligence";
import { formatInsightDate } from "@/content/insights/types";
import { formatValue } from "@/lib/market/format";
import type { InstrumentSnapshot } from "@/lib/market/types";
import { routes } from "@/lib/routes";

/** Short, rapidly consumable intelligence items — a rail on mobile, a ruled grid on desktop. */
export function LatestSignals({ signals, instruments }: { signals: Signal[]; instruments: Record<string, InstrumentSnapshot> }) {
  return (
    <ol className="no-scrollbar -mx-5 flex snap-x gap-0 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-3">
      {signals.map((s, i) => {
        const inst = s.instrument ? instruments[s.instrument] : null;
        return (
          <li key={s.id} className="w-[78vw] shrink-0 snap-start border-l border-rule px-6 py-6 md:w-auto md:border-t md:[&:nth-child(-n+2)]:border-t-0 xl:[&:nth-child(-n+3)]:border-t-0">
            <p className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em]">
              <span className="flex items-center gap-2 font-semibold text-gold-700">
                {s.theme}
              </span>
              <time className="num text-stone" dateTime={s.date}>
                {formatInsightDate(s.date)}
              </time>
            </p>
            <h3 className="mt-3 font-serif text-[1.35rem] leading-snug text-teal-900">{s.headline}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-stone">{s.reading}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              {inst ? (
                <Link href={routes.market(inst.instrument.id)} aria-label={`${inst.instrument.shortName}: open market view`} className="group flex items-center gap-2 text-[12px]">
                  <span className="font-semibold text-ink group-hover:text-teal-700">{inst.instrument.shortName}</span>
                  <StaleMark provenance={inst.provenance} />
                  <span className="num text-charcoal">
                    {formatValue(inst.quote.value, inst.instrument.decimals)}
                    {inst.instrument.unit === "%" ? "%" : ""}
                  </span>
                  <Change instrument={inst.instrument} change={inst.quote.change} changePct={inst.quote.changePct} changeBp={inst.quote.changeBp} showAbsolute={false} />
                </Link>
              ) : (
                <span />
              )}
              <Link href={`/insights/${s.insight}`} className="text-[12.5px] font-medium text-teal-800 hover:text-teal-950" aria-label={`Research behind signal ${i + 1}: ${s.headline}`}>
                Research →
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
