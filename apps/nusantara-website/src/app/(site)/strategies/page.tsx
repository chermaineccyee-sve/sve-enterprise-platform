import type { Metadata } from "next";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { AllocationUniverse } from "@/components/sections/AllocationUniverse";
import { StatusLabel } from "@/components/sections/StrategyCard";
import { PageHero } from "@/components/ui/PageHero";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import { STATUS_INFO, type StrategyStage } from "@/content/strategies";
import { getCapabilities, getContentGraph, getInsightListings } from "@/lib/content/repository";
import { getIntelligence, getMarketSnapshot } from "@/lib/market/service";

/** Market relationships refresh at most every five minutes once a live or delayed provider is configured. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Strategies",
  description:
    "Nusantara allocation capabilities across income, private credit, real assets, precious metals, alternatives, regional opportunities and Shariah-capable strategies.",
  alternates: { canonical: "/strategies" },
};

export default async function StrategiesPage() {
  const [snapshot, intelligence, STRATEGIES, graph, listings] = await Promise.all([
    getMarketSnapshot(),
    getIntelligence(),
    getCapabilities(),
    getContentGraph(),
    getInsightListings(),
  ]);
  const instruments = Object.fromEntries(snapshot.instruments.map((s) => [s.instrument.id, s]));
  const indicators = Object.fromEntries(intelligence.indicators.map((i) => [i.id, i]));
  const listingMap = Object.fromEntries(listings.map((l) => [l.slug, l]));
  const insights = Object.fromEntries(STRATEGIES.map((s) => [s.slug, listingMap[graph.insightsForCapability(s.slug)[0] ?? ""] ?? null]));
  return (
    <>
      <PageHero
        eyebrow="Strategies"
        title={<>Allocation capabilities.</>}
        lede="A modular view of where Nusantara can apply its investment process. Capabilities are developed progressively, each with its own governance, documentation and risk controls."
        crumbs={[{ label: "Home", href: "/" }, { label: "Strategies" }]}
      />

      <section aria-labelledby="modular" className="border-b border-rule bg-ivory">
        <div className="container-site grid gap-6 py-10 md:grid-cols-3">
          {["Curated, not crowded.", "Modular, not scattered.", "Governed, not promotional."].map((t) => (
            <p key={t} className="font-serif text-[1.45rem] text-teal-900">
              {t}
            </p>
          ))}
          <h2 id="modular" className="sr-only">
            Principles of the capability architecture
          </h2>
        </div>
      </section>

      <section aria-labelledby="capabilities" className="bg-ivory">
        <div className="mx-auto max-w-[1560px] px-5 py-16 md:px-10 md:py-24">
          <div className="mb-12 grid gap-6 lg:grid-cols-12 lg:items-end">
            <h2 id="capabilities" className="display-m text-teal-900 lg:col-span-6">
              The allocation universe.
            </h2>
            <p className="text-[15px] leading-relaxed text-stone lg:col-span-6">
              Select a capability. The canvas shows its role, an indicative asset-class profile, the risks we would assess, and the
              markets and research connected to it. These are capability areas — none is presented as an active product.
            </p>
          </div>
          {STRATEGIES.length ? (
            <AllocationUniverse strategies={STRATEGIES} instruments={instruments} indicators={indicators} insights={insights} provenance={snapshot.provenance} />
          ) : (
            <ReviewPlaceholder>Capabilities will be described here once management has approved them for publication.</ReviewPlaceholder>
          )}
        </div>
      </section>

      <section aria-labelledby="status" className="bg-ivory">
        <div className="container-site grid gap-12 py-20 md:py-24 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow text-stone">Status architecture</p>
            <h2 id="status" className="display-m mt-5 text-teal-900">
              Every capability carries an explicit status.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-stone">
              Status is set centrally and shown wherever a capability appears, so that nothing is presented as available before it
              has been approved.
            </p>
          </div>
          <dl className="divide-y divide-rule border-y border-rule lg:col-span-7 lg:col-start-6">
            {(Object.keys(STATUS_INFO) as StrategyStage[]).map((k) => {
              const n = STRATEGIES.filter((s) => s.stage === k).length;
              return (
                <div key={k} className="grid gap-2 py-5 sm:grid-cols-[200px_1fr_auto] sm:items-baseline sm:gap-6">
                  <dt>
                    <StatusLabel status={k} />
                  </dt>
                  <dd className="text-[15px] text-charcoal">{STATUS_INFO[k].description}</dd>
                  <dd className="num text-[12px] text-stone">{n === 0 ? "Not in use" : `${n} ${n === 1 ? "area" : "areas"}`}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      <section className="bg-ivory">
        <div className="container-site py-12">
          <ReviewPlaceholder>
            Objectives, time horizons, documents and terms will be published only for approved strategies. Capability descriptions
            are general information, not an offer.
          </ReviewPlaceholder>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}
