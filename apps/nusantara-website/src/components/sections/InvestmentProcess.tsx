"use client";

import { useState } from "react";
import { PROCESS_STEPS } from "@/content/approach";

const SIZE = 520;
const C = SIZE / 2;
const R = 188;

/**
 * Signature diagram: the six-stage operating model arranged around
 * governed allocation. Desktop is interactive; mobile is a stepped list.
 */
export function InvestmentProcess({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [active, setActive] = useState(0);
  const dark = tone === "dark";
  const step = PROCESS_STEPS[active];

  const nodes = PROCESS_STEPS.map((s, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / PROCESS_STEPS.length;
    const x = Math.round((C + R * Math.cos(a)) * 100) / 100;
    const y = Math.round((C + R * Math.sin(a)) * 100) / 100;
    const lx = Math.round((C + (R + 62) * Math.cos(a)) * 100) / 100;
    const ly = Math.round((C + (R + 62) * Math.sin(a)) * 100) / 100;
    return { ...s, i, x, y, lx, ly, anchor: (Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end") as "middle" | "start" | "end" };
  });

  const ink = dark ? "#ffffff" : "#0e2d3b";
  const muted = dark ? "rgba(196,213,219,0.35)" : "rgba(18,56,74,0.18)";

  return (
    <div>
      {/* Desktop / tablet: interactive ring */}
      <div className="hidden items-center gap-12 lg:grid lg:grid-cols-12">
        <div className="lg:col-span-6">
          <svg viewBox={`-175 -40 ${SIZE + 350} ${SIZE + 80}`} className="h-auto w-full" role="img" aria-label="The Nusantara investment operating model: six stages arranged around governed allocation.">
            <circle cx={C} cy={C} r={R} fill="none" stroke={muted} strokeWidth={1} />
            <circle cx={C} cy={C} r={R - 46} fill="none" stroke="#b8955a" strokeOpacity={0.7} strokeWidth={1} />
            {/* progress arc to active step */}
            <circle
              cx={C}
              cy={C}
              r={R}
              fill="none"
              stroke="#cdae73"
              strokeWidth={2}
              pathLength={360}
              strokeDasharray={`${(active / PROCESS_STEPS.length) * 360} 360`}
              transform={`rotate(-90 ${C} ${C})`}
              style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.22,1,0.36,1)" }}
            />
            <circle cx={C} cy={C} r={92} fill={dark ? "#12384a" : "#12384a"} />
            <text x={C} y={C - 8} textAnchor="middle" className="fill-white font-serif text-[22px]">
              Governed
            </text>
            <text x={C} y={C + 20} textAnchor="middle" className="fill-white font-serif text-[22px]">
              Allocation
            </text>
            {nodes.map((n) => {
              const on = n.i === active;
              return (
                <g key={n.id} onClick={() => setActive(n.i)} onMouseEnter={() => setActive(n.i)} className="cursor-pointer" aria-hidden>
                  <circle cx={n.x} cy={n.y} r={30} fill={on ? "#b8955a" : dark ? "#0e2d3b" : "#fbf9f4"} stroke="#b8955a" strokeWidth={1.4} style={{ transition: "fill 250ms" }} />
                  <text x={n.x} y={n.y} dy="0.35em" textAnchor="middle" className="num text-[15px] font-semibold" fill={on ? "#0a2330" : dark ? "#dfc898" : "#7f6129"}>
                    {n.n}
                  </text>
                  <text x={n.lx} y={n.ly} dy="0.35em" textAnchor={n.anchor} className="text-[15px] font-medium" fill={on ? (dark ? "#dfc898" : "#7f6129") : ink} fillOpacity={on ? 1 : 0.85}>
                    {n.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="lg:col-span-6">
          <div className="min-h-[300px]" aria-live="polite">
            <p className={`num text-[5rem] font-light leading-none ${dark ? "text-gold-400" : "text-gold-600"}`}>{step.n}</p>
            <h3 className={`display-m mt-4 ${dark ? "text-white" : "text-teal-900"}`}>{step.title}</h3>
            <p className={`mt-4 font-serif text-[1.3rem] italic ${dark ? "text-gold-200" : "text-gold-700"}`}>{step.question}</p>
            <p className={`mt-5 max-w-xl text-[16px] leading-relaxed ${dark ? "text-teal-100" : "text-charcoal"}`}>{step.text}</p>
          </div>
          <div role="group" aria-label="Process stages" className={`mt-10 grid grid-cols-6 border-t ${dark ? "border-white/15" : "border-rule"}`}>
            {PROCESS_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={`-mt-px border-t-2 pt-3 text-left transition-colors ${
                  i === active
                    ? dark
                      ? "border-gold-400 text-white"
                      : "border-teal-800 text-teal-900"
                    : dark
                      ? "border-transparent text-teal-300 hover:text-white"
                      : "border-transparent text-stone hover:text-teal-800"
                }`}
              >
                <span className="num block text-[12px]">{s.n}</span>
                <span className="sr-only">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: stepped list */}
      <ol className="lg:hidden">
        {PROCESS_STEPS.map((s, i) => (
          <li key={s.id} className={`relative grid grid-cols-[56px_1fr] gap-4 pb-10 ${i === PROCESS_STEPS.length - 1 ? "pb-0" : ""}`}>
            {i < PROCESS_STEPS.length - 1 && (
              <span aria-hidden className={`absolute left-[27px] top-14 bottom-0 w-px ${dark ? "bg-white/15" : "bg-rule"}`} />
            )}
            <span className={`num flex h-14 w-14 items-center justify-center border text-[15px] font-semibold ${dark ? "border-gold-400 text-gold-300" : "border-gold-500 text-gold-700"}`}>
              {s.n}
            </span>
            <div className="pt-2">
              <h3 className={`font-serif text-[1.45rem] leading-tight ${dark ? "text-white" : "text-teal-900"}`}>{s.title}</h3>
              <p className={`mt-1 font-serif italic ${dark ? "text-gold-200" : "text-gold-700"}`}>{s.question}</p>
              <p className={`mt-3 text-[15px] leading-relaxed ${dark ? "text-teal-100" : "text-charcoal"}`}>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
