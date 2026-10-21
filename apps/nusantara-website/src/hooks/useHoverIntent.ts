"use client";

import { useEffect, useRef } from "react";

/**
 * Guards hover-to-select lists. Hover selection is honoured only on devices
 * that genuinely hover, and not in the first moments after the page settles —
 * when the browser can fire synthetic hover events under a resting pointer
 * (after a reload, a deep link or a scroll) that would otherwise override the
 * selection restored from the URL or made by keyboard.
 */
export function useHoverIntent(settleMs = 1200) {
  const readyAt = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    readyAt.current = performance.now() + settleMs;
  }, [settleMs]);
  return () => performance.now() >= readyAt.current;
}
