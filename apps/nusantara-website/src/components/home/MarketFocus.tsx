"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = { focusId: string; setFocus: (id: string, opts?: { scroll?: boolean }) => void };
const MarketFocusContext = createContext<Ctx | null>(null);

/**
 * Shared "which market is the visitor looking at" state for the homepage.
 * The ribbon, hero monitor and Market Lens all read and write it, so choosing
 * a market anywhere connects it to Nusantara's view and related research.
 */
export function MarketFocusProvider({ initial, children, targetId = "market-lens" }: { initial: string; children: ReactNode; targetId?: string }) {
  const [focusId, setFocusId] = useState(initial);
  const setFocus = useCallback((id: string, opts?: { scroll?: boolean }) => {
    setFocusId(id);
    if (opts?.scroll) {
      const el = document.getElementById(targetId);
      el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
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
