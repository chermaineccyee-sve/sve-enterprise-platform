"use client";

import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { CROSS_ASSET_VIEW } from "@/content/intelligence";
import type { CrossAssetMeasure } from "@/lib/market/analytics";
import { signed } from "@/lib/market/format";
import { ASSET_CLASS_LABELS } from "@/lib/market/instruments";
import type { AssetClass } from "@/lib/market/types";

const CLASSES: AssetClass[] = ["equities", "fx", "rates", "commodities"];
const ROWS = ["Momentum", "Volatility", "Direction", "Nusantara view"] as const;
type Row = (typeof ROWS)[number];

const TONE: Record<string, string> = {
  // Neutral, non-judgemental scale: direction is information, not good/bad.
  Positive: "bg-teal-800 text-white",
  Negative: "bg-teal-300 text-teal-950",
  Flat: "bg-ivory-deep text-charcoal",
  Subdued: "bg-teal-100 text-teal-900",
  Normal: "bg-ivory-deep text-charcoal",
  Elevated: "bg-gold-300 text-teal-950",
  "Broadly higher": "bg-teal-800 text-white",
  "Broadly lower": "bg-teal-300 text-teal-950",
  Mixed: "bg-ivory-deep text-charcoal",
};

/**
 * CROSS-ASSET VIEW. Momentum, volatility and direction are *derived* from the
 * dataset (illustrative here); the Nusantara row is a sample reading.
 */
export function CrossAssetView({ measures }: { measures: Record<AssetClass, CrossAssetMeasure> }) {
  const [cell, setCell] = useState<{ row: Row; c: AssetClass }>({ row: "Momentum", c: "equities" });

  const label = (row: Row, c: AssetClass) => {
    const ms = measures[c];
    if (row === "Momentum") return ms.momentum.label;
    if (row === "Volatility") return ms.volatility.label;
    if (row === "Direction") return ms.direction.label;
    return CROSS_ASSET_VIEW[c].view;
  };
  const detail = (row: Row, c: AssetClass) => {
    const ms = measures[c];
    const n = ms.members.length;
    if (row === "Momentum") return `Average one-month change across ${n} ${ASSET_CLASS_LABELS[c]} instruments: ${signed(ms.momentum.value, ms.unit === "bp" ? 1 : 2, ms.unit === "bp" ? " bp" : "%")}.`;
    if (row === "Volatility") return `Average three-month realised volatility, annualised: ${ms.volatility.value.toFixed(ms.unit === "bp" ? 0 : 1)}${ms.unit === "bp" ? " bp" : "%"}, compared with a reference band for the asset class.`;
    if (row === "Direction") return `${ms.direction.up} of ${n} instruments higher and ${ms.direction.down} lower over one month (as quoted; for USD pairs, lower means regional currency strength).`;
    return CROSS_ASSET_VIEW[c].note;
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <caption className="sr-only">Cross-asset view: derived measures and illustrative Nusantara view by asset class</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[150px]" />
              {CLASSES.map((c) => (
                <th key={c} scope="col" className="pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone">
                  {ASSET_CLASS_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row} className={row === "Nusantara view" ? "border-t-2 border-teal-800" : "border-t border-rule-soft"}>
                <th scope="row" className="py-1.5 pr-4 text-[12.5px] font-medium text-charcoal">
                  <span className="flex items-center gap-2">
                    {row}
                  </span>
                </th>
                {CLASSES.map((c) => {
                  const l = label(row, c);
                  const on = cell.row === row && cell.c === c;
                  return (
                    <td key={c} className="p-0.5">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setCell({ row, c })}
                        onMouseEnter={() => setCell({ row, c })}
                        className={`relative flex h-12 w-full items-center px-3 text-left text-[13px] font-medium transition-transform duration-200 hover:-translate-y-px ${
                          row === "Nusantara view" ? "bg-white font-serif text-[15px] italic text-teal-900" : TONE[l] ?? "bg-ivory-deep"
                        } ${on ? "ring-2 ring-gold-500 ring-offset-1" : ""}`}
                      >
                        {l}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 min-h-[72px] border-l-2 border-gold-500 pl-4" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={`${cell.row}-${cell.c}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone">
              {cell.row} · {ASSET_CLASS_LABELS[cell.c]}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-charcoal">{detail(cell.row, cell.c)}</p>
          </m.div>
        </AnimatePresence>
      </div>
      <p className="mt-4 text-[11.5px] leading-relaxed text-stone">
        Momentum, volatility and direction are calculated from the illustrative dataset using documented thresholds, so they are illustrative too. The Nusantara row is an illustrative view for management review.
      </p>
    </div>
  );
}
