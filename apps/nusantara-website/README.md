# Nusantara Fund Management — public website (management-review prototype)

The public website for Nusantara Fund Management: institutional positioning, a
public **Market Dashboard**, **Nusantara Insights** research, investment
approach, capability architecture and governance.

**Status: management-review prototype.** All market data is illustrative, all
research is sample content, and the site is excluded from search indexing
(`site.isPrototype` in `src/lib/site.ts`). The app is self-contained and has no
dependency on any other app or service in this repository.

## V2 experience (current)

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
  swipe on mobile), Nusantara Market State, Market → Signal → Insight lens,
  scroll-revealed statement, sticky scroll investment story, research rail,
  governance signal.
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
cross-asset view and map — lives in `src/content/intelligence.ts` and is
**sample content for management review**, labelled as such wherever shown.

## Running

```bash
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
| `/` | Homepage: hero, market pulse, philosophy, process, capabilities, market intelligence, Nusantara View, insights, governance, contact |
| `/market-dashboard` | Public dashboard. Level A market data (tabs, periods, region filter, cards/table, single/compare chart) and Level B strategic intelligence |
| `/insights`, `/insights/[slug]` | Research library and article template |
| `/investment-approach`, `/strategies`, `/strategies/[slug]`, `/governance`, `/about`, `/contact` | Core pages |
| `/legal/[page]` | Privacy, Terms of Use, Important Information, Disclaimer (draft) |
| `/api/market/*` | Static JSON from the market-data service |
| `/api/contact` | Validates enquiries; **does not store or send them** |

## Architecture

```
src/
  lib/market/        types.ts (contracts), instruments.ts (catalogue),
                     service.ts (single entry point), format.ts,
                     providers/illustrative*.ts (seeded demo data)
  hooks/useMarketData.ts   client history/snapshot hooks
  content/           insights/ (typed articles), strategies.ts, approach.ts,
                     governance.ts, view.ts, legal.ts
  components/        layout/, ui/, market/, insights/, sections/
  app/               routes, sitemap, robots, icons, OG image
```

### Replacing illustrative market data

UI components never read a provider directly — only `src/lib/market/service.ts`.
To integrate an authorised source:

1. Implement `MarketDataProvider` (`src/lib/market/types.ts`) in
   `src/lib/market/providers/<name>.ts`, mapping instrument ids to vendor symbols.
2. Return real `DataProvenance` (`source`, `status: "live" | "delayed" | "end-of-day"`,
   `asOf`, `delayMinutes`, `attribution`) and the provider's required disclaimer.
3. Register it in `service.ts` and set `MARKET_DATA_PROVIDER=<name>`.
4. Set `refreshIntervalMs` if the client should poll; change the market API
   routes from `force-static` to an appropriate revalidation.

Status labels, source lines, timestamps and disclaimers then update everywhere.

### Adding research

Add `src/content/insights/<slug>.ts` exporting an `Insight` and register it in
`src/content/insights/index.ts`. The template renders the structured blocks —
including `layer` blocks (`data` / `interpretation` / `implication`), tables,
charts and the reusable `scenario` block (Nusantara Scenario Analysis). Set
`status: "approved"` to remove the sample-research banner.

### Strategy status

`src/content/strategies.ts` drives a five-state status (`capability`,
`under-review`, `strategy`, `active`, `future-development`). All entries are
`capability` or `future-development`; objective, time horizon and documents are
`null` and render as management-review placeholders.

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

- [ ] Approve positioning copy (hero, About, Investment Approach)
- [ ] Approve or replace sample research, Market State readings, instrument views and signals (`src/content/intelligence.ts`)
- [ ] Appoint a market-data provider; confirm licence and attribution wording
- [ ] Replace Level B illustrative indicators with sourced research data
- [ ] Supply contact details, corporate information and leadership (if any)
- [ ] Confirm the status of each capability before any is shown as active
- [ ] Legal review of `/legal/*` and disclaimers
- [ ] Connect `/api/contact` to an approved delivery channel
- [ ] Set `NEXT_PUBLIC_SITE_URL` and `site.isPrototype = false` at launch
