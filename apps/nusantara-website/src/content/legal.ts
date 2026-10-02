/**
 * Draft legal copy. Deliberately jurisdiction-neutral and marked for legal
 * review — not to be published without approval by counsel.
 */
export type LegalPage = { slug: string; title: string; summary: string; sections: { heading: string; body: string[] }[] };

export const LEGAL_PAGES: LegalPage[] = [
  {
    slug: "important-information",
    title: "Important Information",
    summary: "Information that applies to all content on this website.",
    sections: [
      {
        heading: "General information only",
        body: [
          "The information on this website is provided for general information purposes only. It does not constitute an offer, solicitation, recommendation, investment advice, legal advice, tax advice or regulatory advice, and should not be relied upon as such.",
          "Any investment discussion, subscription, distribution or participation in any Nusantara-related product or platform is subject to the relevant offering documents, eligibility review, investor suitability assessment, applicable selling restrictions and regulatory requirements.",
        ],
      },
      {
        heading: "Investment risk",
        body: [
          "Investments involve risk, including the possible loss of capital. The value of investments and any income from them can fall as well as rise. Past performance, where shown, is not a reliable indicator of future results.",
          "Governance, oversight and risk processes are intended to improve the quality of decisions. They do not eliminate investment risk or guarantee any outcome.",
        ],
      },
      {
        heading: "Market data",
        body: [
          "Market information displayed in this prototype is illustrative and is provided for demonstration purposes only. It is not sourced from any exchange, index provider or data vendor and must not be relied upon.",
          "When authorised data is integrated, each figure will display its source, timestamp and status (live, delayed or end of day) in accordance with the provider’s terms.",
        ],
      },
      {
        heading: "Scenario analysis and forward-looking statements",
        body: [
          "Scenario analysis and forward-looking statements illustrate how outcomes may differ under stated assumptions. They are not forecasts, performance targets, expected returns or investment promises.",
        ],
      },
    ],
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    summary: "Limitations on the use of, and reliance on, information on this website.",
    sections: [
      {
        heading: "No reliance",
        body: [
          "While care is taken in preparing the information on this website, no representation or warranty, express or implied, is made as to its accuracy, completeness or timeliness. Opinions expressed are subject to change without notice.",
        ],
      },
      {
        heading: "Third-party information",
        body: [
          "Where information is attributed to third parties, it is believed to be reliable but has not been independently verified. Links to third-party websites are provided for convenience and do not imply endorsement.",
        ],
      },
      {
        heading: "Limitation of liability",
        body: [
          "To the extent permitted by applicable law, no liability is accepted for any loss arising from the use of, or reliance on, the information on this website.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy",
    summary: "How personal information submitted through this website would be handled.",
    sections: [
      {
        heading: "Information we collect",
        body: [
          "If you submit an enquiry, we would collect the information you provide — such as your name, email address, organisation and message — in order to respond to you.",
          "In this management-review prototype, enquiries are validated but not stored or transmitted.",
        ],
      },
      {
        heading: "How information would be used",
        body: [
          "Information would be used only to respond to your enquiry and for related record-keeping, and would not be sold. Retention periods and your rights in relation to your information will be set out once this notice is finalised.",
        ],
      },
      {
        heading: "Cookies and analytics",
        body: ["This prototype does not use analytics or advertising cookies. Any future use will be described here before it is introduced."],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Use",
    summary: "Terms that apply to your use of this website.",
    sections: [
      {
        heading: "Use of this website",
        body: [
          "By using this website you agree to these terms. The website and its content are provided for general information purposes only and may be changed or withdrawn without notice.",
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          "The Nusantara name and logo, and the content of this website, are protected by intellectual property rights. Content may not be reproduced for commercial purposes without prior written permission.",
        ],
      },
      {
        heading: "Access restrictions",
        body: [
          "Information on this website is not directed at any person in any jurisdiction where its publication or availability would be contrary to applicable law or regulation.",
        ],
      },
    ],
  },
];

export function getLegalPage(slug: string) {
  return LEGAL_PAGES.find((p) => p.slug === slug);
}
