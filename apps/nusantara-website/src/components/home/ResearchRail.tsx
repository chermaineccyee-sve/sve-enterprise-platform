"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { InsightVisual } from "@/components/insights/InsightVisual";
import { MorphChart } from "@/components/market/MorphChart";
import { SERIES_COLORS, PRIMARY_LINE } from "@/components/market/chart-utils";
import { formatInsightDate, type InsightListing } from "@/content/insights/types";

type FeaturedChart = { caption: string; xLabels: string[]; series: { id: string; label: string; values: number[] }[]; decimals: number; unit?: string; illustrative: boolean };

/**
 * Full-bleed horizontal research rail: the featured piece carries a live,
 * explorable chart; further research follows as an editorial sequence.
 */
export function ResearchRail({ featured, chart, items }: { featured: InsightListing; chart: FeaturedChart | null; items: InsightListing[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const scroll = (dir: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 520), behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth > el.scrollWidth - 8);
  };
  const fmt = (v: number) =>
    `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: chart?.decimals ?? 1, maximumFractionDigits: chart?.decimals ?? 1 }).format(v)}${chart?.unit ?? ""}`;

  return (
    <div>
      <div className="container-site flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-stone">
            Nusantara Insights
          </p>
          <h2 className="display-l mt-5 text-teal-900">What it may mean.</h2>
        </div>
        <div className="hidden gap-2 md:flex">
          <button type="button" onClick={() => scroll(-1)} disabled={atStart} aria-label="Previous research" className="flex h-11 w-11 items-center justify-center border border-teal-800/30 text-teal-800 transition-colors hover:bg-teal-800 hover:text-white disabled:opacity-30">
            ←
          </button>
          <button type="button" onClick={() => scroll(1)} disabled={atEnd} aria-label="Next research" className="flex h-11 w-11 items-center justify-center border border-teal-800/30 text-teal-800 transition-colors hover:bg-teal-800 hover:text-white disabled:opacity-30">
            →
          </button>
        </div>
      </div>

      <ul
        ref={track}
        onScroll={onScroll}
        className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 pl-5 pr-5 md:gap-8 md:pl-10 xl:pl-[max(2.5rem,calc((100vw_-_1320px)/2_+_2.5rem))]"
        aria-label="Research"
      >
        {/* Featured */}
        <li className="w-[88vw] shrink-0 snap-start md:w-[min(820px,72vw)]">
          <article className="grid h-full border border-teal-800 bg-white md:grid-cols-5">
            <div className="flex flex-col p-6 md:col-span-2 md:p-8">
              <p className="eyebrow text-stone">Featured research · {featured.category}</p>
              <h3 className="mt-4 font-serif text-[1.8rem] leading-[1.1] text-teal-900">
                <Link href={`/insights/${featured.slug}`} className="hover:text-teal-700">
                  {featured.title}
                </Link>
              </h3>
              <p className="mt-4 text-[14.5px] leading-relaxed text-stone">{featured.summary}</p>
              <p className="num mt-auto pt-6 text-[12px] text-stone">
                {formatInsightDate(featured.date)} · {featured.sample ? "Illustrative · " : ""}{featured.readingTime} min
              </p>
            </div>
            <div className="border-t border-rule-soft p-5 md:col-span-3 md:border-l md:border-t-0">
              {chart ? (
                <>
                  <p className="text-[12.5px] text-charcoal">{chart.caption}</p>
                  <MorphChart
                    series={chart.series.map((s, i) => ({ ...s, color: chart.series.length > 1 ? SERIES_COLORS[i] : PRIMARY_LINE }))}
                    labels={chart.xLabels}
                    format={fmt}
                    height={240}
                    ariaLabel={`${chart.caption}.${chart.illustrative ? " Illustrative." : ""}`}
                  />
                  <p className="mt-1 text-[11px] text-stone">{chart.illustrative ? "Illustrative · " : ""}hover or use arrow keys to read values</p>
                </>
              ) : (
                <div className="aspect-[16/10]">
                  <InsightVisual insight={featured} />
                </div>
              )}
            </div>
          </article>
        </li>
        {items.map((i, k) => (
          <li key={i.slug} className="w-[72vw] shrink-0 snap-start sm:w-[340px]">
            <Link href={`/insights/${i.slug}`} className="group flex h-full flex-col">
              <div className="relative aspect-[4/3] overflow-hidden">
                <InsightVisual insight={i} className="transition-transform duration-700 group-hover:scale-[1.04]" />
                <span className="num absolute left-4 top-4 text-[11px] text-gold-300">{String(k + 2).padStart(2, "0")}</span>
              </div>
              <p className="eyebrow mt-5 text-stone">{i.category}</p>
              <h3 className="mt-2 font-serif text-[1.35rem] leading-snug text-teal-900 group-hover:text-teal-700">{i.title}</h3>
              <p className="num mt-auto pt-4 text-[12px] text-stone">
                {formatInsightDate(i.date)} · {i.sample ? "Illustrative · " : ""}{i.readingTime} min
              </p>
            </Link>
          </li>
        ))}
        <li className="flex w-[60vw] shrink-0 snap-start items-center sm:w-[280px]">
          <Link href="/insights" className="group flex h-full w-full flex-col justify-center border-l border-rule pl-8">
            <span className="font-serif text-[1.8rem] leading-tight text-teal-900">All research</span>
            <span className="mt-3 inline-flex items-center gap-2 text-[14px] text-teal-800">
              Nusantara Insights <span className="transition-transform group-hover:translate-x-1">→</span>
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
