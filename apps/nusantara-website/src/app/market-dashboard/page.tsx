import type { Metadata } from "next";
import { CrossAssetView } from "@/components/dashboard/CrossAssetView";
import { MarketMap } from "@/components/dashboard/MarketMap";
import { StructuralIndicators } from "@/components/dashboard/StructuralIndicators";
import { Workspace } from "@/components/dashboard/Workspace";
import { MarketFocusProvider } from "@/components/home/MarketFocus";
import { MarketRibbon } from "@/components/home/MarketRibbon";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CTA } from "@/components/ui/CTA";
import { getAllListings } from "@/content/insights";
import { crossAsset } from "@/lib/market/analytics";
import { formatTimestamp, STATUS_LABEL } from "@/lib/market/format";
import { getIntelligence, getMarketHistory, getMarketSnapshot } from "@/lib/market/service";
import type { DataStatus } from "@/lib/market/types";

export const metadata: Metadata = {
  title: "Market Dashboard",
  description:
    "The Nusantara Market Dashboard: an intelligence workspace across equities, currencies, rates, commodities and structural indicators, with Nusantara's view alongside the data.",
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
  const [snapshot, h1m, h3m, intelligence] = await Promise.all([getMarketSnapshot(), getMarketHistory("1M"), getMarketHistory("3M"), getIntelligence()]);
  const byId = Object.fromEntries(snapshot.instruments.map((s) => [s.instrument.id, s]));
  const listings = Object.fromEntries(getAllListings().map((l) => [l.slug, l]));
  const measures = crossAsset(
    snapshot.instruments,
    new Map(h1m.map((h) => [h.instrumentId, h.points])),
    new Map(h3m.map((h) => [h.instrumentId, h.points])),
  );

  return (
    <MarketFocusProvider initial="klci" targetId="workspace">
      {/* Masthead */}
      <section className="on-dark relative overflow-hidden bg-teal-950 text-white">
        <div className="container-site relative pt-8 pb-10 md:pt-10 md:pb-14">
          <Breadcrumb tone="dark" items={[{ label: "Home", href: "/" }, { label: "Market Dashboard" }]} />
          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow text-teal-200">
                Nusantara Market Dashboard
              </p>
              <h1 className="display-l mt-5">Markets at a glance.</h1>
            </div>
            <div className="lg:col-span-5">
              <p className="text-[15px] leading-relaxed text-teal-100">
                Market data on the left and centre; the Nusantara View — our interpretation — on the right.
              </p>
              <p className="num mt-4 text-[12px] text-teal-200">Illustrative data · As at {formatTimestamp(snapshot.provenance.asOf)}</p>
            </div>
          </div>
        </div>
      </section>
      <div className="hidden md:block">
        <MarketRibbon instruments={snapshot.instruments} />
      </div>

      {/* Workspace */}
      <section id="workspace" aria-label="Market workspace" className="scroll-mt-16 bg-paper">
        <div className="mx-auto max-w-[1720px] py-8 lg:px-8 lg:py-10">
          <Workspace snapshot={snapshot} initialHistory={h1m} indicators={intelligence.indicators} insights={listings} />
        </div>
      </section>

      {/* Cross-asset + map */}
      <section aria-label="Cross-asset view and markets we monitor" className="hidden border-t border-rule bg-white md:block">
        <div className="mx-auto grid max-w-[1720px] grid-cols-[minmax(0,1fr)] gap-16 px-5 py-16 md:px-10 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <p className="eyebrow text-stone">
              Cross-asset view
            </p>
            <h2 className="display-m mt-4 text-teal-900">Signals across asset classes.</h2>
            <div className="mt-10">
              <CrossAssetView measures={measures} />
            </div>
          </div>
          <div>
            <p className="eyebrow text-stone">
              Markets we monitor
            </p>
            <h2 className="display-m mt-4 text-teal-900">A regional and global watch-list.</h2>
            <div className="mt-10">
              <MarketMap instruments={byId} insights={listings} />
            </div>
          </div>
        </div>
      </section>

      {/* Structural indicators */}
      <section aria-labelledby="structural" className="border-t border-rule bg-ivory">
        <div className="container-site py-16 md:py-24">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow text-stone">
                Strategic market intelligence
              </p>
              <h2 id="structural" className="display-m mt-4 text-teal-900">
                Beneath the prices.
              </h2>
            </div>
            <p className="text-[15px] leading-relaxed text-stone lg:col-span-5">{intelligence.disclaimer}</p>
          </div>
          <div className="mt-12">
            <StructuralIndicators indicators={intelligence.indicators} />
          </div>
        </div>
      </section>

      {/* From data to meaning */}
      <section className="on-dark bg-teal-900 text-white">
        <div className="container-site grid gap-8 py-14 md:py-16 lg:grid-cols-12 lg:items-center">
          <p className="display-s lg:col-span-7">Market data answers what happened. Our signals say what we are watching. Our research asks what it may mean.</p>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <CTA href="/insights" variant="light">
              Nusantara Insights
            </CTA>
            <CTA href="/#market-state" variant="light">
              Market State
            </CTA>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section aria-labelledby="methodology" className="bg-paper">
        <div className="container-site grid gap-12 py-16 md:py-20 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow text-stone">Data methodology</p>
            <h2 id="methodology" className="display-s mt-4 text-teal-900">
              Every figure carries its source, timestamp and status.
            </h2>
            <p className="mt-5 text-[14.5px] leading-relaxed text-stone">
              The workspace reads one market-data interface. When an authorised provider is appointed, the illustrative dataset is
              replaced at that single point; attribution, timestamps and status labels update everywhere. Illustrative values never
              update on screen — only your selection changes.
            </p>
          </div>
          <dl className="divide-y divide-rule border-y border-rule lg:col-span-8">
            {STATUS_DEFINITIONS.map((d) => (
              <div key={d.status} className="grid gap-2 py-4 sm:grid-cols-[180px_1fr] sm:gap-8">
                <dt className="eyebrow pt-0.5 text-teal-800">{STATUS_LABEL[d.status]}</dt>
                <dd className="text-[14.5px] leading-relaxed text-charcoal">{d.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </MarketFocusProvider>
  );
}
