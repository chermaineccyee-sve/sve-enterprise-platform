import { direction, formatChange, formatPct } from "@/lib/market/format";
import type { InstrumentDefinition } from "@/lib/market/types";

/** Directional change. Arrow glyph + sign carry direction; colour is reinforcement only. */
export function Change({
  instrument,
  change,
  changePct,
  changeBp,
  size = "sm",
  tone = "light",
  showAbsolute = true,
  className = "",
}: {
  instrument: InstrumentDefinition;
  change: number;
  changePct: number | null;
  changeBp: number | null;
  size?: "sm" | "md";
  tone?: "light" | "dark";
  showAbsolute?: boolean;
  className?: string;
}) {
  const dir = direction(change);
  const dark = tone === "dark";
  const color =
    dir === "up" ? (dark ? "text-[#8fd1b0]" : "text-up") : dir === "down" ? (dark ? "text-[#f0a397]" : "text-down") : dark ? "text-teal-200" : "text-stone";
  const isYield = instrument.convention === "yield";
  return (
    <span className={`num inline-flex items-baseline gap-2 ${size === "md" ? "text-[15px]" : "text-[12.5px]"} ${color} ${className}`}>
      <span aria-hidden className="text-[0.8em]">
        {dir === "up" ? "▲" : dir === "down" ? "▼" : "■"}
      </span>
      <span className="sr-only">{dir === "up" ? "Up" : dir === "down" ? "Down" : "Unchanged"}</span>
      {isYield ? (
        <span>{formatChange(instrument, { change, changeBp })}</span>
      ) : (
        <>
          {showAbsolute && <span>{formatChange(instrument, { change, changeBp })}</span>}
          <span className={showAbsolute ? "opacity-90" : ""}>{showAbsolute ? `(${formatPct(changePct)})` : formatPct(changePct)}</span>
        </>
      )}
    </span>
  );
}
