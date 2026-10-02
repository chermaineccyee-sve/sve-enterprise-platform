# Nusantara Fund Management — public website (management-review prototype)

The public website for Nusantara Fund Management: institutional positioning, a
public **Market Dashboard**, **Nusantara Insights** research, investment
approach, capability architecture and governance.

**Status: management-review prototype.** All market data is illustrative, all
research is sample content, and the site is excluded from search indexing
(`NUSANTARA_ENV=review`, see `src/lib/config.ts`). The app is self-contained
and has no dependency on any other app or service in this repository.

**Built for the end state.** The V2.1 design is frozen; the platform beneath it
is ready to move from prototype to public investment-intelligence website by
configuration and content, not a rebuild:

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — information chain, market-data
  service and data states, publication governance, content models, relationship
  engine, CMS readiness, search, environments, security, and the end-state test
- [`docs/PRODUCTION_ROADMAP.md`](./docs/PRODUCTION_ROADMAP.md) — prototype → content
  approval → data integration → publication governance → legal/compliance →
  staging → launch → operations
- [`docs/MANAGEMENT_DECISIONS.md`](./docs/MANAGEMENT_DECISIONS.md) — decisions still
  required (none filled by guesswork)

## V2.1 design maturity pass (current)

A subtraction and refinement pass on V2 — no new pages, features or motion.

- **Lattice and markers** kept only in the hero, the investment process, the
  governance architecture and governance signal, and a few status markers.
  Eyebrows and category labels are neutral; gold is reserved for meaning
  (the Nusantara View signal, the active process stage, disclosure labels).
- **Governance language** describes process and control concepts ("reviewed
  and challenged", "safeguarding and verification"), never a confirmed
  structure, layer count or independence claim.
- **Nusantara Market State** is framed as a *demonstration framework*:
  illustrative readings for management review, not a current house view.
- **Three layers kept visually distinct**: market data (observed ·
  illustrative), the Nusantara View (interpretation: Signal · Context · What we
  are watching · Key risk · Related insight) and sample content.
- **Homepage**: who we are → what we watch → how we think/invest → what we
  read → how we govern. The Market Lens section was removed; the ribbon and
  hero monitor link to the dashboard (`?instrument=<id>`).
- **Strategies**: progressive disclosure (role, key considerations, market
  relationships, related insight; detail behind "More detail"). The tokenised
  real-world assets capability was removed pending approval, and the
  tokenisation research note was withdrawn before management review.
- **Mobile**: one idea at a time — Market State dimension chips; dashboard
  order instrument select → number → chart → period → Nusantara View
  (collapsed) → statistics → related markets.
- **Charts**: restrained teal / gold / grey palette, no draw-in animation.
- **Disclosure vocabulary**: Management review · Illustrative · Pending
  approval, kept secondary; the top banner is the master disclosure.

## V2 experience

V2 rebuilt the presentation and interaction layer on the same data and content
architecture. See [`docs/V2_CREATIVE_REVIEW.md`](./docs/V2_CREATIVE_REVIEW.md) for
the section-by-section review of what changed and why.

- **Visual DNA — the Nusantara lattice** (`src/components/identity/`): four
  interlocking arched bands about a cross-axis converging on a four-point star,
  derived from (never altering) the logo. Used for markers (`NStar`), diagrams
  (`Lattice`, `AllocationSystem`), gauges (`StateGauge`) and transitions.
- **Motion** (`motion` / Framer Motion via `LazyMotion`, plus CSS keyframes):
  values tween when the *selection* changes, charts morph between periods
  (`MorphChart`), the process visual transforms per stage, a decision token
  travels the governance gates. `MotionConfig reducedMotion="user"` and CSS
  `prefers-reduced-motion` rules disable all of it. Illustrative values never
  update on their own.
- **Homepage**: live market canvas hero, continuous market ribbon (pausable;
  swipe on mobile), Nusantara Market State, scroll-revealed statement, sticky
  scroll investment story, research rail, governance signal.
- **Market Dashboard**: intelligence workspace (market rail · morphing chart or
  table · Nusantara View panel), historical comparison, cross-asset view
  (derived measures + sample view), schematic markets map, structural indicators.
- **Insights**: featured research with interactive chart, latest signals, deep
  dives index, themes; articles with active contents, margin notes and market
  signal pull-outs, in-view chart drawing, expandable sources/methodology
  (opened automatically for print).
- **Strategies**: allocation universe; **Governance**: decision flow and control
  architecture.

The intelligence layer — Market State, per-instrument views, signals, themes,
cross-asset view and map — lives in `src/content/data/` and is
**illustrative content for management review**, labelled as such wherever shown.

## Deploying the management-review build

The review deployment is the fully populated demonstration: illustrative
market-data provider, every dashboard surface, sample Nusantara Views, the
Market State demonstration framework and sample research — all labelled, with
the review banner and noindex.

```bash
npm ci
npm run build:review     # NUSANTARA_ENV=review MARKET_DATA_PROVIDER=illustrative
npm run start:review
```

On a hosting platform, set `NUSANTARA_ENV=review` and
`MARKET_DATA_PROVIDER=illustrative` (or leave both unset — review is the
default) for **both build and runtime**. The build log states the mode:

```
Nusantara · environment: MANAGEMENT REVIEW · market data: illustrative
```

| Configuration | Result |
|---|---|
| `NUSANTARA_ENV=review` (default) | illustrative provider, full demonstration |
| `NUSANTARA_ENV=production` + `MARKET_DATA_PROVIDER=http` + credentials | approved provider, published content only |
| production/staging with no provider, or a failing provider | every market surface shows its UNAVAILABLE state |

A dashboard reading "Market data unavailable" means the deployment is running
the production configuration without a provider — not the review build.

## Running

```bash
cp .env.example .env.local   # optional; prototype defaults need no configuration
npm ci
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck  # next typegen && tsc --noEmit
npm run build && npm start
```

Stack: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS 4. Charts are
dependency-free SVG components. Fonts: Newsreader (display) and IBM Plex Sans
(body/data) via `next/font`.

## Routes

| Route | Purpose |
|---|---|
| `/` | Homepage: hero, market ribbon, who we are, Nusantara Market State, investment process, research, governance, contact |
| `/market-dashboard` | Public dashboard: market workspace (rail · chart/table · Nusantara View), cross-asset view, markets map, structural indicators. Accepts `?instrument=<id>` |
| `/insights`, `/insights/[slug]` | Research library and article template |
| `/investment-approach`, `/strategies`, `/strategies/[slug]`, `/governance`, `/about`, `/contact` | Core pages |
| `/legal/[page]` | Privacy, Terms of Use, Important Information, Disclaimer (draft) |
| `/api/market/*` | JSON from the market-data service (revalidated every 60 s) |
| `/api/insights/search-index` | Static search index of visible research |
| `/api/contact` | Validates enquiries; delivers only if `CONTACT_DELIVERY` is configured (prototype: **not stored or sent**) |

## Architecture

```
src/
  lib/config.ts        environment: prototype | staging | production
  lib/market/          types.ts (contracts, data states), instruments.ts (catalogue),
                       service.ts (single entry point; unavailable/licensing rules),
                       status.ts (labels, staleness), providers/illustrative*.ts,
                       providers/http.ts (approved API / vendor gateway)
  lib/content/         repository.ts (publication rules, integrity), relationships.ts (graph)
  lib/search.ts        search index + matching
  lib/analytics.ts     event hooks (no tracker)
  lib/contact*.ts      enquiry schema, delivery seam; lib/rate-limit.ts
  content/model/       publication workflow, Nusantara intelligence model
  content/data/        Nusantara Views, Market State, signals, themes, monitored markets
  content/insights/    typed articles; strategies.ts (capabilities); approach, governance, legal
  components/          layout/, ui/, market/, dashboard/, home/, insights/, sections/
  app/                 routes, sitemap, robots, icons, OG image
```

### Replacing illustrative market data

UI components never read a provider directly — only `src/lib/market/service.ts`.
For an approved API, set `MARKET_DATA_PROVIDER=http` with `MARKET_DATA_API_URL`
and `MARKET_DATA_API_KEY` (server-only) and serve the contract documented in
`providers/http.ts`. For a vendor SDK, add a sibling adapter implementing
`MarketDataProvider` and register it in `service.ts`. Status labels
(illustrative · delayed · live · unavailable), source lines, timestamps,
stale markers and licensing withholding then apply everywhere.

### Adding research

Add `src/content/insights/<slug>.ts` exporting an `Insight` and register it in
`src/content/insights/index.ts`. The template renders the structured blocks —
including `layer` blocks (`data` / `interpretation` / `implication`), tables,
charts and the reusable `scenario` block (Nusantara Scenario Analysis).
Publication follows `draft → review → approved → published → archived`;
declare `markets`, `themes`, `capabilities` and `assetClasses` and the
relationship engine links the article everywhere relevant.

### Capabilities and products

`src/content/strategies.ts`: `status` is the governance lifecycle
(`internal → review → public-capability → active-product → archived`) and
decides visibility; `stage` is the public label (Capability, Future
development …). All seven are in `review`. `product` is the future product
extension and is `null` everywhere; it is displayed only for an approved
active product.

## Publication filter applied

Built from the Platform Profile (Investor Edition v1.0) and the private-wealth
market insight report, after filtering:

- **Used (generalised):** governed-allocation philosophy, six-stage operating
  model, governance layers at function level, risk ↔ resilience ↔ return,
  modular capabilities, layered information pathway, data/interpretation/
  implication research structure, conventional and Shariah-capable shared principles.
- **Excluded:** all jurisdictional and structuring references, channel and
  distribution positioning, market statistics and scenario figures from the
  report, the active-strategy addendum (sizing, holding periods, signal metrics),
  commercial KPI and AUM tables, and all named individuals and providers.
- Singapore and Malaysia appear only as market-data instruments (e.g. STI, KLCI,
  USD/SGD), never as positioning.

## Management review checklist

The full register is [`docs/MANAGEMENT_DECISIONS.md`](./docs/MANAGEMENT_DECISIONS.md).

- [ ] Approve positioning copy (hero, About, Investment Approach)
- [ ] Approve or replace sample research, Market State readings, Nusantara Views and signals (`src/content/data/`)
- [ ] Appoint a market-data provider; confirm licence and attribution wording
- [ ] Replace Level B illustrative indicators with sourced research data
- [ ] Supply contact details, corporate information and leadership (if any)
- [ ] Confirm the status of each capability before any is shown as active
- [ ] Legal review of `/legal/*` and disclaimers
- [ ] Connect `/api/contact` to an approved delivery channel
- [ ] Set `NEXT_PUBLIC_SITE_URL` and `NUSANTARA_ENV=production` at launch
