"use client";

import { AnimatePresence, m, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { NStar } from "@/components/identity/NStar";
import { DECISION_GATES } from "@/content/governance";

/**
 * A decision travels through governance gates. The token pauses at each gate
 * while its purpose is shown — motion that explains how discipline is applied.
 */
export function GovernanceSignal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [gate, setGate] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (!inView || hold || reduce) return;
    const t = window.setInterval(() => setGate((g) => (g + 1) % DECISION_GATES.length), 2400);
    return () => window.clearInterval(t);
  }, [inView, hold, reduce]);

  const g = DECISION_GATES[gate];
  const pct = (gate / (DECISION_GATES.length - 1)) * 100;

  return (
    <div ref={ref} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      {/* track */}
      <div className="relative mt-4 hidden md:block">
        <div className="absolute left-0 right-0 top-[11px] h-px bg-rule" />
        <m.div className="absolute left-0 top-[11px] h-px bg-gold-500" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
        <m.span
          aria-hidden
          className="absolute top-0 -ml-[11px] flex h-[23px] w-[23px] items-center justify-center bg-ivory"
          initial={false}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <NStar className="h-[18px] w-[18px] text-gold-500" />
        </m.span>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${DECISION_GATES.length}, minmax(0, 1fr))` }}>
          {DECISION_GATES.map((d, i) => (
            <li key={d.id} className={i === 0 ? "text-left" : i === DECISION_GATES.length - 1 ? "text-right" : "text-center"}>
              <button
                type="button"
                onClick={() => setGate(i)}
                onFocus={() => {
                  setGate(i);
                  setHold(true);
                }}
                onBlur={() => setHold(false)}
                aria-pressed={i === gate}
                className="group pt-10"
              >
                <span className={`num block text-[11px] ${i <= gate ? "text-gold-700" : "text-mist"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={`mt-1 block text-[12.5px] font-medium uppercase tracking-[0.08em] transition-colors ${i === gate ? "text-teal-900" : "text-stone group-hover:text-teal-900"}`}>
                  {d.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* mobile: vertical list */}
      <ol className="space-y-1 md:hidden">
        {DECISION_GATES.map((d, i) => (
          <li key={d.id}>
            <button type="button" onClick={() => setGate(i)} aria-pressed={i === gate} className={`flex w-full items-center gap-3 border-l-2 py-2 pl-4 text-left ${i === gate ? "border-gold-500 text-teal-900" : "border-rule text-stone"}`}>
              <span className="num text-[11px] text-gold-700">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[13px] font-medium uppercase tracking-[0.08em]">{d.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-12 min-h-[150px] md:mt-16" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }} className="grid gap-6 md:grid-cols-12">
            <p className="font-serif text-[1.9rem] leading-tight text-teal-900 md:col-span-5">{g.question}</p>
            <div className="md:col-span-6 md:col-start-7">
              <p className="text-[16px] leading-relaxed text-charcoal">{g.purpose}</p>
              <p className="mt-4 text-[13.5px] text-stone">
                <span className="font-semibold text-gold-700">Stops: </span>
                {g.stops}
              </p>
            </div>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
