import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackedDetails, TrackOnMount } from "@/components/analytics/Track";
import { ArticleBody } from "@/components/insights/ArticleBody";
import { InsightCover } from "@/components/insights/InsightCover";
import { ShareTools } from "@/components/insights/ShareTools";
import { ArticleToc } from "@/components/insights/v2/ArticleToc";
import { LayerFocus } from "@/components/insights/v2/LayerFocus";
import { PrintOpen } from "@/components/insights/v2/PrintOpen";
import { Change } from "@/components/market/Change";
import { StaleMark } from "@/components/market/MarketStatus";
import { Sparkline } from "@/components/market/Sparkline";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { readingMinutes, toListing } from "@/content/insights";
import { SAMPLE_LABELS } from "@/content/data/sample";
import { formatInsightDate, type InsightSource } from "@/content/insights/types";
import { getCapabilities, getContentGraph, getInsight, getInsights, getMarketState } from "@/lib/content/repository";
import { routes } from "@/lib/routes";
import { SnapshotStamp } from "@/components/market/MarketTime";
import { formatValue } from "@/lib/market/format";
import { getMarketHistory, getMarketSnapshot } from "@/lib/market/service";
import { statusTitle } from "@/lib/market/status";
import { generalDisclaimer, site } from "@/lib/site";

/** Unknown slugs render notFound() on request, so the 404 hydrates with the real path. */
export const dynamicParams = true;

/** Market signals in the margin refresh at most every five minutes once a live or delayed provider is configured. */
export const revalidate = 300;

export async function generateStaticParams() {
  return (await getInsights()).map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: PageProps<"/insights/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const insight = await getInsight(slug);
  if (!insight) return {};
  const title = insight.seo?.title ?? insight.title;
  const description = insight.seo?.description ?? insight.summary;
  return {
    title,
    description,
    alternates: { canonical: `/insights/${insight.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: insight.publishedAt ?? insight.date,
      modifiedTime: insight.updatedAt,
      authors: [insight.author],
      section: insight.category,
      tags: insight.tags,
      ...(insight.seo?.image ? { images: [insight.seo.image] } : {}),
    },
  };
}

/** Source-governance metadata, shown when present (provider, dates, licence, method, link). */
function SourceMeta({ source }: { source: InsightSource }) {
  const rows: [string, React.ReactNode][] = [];
  if (source.provider) rows.push(["Provider", source.provider]);
  if (source.publishedAt) rows.push(["Published", formatInsightDate(source.publishedAt.slice(0, 10))]);
  if (source.retrievedAt) rows.push(["Retrieved", formatInsightDate(source.retrievedAt.slice(0, 10))]);
  if (source.licensingNote) rows.push(["Licence", source.licensingNote]);
  if (source.methodology) rows.push(["Method", source.methodology]);
  if (source.url)
    rows.push([
      "Reference",
      <a key="u" href={source.url} rel="noopener noreferrer" target="_blank" className="link-underline text-teal-800">
        {source.url}
      </a>,
    ]);
  if (!rows.length) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 pl-7 text-[12.5px] text-stone sm:grid-cols-[90px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>{k}</dt>
          <dd className="text-charcoal">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function InsightArticlePage({ params }: PageProps<"/insights/[slug]">) {
  const { slug } = await params;
  const insight = await getInsight(slug);
  if (!insight) notFound();
  const [graph, marketState, capabilities] = await Promise.all([getContentGraph(), getMarketState(), getCapabilities()]);
  // Where this research connects in the analytical system (resolved by the relationship engine).
  const dims = graph
    .dimensionsForInsight(insight.slug)
    .map((id) => marketState?.dimensions.find((d) => d.id === id))
    .filter((d) => !!d)
    .slice(0, 3);
  const caps = graph
    .capabilitiesForInsight(insight.slug)
    .map((slug) => capabilities.find((c) => c.slug === slug))
    .filter((c) => !!c)
    .slice(0, 3);

  const minutes = readingMinutes(insight);
  const headings = insight.body.filter((b): b is Extract<typeof b, { type: "heading" }> => b.type === "heading");
  const toc = [{ id: "summary", text: "Executive summary" }, ...headings.map((h) => ({ id: h.id, text: h.text })), { id: "sources", text: "Sources and methodology" }];
  const related = graph.relatedInsights(insight.slug).map(toListing);
  const path = `/insights/${insight.slug}`;
  const signalIds = graph.marketsForInsight(insight.slug);
  const updated = !insight.sample && insight.updatedAt.slice(0, 10) !== insight.date ? insight.updatedAt.slice(0, 10) : null;
  const [snapshot, hist] = signalIds.length ? await Promise.all([getMarketSnapshot(signalIds), getMarketHistory("1M", signalIds)]) : [null, []];
  const sparks = new Map(hist.map((h) => [h.instrumentId, h.points.map((p) => p.v)]));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: insight.title,
    description: insight.summary,
    datePublished: insight.publishedAt ?? insight.date,
    dateModified: insight.updatedAt,
    author: { "@type": "Organization", name: insight.author },
    publisher: { "@type": "Organization", name: site.name },
    articleSection: insight.category,
    keywords: insight.tags.join(", "),
    mainEntityOfPage: `${site.url}${path}`,
  };

  const marketSignals = snapshot?.instruments.length ? (
    <div>
      <p className="eyebrow flex items-center gap-2 text-stone">
        Market signals
      </p>
      <ul className="mt-3 space-y-3">
        {snapshot.instruments.map((s) => {
          const view = graph.viewForMarket(s.instrument.id);
          return (
            <li key={s.instrument.id}>
              <Link
                href={routes.market(s.instrument.id)}
                aria-label={`${s.instrument.shortName}: open market view`}
                className="group block border-l-2 border-teal-800 bg-paper px-4 py-3 transition-colors hover:border-gold-500"
              >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">
                  {s.instrument.shortName} <StaleMark provenance={s.provenance} />
                </span>
                <span className="num text-[13px] text-ink">
                  {formatValue(s.quote.value, s.instrument.decimals)}
                  {s.instrument.unit === "%" ? "%" : ""}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <Sparkline values={sparks.get(s.instrument.id) ?? []} width={96} height={22} label={`${s.instrument.shortName} one-month trend`} className="text-teal-800" />
                <Change instrument={s.instrument} change={s.quote.change} changePct={s.quote.changePct} changeBp={s.quote.changeBp} showAbsolute={false} />
              </div>
              {view?.signal && (
                <p className="mt-2 text-[12px] text-stone">
                  Nusantara signal: <span className="font-serif text-[13.5px] italic text-gold-700">{view.signal}</span>
                </p>
              )}
              <p className="mt-2 text-[11.5px] font-medium text-teal-800 group-hover:text-teal-700">Open market view →</p>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10.5px] text-stone">
        {statusTitle(snapshot.provenance)} · {snapshot.provenance.status === "illustrative" ? "Snapshot" : "As at"} <SnapshotStamp provenance={snapshot.provenance} />
      </p>
      {snapshot.instruments.some((s) => graph.viewForMarket(s.instrument.id)?.sample) && (
        <p className="mt-1 text-[10.5px] font-medium tracking-[0.04em] text-gold-800">Nusantara signals: {SAMPLE_LABELS.interpretation}</p>
      )}
    </div>
  ) : null;

  const connected =
    dims.length || caps.length ? (
      <div>
        <p className="eyebrow text-stone">Connected</p>
        <dl className="mt-3 space-y-3 text-[13px]">
          {dims.length > 0 && (
            <div>
              <dt className="text-stone">Market State</dt>
              <dd className="mt-1 flex flex-col gap-1">
                {dims.map((d) => (
                  <Link key={d!.id} href={routes.dimension(d!.id)} className="link-underline self-start text-teal-800">
                    {d!.label}: {d!.state.toLowerCase()}
                  </Link>
                ))}
              </dd>
            </div>
          )}
          {caps.length > 0 && (
            <div>
              <dt className="text-stone">Capabilities</dt>
              <dd className="mt-1 flex flex-col gap-1">
                {caps.map((c) => (
                  <Link key={c!.slug} href={routes.capability(c!.slug)} className="link-underline self-start text-teal-800">
                    {c!.name}
                  </Link>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
    ) : null;

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PrintOpen />
      <TrackOnMount event={{ name: "insight_opened", slug: insight.slug }} />
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
            <p className="eyebrow text-stone">
              {insight.category}
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
                  {insight.sample && <span className="text-stone"> · Illustrative</span>}
                </dd>
              </div>
              {updated && (
                <div className="flex gap-2">
                  <dt className="text-stone">Last updated</dt>
                  <dd className="text-ink">
                    <time dateTime={updated}>{formatInsightDate(updated)}</time>
                  </dd>
                </div>
              )}
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
        <InsightCover insight={insight} variant="hero" sizes="100vw" />
      </div>
      {insight.cover?.type === "image" && (insight.cover.caption || insight.cover.image.credit) && (
        <p className="container-site pt-3 text-[12px] text-stone" data-print="hide">
          {[insight.cover.caption, insight.cover.image.credit].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="bg-ivory">
        <div className="container-site grid gap-12 py-14 md:py-20 lg:grid-cols-12">
          <aside className="lg:col-span-3 xl:col-span-2" data-print="hide">
            <div className="lg:sticky lg:top-28">
              <ArticleToc items={toc} targetId="article-body" />
              <div className="mt-10 hidden border-t border-rule pt-6 lg:block">
                <p className="eyebrow text-stone">Reading layers</p>
                <LayerFocus targetId="article-body" />
              </div>
            </div>
          </aside>

          <div id="article-body" className="min-w-0 lg:col-span-9 xl:col-span-7">
            {insight.sample && (
              <p className="mb-10 border-l-2 border-gold-500 pl-4 text-[12.5px] text-stone">
                <span className="font-medium uppercase tracking-[0.08em] text-gold-800">Management review · Pending approval.</span> Data shown is illustrative.
              </p>
            )}

            <section id="summary" aria-labelledby="summary-heading" className="border-t-2 border-teal-800 bg-paper p-6 md:p-8">
              <h2 id="summary-heading" className="eyebrow text-stone">
                Executive summary
              </h2>
              <div className="mt-4 space-y-4 font-serif text-[1.15rem] leading-relaxed text-charcoal">
                {insight.executiveSummary.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {/* Takeaways inline below xl; in the margin from xl */}
              <div className="xl:hidden">
                <h3 className="eyebrow mt-8 border-t border-rule-soft pt-6 text-stone">Key takeaways</h3>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {insight.keyTakeaways.map((t, i) => (
                    <li key={i} className="flex gap-3 text-[14.5px] leading-snug text-ink">
                      <span className="num font-semibold text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                      {t}
                    </li>
                  ))}
                </ul>
                {marketSignals && <div className="mt-8 border-t border-rule-soft pt-6">{marketSignals}</div>}
                {connected && <div className="mt-8 border-t border-rule-soft pt-6">{connected}</div>}
              </div>
            </section>

            <div className="mt-14">
              <ArticleBody blocks={insight.body} />
            </div>

            <section id="sources" aria-labelledby="sources-heading" className="mt-16 border-t border-rule pt-8">
              <h2 id="sources-heading" className="eyebrow text-stone">
                Sources
              </h2>
              <ol className="mt-4 divide-y divide-rule-soft border-y border-rule-soft">
                {insight.sources.map((s, i) => (
                  <li key={i}>
                    <TrackedDetails event={{ name: "insight_source_expanded", slug: insight.slug, source: i + 1 }} className="group py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] [&::-webkit-details-marker]:hidden">
                        <span>
                          <span className="num mr-3 text-stone">{i + 1}.</span>
                          <span className="font-medium text-ink">{s.label}</span>
                        </span>
                        <span aria-hidden className="text-teal-800 transition-transform group-open:rotate-45">+</span>
                      </summary>
                      {s.detail && <p className="mt-2 pl-7 text-[13.5px] leading-relaxed text-stone">{s.detail}</p>}
                      <SourceMeta source={s} />
                    </TrackedDetails>
                  </li>
                ))}
              </ol>
              {insight.methodology && (
                <details className="group mt-6 border border-rule bg-paper p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                    <span className="eyebrow text-stone">Methodology</span>
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
                <p className="eyebrow text-stone">Key takeaways</p>
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
              {connected}
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
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone">{r.category}</span>
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
