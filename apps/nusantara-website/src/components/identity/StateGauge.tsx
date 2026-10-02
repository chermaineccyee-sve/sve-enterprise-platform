"use client";

import { m } from "motion/react";
import { NStar } from "./NStar";

/**
 * Five-step qualitative gauge. The four-point star marks Nusantara's reading;
 * it glides between positions when the reading changes.
 */
export function StateGauge({
  scale,
  position,
  showLabels = false,
  tone = "light",
  id,
}: {
  scale: readonly string[];
  position: number;
  showLabels?: boolean;
  tone?: "light" | "dark";
  /** Stable identifier (used for test hooks). */
  id: string;
}) {
  const dark = tone === "dark";
  return (
    <div className="w-full" data-gauge={id} role="img" aria-label={`Reading: ${scale[position]} (position ${position + 1} of ${scale.length}, from ${scale[0]} to ${scale[scale.length - 1]})`}>
      <div className="relative h-4">
        <span className={`absolute inset-x-0 top-1/2 h-px -translate-y-1/2 ${dark ? "bg-white/20" : "bg-rule"}`} />
        {scale.map((_, i) => (
          <span
            key={i}
            className={`absolute top-1/2 h-2 w-px -translate-y-1/2 ${dark ? "bg-white/30" : "bg-teal-800/25"}`}
            style={{ left: `${(i / (scale.length - 1)) * 100}%` }}
          />
        ))}
        <m.span
          className={`absolute top-1/2 -ml-[7px] -mt-[7px] flex h-[14px] w-[14px] items-center justify-center ${dark ? "text-gold-300" : "text-gold-600"}`}
          initial={false}
          animate={{ left: `${(position / (scale.length - 1)) * 100}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
        >
          <NStar className="h-[14px] w-[14px]" />
        </m.span>
      </div>
      {showLabels && (
        <div className={`relative mt-2 h-4 text-[10.5px] ${dark ? "text-teal-200" : "text-stone"}`}>
          {/* End labels give way when the reading sits on or beside them, so labels never collide. */}
          {position > 1 && <span className="absolute left-0">{scale[0]}</span>}
          {position < scale.length - 2 && <span className="absolute right-0">{scale[scale.length - 1]}</span>}
          <m.span
            initial={false}
            animate={{ left: `${(position / (scale.length - 1)) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className={`absolute whitespace-nowrap font-semibold ${dark ? "text-white" : "text-teal-900"} ${
              position === 0 ? "" : position === scale.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
          >
            {scale[position]}
          </m.span>
        </div>
      )}
    </div>
  );
}
