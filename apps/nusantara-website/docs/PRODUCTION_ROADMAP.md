# Production roadmap

From **management-review prototype** to **public investment-intelligence
website** on the same platform. Each stage is a change of content,
configuration or integration — not a rebuild. Technical detail is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md); open decisions are in
[`MANAGEMENT_DECISIONS.md`](./MANAGEMENT_DECISIONS.md).

```
CURRENT PROTOTYPE → CONTENT APPROVAL → DATA INTEGRATION → PUBLICATION GOVERNANCE
  → LEGAL / COMPLIANCE → STAGING → PRODUCTION LAUNCH → ONGOING MARKET & INSIGHTS OPERATIONS
```

---

## 1. Current prototype

**State:** V2.1 design approved and frozen. `NUSANTARA_ENV=prototype`.

- Illustrative market data, clearly labelled; prototype banner; not indexed.
- All Nusantara Views, the Market State, signals, themes and eight research
  articles are sample content in `review` status.
- Seven capabilities in `review` status; no products.
- Contact form validates but neither stores nor sends.
- Architecture in place: provider-agnostic market data, publication workflow,
  relationship engine, search index, analytics hooks, environment
  configuration, security headers.

**Exit criteria:** management review complete; decisions in
`MANAGEMENT_DECISIONS.md` assigned owners.

## 2. Content approval

**Goal:** an approved set of words, views and capabilities.

- Approve positioning copy (Home, About, Investment Approach, Governance).
- For each research article: approve, edit or withdraw. Approved articles move
  `review → approved`; sample flags are removed only on genuinely approved text.
- Decide which capabilities are public (`review → public-capability`).
  Products remain out of scope unless separately approved.
- Supply corporate information and contact details (`lib/site.ts`).

**Exit criteria:** every public item has an owner, an approver of record and,
where time-sensitive, a review cycle.

## 3. Data integration

**Goal:** an authorised market-data source behind the existing service.

- Appoint a provider; confirm licence, display rights, delay and attribution
  wording per instrument.
- Implement or configure the adapter (`providers/http.ts` contract, or a
  vendor-specific sibling). Map instrument ids to vendor symbols in the gateway.
- Set `licence: "restricted"` for anything not cleared for public display —
  the service withholds it automatically.
- Set staleness thresholds (`staleAfterMinutes`) per feed.
- Replace illustrative structural indicators with sourced research data.

**Exit criteria:** staging shows delayed/live labels, attribution and no
unlicensed values; failure states verified (provider down, instrument missing,
stale, missing history).

## 4. Publication governance

**Goal:** a repeatable path from draft to published, and back to archived.

- Define roles: author, reviewer, approver (names recorded in `approvedBy`).
- Define review cycles: house views and the Market State carry `reviewAt`;
  expired items withdraw automatically.
- Decide research authorship (institutional byline vs named authors) and
  publication frequency.
- Choose the editing tool: continue with reviewed source changes, or adopt a
  CMS via the repository seam (see ARCHITECTURE §6). Either way the workflow
  states are the same.

**Exit criteria:** one Nusantara View and one article taken through the full
workflow on staging, including expiry and archive.

## 5. Legal / compliance

**Goal:** wording and controls approved for public use.

- Legal review of `/legal/*`, the general disclaimer, data disclosures and
  attribution wording.
- Confirm governance disclosures (bodies, independence, service providers) —
  until confirmed they remain described as process and control concepts.
- Privacy notice aligned with the contact workflow and any analytics.
- Accessibility review (WCAG 2.2 AA target).
- Security hardening: nonce-based CSP, shared rate-limit store, secret
  rotation, dependency audit in CI.

**Exit criteria:** written legal and compliance sign-off on the staging site.

## 6. Staging

**Goal:** the production configuration, rehearsed.

- `NUSANTARA_ENV=staging`, real provider credentials (test entitlement),
  `CONTACT_DELIVERY=webhook` to a test endpoint.
- Not indexed. Approved content only.
- Run the QA suites (interaction, architecture, crawl, visual regression)
  against staging.

**Exit criteria:** management walkthrough on staging; go/no-go recorded.

## 7. Production launch

- `NUSANTARA_ENV=production`; production domain in `NEXT_PUBLIC_SITE_URL`.
- Production market-data entitlement; production contact delivery.
- `SITE_INDEXING=allow` only if management has decided to index.
- Analytics adapter attached only if approved (with consent where required).
- Post-launch checks: headers, robots, sitemap, data status labels,
  contact delivery, error monitoring.

## 8. Ongoing market & insights operations

| Cadence | Activity |
|---|---|
| Continuous | Market data refreshes (pages every 5 min, APIs every 60 s); stale and unavailable states surface automatically |
| Per review cycle | Re-review each Nusantara View and the Market State before `reviewAt`; republish or archive |
| Per publication | Draft → review → approve → publish research; sources carry provider, dates, licence and method |
| Monthly | Review analytics (if adopted), search terms, broken-link and accessibility reports |
| Quarterly | Licence and attribution review; dependency and security audit; content integrity report |
| As needed | Capability lifecycle changes; any product only through formal approval and the product extension |
