import Link from "next/link";
import { generalDisclaimer, legalNav, site } from "@/lib/site";
import { Logo } from "./Logo";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Firm",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Investment Approach", href: "/investment-approach" },
      { label: "Strategies", href: "/strategies" },
      { label: "Governance", href: "/governance" },
    ],
  },
  {
    title: "Intelligence",
    links: [
      { label: "Market Dashboard", href: "/market-dashboard" },
      { label: "Insights", href: "/insights" },
      { label: "Nusantara View", href: "/#nusantara-view" },
      { label: "Scenario Analysis", href: "/insights/from-access-to-governed-allocation#scenario" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "General Enquiries", href: "/contact?topic=general" },
      { label: "Institutional Enquiries", href: "/contact?topic=institutional" },
      { label: "Research Enquiries", href: "/contact?topic=research" },
      { label: "Business Enquiries", href: "/contact?topic=business" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="on-dark bg-teal-950 text-teal-100" data-print="hide">
      <div className="container-site pt-16 pb-10 md:pt-24">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo height={84} surface="dark" />
            <p className="mt-8 max-w-sm font-serif text-2xl leading-snug text-white">
              Investing with perspective.
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-teal-200">
              Market intelligence, disciplined allocation and governance — connected.
            </p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3 lg:col-span-8 lg:pl-8">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="eyebrow text-teal-200">{col.title}</h2>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="link-underline text-[15px] text-teal-100 hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8">
          <h2 className="eyebrow text-teal-200">Important information</h2>
          <p className="mt-4 max-w-5xl text-[13px] leading-relaxed text-teal-200">{generalDisclaimer}</p>
          {site.isPrototype && (
            <p className="mt-3 max-w-5xl text-[13px] leading-relaxed text-teal-200">
              Market information displayed in this prototype is illustrative and is provided for demonstration
              purposes only.
            </p>
          )}
        </div>

        <div className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-6 text-[13px] text-teal-200 md:flex-row md:items-center md:justify-between">
          <p>
            © {site.copyrightYear} {site.name}
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {legalNav.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="link-underline hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
