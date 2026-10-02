import Link from "next/link";
import { formatInsightDate, type InsightListing } from "@/content/insights/types";
import { InsightVisual } from "./InsightVisual";

type Variant = "standard" | "feature" | "text";

/** Editorial research card. Category, title, summary, date, author, reading time, tags. */
export function InsightCard({ insight, variant = "standard", headingLevel = 3 }: { insight: InsightListing; variant?: Variant; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const meta = (
    <p className="num flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-stone">
      <time dateTime={insight.date}>{formatInsightDate(insight.date)}</time>
      <span aria-hidden className="text-rule">/</span>
      <span>{insight.author}</span>
      <span aria-hidden className="text-rule">/</span>
      <span>{insight.readingTime} min read</span>
    </p>
  );

  if (variant === "feature") {
    return (
      <article className="group grid border border-rule-soft bg-white lg:grid-cols-12">
        <Link href={`/insights/${insight.slug}`} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] overflow-hidden lg:col-span-7 lg:aspect-auto lg:min-h-[420px]">
          <InsightVisual insight={insight} className="transition-transform duration-700 group-hover:scale-[1.02]" />
          {insight.featured && (
            <span className="eyebrow absolute left-5 top-5 bg-gold-500 px-2.5 py-1.5 text-teal-950">Featured research</span>
          )}
        </Link>
        <div className="flex flex-col p-6 md:p-10 lg:col-span-5">
          <p className="eyebrow text-gold-700">{insight.category}</p>
          <H className="display-m mt-4 text-teal-900">
            <Link href={`/insights/${insight.slug}`} className="hover:text-teal-700">
              {insight.title}
            </Link>
          </H>
          <p className="mt-4 text-[15.5px] leading-relaxed text-stone">{insight.summary}</p>
          <div className="mt-auto pt-8">
            {meta}
            <Tags tags={insight.tags} />
          </div>
        </div>
      </article>
    );
  }

  if (variant === "text") {
    return (
      <article className="group border-t border-rule py-6">
        <p className="eyebrow text-gold-700">{insight.category}</p>
        <H className="display-s mt-3 text-teal-900">
          <Link href={`/insights/${insight.slug}`} className="link-underline hover:text-teal-700">
            {insight.title}
          </Link>
        </H>
        <p className="mt-3 text-[14.5px] leading-relaxed text-stone">{insight.summary}</p>
        <div className="mt-4">{meta}</div>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col">
      <Link href={`/insights/${insight.slug}`} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] overflow-hidden">
        <InsightVisual insight={insight} className="transition-transform duration-700 group-hover:scale-[1.03]" />
      </Link>
      <div className="flex flex-1 flex-col border-b border-rule pb-6 pt-5">
        <p className="eyebrow text-gold-700">{insight.category}</p>
        <H className="mt-3 font-serif text-[1.45rem] leading-[1.2] text-teal-900">
          <Link href={`/insights/${insight.slug}`} className="hover:text-teal-700">
            {insight.title}
          </Link>
        </H>
        <p className="mt-3 text-[14.5px] leading-relaxed text-stone">{insight.summary}</p>
        <div className="mt-auto pt-5">{meta}</div>
      </div>
    </article>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
      {tags.map((t) => (
        <li key={t} className="border border-rule px-2 py-0.5 text-[11.5px] text-stone">
          {t}
        </li>
      ))}
    </ul>
  );
}

export function InsightGrid({ insights, columns = 3 }: { insights: InsightListing[]; columns?: 2 | 3 | 4 }) {
  const cols = columns === 4 ? "lg:grid-cols-4" : columns === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  return (
    <ul className={`grid gap-x-8 gap-y-12 sm:grid-cols-2 ${cols}`}>
      {insights.map((i) => (
        <li key={i.slug}>
          <InsightCard insight={i} />
        </li>
      ))}
    </ul>
  );
}
