# Management decision register

Decisions required before the website can move beyond management review.
**Nothing here has been decided.** Gaps are recorded, not filled: where the
prototype shows something, it is a labelled placeholder or sample.

Status key: **Open** — not yet decided.

| # | Decision | Why it is needed | Prototype today | Where it takes effect | Status |
|---|---|---|---|---|---|
| 1 | **Corporate positioning** — approved wording for Home, About, Investment Approach and Governance | Public statements must be approved | V2.1 copy for review | Page copy; `lib/site.ts` | Open |
| 2 | **Approved capabilities** — which capabilities may be described publicly | Only approved capabilities may appear | 7 capabilities, all `review` | `content/strategies.ts` → `status: public-capability` | Open |
| 3 | **Actual products** — whether any capability becomes an offered product, and its approved details | Products require offering documents and approvals | None; `product: null` everywhere | `product` extension; `status: active-product` | Open |
| 4 | **Market-data provider** | Illustrative data cannot be published as market data | Illustrative dataset | `MARKET_DATA_PROVIDER` + adapter | Open |
| 5 | **Data licensing** — display rights per instrument, delay, attribution wording, staleness thresholds | Licence terms decide what may be shown and how | Not applicable (illustrative) | Provider provenance: `licence`, `attribution`, `staleAfterMinutes` | Open |
| 6 | **Nusantara house-view governance** — who authors, reviews and approves Nusantara Views and the Market State; review cycle length | A published view needs an approver of record and a review date | All views are sample, `review` | `approvedBy`, `reviewAt` on views and editions | Open |
| 7 | **Research approval process** — steps and approvers for research | Articles need approval before publication | 8 sample articles, `review` | Publication workflow on `Insight` | Open |
| 8 | **Research authorship** — institutional byline or named authors | Named individuals must not be published without approval | Institutional bylines only | `author` field | Open |
| 9 | **Publication frequency** — research, signals and Market State cadence | Sets reader expectations and review workload | Not set | Editorial calendar; `reviewAt` | Open |
| 10 | **Governance disclosures** — which governance bodies, independence arrangements and service providers may be described | Unconfirmed structures must not be implied | Described as process and control concepts | `content/governance.ts`, Governance page | Open |
| 11 | **Corporate information** — legal name, registration details, addresses, leadership (if any) | Required for a public corporate site; must not be invented | Placeholders | `lib/site.ts`, About, Contact, footer | Open |
| 12 | **Contact details** — address, telephone, email | Must not be invented | Placeholders | `lib/site.ts` | Open |
| 13 | **Contact workflow** — delivery channel (CRM, ticketing, mail), retention period, response ownership | Enquiries are personal data | Validated, neither stored nor sent | `CONTACT_DELIVERY`, `contact-delivery.ts`, privacy notice | Open |
| 14 | **Legal wording** — disclaimers, important information, privacy notice, terms of use, data disclosures | Requires legal review | Draft, pending legal review | `content/legal.ts`, `generalDisclaimer`, footer | Open |
| 15 | **Domain** — production domain and canonical URL | Needed for canonical links, sitemap and certificates | `example.com` placeholder | `NEXT_PUBLIC_SITE_URL` | Open |
| 16 | **Search indexing** — whether, and when, production is indexed | Indexing makes content discoverable | Not indexed in any environment | `SITE_INDEXING=allow` | Open |
| 17 | **Analytics** — whether to measure use; which service; consent approach | Privacy and consent obligations | Event hooks only; no tracker | Analytics adapter on `nusantara:analytics` | Open |
| 18 | **Production hosting** — platform, regions, single or multi-instance, monitoring | Determines rate-limit store, caching and operations | Not selected | Deployment; `rate-limit.ts` store | Open |
| 19 | **Content editing tool** — continue with reviewed source changes, or adopt a CMS | Determines who can publish and how | Typed content files behind a repository | `lib/content/repository.ts` loaders | Open |
| 20 | **Production disclosure wording** — banner/footer wording once the prototype banner is removed | Production needs its own approved disclosures | Prototype wording | `PrototypeBanner`, `Footer`, `generalDisclaimer` | Open |

## How to record a decision

For each decision: date, decision, decision-maker, and the resulting change
(content edit, configuration value or integration task). Update the status
column to **Decided** and reference the change.
