import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody, LayerGlyph, LAYER_META } from "@/components/insights/ArticleBody";
import { InsightCard } from "@/components/insights/InsightCard";
import { InsightVisual } from "@/components/insights/InsightVisual";
import { ShareTools } from "@/components/insights/ShareTools";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import {
  formatInsightDate,
  getAllInsights,
  getInsight,
  getRelatedInsights,
  readingMinutes,
  toListing,
} from "@/content/insights";
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
    openGraph: {
      type: "article",
      title: insight.title,
      description: insight.summary,
      publishedTime: insight.date,
      authors: [insight.author],
      section: insight.category,
      tags: insight.tags,
    },
  };
}

export default async function InsightArticlePage({ params }: PageProps<"/insights/[slug]">) {
  const { slug } = await params;
  const insight = getInsight(slug);
  if (!insight) notFound();

  const minutes = readingMinutes(insight);
  const headings = insight.body.filter((b): b is Extract<typeof b, { type: "heading" }> => b.type === "heading");
  const related = getRelatedInsights(insight).map(toListing);
  const path = `/insights/${insight.slug}`;

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

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
          <div className="mt-14 grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-9">
              <p className="eyebrow text-gold-700">{insight.category}</p>
              <h1 className="display-l mt-5 text-teal-900">{insight.title}</h1>
              <p className="mt-6 max-w-3xl font-serif text-[1.35rem] leading-snug text-charcoal md:text-[1.5rem]">{insight.subtitle}</p>
            </div>
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

      <div className="relative aspect-[16/9] w-full overflow-hidden md:aspect-[21/7]" data-print="hide">
        <InsightVisual insight={insight} />
      </div>

      <div className="bg-paper">
        <div className="container-site grid gap-12 py-14 md:py-20 lg:grid-cols-12">
          <aside className="lg:col-span-3" data-print="hide">
            <div className="lg:sticky lg:top-32">
              <nav aria-label="Contents" className="hidden lg:block">
                <p className="eyebrow text-gold-700">Contents</p>
                <ol className="mt-4 space-y-2.5 border-l border-rule">
                  <li>
                    <a href="#summary" className="-ml-px block border-l border-transparent pl-4 text-[13.5px] text-stone hover:border-teal-800 hover:text-teal-800">
                      Executive summary
                    </a>
                  </li>
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="-ml-px block border-l border-transparent pl-4 text-[13.5px] text-stone hover:border-teal-800 hover:text-teal-800">
                        {h.text}
                      </a>
                    </li>
                  ))}
                  <li>
                    <a href="#sources" className="-ml-px block border-l border-transparent pl-4 text-[13.5px] text-stone hover:border-teal-800 hover:text-teal-800">
                      Sources and methodology
                    </a>
                  </li>
                </ol>
              </nav>
              <div className="mt-10 hidden border-t border-rule pt-6 lg:block">
                <p className="eyebrow text-gold-700">Reading layers</p>
                <ul className="mt-4 space-y-3">
                  {(["data", "interpretation", "implication"] as const).map((l) => (
                    <li key={l} className="flex items-center gap-3 text-[13px] text-charcoal">
                      <span className={l === "data" ? "text-teal-700" : l === "interpretation" ? "text-gold-700" : "text-teal-900"}>
                        <LayerGlyph layer={l} />
                      </span>
                      <span>
                        <strong className="font-semibold">{LAYER_META[l].label}</strong>
                        <span className="text-stone"> — {LAYER_META[l].description.toLowerCase()}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          <div className="min-w-0 lg:col-span-8 lg:col-start-4 xl:col-span-7 xl:col-start-4">
            {insight.status === "sample" && (
              <ReviewPlaceholder label="Sample research — management review" className="mb-10">
                This article was prepared to demonstrate the Nusantara research template. It is subject to review and approval
                before publication. Any data shown is illustrative.
              </ReviewPlaceholder>
            )}

            <section id="summary" aria-labelledby="summary-heading" className="scroll-mt-32 border-t-2 border-teal-800 bg-white p-6 md:p-8">
              <h2 id="summary-heading" className="eyebrow text-gold-700">
                Executive summary
              </h2>
              <div className="mt-4 space-y-4 font-serif text-[1.125rem] leading-relaxed text-charcoal">
                {insight.executiveSummary.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <h3 className="eyebrow mt-8 border-t border-rule-soft pt-6 text-gold-700">Key takeaways</h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {insight.keyTakeaways.map((t, i) => (
                  <li key={i} className="flex gap-3 text-[14.5px] leading-snug text-ink">
                    <span className="num font-semibold text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-14">
              <ArticleBody blocks={insight.body} />
            </div>

            <section id="sources" aria-labelledby="sources-heading" className="mt-16 scroll-mt-32 border-t border-rule pt-8">
              <h2 id="sources-heading" className="eyebrow text-gold-700">
                Sources
              </h2>
              <ol className="mt-4 space-y-3 text-[14px]">
                {insight.sources.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="num text-stone">{i + 1}.</span>
                    <span>
                      <span className="font-medium text-ink">{s.label}</span>
                      {s.detail && <span className="text-stone"> — {s.detail}</span>}
                    </span>
                  </li>
                ))}
              </ol>
              {insight.methodology && (
                <>
                  <h2 className="eyebrow mt-8 text-gold-700">Methodology</h2>
                  <p className="mt-3 text-[14px] leading-relaxed text-charcoal">{insight.methodology}</p>
                </>
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
          <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <InsightCard insight={r} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </article>
  );
}
