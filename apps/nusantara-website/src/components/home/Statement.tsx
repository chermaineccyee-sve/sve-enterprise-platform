"use client";

import { m, useScroll, useTransform, type MotionValue } from "motion/react";
import { useRef, type ReactNode } from "react";

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
 * place. Used sparingly, at major conceptual transitions only.
 */
export function Statement({ phrases, children }: { phrases: ReactNode[]; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const step = 1 / phrases.length;
  return (
    <div ref={ref} className="relative">
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
