import type { Metadata } from "next";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { GovernanceStack } from "@/components/sections/GovernanceStack";
import { RiskFramework } from "@/components/sections/RiskFramework";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Governance",
  description:
    "Governance is part of the Nusantara investment process: oversight, investment review, risk management, compliance, independent controls, administration and reporting.",
  alternates: { canonical: "/governance" },
};

const PRINCIPLES = [
  { title: "Visibility", text: "Each control layer should be visible and explainable to investors and their advisers." },
  { title: "Separation", text: "Functions that safeguard assets and verify records are kept separate from investment decision-making." },
  { title: "Challenge", text: "Investment proposals are subject to independent review before commitment, not after." },
  { title: "Documentation", text: "Decisions and their rationale are recorded so that they can be reviewed and revisited." },
  { title: "Accountability", text: "Responsibility for each function is clearly assigned and periodically reviewed." },
];

const SHARED = ["Governance visibility", "Investor suitability", "Risk disclosure", "Liquidity alignment", "Reporting discipline"];

export default function GovernancePage() {
  return (
    <>
      <PageHero
        tone="teal"
        eyebrow="Governance"
        title={<>Governance is part of the investment process.</>}
        lede="Governance is not a back-office function. It is part of how investment decisions are made, examined and explained."
        crumbs={[{ label: "Home", href: "/" }, { label: "Governance" }]}
      />

      <section aria-labelledby="stack" className="bg-paper">
        <div className="container-site grid gap-14 py-20 md:py-28 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow text-gold-700">Governance architecture</p>
            <h2 id="stack" className="display-m mt-5 text-teal-900">
              Seven layers through which decisions pass.
            </h2>
            <p className="mt-6 text-[15.5px] leading-relaxed text-stone">
              From oversight at the top to reporting and monitoring at the base, each layer narrows the set of decisions that can
              pass through unexamined. The architecture is described here at the level of function.
            </p>
          </div>
          <Reveal className="lg:col-span-8">
            <GovernanceStack />
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="principles" className="border-t border-rule bg-white">
        <div className="container-site py-20 md:py-28">
          <SectionHeader eyebrow="Principles" title={<span id="principles">How discipline is maintained.</span>} />
          <ol className="mt-14 grid border-t border-teal-800 sm:grid-cols-2 lg:grid-cols-5">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className="border-b border-rule py-8 sm:pr-6 lg:border-b-0 lg:border-r lg:px-6 lg:first:pl-0 lg:last:border-r-0">
                <span className="num text-[12px] text-gold-700">0{i + 1}</span>
                <h3 className="mt-3 font-serif text-[1.45rem] text-teal-900">{p.title}</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-stone">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="risk" className="bg-ivory">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            eyebrow="Risk & resilience"
            title={<span id="risk">Risk ↔ resilience ↔ return.</span>}
            intro="Governance supports resilience. It does not remove investment risk."
          />
          <div className="mt-14">
            <RiskFramework />
          </div>
        </div>
      </section>

      <section aria-labelledby="dual-track" className="bg-paper">
        <div className="container-site grid gap-12 py-20 md:py-24 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow text-gold-700">One standard</p>
            <h2 id="dual-track" className="display-m mt-5 text-teal-900">
              Conventional and Shariah-capable allocation share the same discipline.
            </h2>
            <p className="mt-6 text-[15.5px] leading-relaxed text-stone">
              Where Shariah-capable allocation is considered, it would be supported by appropriate screening, adviser oversight and
              documentation — under the same operating principles as conventional allocation.
            </p>
          </div>
          <ul className="self-end lg:col-span-6 lg:col-start-7">
            {SHARED.map((s) => (
              <li key={s} className="flex items-center justify-between border-b border-rule py-4">
                <span className="font-serif text-[1.3rem] text-teal-900">{s}</span>
                <span className="text-[12px] uppercase tracking-[0.12em] text-stone">Both tracks</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="pending" className="border-t border-rule bg-white">
        <div className="container-site py-16 md:py-20">
          <h2 id="pending" className="eyebrow text-gold-700">
            Governance information pending approval
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <ReviewPlaceholder label="Governance bodies">
              Board composition, committees and their terms of reference will be published once approved.
            </ReviewPlaceholder>
            <ReviewPlaceholder label="Service providers">
              Administrators, auditors, custodians and banking arrangements will be named only once appointed and approved for
              disclosure.
            </ReviewPlaceholder>
            <ReviewPlaceholder label="Regulatory information">
              Regulatory status and licensing information will be added only once confirmed for publication.
            </ReviewPlaceholder>
          </div>
          <Disclaimer className="mt-12 max-w-3xl">
            Governance and oversight arrangements are intended to improve the quality and transparency of decisions. They do not
            guarantee investment outcomes or eliminate the risk of loss.
          </Disclaimer>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}
