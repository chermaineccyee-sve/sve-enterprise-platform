import type { Metadata } from "next";
import { IntelligencePanel } from "@/components/market/IntelligencePanel";
import { MarketDashboard } from "@/components/market/MarketDashboard";
import { Provenance } from "@/components/market/MarketStatus";
import { MarketTicker } from "@/components/market/MarketTicker";
import { CTA } from "@/components/ui/CTA";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { STATUS_LABEL } from "@/lib/market/format";
import { getIntelligence, getMarketHistory, getMarketSnapshot, getRefreshInterval } from "@/lib/market/service";
import type { DataStatus } from "@/lib/market/types";

export const metadata: Metadata = {
  title: "Market Dashboard",
  description:
    "The Nusantara Market Dashboard: equities, currencies, rates and commodities at a glance, alongside strategic market intelligence.",
  alternates: { canonical: "/market-dashboard" },
};

const STATUS_DEFINITIONS: { status: DataStatus; text: string }[] = [
  { status: "live", text: "Streamed from an authorised source during market hours, subject to the provider’s terms." },
  { status: "delayed", text: "Sourced from an authorised provider and shown with a stated delay." },
  { status: "end-of-day", text: "Closing values from an authorised provider, updated after the session." },
  { status: "illustrative", text: "Generated for demonstration. Not market data and not to be relied upon." },
  { status: "placeholder", text: "Reserved for an indicator whose approved source has not yet been confirmed." },
];

export default async function MarketDashboardPage() {
  const [snapshot, history, intelligence] = await Promise.all([
    getMarketSnapshot(),
    getMarketHistory("1M"),
    getIntelligence(),
  ]);

  return (
    <>
      <PageHero
        tone="teal"
        eyebrow="Nusantara Market Dashboard"
        title={<>Markets at a glance.</>}
        lede="What is happening across equities, currencies, rates and commodities — and, beneath the prices, the structural indicators we watch."
        crumbs={[{ label: "Home", href: "/" }, { label: "Market Dashboard" }]}
        aside={<Provenance provenance={snapshot.provenance} tone="dark" className="mt-6" />}
      />
      <MarketTicker snapshot={snapshot} />

      <section aria-labelledby="level-a" className="bg-paper">
        <div className="container-site py-16 md:py-24">
          <div className="mb-10 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="eyebrow text-gold-700">Level A · Market data</p>
              <h2 id="level-a" className="display-m mt-4 text-teal-900">
                Prices, rates and currencies.
              </h2>
            </div>
            <Disclaimer title="Prototype data notice" className="lg:col-span-5 lg:self-end">
              {snapshot.disclaimer} Values are generated and do not reflect any exchange, index provider or data vendor.
            </Disclaimer>
          </div>
          <MarketDashboard
            initialSnapshot={snapshot}
            initialHistory={{ period: "1M", data: history }}
            refreshIntervalMs={getRefreshInterval()}
          />
        </div>
      </section>

      <section aria-labelledby="level-b" className="border-t border-rule bg-ivory">
        <div className="container-site py-16 md:py-24">
          <SectionHeader
            eyebrow="Level B · Strategic market intelligence"
            title={<span id="level-b">Beneath the prices.</span>}
            intro="Structural indicators across asset management, private markets, capital flows and private wealth. Each pairs the data with a Nusantara reading of what it may mean."
          />
          <Reveal className="mt-12">
            <IntelligencePanel snapshot={intelligence} />
          </Reveal>
          <Disclaimer title="About these indicators" className="mt-12 max-w-4xl">
            {intelligence.disclaimer}
          </Disclaimer>
        </div>
      </section>

      <section aria-labelledby="from-data" className="bg-teal-900 text-white on-dark">
        <div className="container-site grid gap-10 py-16 md:py-20 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="eyebrow text-gold-300">From data to interpretation</p>
            <h2 id="from-data" className="display-m mt-4">
              The dashboard shows what is happening. Our research considers what it may mean.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <CTA href="/insights" variant="light">
              Read Nusantara Insights
            </CTA>
            <CTA href="/#nusantara-view" variant="light">
              The Nusantara View
            </CTA>
          </div>
        </div>
      </section>

      <section aria-labelledby="methodology" className="bg-paper">
        <div className="container-site grid gap-12 py-16 md:py-24 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow text-gold-700">Data methodology</p>
            <h2 id="methodology" className="display-s mt-4 text-teal-900">
              Every figure carries its source, its timestamp and its status.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-stone">
              The dashboard is built on a single market-data interface. When an authorised provider is appointed, the
              illustrative dataset is replaced at that one point; source attribution, timestamps and status labels update
              throughout the site automatically.
            </p>
          </div>
          <div className="lg:col-span-8">
            <dl className="divide-y divide-rule border-y border-rule">
              {STATUS_DEFINITIONS.map((d) => (
                <div key={d.status} className="grid gap-2 py-5 sm:grid-cols-[180px_1fr] sm:gap-8">
                  <dt className="eyebrow pt-0.5 text-teal-800">{STATUS_LABEL[d.status]}</dt>
                  <dd className="text-[15px] leading-relaxed text-charcoal">{d.text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-[13px] leading-relaxed text-stone">
              Timestamps are shown in UTC. Intended future sources include exchange feeds, official statistical releases and
              licensed market-data providers, subject to management approval and the relevant licence terms.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
