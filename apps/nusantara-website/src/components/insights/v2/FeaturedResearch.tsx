"use client";

import Link from "next/link";
import { MorphChart } from "@/components/market/MorphChart";
import { formatInsightDate, type InsightListing } from "@/content/insights/types";

type Chart = { caption: string; xLabels: string[]; series: { id: string; label: string; values: number[] }[]; decimals: number; unit?: string };

/** Flagship research with its own explorable chart and its key takeaways. */
export function FeaturedResearch({ insight, chart, takeaways }: { insight: InsightListing; chart: Chart | null; takeaways: string[] }) {
  const fmt = (v: number) =>
    `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: chart?.decimals ?? 1, maximumFractionDigits: chart?.decimals ?? 1 }).format(v)}${chart?.unit ?? ""}`;
  return (
    <div className="grid lg:grid-cols-12">
      <div className="flex flex-col py-10 lg:col-span-6 lg:py-16 lg:pr-12">
        <p className="eyebrow text-teal-200">
          Featured research · {insight.category}
        </p>
        <h2 className="mt-6 font-serif text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.04] tracking-[-0.02em] text-white">
          <Link href={`/insights/${insight.slug}`} className="hover:text-gold-100">
            {insight.title}
          </Link>
        </h2>
        <p className="mt-6 text-[16px] leading-relaxed text-teal-100">{insight.summary}</p>
        <ol className="mt-8 space-y-3 border-t border-white/10 pt-6">
          {takeaways.slice(0, 3).map((t, i) => (
            <li key={t} className="flex gap-3 text-[14px] text-teal-50">
              <span className="num text-gold-300">{String(i + 1).padStart(2, "0")}</span>
              {t}
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-wrap items-center gap-6 pt-10">
          <Link href={`/insights/${insight.slug}`} className="btn-fill inline-flex h-12 items-center gap-3 border border-white/30 px-6 text-[14px] font-medium text-white hover:text-teal-900 [--fill:#fff]">
            Read the research <span aria-hidden>→</span>
          </Link>
          <span className="num text-[12px] text-teal-200">
            {formatInsightDate(insight.date)} · {insight.author} · {insight.readingTime} min
          </span>
        </div>
      </div>
      <div className="border-t border-white/10 py-10 lg:col-span-6 lg:border-l lg:border-t-0 lg:py-16 lg:pl-12">
        {chart && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="max-w-md text-[13px] text-teal-100">{chart.caption}</p>
              <span className="inline-flex items-center gap-1.5 border border-gold-300/50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gold-200">
                Illustrative
              </span>
            </div>
            {chart.series.length > 1 && (
              <ul className="mt-4 flex gap-5" aria-label="Legend">
                {chart.series.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 text-[12px] text-teal-100">
                    <span aria-hidden className="block h-0.5 w-4" style={{ background: i === 0 ? "#cdae73" : "#9db6c0" }} />
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6">
              <MorphChart
                series={chart.series.map((s, i) => ({ ...s, color: i === 0 ? "#cdae73" : "#9db6c0" }))}
                labels={chart.xLabels}
                format={fmt}
                height={260}
                tone="dark"
                area={chart.series.length === 1}
                ariaLabel={`${chart.caption}. Illustrative.`}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
