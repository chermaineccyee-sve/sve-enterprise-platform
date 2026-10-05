import type { Metadata } from "next";
import { LayerGlyph, LAYER_META } from "@/components/insights/ArticleBody";
import { DeepDives } from "@/components/insights/v2/DeepDives";
import { FeaturedResearch } from "@/components/insights/v2/FeaturedResearch";
import { LatestSignals } from "@/components/insights/v2/LatestSignals";
import { Themes } from "@/components/insights/v2/Themes";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CTA } from "@/components/ui/CTA";
import { SAMPLE_LABELS } from "@/content/data/sample";
import { getContentGraph, getFeaturedInsight, getInsightListings, getSignals, getThemes } from "@/lib/content/repository";
import { getIntelligence, getMarketSnapshot } from "@/lib/market/service";

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Nusantara Insights: featured research, latest signals, deep dives and the themes we are watching — each pairing data with interpretation and implication.",
  alternates: { canonical: "/insights" },
};

export default async function InsightsPage() {
  const [snapshot, intelligence, listings, featuredFull, signals, themeList, graph] = await Promise.all([
    getMarketSnapshot(),
    getIntelligence(),
    getInsightListings(),
    getFeaturedInsight(),
    getSignals(),
    getThemes(),
    getContentGraph(),
  ]);
  const instruments = Object.fromEntries(snapshot.instruments.map((s) => [s.instrument.id, s]));
  const indicators = Object.fromEntries(intelligence.indicators.map((i) => [i.id, i]));
  const listingMap = Object.fromEntries(listings.map((l) => [l.slug, l]));
  const chartBlock = featuredFull?.body.find((b) => b.type === "chart");
  const chart =
    chartBlock && chartBlock.type === "chart"
      ? { caption: chartBlock.caption, xLabels: chartBlock.xLabels, series: chartBlock.series, decimals: chartBlock.decimals, unit: chartBlock.unit, illustrative: chartBlock.illustrative }
      : null;
  // Curated research first, then anything else the relationship engine links to the theme.
  const themes = themeList
    .map((t) => ({ ...t, insights: [...new Set([...t.insights, ...graph.insightsForTheme(t.id)])].filter((s) => listingMap[s]) }))
    .filter((t) => t.insights.length > 0);
  const signalsLabel = signals.some((s) => s.sample) ? SAMPLE_LABELS.label : null;

  return (
    <>
      {/* Masthead */}
      <section className="relative overflow-hidden bg-ivory">
        <div className="container-site relative pt-10 pb-14 md:pt-14 md:pb-20">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Insights" }]} />
          <p className="eyebrow mt-14 flex items-center gap-3 text-stone">
            Nusantara Insights
          </p>
          <h1 className="display-xl mt-6 max-w-[12ch] text-teal-900">What it may mean.</h1>
          <ol className="mt-12 grid max-w-3xl gap-6 border-t border-rule pt-6 sm:grid-cols-3">
            {(["data", "interpretation", "implication"] as const).map((l, i) => (
              <li key={l} className="flex items-start gap-3">
                <span className={`mt-0.5 ${l === "data" ? "text-teal-700" : l === "interpretation" ? "text-gold-700" : "text-teal-900"}`}>
                  <LayerGlyph layer={l} />
                </span>
                <span>
                  <span className="num text-[11px] text-stone">0{i + 1} </span>
                  <span className="font-serif text-[1.15rem] text-teal-900">{LAYER_META[l].label}</span>
                  <span className="block text-[13px] text-stone">{LAYER_META[l].description}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured */}
      {featuredFull && (
        <section aria-label="Featured research" className="on-dark bg-teal-900 text-white">
          <div className="container-site">
            <FeaturedResearch insight={listingMap[featuredFull.slug]} chart={chart} takeaways={featuredFull.keyTakeaways} />
          </div>
        </section>
      )}

      {/* Latest signals */}
      {signals.length > 0 && (
      <section aria-labelledby="signals" className="bg-ivory">
        <div className="container-site py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-stone">
                Latest signals
              </p>
              <h2 id="signals" className="display-m mt-4 text-teal-900">
                What we are watching, briefly.
              </h2>
            </div>
            {signalsLabel && <p className="text-[12px] text-stone">{signalsLabel}</p>}
          </div>
          <div className="mt-10 border-y border-rule">
            <LatestSignals signals={signals} instruments={instruments} />
          </div>
        </div>
      </section>
      )}

      {/* Deep dives */}
      <section aria-labelledby="deep-dives" className="border-t border-rule bg-ivory">
        <div className="container-site py-16 md:py-24">
          <p className="eyebrow text-stone">
            Deep dives
          </p>
          <h2 id="deep-dives" className="display-m mt-4 text-teal-900">
            The research library.
          </h2>
          <div className="mt-10">
            {listings.length ? (
              <DeepDives insights={listings} />
            ) : (
              <p className="border-y border-rule py-10 text-[15px] text-stone">Research will appear here once it has been approved for publication.</p>
            )}
          </div>
        </div>
      </section>

      {/* Themes */}
      {themes.length > 0 && (
      <section aria-labelledby="themes" className="overflow-hidden border-t border-rule bg-ivory">
        <div className="container-site py-16 md:py-24">
          <p className="eyebrow text-gold-700">
            Themes we are watching
          </p>
          <h2 id="themes" className="display-m mt-4 max-w-2xl text-teal-900">
            {COUNT_WORDS[themes.length] ?? themes.length} {themes.length === 1 ? "thread that runs" : "threads that run"} through our research.
          </h2>
          <div className="mt-12">
            <Themes themes={themes} insights={listingMap} instruments={instruments} indicators={indicators} provenance={snapshot.provenance} />
          </div>
        </div>
      </section>
      )}

      <section className="border-t border-rule bg-ivory">
        <div className="container-site flex flex-col gap-6 py-14 md:flex-row md:items-center md:justify-between">
          <p className="display-s max-w-2xl text-teal-900">Questions about our research, or interested in future publications?</p>
          <CTA href="/contact?topic=research">Research enquiries</CTA>
        </div>
      </section>
    </>
  );
}
