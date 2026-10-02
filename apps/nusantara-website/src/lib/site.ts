/**
 * Central site configuration. Corporate facts that have not been approved
 * for publication are deliberately represented as `null` and rendered as
 * management-review placeholders rather than invented.
 */
export const site = {
  name: "Nusantara Fund Management",
  shortName: "Nusantara",
  tagline: "Investing with perspective.",
  description:
    "Disciplined investment thinking, market intelligence and governed allocation for long-term value creation.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.example.com",
  copyrightYear: 2026,
  /** Set to false once the site moves from management review to publication. */
  isPrototype: true,
  contact: {
    // Not supplied — rendered as clearly marked placeholders.
    address: null as string | null,
    telephone: null as string | null,
    email: null as string | null,
  },
} as const;

export type NavItem = {
  label: string;
  href: string;
  /** Emphasised in navigation (Market Dashboard and Insights). */
  featured?: boolean;
  description?: string;
};

export const primaryNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about", description: "Who we are and how we think" },
  {
    label: "Investment Approach",
    href: "/investment-approach",
    description: "From market insight to governed allocation",
  },
  { label: "Strategies", href: "/strategies", description: "Allocation capabilities" },
  {
    label: "Market Dashboard",
    href: "/market-dashboard",
    featured: true,
    description: "Markets at a glance",
  },
  { label: "Insights", href: "/insights", featured: true, description: "Research and perspectives" },
  { label: "Governance", href: "/governance", description: "How discipline is maintained" },
  { label: "Contact", href: "/contact" },
];

export const legalNav: NavItem[] = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "Important Information", href: "/legal/important-information" },
  { label: "Disclaimer", href: "/legal/disclaimer" },
];

export const generalDisclaimer =
  "The information on this website is provided for general information purposes only. It does not constitute an offer, solicitation, recommendation, investment advice, legal advice, tax advice or regulatory advice. Any investment discussion or participation in any Nusantara-related product or platform is subject to the relevant offering documents, eligibility review, investor suitability assessment, applicable selling restrictions and regulatory requirements. Investments involve risk, including the possible loss of capital.";
