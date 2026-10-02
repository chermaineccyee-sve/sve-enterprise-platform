import type { Metadata } from "next";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { StatusLabel, StrategyCard } from "@/components/sections/StrategyCard";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { PageHero } from "@/components/ui/PageHero";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { STATUS_INFO, STRATEGIES, type StrategyStatus } from "@/content/strategies";

export const metadata: Metadata = {
  title: "Strategies",
  description:
    "Nusantara allocation capabilities across income, private credit, real assets, precious metals, alternatives, regional opportunities and Shariah-capable strategies.",
  alternates: { canonical: "/strategies" },
};

export default function StrategiesPage() {
  const current = STRATEGIES.filter((s) => s.status !== "future-development");
  const future = STRATEGIES.filter((s) => s.status === "future-development");
  return (
    <>
      <PageHero
        eyebrow="Strategies"
        title={<>Allocation capabilities.</>}
        lede="A modular view of where Nusantara can apply its investment process. Capabilities are developed progressively, each with its own governance, documentation and risk controls."
        crumbs={[{ label: "Home", href: "/" }, { label: "Strategies" }]}
      />

      <section aria-labelledby="modular" className="border-b border-rule bg-white">
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

      <section aria-labelledby="capabilities" className="bg-paper">
        <div className="container-site py-20 md:py-28">
          <SectionHeader
            eyebrow="Capabilities"
            title={<span id="capabilities">Where we apply our thinking.</span>}
            intro="These are capability areas, not products. No capability on this page is offered to investors, and no capability is described as active."
          />
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((s, i) => (
              <li key={s.slug}>
                <StrategyCard strategy={s} index={i} variant="tile" />
              </li>
            ))}
          </ul>
          {future.length > 0 && (
            <div className="mt-14 border-t border-rule pt-8">
              <p className="eyebrow text-gold-700">Future development</p>
              <div className="mt-2">
                {future.map((s, i) => (
                  <StrategyCard key={s.slug} strategy={s} index={current.length + i} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="status" className="bg-ivory">
        <div className="container-site grid gap-12 py-20 md:py-24 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow text-gold-700">Status architecture</p>
            <h2 id="status" className="display-m mt-5 text-teal-900">
              Every capability carries an explicit status.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-stone">
              Status is set centrally and shown wherever a capability appears, so that nothing is presented as available before it
              has been approved.
            </p>
          </div>
          <dl className="divide-y divide-rule border-y border-rule lg:col-span-7 lg:col-start-6">
            {(Object.keys(STATUS_INFO) as StrategyStatus[]).map((k) => {
              const n = STRATEGIES.filter((s) => s.status === k).length;
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

      <section className="bg-paper">
        <div className="container-site grid gap-6 py-16 md:grid-cols-2">
          <ReviewPlaceholder label="Strategy information — approval required">
            Objectives, time horizons, characteristics, fees and documents for any strategy will be published only once approved.
            Internal strategy parameters are not shown on this website.
          </ReviewPlaceholder>
          <Disclaimer>
            Capability descriptions are for general information only and do not constitute an offer or solicitation. Any future
            offering would be made only through formal offering documents to eligible investors.
          </Disclaimer>
        </div>
      </section>

      <ContactCTA />
    </>
  );
}
