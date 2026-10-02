"use client";

import { m, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";
import { Lattice } from "@/components/identity/Lattice";

function Phrase({ progress, range, children }: { progress: MotionValue<number>; range: [number, number]; children: ReactNode }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  const y = useTransform(progress, range, [10, 0]);
  return (
    <m.span style={{ opacity, y }} className="block">
      {children}
    </m.span>
  );
}

/**
 * Oversized editorial statement revealed phrase-by-phrase as it scrolls into
 * place, over a lattice that turns slightly with the page. Used sparingly, at
 * major conceptual transitions only.
 */
export function Statement({ phrases, children }: { phrases: ReactNode[]; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [-12, 12]);
  const step = 1 / phrases.length;
  return (
    <div ref={ref} className="relative">
      <m.div style={{ rotate }} className="pointer-events-none absolute -right-[18%] top-1/2 hidden aspect-square w-[58%] -translate-y-1/2 text-teal-800/10 lg:block" aria-hidden>
        <Lattice className="h-full w-full" strokeWidth={0.5} accent="rgba(184,149,90,0.35)" />
      </m.div>
      <p className="relative max-w-[18ch] font-serif text-[clamp(2.4rem,6.4vw,6.2rem)] leading-[1.02] tracking-[-0.025em] text-teal-900">
        {phrases.map((p, i) => (
          <Phrase key={i} progress={scrollYProgress} range={[i * step, Math.min(1, (i + 1) * step + 0.05)]}>
            {p}
          </Phrase>
        ))}
      </p>
      {children}
    </div>
  );
}
