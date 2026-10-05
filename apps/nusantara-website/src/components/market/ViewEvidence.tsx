"use client";

import { useId, useRef } from "react";
import type { NusantaraView } from "@/content/model/intelligence";

/**
 * The reasoning behind a Nusantara View, one part at a time:
 * What we're watching | Key risk | What would change our view.
 * Existing view content only, reorganised; a tab appears only when the view
 * has that content. The chosen tab is owned by the caller so it persists
 * as the visitor moves between markets.
 */
export type EvidenceTab = "watching" | "risk" | "change";

const LABELS: Record<EvidenceTab, string> = {
  watching: "What we’re watching",
  risk: "Key risk",
  change: "What would change our view",
};

export function evidenceTabs(view: NusantaraView): EvidenceTab[] {
  const tabs: EvidenceTab[] = [];
  if (view.whatWeAreWatching.length) tabs.push("watching");
  if (view.keyRisk) tabs.push("risk");
  if (view.whatWouldChangeOurView) tabs.push("change");
  return tabs;
}

export function ViewEvidence({
  view,
  tab,
  onTab,
  className = "",
}: {
  view: NusantaraView;
  tab: EvidenceTab;
  onTab: (t: EvidenceTab) => void;
  className?: string;
}) {
  const uid = useId();
  const refs = useRef<Partial<Record<EvidenceTab, HTMLButtonElement | null>>>({});
  const tabs = evidenceTabs(view);
  if (!tabs.length) return null;
  const current = tabs.includes(tab) ? tab : tabs[0];

  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.indexOf(current);
    const next =
      e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] : e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length] : e.key === "Home" ? tabs[0] : e.key === "End" ? tabs[tabs.length - 1] : null;
    if (!next) return;
    e.preventDefault();
    onTab(next);
    refs.current[next]?.focus();
    refs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div className={`border-t border-white/10 pt-3 ${className}`}>
      {/* Below lg: one compact row that scrolls sideways if needed; from lg: wraps as before. */}
      <div
        role="tablist"
        aria-label="Reasoning behind this view"
        className="no-scrollbar -mx-5 flex gap-x-4 overflow-x-auto whitespace-nowrap px-5 md:-mx-8 md:px-8 lg:mx-0 lg:flex-wrap lg:gap-y-1 lg:overflow-visible lg:whitespace-normal lg:px-0"
        onKeyDown={onKey}
      >
        {tabs.map((t) => {
          const on = t === current;
          return (
            <button
              key={t}
              ref={(el) => {
                refs.current[t] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-${t}`}
              aria-selected={on}
              aria-controls={`${uid}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={(e) => {
                onTab(t);
                e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
              className={`relative shrink-0 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] transition-colors duration-200 ${on ? "text-gold-200" : "text-teal-300 hover:text-teal-50"}`}
            >
              {LABELS[t]}
              <span aria-hidden className={`absolute inset-x-0 -bottom-px h-px bg-gold-400 transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`} />
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${current}`} className="mt-2.5 min-h-[3.5rem] space-y-1.5 text-[14.5px] leading-snug text-teal-50">
        {current === "watching" && view.whatWeAreWatching.map((w) => <p key={w}>{w}</p>)}
        {current === "risk" && <p>{view.keyRisk}</p>}
        {current === "change" && <p>{view.whatWouldChangeOurView}</p>}
      </div>
    </div>
  );
}
