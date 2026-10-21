import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactCTA } from "@/components/sections/ContactCTA";
import { StatusLabel } from "@/components/sections/StrategyCard";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import { STATUS_INFO } from "@/content/strategies";
import { getCapabilities, getCapability } from "@/lib/content/repository";
import { generalDisclaimer } from "@/lib/site";

/** Unknown slugs render notFound() on request, so the 404 hydrates with the real path. */
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getCapabilities()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/strategies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = await getCapability(slug);
  if (!s) return {};
  return { title: s.name, description: s.summary, alternates: { canonical: `/strategies/${s.slug}` } };
}

const SECTIONS = [
  ["overview", "Overview"],
  ["objective", "Objective"],
  ["approach", "Investment approach"],
  ["opportunity-set", "Opportunity set"],
  ["risks", "Risk considerations"],
  ["horizon", "Time horizon"],
  ["characteristics", "Key characteristics"],
  ["documents", "Documents"],
  ["important-information", "Important information"],
] as const;

function Row({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid gap-4 border-b border-rule py-10 md:grid-cols-12 md:gap-10">
      <h2 id={`${id}-h`} className="eyebrow pt-1 text-stone md:col-span-3">
        {title}
      </h2>
      <div className="md:col-span-9">{children}</div>
    </section>
  );
}

export default async function StrategyPage({ params }: PageProps<"/strategies/[slug]">) {
  const { slug } = await params;
  const s = await getCapability(slug);
  if (!s) notFound();
  const STRATEGIES = await getCapabilities();
  const idx = STRATEGIES.findIndex((x) => x.slug === s.slug);
  const next = STRATEGIES[(idx + 1) % STRATEGIES.length];
  // Product fields are shown only for an approved, active product — never for a capability.
  const product = s.status === "active-product" ? s.product : null;


  return (
    <>
      <section className="relative overflow-hidden bg-ivory">
        <div className="container-site relative pt-10 pb-16 md:pt-14 md:pb-20">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Strategies", href: "/strategies" }, { label: s.name }]} />
          <div className="mt-14 md:mt-20">
            <StatusLabel status={s.stage} />
            <h1 className="display-xl mt-6 max-w-4xl text-teal-900">{s.name}</h1>
            <p className="lede mt-8 max-w-2xl text-stone">{s.summary}</p>
            <p className="mt-6 max-w-2xl border-l-2 border-gold-500 pl-4 text-[13.5px] text-charcoal">
              Status: <strong className="font-semibold">{STATUS_INFO[s.stage].label}</strong> — {STATUS_INFO[s.stage].description}
            </p>
          </div>
        </div>
      </section>

      <div className="bg-ivory">
        <div className="container-site grid gap-12 py-14 md:py-20 lg:grid-cols-12">
          <nav aria-label="On this page" className="hidden lg:col-span-3 lg:block">
            <ol className="sticky top-32 space-y-2.5 border-l border-rule">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="-ml-px block border-l border-transparent pl-4 text-[13.5px] text-stone hover:border-teal-800 hover:text-teal-800">
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="border-t border-teal-800 lg:col-span-9">
            <Row id="overview" title="Overview">
              <p className="font-serif text-[1.3rem] leading-relaxed text-charcoal">{s.overview}</p>
            </Row>
            <Row id="objective" title="Objective">
              {product?.objective ? (
                <p className="text-[16px] leading-relaxed text-charcoal">{product.objective}</p>
              ) : (
                <ReviewPlaceholder>An approved objective will be published if and when this capability becomes a defined strategy.</ReviewPlaceholder>
              )}
            </Row>
            <Row id="approach" title="Investment approach">
              <p className="text-[16px] leading-relaxed text-charcoal">{s.approach}</p>
              <Link href="/investment-approach" className="link-underline mt-4 inline-block text-[14px] text-teal-800">
                How Nusantara invests →
              </Link>
            </Row>
            <Row id="opportunity-set" title="Opportunity set">
              <ul className="grid gap-3 sm:grid-cols-2">
                {s.opportunitySet.map((o) => (
                  <li key={o} className="border-t border-rule-soft pt-3 text-[15px] text-charcoal">
                    {o}
                  </li>
                ))}
              </ul>
            </Row>
            <Row id="risks" title="Risk considerations">
              <ul className="space-y-3">
                {s.riskConsiderations.map((r) => (
                  <li key={r} className="flex gap-3 text-[15px] text-charcoal">
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[13px] text-stone">This list is not exhaustive. All investments involve risk, including the loss of capital.</p>
            </Row>
            <Row id="horizon" title="Time horizon">
              {s.timeHorizon ? (
                <p className="text-[16px] text-charcoal">{s.timeHorizon}</p>
              ) : (
                <ReviewPlaceholder>Time horizon to be confirmed on approval. Not stated for capability areas.</ReviewPlaceholder>
              )}
            </Row>
            <Row id="characteristics" title="Key characteristics">
              <ul className="flex flex-wrap gap-2">
                {s.characteristics.map((c) => (
                  <li key={c} className="border border-rule bg-paper px-3 py-1.5 text-[13.5px] text-charcoal">
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-stone">Qualitative characteristics only. No performance, return or fee figures are shown.</p>
            </Row>
            <Row id="documents" title="Documents">
              {product?.documents.length ? (
                <ul>
                  {product.documents.map((d) => (
                    <li key={d.href}>
                      <a href={d.href}>{d.title}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <ReviewPlaceholder label="Documents · Pending approval">
                  Offering documents, factsheets and risk disclosures will appear here only for approved strategies, subject to
                  eligibility and applicable selling restrictions.
                </ReviewPlaceholder>
              )}
            </Row>
            <Row id="important-information" title="Important information">
              <Disclaimer title="Not an offer">{generalDisclaimer}</Disclaimer>
            </Row>
            <div className="flex items-center justify-between gap-6 pt-10">
              <Link href="/strategies" className="link-underline text-[14px] text-stone hover:text-teal-800">
                ← All capabilities
              </Link>
              <Link href={`/strategies/${next.slug}`} className="group text-right">
                <span className="eyebrow block text-stone">Next</span>
                <span className="mt-1 block font-serif text-[1.3rem] text-teal-900 group-hover:text-teal-700">{next.name} →</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <ContactCTA />
    </>
  );
}
