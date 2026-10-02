"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, available only after hydration (null during server
 * render and hydration, so markup always matches). Used for time-dependent
 * rules — stale market data, expired Nusantara Views — that must be
 * re-checked in the browser because pages are statically rendered.
 *
 * One shared minute ticker serves every subscriber on the page.
 */
let now: number | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  listener();
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}
