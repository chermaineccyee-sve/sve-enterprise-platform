import Link from "next/link";
import { formatValue } from "@/lib/market/format";
import type { InstrumentHistory, IntelligenceSnapshot, MarketSnapshot } from "@/lib/market/types";
import { Change } from "./Change";
import { Sparkline } from "./Sparkline";

type Tile = { theme: string; label: string; value: string; values: number[]; foot: React.ReactNode };

/** Homepage strategic-intelligence preview across eight themes. */
export function IntelligencePreview({
  snapshot,
  history,
  intelligence,
}: {
  snapshot: MarketSnapshot;
  history: InstrumentHistory[];
  intelligence: IntelligenceSnapshot;
}) {
  const hist = new Map(history.map((h) => [h.instrumentId, h.points.map((p) => p.v)]));
  const inst = (id: string, theme: string): Tile | null => {
    const s = snapshot.instruments.find((x) => x.instrument.id === id);
    if (!s) return null;
    return {
      theme,
      label: s.instrument.shortName,
      value: `${formatValue(s.quote.value, s.instrument.decimals)}${s.instrument.unit === "%" ? "%" : ""}`,
      values: hist.get(id) ?? [],
      foot: (
        <Change instrument={s.instrument} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} tone="dark" />
      ),
    };
  };
  const ind = (id: string, theme: string): Tile | null => {
    const i = intelligence.indicators.find((x) => x.id === id);
    if (!i) return null;
    return {
      theme,
      label: i.title,
      value: `${formatValue(i.value, i.decimals)}${i.unit ?? ""}`,
      values: i.series.map((s) => s.v),
      foot: <span className="text-[12px] text-teal-200">{i.measure}</span>,
    };
  };
  const tiles = [
    inst("spx", "Global Markets"),
    inst("us10y", "Rates"),
    inst("usdmyr", "Currencies"),
    inst("gold", "Commodities"),
    ind("cf-portfolio", "Capital Flows"),
    ind("am-alt-share", "Alternative Assets"),
    ind("pm-credit", "Private Markets"),
    ind("pw-pool", "Wealth & Capital"),
  ].filter((t): t is Tile => !!t);

  return (
    <ul className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <li key={t.theme} className="bg-teal-900">
          <Link href="/market-dashboard" className="group flex h-full flex-col p-6 transition-colors hover:bg-teal-800">
            <p className="eyebrow text-gold-300">{t.theme}</p>
            <p className="mt-3 min-h-[2.6em] text-[14px] leading-snug text-teal-100">{t.label}</p>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-[1.75rem] font-medium leading-none tracking-tight text-white">{t.value}</p>
              <Sparkline values={t.values} width={88} height={32} color="#cdae73" label={`${t.label} trend`} className="text-white" />
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">{t.foot}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
