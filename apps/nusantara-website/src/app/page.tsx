import type { Metadata } from "next";
import Link from "next/link";
import { InsightCard } from "@/components/insights/InsightCard";
import { IntelligencePreview } from "@/components/market/IntelligencePreview";
import { MarketPulse } from "@/components/market/MarketPulse";
import { Provenance } from "@/components/market/MarketStatus";
import { AccessToAllocation } from "@/components/sections/AccessToAllocation";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { GovernanceStack } from "@/components/sections/GovernanceStack";
import { InvestmentProcess } from "@/components/sections/InvestmentProcess";
import { NusantaraView } from "@/components/sections/NusantaraView";
import { RiskFramework } from "@/components/sections/RiskFramework";
import { StrategyCard } from "@/components/sections/StrategyCard";
import { CTA } from "@/components/ui/CTA";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAllListings } from "@/content/insights";
import { STRATEGIES } from "@/content/strategies";
import { PULSE_INSTRUMENT_IDS } from "@/lib/market/instruments";
import { getIntelligence, getMarketHistory, getMarketSnapshot } from "@/lib/market/service";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${site.name} — Investing with Perspective` },
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [pulse, pulseHistory, fullSnapshot, intelligence] = await Promise.all([
    getMarketSnapshot(PULSE_INSTRUMENT_IDS),
    getMarketHistory("1M", PULSE_INSTRUMENT_IDS),
    getMarketSnapshot(),
    getIntelligence(),
  ]);
  const insights = getAllListings().slice(0, 4);
  const capabilities = STRATEGIES.filter((s) => s.status !== "future-development");

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: `${site.url}/brand/nusantara-logo.png`,
    description: site.description,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />

      {/* 01 — Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden bg-ivory">
        <HeroField />
        <div className="container-site relative pt-16 pb-20 md:pt-24 md:pb-28 lg:pt-28">
          <p className="eyebrow text-gold-700">Nusantara Fund Management</p>
          <h1 id="hero-title" className="display-xl mt-8 max-w-[11ch] text-teal-900">
            Investing with perspective.
          </h1>
          <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end">
            <p className="lede max-w-xl text-charcoal lg:col-span-6">{site.description}</p>
            <div className="flex flex-wrap gap-3 lg:col-span-6 lg:justify-end">
              <CTA href="/investment-approach">Explore Our Approach</CTA>
              <CTA href="/market-dashboard" variant="secondary">
                Market Dashboard
              </CTA>
            </div>
          </div>
          <div className="mt-16 grid gap-px border-y border-rule bg-rule sm:grid-cols-4">
            {[
              ["Market", "What is happening?"],
              ["Insight", "What may it mean?"],
              ["Investment thinking", "How do we evaluate opportunity?"],
              ["Governance", "How is discipline maintained?"],
            ].map(([k, v], i) => (
              <div key={k} className="bg-ivory py-5 sm:px-5 sm:first:pl-0">
                <p className="num text-[11px] text-gold-700">0{i + 1}</p>
                <p className="mt-2 font-serif text-[1.2rem] text-teal-900">{k}</p>
                <p className="mt-1 text-[13px] text-stone">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 02 — Market pulse */}
      <section aria-label="Market pulse" className="border-b border-rule bg-paper">
        <div className="container-site py-16 md:py-24">
          <MarketPulse snapshot={pulse} history={pulseHistory} />
        </div>
      </section>

      {/* 03 — About */}
      <section aria-labelledby="about-title" className="bg-paper">
        <div className="container-site py-20 md:py-28">
          <Reveal className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="eyebrow text-gold-700">03 — About Nusantara</p>
              <h2 id="about-title" className="display-l mt-6 text-teal-900">
                Opportunity, examined.
              </h2>
            </div>
            <div className="space-y-6 lg:col-span-6 lg:col-start-7 lg:pt-14">
              <p className="font-serif text-[1.45rem] leading-snug text-charcoal">
                Nusantara Fund Management is an investment and allocation platform built around disciplined investment thinking,
                governance, curation and clear communication.
              </p>
              <p className="text-[16px] leading-relaxed text-stone">
                We evaluate and curate investment opportunities through a governed process — beginning with market intelligence,
                continuing through investment review and risk assessment, and extending to ongoing monitoring once capital is
                allocated. We would rather understand a few opportunities well than offer many superficially.
              </p>
              <CTA href="/about" variant="text">
                About Nusantara
              </CTA>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 04 — From access to governed allocation */}
      <section aria-labelledby="philosophy-title" className="bg-ivory">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            index="04"
            eyebrow="Our philosophy"
            title={<span id="philosophy-title">From access to governed allocation.</span>}
            intro="Access to opportunity has broadened. The point of difference is what happens next: selection, curation, governance, disciplined allocation and monitoring."
          />
          <Reveal className="mt-14">
            <AccessToAllocation />
          </Reveal>
        </div>
      </section>

      {/* 05 — How Nusantara invests */}
      <section aria-labelledby="process-title" className="on-dark bg-teal-900 text-white">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            index="05"
            eyebrow="How Nusantara invests"
            tone="dark"
            title={<span id="process-title">Six stages. One discipline.</span>}
            intro="Our operating model moves from market insight to monitoring, with governance at its centre. Each stage exists to reduce a particular kind of error."
          />
          <Reveal className="mt-14">
            <InvestmentProcess />
          </Reveal>
          <div className="mt-12">
            <CTA href="/investment-approach" variant="light">
              Explore Our Approach
            </CTA>
          </div>
        </div>
      </section>

      {/* 06 — Allocation capabilities */}
      <section aria-labelledby="capabilities-title" className="bg-paper">
        <div className="container-site py-20 md:py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow text-gold-700">06 — Allocation capabilities</p>
              <h2 id="capabilities-title" className="display-l mt-6 text-teal-900">
                Where we apply that thinking.
              </h2>
              <p className="mt-6 text-[15.5px] leading-relaxed text-stone">
                Capabilities are developed progressively, each with its own governance, documentation and risk controls. They
                describe where Nusantara can apply its process — not products on offer.
              </p>
              <div className="mt-8">
                <CTA href="/strategies" variant="text">
                  View all capabilities
                </CTA>
              </div>
            </div>
            <div className="border-t border-rule lg:col-span-8">
              {capabilities.map((s, i) => (
                <StrategyCard key={s.slug} strategy={s} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 07 — Market intelligence */}
      <section aria-labelledby="intel-title" className="on-dark bg-teal-950 text-white">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            index="07"
            eyebrow="Nusantara market intelligence"
            tone="dark"
            title={<span id="intel-title">What we are watching.</span>}
            intro="Beyond prices: rates, currencies, commodities, capital flows, alternative assets, private markets and the pools of wealth and capital behind them."
          />
          <Reveal className="mt-14">
            <IntelligencePreview snapshot={fullSnapshot} history={pulseHistory} intelligence={intelligence} />
          </Reveal>
          <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <Provenance provenance={intelligence.provenance} tone="dark" showTime={false} />
            <CTA href="/market-dashboard" variant="light">
              Explore Market Intelligence
            </CTA>
          </div>
        </div>
      </section>

      {/* 08 — Nusantara View */}
      <section id="nusantara-view" aria-label="Nusantara View" className="scroll-mt-24 bg-ivory">
        <div className="container-site py-20 md:py-28">
          <Reveal>
            <NusantaraView />
          </Reveal>
        </div>
      </section>

      {/* 09 — Latest insights */}
      <section aria-labelledby="insights-title" className="bg-paper">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            index="09"
            eyebrow="Latest insights"
            title={<span id="insights-title">Our research.</span>}
            intro="Market outlooks, investment perspectives and research notes — each pairing data with interpretation and implication."
            action={
              <CTA href="/insights" variant="text">
                View all insights
              </CTA>
            }
          />
          <Reveal className="mt-14 grid gap-x-8 gap-y-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <InsightCard insight={insights[0]} />
            </div>
            <div className="lg:col-span-5">
              {insights.slice(1).map((i) => (
                <InsightCard key={i.slug} insight={i} variant="text" />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* 10 — Governance & risk */}
      <section aria-labelledby="governance-title" className="border-t border-rule bg-white">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            index="10"
            eyebrow="Governance & risk"
            title={<span id="governance-title">Governance is part of the investment process.</span>}
            intro="Oversight, investment review, risk discipline, compliance, independent controls, and reporting and monitoring — each a layer through which decisions must pass."
          />
          <div className="mt-14 grid gap-14 lg:grid-cols-12">
            <Reveal className="lg:col-span-7">
              <GovernanceStack compact />
            </Reveal>
            <div className="lg:col-span-5">
              <RiskFramework showConcepts={false} layout="stacked" />
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
                <CTA href="/governance" variant="text">
                  Our governance
                </CTA>
                <Link href="/investment-approach#risk" className="link-underline text-[14px] text-stone hover:text-teal-800">
                  Risk &amp; resilience
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11 — Contact */}
      <ContactCTA />
    </>
  );
}

/** Quiet data-line field behind the hero: concentric arcs and a single market line. */
function HeroField() {
  const pts: string[] = [];
  let y = 300;
  for (let x = 0; x <= 1400; x += 14) {
    y += Math.sin(x / 61) * 5 + Math.cos(x / 23) * 3 - 0.9;
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1400 760" preserveAspectRatio="xMidYMid slice" fill="none">
      <g transform="translate(1180 380)">
        {[120, 200, 280, 360, 440, 520].map((r, i) => (
          <circle key={r} r={r} stroke={i === 3 ? "rgba(184,149,90,0.55)" : "rgba(18,56,74,0.08)"} strokeWidth={1} />
        ))}
      </g>
      <polyline points={pts.join(" ")} stroke="rgba(18,56,74,0.16)" strokeWidth={1.2} className="chart-draw" pathLength={1000} />
    </svg>
  );
}
