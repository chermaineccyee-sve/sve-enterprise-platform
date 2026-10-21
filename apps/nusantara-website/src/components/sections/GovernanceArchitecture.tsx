"use client";

import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { STAR_PATH } from "@/components/identity/NStar";
import { GOVERNANCE_LAYERS } from "@/content/governance";

/**
 * Control architecture as nested frames around the allocation star — from
 * oversight at the outer edge to reporting closest to the investor. Select a
 * function to see its purpose. Function-level only: no bodies, people or providers.
 */
export function GovernanceArchitecture() {
  const [active, setActive] = useState(0);
  const L = GOVERNANCE_LAYERS;
  const layer = L[active];
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
      <div className="lg:col-span-6">
        <svg viewBox="-110 -110 220 220" className="mx-auto aspect-square w-full max-w-[520px]" role="img" aria-label={`Governance architecture: ${layer.title} selected`}>
          {L.map((l, i) => {
            const h = 100 - i * 12;
            const on = i === active;
            return (
              <g key={l.n} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} className="cursor-pointer" aria-hidden>
                <rect x={-h} y={-h} width={h * 2} height={h * 2} rx={h * 0.22} fill="transparent" stroke={on ? "#cdae73" : "rgba(196,213,219,0.35)"} strokeWidth={on ? 1.6 : 0.7} style={{ transition: "stroke 300ms, stroke-width 300ms" }} />
                <text x={0} y={-h + 7.5} textAnchor="middle" fontSize="5.2" letterSpacing="0.8" fill={on ? "#dfc898" : "rgba(196,213,219,0.55)"} style={{ transition: "fill 300ms", textTransform: "uppercase" }}>
                  {l.n}
                </text>
              </g>
            );
          })}
          <m.circle r={14} fill="none" stroke="#cdae73" strokeOpacity={0.5} initial={false} animate={{ r: [12, 17, 12] }} transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }} />
          <path d={STAR_PATH(10)} fill="#cdae73" />
        </svg>
      </div>
      <div className="lg:col-span-6">
        <ol className="border-t border-white/10" role="tablist" aria-orientation="vertical" aria-label="Governance functions">
          {L.map((l, i) => {
            const on = i === active;
            return (
              <li key={l.n} className="border-b border-white/10">
                <button role="tab" aria-selected={on} onClick={() => setActive(i)} onFocus={() => setActive(i)} className="flex w-full items-baseline gap-4 py-3.5 text-left">
                  <span className={`num text-[12px] ${on ? "text-gold-300" : "text-teal-300/60"}`}>{l.n}</span>
                  <span className={`text-[1.0625rem] font-medium transition-colors ${on ? "text-white" : "text-teal-200/70 hover:text-white"}`}>{l.title}</span>
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <m.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-4 pl-9 text-[15px] leading-relaxed text-teal-100">
                      {l.text}
                    </m.p>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
