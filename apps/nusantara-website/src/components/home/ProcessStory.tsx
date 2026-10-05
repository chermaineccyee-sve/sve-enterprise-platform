"use client";

import { useEffect, useRef, useState } from "react";
import { AllocationSystem } from "@/components/identity/AllocationSystem";
import { PROCESS_STEPS, PROCESS_SUMMARY } from "@/content/approach";

type Step = (typeof PROCESS_STEPS)[number];

/** What a stage weighs; Stage 01 carries the prototype-dataset qualification instead. */
function considered(i: number, counts: { instruments: number; indicators: number }): { label: string; items: string } | null {
  if (i === 0) return { label: "Illustrative prototype dataset", items: `${counts.instruments} market instruments · ${counts.indicators} structural indicators` };
  const c = PROCESS_STEPS[i].considered;
  return c.length ? { label: "Considered", items: c.join(" · ") } : null;
}

const next = (i: number): Step | undefined => PROCESS_STEPS[i + 1];

/**
 * The investment process as one continuous system. Each stage receives the
 * previous stage's output and passes its own on. Desktop: a sticky visual
 * that accumulates a layer per stage, with a stage navigator; the stages
 * scroll past on the right. Mobile: a swipe carousel of the same stages.
 */
export function ProcessStory({ counts }: { counts: { instruments: number; indicators: number } }) {
  const [active, setActive] = useState(0);
  const blocks = useRef<(HTMLElement | null)[]>([]);
  const headings = useRef<(HTMLHeadingElement | null)[]>([]);

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

  const goTo = (i: number) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    blocks.current[i]?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    headings.current[i]?.focus({ preventScroll: true });
  };

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:grid lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="sticky top-0 flex h-screen items-center gap-6 xl:gap-10">
            <nav aria-label="Investment process stages" className="w-48 shrink-0">
              <ol className="space-y-1">
                {PROCESS_STEPS.map((s, i) => {
                  const state = i === active ? "active" : i < active ? "done" : "next";
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        aria-current={state === "active" ? "step" : undefined}
                        className="group flex w-full items-center gap-3 py-1.5 text-left"
                      >
                        <span
                          aria-hidden
                          className={`block h-px shrink-0 transition-all duration-500 ${state === "active" ? "w-8 bg-gold-400" : state === "done" ? "w-4 bg-teal-300/70" : "w-3 bg-white/20"}`}
                        />
                        <span
                          className={`whitespace-nowrap text-[12px] leading-snug transition-colors duration-500 ${
                            state === "active" ? "text-gold-300" : state === "done" ? "text-teal-200/80 group-hover:text-teal-50" : "text-teal-300/45 group-hover:text-teal-100"
                          }`}
                        >
                          <span className="num mr-2">{s.n}</span>
                          {s.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
            <AllocationSystem stage={active} className="aspect-square w-full max-w-[540px] min-w-0 flex-1" />
            <p className="sr-only" aria-live="polite">
              Stage {PROCESS_STEPS[active].n} of 06: {PROCESS_STEPS[active].title}
            </p>
          </div>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          {PROCESS_STEPS.map((s, i) => {
            const c = considered(i, counts);
            const n = next(i);
            return (
              <article
                key={s.id}
                ref={(el) => {
                  blocks.current[i] = el;
                }}
                data-stage={i}
                aria-current={i === active ? "step" : undefined}
                className={`flex flex-col justify-center py-16 transition-opacity duration-700 ${i === 0 ? "mt-[1vh]" : ""} ${i === PROCESS_STEPS.length - 1 ? "min-h-[70vh]" : "min-h-[88vh]"}`}
                style={{ opacity: i === active ? 1 : 0.28 }}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-teal-300">
                  {i === 0 ? "Inputs" : "Receives"}
                  <span className="ml-3 font-normal normal-case tracking-normal text-teal-100">{s.input}</span>
                </p>
                <p className="num mt-6 text-[3rem] font-medium leading-none text-gold-400/90">{s.n}</p>
                <h3
                  ref={(el) => {
                    headings.current[i] = el;
                  }}
                  tabIndex={-1}
                  className="display-m mt-4 text-white focus:outline-none"
                >
                  {s.title}
                </h3>
                <p className="mt-4 font-serif text-[1.4rem] italic text-gold-200">{s.question}</p>
                <p className="mt-5 max-w-lg text-[16.5px] leading-relaxed text-teal-100">{s.text}</p>
                <Output step={s} next={n} />
                {c && (
                  <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-teal-200">
                    <span className="text-teal-300">{c.label}:</span> {c.items}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* Mobile / tablet */}
      <MobileStory counts={counts} />
    </>
  );
}

function Output({ step, next, compact = false }: { step: Step; next?: Step; compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-5 pl-4" : "mt-8 pl-5"} max-w-lg border-l-2 border-gold-400/70`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gold-300">Output</p>
      <p className={`mt-1.5 font-serif leading-snug text-white ${compact ? "text-[1.15rem]" : "text-[1.3rem]"}`}>{step.output}</p>
      {next && (
        <p className="mt-2 text-[12px] text-teal-300">
          <span aria-hidden>→ </span>
          Feeds {next.n} {next.title}
        </p>
      )}
    </div>
  );
}

function MobileStory({ counts }: { counts: { instruments: number; indicators: number } }) {
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
        {PROCESS_STEPS.map((s, k) => {
          const c = considered(k, counts);
          return (
            <li key={s.id} className="flex w-[86%] shrink-0 snap-center flex-col border border-white/15 p-6 md:w-[60%]">
              <p className="num text-[13px] text-gold-300">{s.n} / 06</p>
              <h3 className="mt-2 font-serif text-[1.7rem] leading-tight text-white">{s.title}</h3>
              <p className="mt-2 font-serif italic text-gold-200">{s.question}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-teal-100">{s.text}</p>
              <Output step={s} next={next(k)} compact />
              {c && (
                <p className="mt-4 text-[12.5px] leading-relaxed text-teal-200">
                  <span className="text-teal-300">{c.label}:</span> {c.items}
                </p>
              )}
              <AllocationSystem stage={k} className="mx-auto mt-auto aspect-square w-[62%] pt-6" />
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex justify-center gap-2" aria-hidden>
        {PROCESS_STEPS.map((s, k) => (
          <span key={s.id} className={`h-1 transition-all duration-300 ${k === i ? "w-6 bg-gold-400" : "w-2 bg-white/25"}`} />
        ))}
      </div>
    </div>
  );
}

/** Resolves the six stages into one line. Shown after Stage 06 on the homepage only. */
export function ProcessSummary() {
  return (
    <div className="border-t border-white/10 pt-12 lg:pt-14">
      <p className="eyebrow text-gold-300">{PROCESS_SUMMARY.eyebrow}</p>
      <ol className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2 font-serif text-[1.3rem] leading-snug text-white md:text-[1.55rem]">
        {PROCESS_SUMMARY.line.map((t, i) => (
          <li key={t} className="flex items-baseline gap-x-3">
            {i > 0 && (
              <span aria-hidden className="text-gold-400">
                →
              </span>
            )}
            {t}
          </li>
        ))}
      </ol>
      <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-teal-100">{PROCESS_SUMMARY.sentence}</p>
    </div>
  );
}
