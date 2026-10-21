"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's clock for the CURRENT TIME display — never used for market
 * data (see useNow for time-dependent data rules). Null during server render
 * and hydration, so markup always matches; the time appears after hydration.
 *
 * One shared ticker per precision, aligned to the second/minute boundary.
 * It stops while the page is hidden and catches up as soon as it is visible.
 */
type Precision = "second" | "minute";

function createClock(precision: Precision) {
  const step = precision === "second" ? 1000 : 60_000;
  let now: number | null = null;
  let timer: number | undefined;
  const listeners = new Set<() => void>();

  const emit = () => {
    now = Date.now();
    listeners.forEach((l) => l());
  };
  const stop = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    stop();
    timer = window.setTimeout(() => {
      emit();
      schedule();
    }, step - (Date.now() % step) + 5);
  };
  const onVisibility = () => {
    if (document.hidden) stop();
    else {
      emit();
      schedule();
    }
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        now = Date.now();
        document.addEventListener("visibilitychange", onVisibility);
        if (!document.hidden) schedule();
      }
      listener();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stop();
          document.removeEventListener("visibilitychange", onVisibility);
        }
      };
    },
    get: () => now,
  };
}

const clocks = { second: createClock("second"), minute: createClock("minute") };

export function useClock(precision: Precision): number | null {
  const c = clocks[precision];
  return useSyncExternalStore(c.subscribe, c.get, () => null);
}
