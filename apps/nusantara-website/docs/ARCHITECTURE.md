# Nusantara website — architecture for the end state

The V2.1 design is frozen. This document describes the platform underneath it:
how the management-review prototype becomes the public investment-intelligence
website **by configuration and content, without rebuilding the platform**.

## 1. The information chain

```
MARKET DATA ──► SIGNALS ──► NUSANTARA VIEW ──► INSIGHTS ──► INVESTMENT THINKING ──► GOVERNANCE ──► APPROVED CAPABILITIES
lib/market      content/     content/data/      content/     content/approach.ts     content/        content/strategies.ts
(provider)      data/        market-views.ts    insights/                            governance.ts   (lifecycle-gated)
                signals.ts   market-state.ts
```

Each link is a separate layer with its own source, status and owner:

| Layer | Source today | Source in production | Rule enforced in |
|---|---|---|---|
| Market data | `illustrative` provider | approved API / licensed vendor (`providers/http.ts` or sibling) | `lib/market/service.ts` |
| Signals, Nusantara Views, Market State, Themes | typed files in `content/data/` | CMS | `lib/content/repository.ts` |
| Insights | typed files in `content/insights/` | CMS | `lib/content/repository.ts` |
| Capabilities | `content/strategies.ts` | CMS | `lib/content/repository.ts` |
| Relationships between all of the above | declared on records | declared on records | `lib/content/relationships.ts` |

Pages (server components) are the only place layers meet. They ask the
service and the repository, resolve relationships through the graph, and pass
plain data to presentation components. **Components never import content or
providers**; the dashboard, Market State, themes, map and cross-asset view all
receive their data as props.

## 2. Market data service

`src/lib/market/service.ts` is the single entry point. Providers implement
`MarketDataProvider` (`src/lib/market/types.ts`):

| Provider | Status | Selected by |
|---|---|---|
| `illustrative` | prototype default; seeded, deterministic | `MARKET_DATA_PROVIDER=illustrative` |
| `http` | approved API, or a gateway in front of a licensed enterprise vendor | `MARKET_DATA_PROVIDER=http` + `MARKET_DATA_API_URL` / `MARKET_DATA_API_KEY` |
| *(sibling adapter)* | a vendor SDK mapped into the same types | add `providers/<vendor>.ts`, register in `service.ts` |

Every market object carries: instrument, ticker, asset class, market,
currency, value, change, percentage change (or basis points for yields),
historical series, timestamp (`asOf`), source, delay status, and
licensing/display status (`licence`, `licensingNote`, `attribution`,
`retrievedAt`, `methodology`).

### Data states

`illustrative · delayed · live · unavailable` (`DATA_STATUSES`). Every surface
derives its labels from the data's status — "Illustrative data", "Delayed
15 min", "Live" — so nothing on screen claims a status the data does not have.

| Situation | Behaviour |
|---|---|
| Provider down / not configured | snapshot status `unavailable`; dashboard shows an explicit unavailable panel; ribbon and hero monitor are omitted; nav reads "Data unavailable" |
| Instrument not supplied / invalid | listed in `snapshot.unavailable`; rail shows "Unavailable" with the reason; no number is invented |
| Not licensed for public display | withheld by the service (`not-licensed`) — the value never reaches the page |
| Delayed feed | "Delayed N min" on every surface; delay shown beside the status |
| Stale value (older than `staleAfterMinutes`) | "Not current — last updated …" beside the value, a **Stale** badge, and a Stale marker on every compact surface (ribbon, rails, lists, table). Re-checked in the browser, so an aged static page cannot present old data as current |
| Missing history | explicit "history is unavailable" panel instead of a chart; statistics that need history show "—" |
| Missing Nusantara View | "There is no current Nusantara View for …" |
| No related research | the related-insight block is omitted |
| Indicator feed down | the structural-indicator section and the Macro tab are omitted |

Market-bearing pages revalidate every 300 s and the market API routes every
60 s, so a delayed or live provider is re-read without a redeploy.

## 3. Publication governance

`src/content/model/publication.ts`:

```
DRAFT → REVIEW → APPROVED → PUBLISHED → ARCHIVED
```

Every Nusantara View, Market State edition, signal, theme and article carries
`status`, `sample`, `author`, `approvedBy`, `publishedAt`, `updatedAt`,
`reviewAt`. The **environment** decides what may render:

| Environment | Renders |
|---|---|
| review | review, approved, published — plus sample content, always labelled |
| staging | approved, published |
| production | published only; never sample content |

**Review control.** A published time-sensitive item must have `reviewAt`. Once
it passes, the item is withdrawn — on the server at render, and again in the
browser for pages rendered before it expired. A house view therefore cannot
stay "current" because nobody updated the website.

**Timestamps.** Approved content shows *Published · Last updated · Next review
· Status* (`PublicationStamp`). Sample content keeps its management-review
label, which is why the prototype looks unchanged.

**Integrity.** `contentProblems()` runs at build time and fails the build on:
dangling references (unknown insight, instrument, theme, capability or
dimension), published items without approval or publication date,
time-sensitive items published without a review date, sample content marked
published, and capability lifecycle violations.

## 4. Content models

| Content type | Model | Data |
|---|---|---|
| Market View (Nusantara View) | `NusantaraView` — signal, stance, context, whatWeAreWatching, keyRisk, whatWouldChangeOurView, relatedMarkets, relatedInsight + publication | `content/data/market-views.ts` (instrument, asset-class and indicator views) |
| Market State | `MarketStateEdition` → dimensions with state, summary, watchItems, changeConditions, supportingMarkets, updatedAt, status | `content/data/market-state.ts` |
| Signal | `Signal` | `content/data/signals.ts` |
| Theme | `Theme` | `content/data/themes.ts` |
| Insight | `Insight` — title, slug, category, summary, author, publication date, last updated, status, tags, themes, markets, asset classes, executive summary, key takeaways, body (typed blocks incl. charts and scenarios), sources (with source-governance fields), methodology, related insights, SEO | `content/insights/*.ts` |
| Capability | `Strategy` — lifecycle `status`, public `stage`, markets, indicators, insights, risks, `product` extension | `content/strategies.ts` |
| Governance / corporate content | plain typed modules | `content/governance.ts`, `approach.ts`, `legal.ts`, `lib/site.ts` |

Interpretation is separated from data at the model level: structural
indicators hold values only; Nusantara's reading of each lives in
`market-views.ts` as an indicator view.

### Capabilities are not products

`status` (governance lifecycle) — `internal → review → public-capability →
active-product → archived` — decides visibility. `stage` (Capability, Future
development …) is the public description. `product: ProductDetails | null`
is the future extension (objective, strategy, benchmark, currency, minimum
investment, liquidity, risk information, documents, NAV/performance source,
legal disclosures). It is null everywhere, is displayed only when status is
`active-product`, and an active product without approved product details fails
the build. Nothing converts a capability into a product automatically.

## 5. Relationship engine

`src/lib/content/relationships.ts` joins links declared on any record into one
bidirectional graph built from **visible** content only:

- **Market →** Nusantara View (instrument, else asset class), Market State
  dimensions, insights, capabilities, related markets
- **Insight →** markets, themes, capabilities, Market State dimensions,
  related research (curated, then same category, then newest)
- **Capability →** markets, risks, insights

Links declared on either side are visible from both. An insight that
discusses a capability's markets is linked to that capability automatically.
Hidden or expired targets disappear from the graph, so links never point at
missing pages.

## 6. CMS readiness

The repository is the seam. Every function in
`src/lib/content/repository.ts` is async and returns the model types, and
every publication rule is applied there. The raw content comes from the
configured source (`src/lib/content/source.ts`):

- `CONTENT_SOURCE=local` (default): the typed files in `src/content`;
- `CONTENT_SOURCE=cms`: the Admin Portal (Payload CMS), via
  `src/lib/content/cms-source.ts`, mapped to the same types.

The Admin Portal (Phase B0) is described in `ADMIN_PORTAL.md`. Still to do in
later phases: content migration, routing legal pages and corporate copy
through the repository, and on-publish revalidation.

## 7. Search

`src/lib/search.ts` + `/api/insights/search-index`. The server builds a token
index of every visible article across title, summary, body, tags, themes,
markets and asset classes (weighted); the browser loads it on first search.
Every query word must match. This scales to several hundred articles; beyond
that, `searchIndex()` is where a hosted search service replaces local matching.

## 8. Environments

`src/lib/config.ts`, driven by `NUSANTARA_ENV` (see `.env.example`; `prototype` is accepted as an alias of `review`):

| | review (management review; default) | staging | production |
|---|---|---|---|
| Market data | illustrative (default) | configured provider (else unavailable) | configured provider (else unavailable) |
| Banner and prototype wording | shown | hidden | hidden |
| Content | sample + review (labelled) | approved + published | published |
| Indexing | none (robots + meta) | none | none until `SITE_INDEXING=allow` |
| Contact delivery | none | per `CONTACT_DELIVERY` | per `CONTACT_DELIVERY` |

Changing environment is a configuration change and redeploy; no code changes.

## 9. Contact workflow

`src/lib/contact.ts` defines the submission record: enquiry type, name,
organisation, email, telephone (optional), message, consent, server
timestamp, submission status (`not-configured · delivered · failed`).
`src/lib/contact-delivery.ts` is the seam: `CONTACT_DELIVERY=none` (default)
validates and neither stores nor sends; `webhook` posts HMAC-signed JSON to an
approved service. The form is unchanged; its confirmation reflects the actual
outcome.

## 10. Analytics readiness

`src/lib/analytics.ts` dispatches a `nusantara:analytics` DOM event for:
market selected, period changed, Nusantara View expanded, insight opened,
insight source expanded, capability explored, contact started, contact
submitted. No tracker is installed and no personal data is included. An
approved analytics service attaches one listener (after consent where
required).

## 11. Security

| Area | Position |
|---|---|
| Secrets | Server-only env vars (no `NEXT_PUBLIC_`); provider and delivery modules import `server-only`; verified absent from client bundles |
| Provider access | Server-side only; the browser calls this site's `/api/market/*` routes |
| Input validation | Shared schema on client and server; JSON-only, 8 KB body limit, honeypot, field limits |
| Rate limiting | Per-IP fixed window on `/api/contact` (5 / 10 min). In-process: replace the store with a shared one, or use platform edge limits, for multi-instance hosting |
| Security headers | CSP (self only, no third parties, `frame-ancestors 'none'`), nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP, HSTS in production; `X-Powered-By` removed |
| Dependencies | Exact-pinned; `npm audit`: 0 known vulnerabilities at the time of writing |
| Hardening before launch | Nonce-based CSP to drop `'unsafe-inline'`; shared rate-limit store; WAF/bot protection on the contact route; secret rotation policy |

## 12. End-state test

| Question | Answer | Evidence |
|---|---|---|
| Can illustrative market data be replaced by an approved provider without redesigning the dashboard? | **Yes** | The same build, run against a mock approved API (`MARKET_DATA_PROVIDER=http`), shows delayed labels, an unlicensed instrument withheld, a stale value flagged, missing history handled — no component changes |
| Can Nusantara publish a new house view without rewriting components? | **Yes** | A view record set to `published` with `approvedBy` / `publishedAt` / `reviewAt` renders with its publication stamp in production |
| Can an Insight be linked automatically to relevant markets and capabilities? | **Yes** | Declaring `markets` on an article links it from those markets, to capabilities sharing them, into search and margin signals |
| Can an outdated Nusantara View be identified and withdrawn? | **Yes** | Past `reviewAt` → withdrawn on the server and, for already-rendered pages, in the browser (tested by letting a published view expire after build) |
| Can a capability later become an approved product without changing the information architecture? | **Yes** | Set `status: "active-product"`, `stage: "active"` and populate `product`; the detail page shows product fields; integrity rules prevent a partial product |
| Can prototype mode be replaced by production configuration without rebuilding the website? | **Yes** — configuration and redeploy | `NUSANTARA_ENV=production` removes the banner, sample content and prototype wording, keeps indexing off until decided; verified by a production build |
