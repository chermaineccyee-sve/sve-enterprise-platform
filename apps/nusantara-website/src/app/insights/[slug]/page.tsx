import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody, LayerGlyph, LAYER_META } from "@/components/insights/ArticleBody";
import { InsightVisual } from "@/components/insights/InsightVisual";
import { ShareTools } from "@/components/insights/ShareTools";
import { ArticleToc } from "@/components/insights/v2/ArticleToc";
import { PrintOpen } from "@/components/insights/v2/PrintOpen";
import { NStar } from "@/components/identity/NStar";
import { Change } from "@/components/market/Change";
import { Sparkline } from "@/components/market/Sparkline";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import { formatInsightDate, getAllInsights, getInsight, getRelatedInsights, readingMinutes, toListing } from "@/content/insights";
import { getInstrumentView } from "@/content/intelligence";
import { formatTimestamp, formatValue } from "@/lib/market/format";
import { getMarketHistory, getMarketSnapshot } from "@/lib/market/service";
import { generalDisclaimer, site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllInsights().map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: PageProps<"/insights/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const insight = getInsight(slug);
  if (!insight) return {};
  return {
    title: insight.title,
    description: insight.summary,
    alternates: { canonical: `/insights/${insight.slug}` },
    openGraph: { type: "article", title: insight.title, description: insight.summary, publishedTime: insight.date, authors: [insight.author], section: insight.category, tags: insight.tags },
  };
}

export default async function InsightArticlePage({ params }: PageProps<"/insights/[slug]">) {
  const { slug } = await params;
  const insight = getInsight(slug);
  if (!insight) notFound();

  const minutes = readingMinutes(insight);
  const headings = insight.body.filter((b): b is Extract<typeof b, { type: "heading" }> => b.type === "heading");
  const toc = [{ id: "summary", text: "Executive summary" }, ...headings.map((h) => ({ id: h.id, text: h.text })), { id: "sources", text: "Sources and methodology" }];
  const related = getRelatedInsights(insight).map(toListing);
  const path = `/insights/${insight.slug}`;
  const signalIds = insight.relatedInstruments ?? [];
  const [snapshot, hist] = signalIds.length ? await Promise.all([getMarketSnapshot(signalIds), getMarketHistory("1M", signalIds)]) : [null, []];
  const sparks = new Map(hist.map((h) => [h.instrumentId, h.points.map((p) => p.v)]));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: insight.title,
    description: insight.summary,
    datePublished: insight.date,
    author: { "@type": "Organization", name: insight.author },
    publisher: { "@type": "Organization", name: site.name },
    articleSection: insight.category,
    keywords: insight.tags.join(", "),
    mainEntityOfPage: `${site.url}${path}`,
  };

  const marketSignals = snapshot?.instruments.length ? (
    <div>
      <p className="eyebrow flex items-center gap-2 text-gold-700">
        <NStar className="h-2 w-2" /> Market signals
      </p>
      <ul className="mt-3 space-y-3">
        {snapshot.instruments.map((s) => {
          const view = getInstrumentView(s.instrument.id, s.instrument.assetClass);
          return (
            <li key={s.instrument.id} className="border-l-2 border-teal-800 bg-white px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">{s.instrument.shortName}</span>
                <span className="num text-[13px] text-ink">
                  {formatValue(s.quote.value, s.instrument.decimals)}
                  {s.instrument.unit === "%" ? "%" : ""}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <Sparkline values={sparks.get(s.instrument.id) ?? []} width={96} height={22} label={`${s.instrument.shortName} one-month trend`} className="text-teal-800" />
                <Change instrument={s.instrument} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} />
              </div>
              <p className="mt-2 text-[12px] text-stone">
                Nusantara signal: <span className="font-serif text-[13.5px] italic text-gold-700">{view.signal}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10.5px] text-stone">Illustrative · As at {formatTimestamp(snapshot.provenance.asOf)}</p>
    </div>
  ) : null;

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PrintOpen />
      <header className="bg-ivory">
        <div className="container-site pt-10 pb-12 md:pt-14 md:pb-16">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Insights", href: "/insights" },
              { label: insight.category, href: `/insights?category=${encodeURIComponent(insight.category)}` },
              { label: insight.title },
            ]}
          />
          <div className="mt-14 max-w-5xl">
            <p className="eyebrow flex items-center gap-3 text-gold-700">
              <NStar className="h-2.5 w-2.5" /> {insight.category}
            </p>
            <h1 className="display-l mt-5 text-teal-900">{insight.title}</h1>
            <p className="mt-6 max-w-3xl font-serif text-[1.35rem] leading-snug text-charcoal md:text-[1.55rem]">{insight.subtitle}</p>
          </div>
          <div className="mt-10 flex flex-col gap-5 border-t border-rule pt-5 md:flex-row md:items-center md:justify-between">
            <dl className="num flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
              <div className="flex gap-2">
                <dt className="text-stone">Published</dt>
                <dd className="text-ink">
                  <time dateTime={insight.date}>{formatInsightDate(insight.date)}</time>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-stone">Author</dt>
                <dd className="text-ink">{insight.author}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-stone">Reading time</dt>
                <dd className="text-ink">{minutes} min</dd>
              </div>
            </dl>
            <ShareTools title={insight.title} path={path} />
          </div>
        </div>
      </header>

      <div className="relative aspect-[16/7] w-full overflow-hidden md:aspect-[24/6]" data-print="hide">
        <InsightVisual insight={insight} />
      </div>

      <div className="bg-paper">
        <div className="container-site grid gap-12 py-14 md:py-20 lg:grid-cols-12">
          <aside className="lg:col-span-3 xl:col-span-2" data-print="hide">
            <div className="lg:sticky lg:top-28">
              <ArticleToc items={toc} targetId="article-body" />
              <div className="mt-10 hidden border-t border-rule pt-6 lg:block">
                <p className="eyebrow text-gold-700">Reading layers</p>
                <ul className="mt-4 space-y-3">
                  {(["data", "interpretation", "implication"] as const).map((l) => (
                    <li key={l} className="flex items-center gap-3 text-[13px] text-charcoal">
                      <span className={l === "data" ? "text-teal-700" : l === "interpretation" ? "text-gold-700" : "text-teal-900"}>
                        <LayerGlyph layer={l} />
                      </span>
                      <strong className="font-semibold">{LAYER_META[l].label}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          <div id="article-body" className="min-w-0 lg:col-span-9 xl:col-span-7">
            {insight.status === "sample" && (
              <ReviewPlaceholder label="Sample research — management review" className="mb-10">
                Prepared to demonstrate the Nusantara research template. Subject to review and approval before publication. Any data
                shown is illustrative.
              </ReviewPlaceholder>
            )}

            <section id="summary" aria-labelledby="summary-heading" className="scroll-mt-32 border-t-2 border-teal-800 bg-white p-6 md:p-8">
              <h2 id="summary-heading" className="eyebrow text-gold-700">
                Executive summary
              </h2>
              <div className="mt-4 space-y-4 font-serif text-[1.15rem] leading-relaxed text-charcoal">
                {insight.executiveSummary.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {/* Takeaways inline below xl; in the margin from xl */}
              <div className="xl:hidden">
                <h3 className="eyebrow mt-8 border-t border-rule-soft pt-6 text-gold-700">Key takeaways</h3>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {insight.keyTakeaways.map((t, i) => (
                    <li key={i} className="flex gap-3 text-[14.5px] leading-snug text-ink">
                      <span className="num font-semibold text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                      {t}
                    </li>
                  ))}
                </ul>
                {marketSignals && <div className="mt-8 border-t border-rule-soft pt-6">{marketSignals}</div>}
              </div>
            </section>

            <div className="mt-14">
              <ArticleBody blocks={insight.body} />
            </div>

            <section id="sources" aria-labelledby="sources-heading" className="mt-16 scroll-mt-32 border-t border-rule pt-8">
              <h2 id="sources-heading" className="eyebrow text-gold-700">
                Sources
              </h2>
              <ol className="mt-4 divide-y divide-rule-soft border-y border-rule-soft">
                {insight.sources.map((s, i) => (
                  <li key={i}>
                    <details className="group py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] [&::-webkit-details-marker]:hidden">
                        <span>
                          <span className="num mr-3 text-stone">{i + 1}.</span>
                          <span className="font-medium text-ink">{s.label}</span>
                        </span>
                        <span aria-hidden className="text-teal-800 transition-transform group-open:rotate-45">+</span>
                      </summary>
                      {s.detail && <p className="mt-2 pl-7 text-[13.5px] leading-relaxed text-stone">{s.detail}</p>}
                    </details>
                  </li>
                ))}
              </ol>
              {insight.methodology && (
                <details className="group mt-6 border border-rule bg-white p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                    <span className="eyebrow text-gold-700">Methodology</span>
                    <span aria-hidden className="text-teal-800 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[14px] leading-relaxed text-charcoal">{insight.methodology}</p>
                </details>
              )}
              <ul className="mt-8 flex flex-wrap gap-1.5" aria-label="Tags">
                {insight.tags.map((t) => (
                  <li key={t} className="border border-rule px-2 py-0.5 text-[12px] text-stone">
                    {t}
                  </li>
                ))}
              </ul>
              <Disclaimer className="mt-10">{generalDisclaimer}</Disclaimer>
            </section>
          </div>

          {/* Margin notes (xl) */}
          <aside className="hidden xl:col-span-3 xl:block" aria-label="Margin notes" data-print="hide">
            <div className="sticky top-28 space-y-10">
              <div>
                <p className="eyebrow text-gold-700">Key takeaways</p>
                <ol className="mt-3 space-y-4">
                  {insight.keyTakeaways.map((t, i) => (
                    <li key={i} className="border-l border-gold-500 pl-4 font-serif text-[1.05rem] leading-snug text-teal-900">
                      <span className="num mb-1 block font-sans text-[11px] text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              </div>
              {marketSignals}
            </div>
          </aside>
        </div>
      </div>

      <section aria-labelledby="related" className="border-t border-rule bg-ivory" data-print="hide">
        <div className="container-site py-16 md:py-20">
          <div className="flex items-end justify-between gap-6">
            <h2 id="related" className="display-m text-teal-900">
              Related insights
            </h2>
            <Link href="/insights" className="link-underline hidden text-[14px] text-teal-800 sm:inline">
              All insights →
            </Link>
          </div>
          <ol className="mt-10 border-t border-teal-800">
            {related.map((r, i) => (
              <li key={r.slug} className="border-b border-rule">
                <Link href={`/insights/${r.slug}`} className="group grid gap-2 py-6 md:grid-cols-[60px_200px_minmax(0,1fr)_40px] md:items-baseline md:gap-6">
                  <span className="num text-[12px] text-mist">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-700">{r.category}</span>
                  <span className="font-serif text-[1.5rem] leading-snug text-teal-900 transition-transform duration-500 group-hover:translate-x-2">{r.title}</span>
                  <span aria-hidden className="hidden text-teal-800 md:block">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </article>
  );
}
