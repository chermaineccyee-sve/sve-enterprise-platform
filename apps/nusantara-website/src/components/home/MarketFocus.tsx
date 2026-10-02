"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = { focusId: string; setFocus: (id: string, opts?: { scroll?: boolean }) => void };
const MarketFocusContext = createContext<Ctx | null>(null);

/**
 * Shared "which market is the visitor looking at" state for the homepage.
 * The ribbon, hero monitor and Market Intelligence panel all read and write
 * it, so choosing a market anywhere connects it to Nusantara's view and
 * related research.
 */
export function MarketFocusProvider({ initial, children, targetId = "market-intelligence" }: { initial: string; children: ReactNode; targetId?: string }) {
  const [focusId, setFocusId] = useState(initial);
  const setFocus = useCallback((id: string, opts?: { scroll?: boolean }) => {
    setFocusId(id);
    if (opts?.scroll) {
      const el = document.getElementById(targetId);
      const r = el?.getBoundingClientRect();
      // Only move the page when the panel that responds is out of view.
      if (el && r && (r.top < 0 || r.top > window.innerHeight * 0.55)) {
        el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      }
    }
  }, [targetId]);
  const value = useMemo(() => ({ focusId, setFocus }), [focusId, setFocus]);
  return <MarketFocusContext.Provider value={value}>{children}</MarketFocusContext.Provider>;
}

export function useMarketFocus() {
  const ctx = useContext(MarketFocusContext);
  if (!ctx) throw new Error("useMarketFocus must be used inside MarketFocusProvider");
  return ctx;
}

/** Like useMarketFocus, but returns null outside a provider (e.g. homepage links). */
export function useOptionalMarketFocus() {
  return useContext(MarketFocusContext);
}
