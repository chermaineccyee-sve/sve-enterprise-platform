"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Tweens between values when the *subject* changes (e.g. a different
 * instrument is selected). Illustrative values never tick on their own.
 */
export function AnimatedNumber({
  value,
  format,
  className = "",
  duration = 0.7,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduce = useReducedMotion();
  const fmtRef = useRef(format);
  useLayoutEffect(() => {
    fmtRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (reduce || from === value) {
      el.textContent = fmtRef.current(value);
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = fmtRef.current(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={`num ${className}`}>
      {format(value)}
    </span>
  );
}
