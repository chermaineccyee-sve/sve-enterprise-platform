"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AllocationSystem } from "@/components/identity/AllocationSystem";
import { NStar } from "@/components/identity/NStar";
import { PROCESS_STEPS } from "@/content/approach";

function evidence(counts: { instruments: number; indicators: number; governanceLayers: number }): string[][] {
  return [
    [`${counts.instruments} market instruments`, `${counts.indicators} structural indicators`, "Prototype dataset"],
    ["Relevance", "Quality", "Transparency", "Portfolio fit"],
    ["Return drivers", "Downside cases", "Liquidity terms", "Valuation method"],
    [`${counts.governanceLayers} governance layers`, "Independent controls", "Compliance review"],
    ["Sizing", "Liquidity alignment", "Concentration", "Suitability"],
    ["Defined review cycle", "Thesis re-tested", "Material change reported"],
  ];
}

/**
 * The investment process as a story. Desktop: a sticky allocation-system
 * visual on the left transforms as each stage scrolls past on the right.
 * Mobile: a snap-scrolling sequence of stages, each with its own state.
 */
export function ProcessStory({ counts }: { counts: { instruments: number; indicators: number; governanceLayers: number } }) {
  const [active, setActive] = useState(0);
  const blocks = useRef<(HTMLElement | null)[]>([]);
  const ev = evidence(counts);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.stage));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    blocks.current.forEach((b) => b && io.observe(b));
    return () => io.disconnect();
  }, []);

  const step = PROCESS_STEPS[active];

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:grid lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="sticky top-0 flex h-screen items-center">
            <div className="relative w-full">
              <AllocationSystem stage={active} className="mx-auto aspect-square w-full max-w-[620px]" />
              {/* progress */}
              <ol className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col gap-3" aria-hidden>
                {PROCESS_STEPS.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className={`block h-px transition-all duration-500 ${i === active ? "w-10 bg-gold-400" : i < active ? "w-5 bg-teal-300" : "w-3 bg-white/20"}`} />
                    <span className={`num text-[11px] transition-colors ${i === active ? "text-gold-300" : "text-teal-300/60"}`}>{s.n}</span>
                  </li>
                ))}
              </ol>
              <div className="absolute bottom-6 right-0 text-right" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <m.p
                    key={step.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300"
                  >
                    {step.n} / 06 · {step.title}
                  </m.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          {PROCESS_STEPS.map((s, i) => (
            <article
              key={s.id}
              ref={(el) => {
                blocks.current[i] = el;
              }}
              data-stage={i}
              aria-current={i === active ? "step" : undefined}
              className="flex min-h-[88vh] flex-col justify-center py-16 transition-opacity duration-700"
              style={{ opacity: i === active ? 1 : 0.28 }}
            >
              <p className="num font-serif text-[5.5rem] font-light leading-none text-gold-400/90">{s.n}</p>
              <h3 className="display-m mt-4 text-white">{s.title}</h3>
              <p className="mt-4 font-serif text-[1.4rem] italic text-gold-200">{s.question}</p>
              <p className="mt-5 max-w-lg text-[16.5px] leading-relaxed text-teal-100">{s.text}</p>
              <ul className="mt-8 flex flex-wrap gap-2">
                {ev[i].map((e) => (
                  <li key={e} className="flex items-center gap-2 border border-white/15 px-3 py-1.5 text-[12.5px] text-teal-50">
                    <NStar className="h-2 w-2 text-gold-400" />
                    {e}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      {/* Mobile / tablet */}
      <MobileStory ev={ev} />
    </>
  );
}

function MobileStory({ ev }: { ev: string[][] }) {
  const [i, setI] = useState(0);
  const track = useRef<HTMLOListElement>(null);
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const w = el.firstElementChild?.getBoundingClientRect().width ?? el.clientWidth;
    setI(Math.round(el.scrollLeft / (w + 16)));
  };
  return (
    <div className="lg:hidden">
      <ol
        ref={track}
        onScroll={onScroll}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:-mx-10 md:px-10"
        aria-label="Investment process — swipe through six stages"
      >
        {PROCESS_STEPS.map((s, k) => (
          <li key={s.id} className="w-[86%] shrink-0 snap-center border border-white/15 p-6 md:w-[60%]">
            <AllocationSystem stage={k} className="mx-auto aspect-square w-[70%]" />
            <p className="num mt-4 text-[13px] text-gold-300">{s.n} / 06</p>
            <h3 className="mt-2 font-serif text-[1.7rem] leading-tight text-white">{s.title}</h3>
            <p className="mt-2 font-serif italic text-gold-200">{s.question}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-teal-100">{s.text}</p>
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {ev[k].map((e) => (
                <li key={e} className="border border-white/15 px-2 py-1 text-[11.5px] text-teal-50">
                  {e}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex justify-center gap-2" aria-hidden>
        {PROCESS_STEPS.map((s, k) => (
          <span key={s.id} className={`h-1 transition-all duration-300 ${k === i ? "w-6 bg-gold-400" : "w-2 bg-white/25"}`} />
        ))}
      </div>
    </div>
  );
}
