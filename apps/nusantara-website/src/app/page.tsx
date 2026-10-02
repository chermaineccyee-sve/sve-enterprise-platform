import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceSignal } from "@/components/home/GovernanceSignal";
import { HeroCanvas } from "@/components/home/HeroCanvas";
import { MarketFocusProvider } from "@/components/home/MarketFocus";
import { MarketLens } from "@/components/home/MarketLens";
import { MarketRibbon } from "@/components/home/MarketRibbon";
import { MarketState } from "@/components/home/MarketState";
import { ProcessStory } from "@/components/home/ProcessStory";
import { ResearchRail } from "@/components/home/ResearchRail";
import { Statement } from "@/components/home/Statement";
import { NStar } from "@/components/identity/NStar";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { CTA } from "@/components/ui/CTA";
import { getAllInsights, getAllListings } from "@/content/insights";
import { GOVERNANCE_LAYERS } from "@/content/governance";
import { INTELLIGENCE_STATUS } from "@/content/intelligence";
import { INSTRUMENTS } from "@/lib/market/instruments";
import { getIntelligence, getMarketHistory, getMarketSnapshot } from "@/lib/market/service";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — Investing with Perspective` },
  alternates: { canonical: "/" },
};

const RIBBON_IDS = ["klci", "sti", "jci", "nikkei", "hsi", "spx", "nasdaq", "usdmyr", "usdsgd", "usdidr", "gold", "silver", "brent", "cpo", "us10y", "mgs10y"];
const MONITOR_IDS = ["klci", "usdmyr", "gold", "us10y", "sti", "brent"];
const LENS_IDS = ["klci", "sti", "jci", "spx", "usdmyr", "usdsgd", "gold", "brent", "cpo", "us10y"];

const FLOW = [
  { label: "Markets", href: "#market-lens" },
  { label: "Signals", href: "#market-state" },
  { label: "Insight", href: "#research" },
  { label: "Investment thinking", href: "#process" },
  { label: "Governance", href: "#governance" },
];

export default async function HomePage() {
  const [snapshot, history, intelligence] = await Promise.all([getMarketSnapshot(), getMarketHistory("1M"), getIntelligence()]);
  const byId = Object.fromEntries(snapshot.instruments.map((s) => [s.instrument.id, s]));
  const sparks = Object.fromEntries(history.map((h) => [h.instrumentId, h.points.map((p) => p.v)]));
  const listings = getAllListings();
  const listingMap = Object.fromEntries(listings.map((l) => [l.slug, l]));
  const featuredFull = getAllInsights().find((i) => i.featured) ?? getAllInsights()[0];
  const featured = listingMap[featuredFull.slug];
  const chartBlock = featuredFull.body.find((b) => b.type === "chart");
  const chart =
    chartBlock && chartBlock.type === "chart"
      ? { caption: chartBlock.caption, xLabels: chartBlock.xLabels, series: chartBlock.series, decimals: chartBlock.decimals, unit: chartBlock.unit }
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

  return (
    <MarketFocusProvider initial="gold">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />

      {/* Hero — atmospheric market canvas */}
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ivory">
        <HeroCanvas instruments={pick(MONITOR_IDS)} sparks={sparks} />
        <div className="container-site pointer-events-none relative flex min-h-[min(86svh,860px)] flex-col justify-center py-20">
          <div className="pointer-events-auto max-w-2xl">
            <p className="eyebrow flex items-center gap-3 text-gold-700">
              <NStar className="h-2.5 w-2.5" />
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
          <nav aria-label="How Nusantara connects markets to decisions" className="pointer-events-auto mt-16 lg:mt-24">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] font-semibold uppercase tracking-[0.16em]">
              {FLOW.map((f, i) => (
                <li key={f.label} className="flex items-center gap-3">
                  <a href={f.href} className="link-underline text-teal-800 hover:text-teal-950">
                    {f.label}
                  </a>
                  {i < FLOW.length - 1 && <span aria-hidden className="text-gold-500">→</span>}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      <MarketRibbon instruments={pick(RIBBON_IDS)} />

      {/* Nusantara Market State */}
      <section id="market-state" aria-labelledby="state-title" className="scroll-mt-20 bg-paper">
        <div className="container-site py-20 md:py-28">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow flex items-center gap-3 text-gold-700">
                <NStar className="h-2.5 w-2.5" /> Nusantara Market State · {INTELLIGENCE_STATUS.edition}
              </p>
              <h2 id="state-title" className="display-l mt-6 text-teal-900">
                How we read the market.
              </h2>
            </div>
            <div className="lg:col-span-5">
              <p className="text-[15.5px] leading-relaxed text-stone">
                Six dimensions, each a reading rather than a number. Select one to see what sits behind it — the data, what would
                change our view, and the research that develops it.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 border border-gold-600/50 bg-gold-100/60 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gold-800">
                <NStar className="h-2 w-2" /> {INTELLIGENCE_STATUS.label}
              </p>
            </div>
          </div>
          <div className="mt-14">
            <MarketState instruments={byId} sparks={sparks} insights={listingMap} />
          </div>
        </div>
      </section>

      {/* Market → Signal → Insight */}
      <section id="market-lens" aria-labelledby="lens-title" className="scroll-mt-20 border-t border-rule bg-white">
        <div className="container-site py-20 md:py-28">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <h2 id="lens-title" className="display-l text-teal-900 lg:col-span-7">
              From market to meaning.
            </h2>
            <p className="text-[15.5px] leading-relaxed text-stone lg:col-span-5">
              Market data tells us what happened. Our signals say what we are watching. Our research considers what it may mean.
              Choose a market — here, or in the ribbon above.
            </p>
          </div>
          <div className="mt-12">
            <MarketLens instruments={pick(LENS_IDS)} initialHistory={history} insights={listingMap} />
          </div>
        </div>
      </section>

      {/* Who we are */}
      <section aria-labelledby="who-title" className="overflow-hidden border-t border-rule bg-paper">
        <div className="container-site py-24 md:py-36">
          <h2 id="who-title" className="eyebrow flex items-center gap-3 text-gold-700">
            <NStar className="h-2.5 w-2.5" /> Who we are
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

      {/* Investment process story */}
      <section id="process" aria-labelledby="process-title" className="on-dark scroll-mt-20 bg-teal-900 text-white">
        <div className="container-site pt-20 md:pt-28">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow flex items-center gap-3 text-gold-300">
                <NStar className="h-2.5 w-2.5" /> How Nusantara invests
              </p>
              <h2 id="process-title" className="display-l mt-6">
                Six stages. One discipline.
              </h2>
            </div>
            <p className="lede text-teal-100 lg:col-span-5">Scroll through the process. Each stage adds a layer to the system — nothing reaches allocation without passing through all of them.</p>
          </div>
        </div>
        <div className="container-site pb-20 pt-10 md:pb-28 lg:pt-0">
          <ProcessStory counts={{ instruments: INSTRUMENTS.length, indicators: intelligence.indicators.length, governanceLayers: GOVERNANCE_LAYERS.length }} />
          <div className="mt-10 lg:mt-0">
            <CTA href="/investment-approach" variant="light">
              Explore Our Approach
            </CTA>
          </div>
        </div>
      </section>

      {/* Research rail */}
      <section id="research" aria-label="Nusantara Insights" className="scroll-mt-20 bg-paper py-20 md:py-28">
        <ResearchRail featured={featured} chart={chart} items={listings.filter((l) => l.slug !== featured.slug).slice(0, 6)} />
      </section>

      {/* Governance signal */}
      <section id="governance" aria-labelledby="gov-title" className="on-dark scroll-mt-20 bg-teal-950 text-white">
        <div className="container-site py-20 md:py-28">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow flex items-center gap-3 text-gold-300">
                <NStar className="h-2.5 w-2.5" /> Governance
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
