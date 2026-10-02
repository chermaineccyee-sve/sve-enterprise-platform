"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LineChart } from "@/components/market/LineChart";
import { PRIMARY_LINE, SERIES_COLORS } from "@/components/market/chart-utils";
import { MarketStatus } from "@/components/market/MarketStatus";
import type { Block } from "@/content/insights/types";

type ChartBlock = Extract<Block, { type: "chart" }>;

export function ArticleChart({ block, index }: { block: ChartBlock; index: number }) {
  const fmt = (v: number) =>
    `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: block.decimals, maximumFractionDigits: block.decimals }).format(v)}${block.unit ?? ""}`;
  const multi = block.series.length > 1;
  const ref = useRef<HTMLDivElement>(null);
  // Draw the chart when it scrolls into view (and keep it mounted afterwards).
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [forPrint, setForPrint] = useState(false);
  useEffect(() => {
    const on = () => flushSync(() => setForPrint(true));
    window.addEventListener("beforeprint", on);
    return () => window.removeEventListener("beforeprint", on);
  }, []);
  return (
    <figure className="not-prose my-12 border-y border-rule py-6 font-sans">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption className="max-w-xl">
          <span className="eyebrow text-gold-700">Figure {index}</span>
          <span className="mt-2 block font-serif text-[1.2rem] leading-snug text-teal-900">{block.caption}</span>
        </figcaption>
        {block.illustrative && <MarketStatus status="illustrative" />}
      </div>
      {multi && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1" aria-label="Legend">
          {block.series.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 text-[12.5px] text-charcoal">
              <span aria-hidden className="block h-0.5 w-4" style={{ background: SERIES_COLORS[i] }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="mt-4 min-h-[260px]">
        {(inView || forPrint) && (
        <LineChart
          series={block.series.map((s, i) => ({ ...s, color: multi ? SERIES_COLORS[i] : PRIMARY_LINE }))}
          xLabels={block.xLabels}
          formatValue={fmt}
          area={!multi}
          height={260}
          ariaLabel={`${block.caption}.${block.illustrative ? " Illustrative data." : ""}`}
          tableCaption={block.caption}
          endLabels={!multi}
        />
        )}
      </div>
      <p className="mt-3 text-[12px] text-stone">Source: {block.source}</p>
    </figure>
  );
}
