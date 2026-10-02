"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { INSIGHT_CATEGORIES, formatInsightDate, type InsightCategory, type InsightListing } from "@/content/insights/types";

type Filter = "All" | InsightCategory;

/**
 * Research index: large editorial rows rather than a card grid. Categories
 * filter in place (no reload).
 */
export function DeepDives({ insights }: { insights: InsightListing[] }) {
  const [cat, setCat] = useState<Filter>("All");
  const [q, setQ] = useState("");

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("category");
    if (c && (INSIGHT_CATEGORIES as readonly string[]).includes(c) && insights.some((i) => i.category === c)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from URL once on mount
      setCat(c as InsightCategory);
    }
  }, [insights]);

  const select = (c: Filter) => {
    setCat(c);
    const url = new URL(window.location.href);
    if (c === "All") url.searchParams.delete("category");
    else url.searchParams.set("category", c);
    window.history.replaceState(null, "", url);
  };

  const counts = new Map<string, number>();
  insights.forEach((i) => counts.set(i.category, (counts.get(i.category) ?? 0) + 1));
  const needle = q.trim().toLowerCase();
  const shown = insights.filter(
    (i) => (cat === "All" || i.category === cat) && (!needle || [i.title, i.subtitle, i.summary, ...i.tags].join(" ").toLowerCase().includes(needle)),
  );

  return (
    <div>
      <div className="flex flex-col gap-5 border-b border-rule pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div role="group" aria-label="Filter by category" className="no-scrollbar -mx-5 flex min-w-0 gap-1 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
          {(["All", ...INSIGHT_CATEGORIES.filter((c) => counts.has(c))] as Filter[]).map((c) => {
            const n = c === "All" ? insights.length : counts.get(c) ?? 0;
            const on = cat === c;
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => select(c)} disabled={n === 0} className={`relative flex h-9 shrink-0 items-center gap-2 px-3.5 text-[12px] uppercase tracking-[0.1em] disabled:opacity-35 ${on ? "text-white" : "text-charcoal hover:text-teal-800"}`}>
                {on && <m.span layoutId="dd-cat" className="absolute inset-0 bg-teal-800" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                <span className="relative">{c}</span>
                <span className={`num relative text-[11px] ${on ? "text-teal-200" : "text-mist"}`}>{n}</span>
              </button>
            );
          })}
        </div>
        <label className="relative block lg:w-72">
          <span className="sr-only">Search research</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search research" className="h-10 w-full border-b border-teal-800/40 bg-transparent pr-8 text-[14px] placeholder:text-mist focus:border-teal-800 focus:outline-none" />
        </label>
      </div>
      <p className="mt-5 text-[12.5px] text-stone" aria-live="polite">
        {shown.length} {shown.length === 1 ? "piece" : "pieces"}
        {cat !== "All" ? ` in ${cat}` : ""}
      </p>

      <div
        className="relative mt-4"
      >
        <ol>
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((i, k) => (
              <m.li key={i.slug} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="border-b border-rule">
                <Link
                  href={`/insights/${i.slug}`}
                  className="group grid gap-2 py-7 md:grid-cols-[60px_200px_minmax(0,1fr)_170px] md:items-baseline md:gap-6"
                >
                  <span className="num text-[12px] text-mist">{String(k + 1).padStart(2, "0")}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone">{i.category}</span>
                  <span>
                    <span className="block font-serif text-[1.6rem] leading-[1.15] text-teal-900 transition-transform duration-500 group-hover:translate-x-2 md:text-[2rem]">{i.title}</span>
                    <span className="mt-2 block max-w-2xl text-[14.5px] leading-relaxed text-stone">{i.summary}</span>
                  </span>
                  <span className="num text-[12px] text-stone md:text-right">
                    {formatInsightDate(i.date)}
                    <br className="hidden md:block" /> <span className="md:hidden">·</span> {i.readingTime} min read
                  </span>
                </Link>
              </m.li>
            ))}
          </AnimatePresence>
        </ol>
        {shown.length === 0 && <p className="py-16 text-center text-stone">No research matches this filter yet.</p>}
      </div>
    </div>
  );
}
