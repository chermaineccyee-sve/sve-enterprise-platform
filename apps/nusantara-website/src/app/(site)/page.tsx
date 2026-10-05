import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceSignal } from "@/components/home/GovernanceSignal";
import { HeroCanvas } from "@/components/home/HeroCanvas";
import { MarketFocusProvider } from "@/components/home/MarketFocus";
import { MarketIntelligence } from "@/components/home/MarketIntelligence";
import { MarketRibbon } from "@/components/home/MarketRibbon";
import { MarketState } from "@/components/home/MarketState";
import { ProcessStory, ProcessSummary } from "@/components/home/ProcessStory";
import { ResearchRail } from "@/components/home/ResearchRail";
import { Statement } from "@/components/home/Statement";
import { CurrentTime } from "@/components/market/CurrentTime";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { CTA } from "@/components/ui/CTA";
import { PublicationStamp } from "@/components/ui/PublicationStamp";
import { getMarketIntel } from "@/lib/content/market-intel";
import { getFeaturedInsight, getInsightListings, getMarketState } from "@/lib/content/repository";
import { INSTRUMENTS } from "@/lib/market/instruments";
import { getIntelligence, getMarketHistory, getMarketSnapshot } from "@/lib/market/service";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — Investing with Perspective` },
  alternates: { canonical: "/" },
};

/** Market-bearing pages refresh at most every five minutes once a live or delayed provider is configured. */
export const revalidate = 300;

const RIBBON_IDS = ["klci", "sti", "jci", "nikkei", "hsi", "spx", "nasdaq", "usdmyr", "usdsgd", "usdidr", "gold", "silver", "brent", "cpo", "us10y", "mgs10y"];
const MONITOR_IDS = ["klci", "usdmyr", "gold", "us10y", "sti", "brent"];

export default async function HomePage() {
  const [snapshot, history, intelligence, listings, featuredFull, marketState, intel] = await Promise.all([
    getMarketSnapshot(),
    getMarketHistory("1M"),
    getIntelligence(),
    getInsightListings(),
    getFeaturedInsight(),
    getMarketState(),
    getMarketIntel(RIBBON_IDS),
  ]);
  const histories = Object.fromEntries(history.map((h) => [h.instrumentId, h.points]));
  const byId = Object.fromEntries(snapshot.instruments.map((s) => [s.instrument.id, s]));
  const sparks = Object.fromEntries(history.map((h) => [h.instrumentId, h.points.map((p) => p.v)]));
  const listingMap = Object.fromEntries(listings.map((l) => [l.slug, l]));
  const featured = featuredFull ? listingMap[featuredFull.slug] : null;
  const chartBlock = featuredFull?.body.find((b) => b.type === "chart");
  const chart =
    chartBlock && chartBlock.type === "chart"
      ? { caption: chartBlock.caption, xLabels: chartBlock.xLabels, series: chartBlock.series, decimals: chartBlock.decimals, unit: chartBlock.unit, illustrative: chartBlock.illustrative }
      : null;
  const pick = (ids: string[]) => ids.map((id) => byId[id]).filter(Boolean);

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: `${site.url}/brand/nusantara-logo.png`,
    description: site.description,
  };

  const ribbon = pick(RIBBON_IDS);

  return (
    <MarketFocusProvider initial={ribbon[0]?.instrument.id ?? "klci"} targetId="market-intelligence">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />

      {/* Hero — atmospheric market canvas */}
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ivory">
        <HeroCanvas instruments={ribbon} monitorIds={MONITOR_IDS} sparks={sparks} />
        <div className="container-site pointer-events-none relative flex min-h-[min(86svh,860px)] flex-col justify-center py-20">
          <div className="pointer-events-auto max-w-2xl">
            <p className="eyebrow text-stone">
              Nusantara Fund Management
            </p>
            <h1 id="hero-title" className="display-xl mt-8 max-w-[9ch] text-teal-900">
              Investing with perspective.
            </h1>
            <p className="lede mt-8 max-w-md text-charcoal">
              We watch the markets, form a view, and subject every allocation decision to governance.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <CTA href="/investment-approach">Explore Our Approach</CTA>
              <CTA href="/market-dashboard" variant="secondary">
                Market Dashboard
              </CTA>
            </div>
          </div>
        </div>
      </section>

      <MarketRibbon instruments={ribbon} provenance={snapshot.provenance} />

      {/* Market intelligence — selecting a market anywhere above updates it */}
      {ribbon.length > 0 && (
        <section id="market-intelligence" aria-labelledby="mi-title" className="bg-paper">
          <div className="container-site pt-16 pb-16 md:pt-20 md:pb-24 lg:pt-14 lg:pb-16">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <p className="eyebrow text-stone">Market intelligence</p>
                  <CurrentTime seconds={false} tone="light" />
                </div>
                <h2 id="mi-title" className="display-m mt-4 text-teal-900">
                  Markets observed. A view formed.
                </h2>
              </div>
              <p className="text-[15px] leading-relaxed text-stone lg:col-span-5">
                Select a market. What happened sits on the left; what we are watching, and what it may mean, on the right.
              </p>
            </div>
            <div className="mt-10 lg:mt-7">
              <MarketIntelligence instruments={ribbon} histories={histories} intel={intel} provenance={snapshot.provenance} />
            </div>
          </div>
        </section>
      )}

      {/* Who we are */}
      <section aria-labelledby="who-title" className="overflow-hidden border-t border-rule bg-paper">
        <div className="container-site py-24 md:py-36">
          <h2 id="who-title" className="eyebrow text-stone">
            Who we are
          </h2>
          <div className="mt-10">
            <Statement phrases={["We are not organised", "around what we can offer.", "We are organised around", "how decisions are made."]}>
              <div className="relative mt-12 grid gap-8 md:grid-cols-12">
                <p className="text-[17px] leading-relaxed text-charcoal md:col-span-6 lg:col-span-5">
                  Nusantara Fund Management is an investment and allocation platform built around disciplined investment thinking,
                  governance, curation and clear communication.
                </p>
                <div className="md:col-span-5 md:col-start-8 lg:col-start-8">
                  <CTA href="/about" variant="text">
                    About Nusantara
                  </CTA>
                </div>
              </div>
            </Statement>
          </div>
        </div>
      </section>

      {/* Nusantara Market State — rendered only while an edition may be shown */}
      {marketState && (
      <section id="market-state" aria-labelledby="state-title" className="bg-paper">
        <div className="container-site py-20 md:py-28">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <h2 id="state-title" className="display-l text-teal-900">
                Nusantara Market State
              </h2>
            </div>
            <div className="lg:col-span-5">
              {marketState.framing ? (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gold-800">{marketState.framing.title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-stone">{marketState.framing.note}</p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gold-800">{marketState.edition}</p>
                  <PublicationStamp p={marketState} className="mt-2" />
                </>
              )}
            </div>
          </div>
          <div className="mt-14">
            <MarketState edition={marketState} instruments={byId} sparks={sparks} insights={listingMap} provenance={snapshot.provenance} />
          </div>
        </div>
      </section>
      )}

      {/* Investment process story */}
      <section id="process" aria-labelledby="process-title" className="on-dark bg-teal-900 text-white">
        <div className="container-site pt-20 md:pt-28">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow text-teal-200">
                How Nusantara invests
              </p>
              <h2 id="process-title" className="display-l mt-6">
                Six stages. One discipline.
              </h2>
            </div>
            <p className="lede text-teal-100 lg:col-span-5">Scroll through the process. Each stage adds a layer to the system — nothing reaches allocation without passing through all of them.</p>
          </div>
        </div>
        <div className="container-site pb-20 pt-10 md:pb-28 lg:pt-0">
          <ProcessStory counts={{ instruments: INSTRUMENTS.length, indicators: intelligence.indicators.length }} />
          <div className="mt-14 lg:mt-4">
            <ProcessSummary />
          </div>
          <div className="mt-10">
            <CTA href="/investment-approach" variant="light">
              Explore Our Approach
            </CTA>
          </div>
        </div>
      </section>

      {/* Research rail — rendered only while research may be shown */}
      {featured && (
        <section id="research" aria-label="Nusantara Insights" className="bg-paper py-20 md:py-28">
          <ResearchRail featured={featured} chart={chart} items={listings.filter((l) => l.slug !== featured.slug).slice(0, 6)} />
        </section>
      )}

      {/* Governance signal */}
      <section id="governance" aria-labelledby="gov-title" className="on-dark bg-teal-950 text-white">
        <div className="container-site py-20 md:py-28">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow text-teal-200">
                Governance
              </p>
              <h2 id="gov-title" className="display-l mt-6">
                Every decision passes the same gates.
              </h2>
            </div>
            <div className="lg:col-span-5">
              <p className="text-[15.5px] leading-relaxed text-teal-100">Governance is part of the investment process, not an afterthought. It improves decisions; it does not remove investment risk.</p>
              <Link href="/governance" className="link-underline mt-4 inline-block text-[14px] text-gold-300 hover:text-white">
                Our governance →
              </Link>
            </div>
          </div>
          <div className="mt-16">
            <GovernanceSignal />
          </div>
        </div>
      </section>

      <ContactCTA />
    </MarketFocusProvider>
  );
}
