import { NStar } from "@/components/identity/NStar";
import type { Metadata } from "next";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { ProcessStory } from "@/components/home/ProcessStory";
import { AccessToAllocation } from "@/components/sections/AccessToAllocation";
import { GOVERNANCE_LAYERS } from "@/content/governance";
import { INSTRUMENTS } from "@/lib/market/instruments";
import { ILLUSTRATIVE_INDICATORS } from "@/lib/market/providers/illustrative-intelligence";
import { RiskFramework } from "@/components/sections/RiskFramework";
import { CTA } from "@/components/ui/CTA";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { INFORMATION_PATHWAY, PILLARS } from "@/content/approach";

export const metadata: Metadata = {
  title: "Investment Approach",
  description:
    "How Nusantara evaluates opportunity: market intelligence, curation, investment assessment, risk and governance, allocation discipline, monitoring and reporting.",
  alternates: { canonical: "/investment-approach" },
};

const STAGES = [
  {
    id: "market-intelligence",
    title: "Market Intelligence",
    lead: "Context before opportunity.",
    text: "We study the market environment — macro conditions, rates, currencies, asset-class dynamics and structural shifts in capital — to understand where opportunity may arise and what could undermine it.",
    points: ["Macro and policy environment", "Asset-class conditions and valuation", "Structural shifts in capital and wealth", "Signals that challenge our assumptions"],
  },
  {
    id: "opportunity-curation",
    title: "Opportunity Curation",
    lead: "Curated, not crowded.",
    text: "Potential strategies and asset classes are filtered for relevance, quality and fit before any detailed review. Saying no early is part of the discipline.",
    points: ["Relevance to defined capabilities", "Quality of sponsor or manager", "Transparency of structure", "Initial fit with portfolio objectives"],
  },
  {
    id: "investment-assessment",
    title: "Investment Assessment",
    lead: "Evidence over narrative.",
    text: "Each opportunity is assessed on its merits and its risks: return drivers, downside scenarios, liquidity terms, valuation methodology, fees and operational arrangements.",
    points: ["Return drivers and downside cases", "Liquidity and redemption terms", "Valuation methodology and frequency", "Operational and counterparty arrangements"],
  },
  {
    id: "risk-governance",
    title: "Risk & Governance",
    lead: "Independent challenge.",
    text: "Opportunities are subject to oversight, compliance review and risk assessment before any commitment. Governance shapes the decision; it is not applied afterwards.",
    points: ["Oversight and approval", "Compliance and investor screening", "Risk assessment and limits", "Separation of independent controls"],
  },
  {
    id: "allocation-discipline",
    title: "Allocation Discipline",
    lead: "Sized for uncertainty.",
    text: "Capital is allocated with explicit attention to position size, liquidity alignment and concentration, through documented processes and appropriate eligibility and suitability checks.",
    points: ["Sizing relative to conviction and risk", "Liquidity alignment with commitments", "Concentration awareness", "Suitability and eligibility"],
  },
  {
    id: "monitoring",
    title: "Monitoring",
    lead: "Does the thesis still hold?",
    text: "Positions are reviewed against the reasons they were taken. Material change is identified early, and assumptions are revisited on a defined cycle.",
    points: ["Review against original thesis", "Early identification of material change", "Periodic reassessment of assumptions"],
  },
  {
    id: "reporting",
    title: "Reporting",
    lead: "Clear, layered communication.",
    text: "Investors receive information appropriate to their stage of engagement — clear, consistent and timely, with material events communicated promptly.",
    points: ["Periodic reporting", "Material event communication", "Plain-language explanation of risk"],
  },
];

export default function InvestmentApproachPage() {
  return (
    <>
      <PageHero
        eyebrow="Investment Approach"
        title={<>Opportunity alone is insufficient.</>}
        lede="Investment opportunity must be accompanied by understanding, selection, risk assessment, governance, execution discipline and ongoing monitoring."
        crumbs={[{ label: "Home", href: "/" }, { label: "Investment Approach" }]}
      />

      <section aria-labelledby="philosophy" className="bg-paper">
        <div className="container-site grid gap-12 py-20 md:py-28 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow text-gold-700">Our philosophy</p>
            <h2 id="philosophy" className="display-m mt-5 text-teal-900">
              From access to governed allocation.
            </h2>
          </div>
          <div className="space-y-6 text-[17px] leading-relaxed text-charcoal lg:col-span-6 lg:col-start-7">
            <p className="font-serif text-[1.45rem] leading-snug text-teal-900">
              The question is no longer whether an opportunity can be reached. It is whether it has been properly understood,
              selected, governed, explained and monitored.
            </p>
            <p>
              As access to investment products has broadened, availability has become a weaker differentiator. What matters is
              the discipline applied before and after capital is committed. Our approach is designed around that discipline.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="From access to governed allocation" className="border-t border-rule bg-ivory">
        <div className="container-site py-16 md:py-20">
          <AccessToAllocation />
        </div>
      </section>

      <section aria-labelledby="model" className="on-dark bg-teal-900 text-white">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            eyebrow="Operating model"
            tone="dark"
            title={<span id="model">Governed allocation at the centre.</span>}
            intro="Six stages, each designed to reduce a particular kind of error — noise at the start, poor fit in the middle, drift once capital is deployed."
          />
          <div className="mt-10 lg:-mt-10">
            <ProcessStory counts={{ instruments: INSTRUMENTS.length, indicators: ILLUSTRATIVE_INDICATORS.length, governanceLayers: GOVERNANCE_LAYERS.length }} />
          </div>
        </div>
      </section>

      <section aria-labelledby="stages" className="bg-paper">
        <div className="container-site py-20 md:py-28">
          <SectionHeader eyebrow="In detail" title={<span id="stages">How each stage works.</span>} />
          <div className="mt-14 border-t border-teal-800">
            {STAGES.map((s, i) => (
              <Reveal key={s.id} id={s.id} className="grid scroll-mt-32 gap-6 border-b border-rule py-12 lg:grid-cols-12 lg:gap-10">
                <div className="lg:col-span-4">
                  <span className="num text-[12px] text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="display-s mt-3 text-teal-900">{s.title}</h3>
                  <p className="mt-2 font-serif text-[1.1rem] italic text-gold-700">{s.lead}</p>
                </div>
                <p className="text-[16px] leading-relaxed text-charcoal lg:col-span-5">{s.text}</p>
                <ul className="space-y-2 lg:col-span-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-3 text-[14px] text-stone">
                      <NStar className="mt-1.5 h-2 w-2 text-gold-500" />
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="risk" aria-labelledby="risk-title" className="scroll-mt-24 bg-ivory">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            eyebrow="Risk & resilience"
            title={<span id="risk-title">Balancing opportunity with resilience.</span>}
            intro="Risk discipline is a core part of allocation. Resilience sits between risk and return: it determines whether risk, when it materialises, can be managed."
          />
          <div className="mt-14">
            <RiskFramework />
          </div>
          <Disclaimer title="A note on risk" className="mt-14 max-w-3xl">
            Governance and risk discipline improve the quality of decisions. They do not eliminate investment risk, and no
            process can guarantee any outcome. Investments may lose value.
          </Disclaimer>
        </div>
      </section>

      <section aria-labelledby="pathway" className="bg-white">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            eyebrow="Information pathway"
            title={<span id="pathway">Clear information before formal participation.</span>}
            intro="Information is layered according to stage of engagement, so that investors and their advisers understand before they participate."
          />
          <ol className="mt-14 grid items-end gap-3 md:grid-cols-6">
            {INFORMATION_PATHWAY.map((s, i) => (
              <li
                key={s.stage}
                className={`flex flex-col justify-end border p-5 ${i < 2 ? "border-gold-500/60 bg-gold-100/50" : "border-rule bg-paper"}`}
                style={{ minHeight: `${150 + i * 34}px` }}
              >
                <span className="num text-[12px] text-gold-700">0{i + 1}</span>
                <span className="mt-2 font-serif text-[1.2rem] leading-tight text-teal-900">{s.stage}</span>
                <span className="mt-2 text-[13px] leading-snug text-stone">{s.detail}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[13px] text-stone">This website forms part of the first two stages. It does not constitute an offer of any product.</p>
        </div>
      </section>

      <section aria-labelledby="pillars" className="border-t border-rule bg-paper">
        <div className="container-site grid gap-12 py-20 md:py-24 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow text-gold-700">Four pillars</p>
            <h2 id="pillars" className="display-m mt-5 text-teal-900">
              Curated access. Governed execution. Clear communication.
            </h2>
          </div>
          <dl className="grid gap-8 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
            {PILLARS.map((p) => (
              <div key={p.title} className="border-t border-teal-800 pt-4">
                <dt className="font-serif text-[1.4rem] text-teal-900">
                  <span className="num mr-3 text-[13px] text-gold-700">{p.n}</span>
                  {p.title}
                </dt>
                <dd className="mt-2 text-[15px] text-stone">{p.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-ivory">
        <div className="container-site flex flex-col gap-6 py-14 md:flex-row md:items-center md:justify-between">
          <p className="display-s max-w-2xl text-teal-900">See the approach applied to markets and research.</p>
          <div className="flex flex-wrap gap-3">
            <CTA href="/market-dashboard">Market Dashboard</CTA>
            <CTA href="/insights" variant="secondary">
              Insights
            </CTA>
          </div>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}
