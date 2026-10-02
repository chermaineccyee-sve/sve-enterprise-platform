import type { Metadata } from "next";
import { Statement } from "@/components/home/Statement";
import { NStar } from "@/components/identity/NStar";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { CTA } from "@/components/ui/CTA";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PILLARS, PRINCIPLES } from "@/content/approach";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Nusantara Fund Management is an investment and allocation platform built around disciplined investment thinking, governance, curation and clear communication.",
  alternates: { canonical: "/about" },
};

const REQUIREMENTS = ["Understanding", "Selection", "Risk assessment", "Governance", "Execution discipline", "Ongoing monitoring"];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Us"
        title={<>Who we are.</>}
        lede="An investment and allocation platform built around disciplined investment thinking, governance, curation and clear communication."
        crumbs={[{ label: "Home", href: "/" }, { label: "About Us" }]}
      />

      <section aria-labelledby="who" className="bg-paper">
        <div className="container-site grid gap-12 py-20 md:py-28 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow text-gold-700">Who we are</p>
            <h2 id="who" className="display-m mt-5 text-teal-900">
              A platform for considered allocation.
            </h2>
          </div>
          <div className="space-y-6 text-[17px] leading-relaxed text-charcoal lg:col-span-7 lg:col-start-6">
            <p className="font-serif text-[1.5rem] leading-snug text-teal-900">
              Nusantara Fund Management evaluates and curates investment opportunities through a governed process — from market
              intelligence to ongoing monitoring.
            </p>
            <p>
              We are not organised around the breadth of what we can offer. We are organised around how decisions are made: how
              opportunities are identified, why they are selected, how their risks are assessed and overseen, and how investors
              are kept informed once capital is committed.
            </p>
            <p>
              Our capabilities are developed progressively. Each is introduced only with the governance, documentation and risk
              controls it requires — so that the platform can grow without losing its discipline.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="purpose" className="overflow-hidden border-y border-rule bg-paper">
        <div className="container-site py-24 md:py-32">
          <h2 id="purpose" className="eyebrow flex items-center gap-3 text-gold-700">
            <NStar className="h-2.5 w-2.5" /> Our purpose
          </h2>
          <div className="mt-10">
            <Statement phrases={["To make investment", "opportunity understandable,", "governed and accountable —", "for the long term."]} />
          </div>
        </div>
      </section>

      <section aria-labelledby="philosophy" className="bg-ivory">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            eyebrow="Our investment philosophy"
            title={<span id="philosophy">Opportunity alone is insufficient.</span>}
            intro="An opportunity is only as sound as the process around it. We believe investment opportunity must be accompanied by:"
          />
          <Reveal as="ol" className="mt-14 grid border-t border-teal-800 sm:grid-cols-2 lg:grid-cols-6">
            {REQUIREMENTS.map((r, i) => (
              <li key={r} className="border-b border-rule py-6 sm:pr-6 lg:border-b-0 lg:border-r lg:px-5 lg:first:pl-0 lg:last:border-r-0">
                <span className="num text-[12px] text-gold-700">0{i + 1}</span>
                <span className="mt-3 block font-serif text-[1.4rem] leading-tight text-teal-900">{r}</span>
              </li>
            ))}
          </Reveal>
          <div className="mt-12">
            <CTA href="/investment-approach" variant="text">
              Our investment approach
            </CTA>
          </div>
        </div>
      </section>

      <section aria-labelledby="principles" className="bg-paper">
        <div className="container-site py-20 md:py-28">
          <SectionHeader eyebrow="Our principles" title={<span id="principles">Four commitments.</span>} />
          <ol className="mt-14 border-t border-teal-800">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className="group grid gap-3 border-b border-rule py-8 md:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)] md:items-baseline md:gap-8">
                <span className="num font-serif text-[2.6rem] leading-none text-gold-500">{i + 1}</span>
                <h3 className="font-serif text-[clamp(1.6rem,3vw,2.4rem)] leading-tight text-teal-900 transition-transform duration-500 group-hover:translate-x-2">{p.title}</h3>
                <p className="max-w-md text-[15.5px] leading-relaxed text-stone">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="how-we-think" className="border-t border-rule bg-white">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            eyebrow="How we think"
            title={<span id="how-we-think">Curation. Governance. Execution. Communication.</span>}
            intro="Four pillars that, together, turn opportunity into a structured and accountable investment experience."
          />
          <ol className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p, i) => (
              <li key={p.title} className={`border-t-2 pb-6 pt-6 sm:pr-8 ${i === 1 ? "border-gold-500" : "border-teal-800"}`}>
                <span className="num text-[12px] text-gold-700">{p.n}</span>
                <h3 className="mt-3 font-serif text-[2rem] leading-none text-teal-900">{p.title}</h3>
                <p className="mt-3 text-[14.5px] text-stone">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="long-term" className="bg-ivory">
        <div className="container-site grid gap-12 py-20 md:py-28 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow text-gold-700">Governance &amp; long-term perspective</p>
            <h2 id="long-term" className="display-m mt-5 text-teal-900">
              Built to be explained, and built to last.
            </h2>
          </div>
          <div className="space-y-6 text-[16.5px] leading-relaxed text-charcoal lg:col-span-6 lg:col-start-7">
            <p>
              Governance is part of our investment proposition, not a back-office function. Each layer of oversight — from
              investment review to independent controls and reporting — exists so that decisions can be examined and explained.
            </p>
            <p>
              We take a long-term perspective. That means preferring durable processes to opportunistic ones, documenting the
              reasons for decisions, and revisiting them on a defined cycle.
            </p>
            <CTA href="/governance" variant="text">
              Our governance
            </CTA>
          </div>
        </div>
      </section>

      <section aria-labelledby="corporate" className="bg-paper">
        <div className="container-site py-20 md:py-24">
          <SectionHeader eyebrow="Corporate information" title={<span id="corporate">Leadership and corporate details.</span>} />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <ReviewPlaceholder label="Leadership — information required">
              Leadership profiles, roles and credentials will be published once supplied and approved by management. No
              individuals are named in this prototype.
            </ReviewPlaceholder>
            <ReviewPlaceholder label="Corporate details — information required">
              Legal entity name, registration, regulatory status, licences, offices and history will be added only once
              confirmed and approved for publication.
            </ReviewPlaceholder>
          </div>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}
