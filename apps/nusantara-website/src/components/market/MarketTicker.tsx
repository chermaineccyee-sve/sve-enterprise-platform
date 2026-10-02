import { formatValue } from "@/lib/market/format";
import type { MarketSnapshot } from "@/lib/market/types";
import { Change } from "./Change";

/** Static, horizontally scrollable strip. Deliberately not an auto-scrolling marquee. */
export function MarketTicker({ snapshot, tone = "light" }: { snapshot: MarketSnapshot; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div className={`border-y ${dark ? "border-white/10" : "border-rule-soft bg-white"}`}>
      <div className="container-site flex items-stretch">
        <p
          className={`eyebrow hidden shrink-0 items-center border-r pr-5 lg:flex ${
            dark ? "border-white/10 text-gold-300" : "border-rule-soft text-gold-700"
          }`}
        >
          Illustrative
        </p>
        <ul
          aria-label="Market summary (illustrative data)"
          className="scrollbar-thin relative flex min-w-0 flex-1 snap-x gap-0 overflow-x-auto"
          tabIndex={0}
        >
          {snapshot.instruments.map(({ instrument: inst, quote }) => (
            <li
              key={inst.id}
              className={`relative flex shrink-0 snap-start items-baseline gap-3 border-r px-5 py-3 ${dark ? "border-white/10" : "border-rule-soft"}`}
            >
              <span className={`text-[12px] font-semibold ${dark ? "text-white" : "text-ink"}`}>{inst.shortName}</span>
              <span className={`num text-[12.5px] ${dark ? "text-teal-100" : "text-charcoal"}`}>
                {formatValue(quote.value, inst.decimals)}
                {inst.unit === "%" ? "%" : ""}
              </span>
              <Change
                instrument={inst}
                change={quote.change}
                changePct={quote.changePct}
                changeBp={quote.changeBp}
                showAbsolute={false}
                tone={tone}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
