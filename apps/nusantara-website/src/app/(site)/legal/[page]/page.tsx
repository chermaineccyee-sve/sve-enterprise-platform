import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import { getLegalPage, LEGAL_PAGES } from "@/content/legal";

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_PAGES.map((p) => ({ page: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[page]">): Promise<Metadata> {
  const { page } = await params;
  const p = getLegalPage(page);
  return p ? { title: p.title, description: p.summary, alternates: { canonical: `/legal/${p.slug}` } } : {};
}

export default async function LegalPageView({ params }: PageProps<"/legal/[page]">) {
  const { page } = await params;
  const p = getLegalPage(page);
  if (!p) notFound();
  return (
    <>
      <PageHero eyebrow="Legal" title={p.title} lede={p.summary} crumbs={[{ label: "Home", href: "/" }, { label: p.title }]} />
      <section className="bg-paper">
        <div className="container-site grid gap-12 py-16 md:py-24 lg:grid-cols-12">
          <nav aria-label="Legal pages" className="lg:col-span-3">
            <ul className="space-y-2 border-l border-rule">
              {LEGAL_PAGES.map((l) => (
                <li key={l.slug}>
                  <Link
                    href={`/legal/${l.slug}`}
                    aria-current={l.slug === p.slug ? "page" : undefined}
                    className={`-ml-px block border-l pl-4 text-[14px] ${
                      l.slug === p.slug ? "border-teal-800 text-teal-900" : "border-transparent text-stone hover:text-teal-800"
                    }`}
                  >
                    {l.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="max-w-3xl lg:col-span-8 lg:col-start-5">
            <ReviewPlaceholder label="Draft · Pending legal review">
              This text is a working draft for the prototype. It must be reviewed and approved by legal counsel before publication.
            </ReviewPlaceholder>
            {p.sections.map((s) => (
              <section key={s.heading} className="mt-12">
                <h2 className="display-s text-teal-900">{s.heading}</h2>
                {s.body.map((b, i) => (
                  <p key={i} className="mt-4 text-[16px] leading-relaxed text-charcoal">
                    {b}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
