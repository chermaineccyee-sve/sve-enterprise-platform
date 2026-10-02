import type { Metadata } from "next";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { GovernanceSignal } from "@/components/home/GovernanceSignal";
import { NStar } from "@/components/identity/NStar";
import { GovernanceArchitecture } from "@/components/sections/GovernanceArchitecture";
import { RiskFramework } from "@/components/sections/RiskFramework";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { PageHero } from "@/components/ui/PageHero";
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

      <section aria-labelledby="flow" className="on-dark bg-teal-950 text-white">
        <div className="container-site py-20 md:py-28">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow flex items-center gap-3 text-gold-300">
                <NStar className="h-2.5 w-2.5" /> The decision path
              </p>
              <h2 id="flow" className="display-l mt-6">
                Every decision passes the same gates.
              </h2>
            </div>
            <p className="text-[15.5px] leading-relaxed text-teal-100 lg:col-span-5">
              Follow a decision from market signal to reporting. Each gate asks one question and stops one kind of error. Select a gate
              to hold it.
            </p>
          </div>
          <div className="mt-16">
            <GovernanceSignal />
          </div>
        </div>
      </section>

      <section aria-labelledby="architecture" className="on-dark border-t border-white/10 bg-teal-900 text-white">
        <div className="container-site py-20 md:py-28">
          <p className="eyebrow flex items-center gap-3 text-gold-300">
            <NStar className="h-2.5 w-2.5" /> Control architecture
          </p>
          <h2 id="architecture" className="display-m mt-5 max-w-2xl">
            Seven functions, nested around every allocation.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-teal-100">
            Described at the level of function. Named bodies, committees and service providers will be published only once approved.
          </p>
          <div className="mt-14">
            <GovernanceArchitecture />
          </div>
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
