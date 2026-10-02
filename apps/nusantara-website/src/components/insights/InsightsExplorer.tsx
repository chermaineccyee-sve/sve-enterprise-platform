"use client";

import { useEffect, useMemo, useState } from "react";
import { INSIGHT_CATEGORIES, type InsightCategory, type InsightListing } from "@/content/insights/types";
import { InsightCard } from "./InsightCard";

type Filter = "All" | InsightCategory;

/** Category filter + keyword search over the research library. */
export function InsightsExplorer({ insights }: { insights: InsightListing[] }) {
  const [category, setCategory] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  // Allow deep links such as /insights?category=Market%20Outlook
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("category");
    if (c && (INSIGHT_CATEGORIES as readonly string[]).includes(c)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from URL once on mount
      setCategory(c as InsightCategory);
    }
  }, []);

  const select = (c: Filter) => {
    setCategory(c);
    const url = new URL(window.location.href);
    if (c === "All") url.searchParams.delete("category");
    else url.searchParams.set("category", c);
    window.history.replaceState(null, "", url);
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of insights) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [insights]);

  const q = query.trim().toLowerCase();
  const shown = insights.filter(
    (i) =>
      (category === "All" || i.category === category) &&
      (!q || [i.title, i.subtitle, i.summary, ...i.tags].join(" ").toLowerCase().includes(q)),
  );

  return (
    <div>
      <div className="flex flex-col gap-6 border-b border-rule pb-6 lg:flex-row lg:items-end lg:justify-between">
        <fieldset className="scrollbar-thin -mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 lg:flex-wrap">
          <legend className="sr-only">Filter by category</legend>
          {(["All", ...INSIGHT_CATEGORIES] as Filter[]).map((c) => {
            const n = c === "All" ? insights.length : counts.get(c) ?? 0;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => select(c)}
                className={`flex h-9 shrink-0 items-center gap-2 border px-3.5 text-[12.5px] uppercase tracking-[0.08em] transition-colors ${
                  category === c ? "border-teal-800 bg-teal-800 text-white" : "border-rule text-charcoal hover:border-teal-600"
                }`}
              >
                {c}
                <span className={`num text-[11px] ${category === c ? "text-teal-200" : "text-mist"}`}>{n}</span>
              </button>
            );
          })}
        </fieldset>
        <label className="relative block lg:w-72">
          <span className="sr-only">Search insights</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search research"
            className="h-10 w-full border-b border-teal-800/40 bg-transparent pr-8 text-[14px] text-ink placeholder:text-mist focus:border-teal-800 focus:outline-none"
          />
          <svg aria-hidden viewBox="0 0 16 16" className="absolute right-1 top-3 h-4 w-4 text-stone" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l4 4" />
          </svg>
        </label>
      </div>
      <p className="mt-6 text-[13px] text-stone" aria-live="polite">
        {shown.length} {shown.length === 1 ? "article" : "articles"}
        {category !== "All" ? ` in ${category}` : ""}
        {q ? ` matching “${query.trim()}”` : ""}
      </p>
      {shown.length === 0 ? (
        <p className="py-16 text-center text-stone">No research matches this filter yet.</p>
      ) : (
        <ul className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((i) => (
            <li key={i.slug}>
              <InsightCard insight={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
