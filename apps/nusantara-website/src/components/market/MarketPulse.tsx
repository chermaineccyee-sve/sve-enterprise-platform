import { CTA } from "@/components/ui/CTA";
import type { InstrumentHistory, MarketSnapshot } from "@/lib/market/types";
import { MarketCard } from "./MarketCard";
import { DataTimestamp, MarketStatus } from "./MarketStatus";

/** Compact homepage dashboard: selected indicators with 1M sparklines. */
export function MarketPulse({ snapshot, history }: { snapshot: MarketSnapshot; history: InstrumentHistory[] }) {
  const byId = new Map(history.map((h) => [h.instrumentId, h.points]));
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="flex flex-col lg:col-span-3">
        <p className="eyebrow text-gold-700">02 — Market pulse</p>
        <h2 className="display-m mt-5 text-teal-900">What is happening.</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-stone">
          A selection of regional and global indicators. Day change shown; trend lines cover one month.
        </p>
        <div className="mt-6 space-y-2 text-[12px] text-stone">
          <MarketStatus status={snapshot.provenance.status} />
          <p>Source: {snapshot.provenance.source}</p>
          <p>
            <DataTimestamp asOf={snapshot.provenance.asOf} />
          </p>
        </div>
        <p className="mt-6 border-l-2 border-gold-500 pl-4 text-[12.5px] leading-relaxed text-charcoal">{snapshot.disclaimer}</p>
        <div className="mt-8 lg:mt-auto lg:pt-8">
          <CTA href="/market-dashboard" variant="text">
            View full Market Dashboard
          </CTA>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:col-span-9 xl:grid-cols-5">
        {snapshot.instruments.map((s) => (
          <li key={s.instrument.id}>
            <MarketCard snapshot={s} history={byId.get(s.instrument.id)} period="1D" density="compact" />
          </li>
        ))}
      </ul>
    </div>
  );
}
