import type { Metadata } from "next";
import { LayerGlyph, LAYER_META } from "@/components/insights/ArticleBody";
import { InsightCard } from "@/components/insights/InsightCard";
import { InsightsExplorer } from "@/components/insights/InsightsExplorer";
import { CTA } from "@/components/ui/CTA";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { getAllListings } from "@/content/insights";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Nusantara Insights: market outlooks, investment perspectives and research notes that pair data with interpretation and implication.",
  alternates: { canonical: "/insights" },
};

export default function InsightsPage() {
  const listings = getAllListings();
  const featured = listings.find((l) => l.featured) ?? listings[0];

  return (
    <>
      <PageHero
        eyebrow="Nusantara Insights"
        title={<>Research and perspectives.</>}
        lede="The Market Dashboard shows what is happening. Our research considers what it may mean — and what it implies for disciplined allocation."
        crumbs={[{ label: "Home", href: "/" }, { label: "Insights" }]}
      />

      <section aria-labelledby="how-to-read" className="border-y border-rule bg-white">
        <div className="container-site grid gap-8 py-10 md:grid-cols-12 md:items-center">
          <h2 id="how-to-read" className="eyebrow text-gold-700 md:col-span-3">
            How to read our research
          </h2>
          <ol className="grid gap-6 sm:grid-cols-3 md:col-span-9">
            {(["data", "interpretation", "implication"] as const).map((l, i) => (
              <li key={l} className="flex items-start gap-4">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center ${
                    l === "data" ? "border border-teal-200 bg-teal-50 text-teal-700" : l === "interpretation" ? "border-l-2 border-gold-500 bg-ivory text-gold-700" : "bg-teal-900 text-gold-300"
                  }`}
                >
                  <LayerGlyph layer={l} />
                </span>
                <span>
                  <span className="num text-[11px] text-stone">0{i + 1}</span>
                  <span className="block font-serif text-[1.2rem] text-teal-900">{LAYER_META[l].label}</span>
                  <span className="block text-[13.5px] text-stone">{LAYER_META[l].description}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-label="Featured research" className="bg-paper">
        <div className="container-site pt-16 md:pt-20">
          <Reveal>
            <InsightCard insight={featured} variant="feature" headingLevel={2} />
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="library" className="bg-paper">
        <div className="container-site py-16 md:py-24">
          <h2 id="library" className="display-m mb-10 text-teal-900">
            Research library
          </h2>
          <InsightsExplorer insights={listings} />
        </div>
      </section>

      <section className="border-t border-rule bg-ivory">
        <div className="container-site flex flex-col gap-6 py-14 md:flex-row md:items-center md:justify-between">
          <p className="display-s max-w-2xl text-teal-900">Questions about our research, or interested in receiving future publications?</p>
          <CTA href="/contact?topic=research">Research enquiries</CTA>
        </div>
      </section>
    </>
  );
}
