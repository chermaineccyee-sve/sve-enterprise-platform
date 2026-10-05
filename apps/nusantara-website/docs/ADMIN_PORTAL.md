# Admin Portal — Nusantara Administration

Payload CMS 3 runs inside this Next.js app.

- **B0 (foundation):** roles, workflow, classification, security and the
  content-source switch.
- **B1A (editorial CMS):** the editorial and intelligence content is imported
  into the Admin Portal and can be run end to end from `/admin`. This covers
  Insights, Nusantara Views, the Market State, Signals, Themes and
  Capabilities, with preview, publishing, revalidation and version restore
  under the approval workflow.

The live site still reads the typed files (`CONTENT_SOURCE=local`, the
default). Setting `CONTENT_SOURCE=cms` switches it to the Admin Portal. The
frozen management-review build is commit `e803790`, and `scripts/parity`
checks the public site against it.

- **B1B (online readiness):** Neon Postgres and private S3 configuration,
  guarded deploy-time migrations, bootstrap window, media delivery rules,
  observability and the legal-404 fix. Deployment and operations:
  [DEPLOYMENT.md](DEPLOYMENT.md); cutover gate:
  [CMS_CUTOVER_CHECKLIST.md](CMS_CUTOVER_CHECKLIST.md).

## 1. Architecture

```
src/app/
  (site)/            public website — unchanged pages, its own root layout
  (payload)/         Admin Portal root layout
    admin/[[...segments]]   /admin  (Payload admin UI)
    api/cms/[...slug]       /api/cms (Payload REST API; GraphQL disabled)
  api/               the site's own routes (/api/market, /api/contact, …) — unchanged
  global-not-found.tsx      404 for unmatched URLs, rendered with the site layout
  robots.ts, sitemap.ts, icons, opengraph-image.jpg — unchanged, at the app root
src/payload.config.ts      Payload configuration
src/cms/
  access/roles.ts          roles and access helpers
  fields/workflow.ts       workflow + classification + audit fields
  hooks/workflow.ts        server-side transition rules (Editor/Approver separation)
  hooks/audit.ts           append-only audit trail
  collections/, globals/   schemas
  taxonomy.ts              fixed taxonomies, read from code
  migrations/              reviewed SQL migrations (no auto-push)
  scripts/                 seed-admin, verify-workflow
src/lib/content/
  source.ts                CONTENT_SOURCE switch
  cms-source.ts            CMS loaders → existing content types
  repository.ts            unchanged rules; now reads through source.ts
```

Public URLs do not change. Route groups add no URL segment. The Admin Portal
is at `/admin` and its API at `/api/cms`, so it does not collide with the
site's `/api/*` routes.

## 2. Roles

| | Editor | Reviewer | Admin |
|---|---|---|---|
| Create / edit content, submit for review | ✓ | ✓ | ✓ |
| Approve, publish, archive | — | ✓ (not own work where separation applies) | ✓ (same) |
| Delete content | — | — | ✓ |
| Confirm *Approved corporate content* | — | — | ✓ |
| Users, roles, corporate information | — | — | ✓ |
| Read the audit log | — | ✓ | ✓ |

All checks are server-side (Payload access control and `beforeChange` hooks).
They apply to the Admin UI, the REST API and the Local API alike.

## 3. Workflow and classification

These are two separate fields, and neither is derived from the other.

**Workflow status:** Draft → In review → Approved → Published → Archived.

- Editors can set Draft or In review only, and can never publish.
- **Nusantara Views and Market State editions use Editor/Approver separation.**
  - An item can be approved only from In review.
  - The approver or publisher must not be the item's creator, submitter or
    last content editor.
  - An approval save cannot change content.
  - Publishing requires exactly the approved content, checked with a content
    hash.
- **Other content follows a lighter workflow.** A Reviewer or Admin may
  approve and publish in one step, and is recorded as the approver.
- When published content is edited, the working copy returns to Draft. The
  live version stays as it is until someone publishes again.
- Archiving with Publish withdraws the live item.

**Content classification:** Illustrative · Management review · Approved
corporate content.

- Publishing never changes the classification.
- Only an Admin can set *Approved corporate content*. The system records who
  set it and when.
- The CMS loader treats anything not confirmed as approved corporate content
  as sample content. Sample content can never render in production.
- Migrated records keep their original id, status and sample flag verbatim in
  a read-only `legacy` group.

## 4. What is not CMS content

The following stay code-controlled:

- Market data: prices, changes, series, instrument mappings, provider
  timestamps, and the provider abstraction.
- Brand master assets.
- The design system, charts, the ticker and Market Dashboard behaviour.
- MYT / SGT time handling.
- Taxonomies: Insight categories, capability status/stage, research asset
  classes and Market State dimensions.
- Product details: these need an approved product and an approved data source.

Instruments and structural indicators appear in the CMS only as fixed choices
in relationship pickers.

## 5. Local development

```bash
# Postgres 16 running locally; create a database and role, then in .env (git-ignored):
DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:5432/nusantara_cms
PAYLOAD_SECRET=$(openssl rand -hex 32)

npm run cms:migrate                      # apply migrations
CMS_SEED_ADMIN_EMAIL=… CMS_SEED_ADMIN_NAME=… CMS_SEED_ADMIN_PASSWORD=… npm run cms:seed-admin
npm run dev                              # site at /, Admin Portal at /admin
npm run cms:verify-workflow              # server-side rules + CMS loader, against the local DB
```

After a schema change, run `npm run cms:migrate:create <name>`, review the
generated SQL, then run `npm run cms:generate` to regenerate the types and
import map.

## 6. Security notes

- **Authentication.** Payload's server-side password authentication.
  - Passwords are hashed with PBKDF2 and must be at least 12 characters.
  - Sessions use an HTTP-only cookie (`Secure` in production,
    `SameSite=Strict`) and expire after 8 hours.
  - After 5 failed attempts an account locks for 15 minutes.
  - Requests are checked against a CSRF/CORS origin allowlist.
- **No self-registration.** The first Admin is created through the
  bootstrap window (`CMS_BOOTSTRAP_TOKEN` + `/admin/bootstrap`, only while no
  account exists) or by `cms:seed-admin` (docs/DEPLOYMENT.md §6).
- **Password reset by email is disabled** until an email service is
  configured. Otherwise Payload would write reset links to the server log.
  Until then, an Admin resets passwords.
- **Admin pages are never indexed or cached.** `/admin` and `/api/cms` send
  `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`, and production
  `robots.txt` disallows `/admin`.
- **No anonymous API access.** Anonymous `/api/cms` requests can read
  nothing, except media files a Reviewer or Admin has approved for public
  use. The public site reads only through the content repository, on the
  server.
- **SSO/MFA later.** Payload auth strategies can authenticate against a
  corporate identity provider and resolve to the same user records. Roles stay
  on those records, so content collections do not change.

## 7. Environment variables

See `.env.example`, and docs/DEPLOYMENT.md §4 for the full matrix per deploy
context. `NEXT_PUBLIC_SITE_URL` is the public origin; it is also the Admin
Portal's CSRF origin.

## 8. B1A — editorial CMS

### What is CMS-managed

These are managed in the CMS: Insights, Nusantara Views, the Market State
(edition and dimensions), Signals, Themes and Capabilities (descriptive
content and relationships).

These are not migrated yet: homepage and other page copy, About, Contact,
navigation and footer, corporate information, legal text, and production
media.

### Import (`npm run cms:import`)

The import is idempotent, and its order follows the relationships:

1. insights (text first)
2. themes
3. capabilities
4. insights again, to add related research
5. signals
6. Nusantara Views
7. Market State

What the import preserves:

- Every id/slug, wording, relationship, date, publication status and sample
  flag.
- The legacy status, sample flag and date, stored verbatim in each record's
  read-only "Migrated record" group.

How records are classified:

- Views, Market State and Signals become **Illustrative**.
- Insights, Themes and Capabilities become **Management review**.
- Nothing becomes Approved corporate content.

Each record becomes its live version with its legacy workflow status (e.g.
In review), exactly as the review site shows it. No approval is recorded.

On re-runs:

- Unchanged records are skipped.
- Records nobody has edited are updated.
- Records edited in the Admin Portal are never overwritten.

`npm run cms:verify-equivalence` compares the content the site would render
from the CMS with the local files, field by field.

### Relationships

There is one relationship graph (`src/lib/content/relationships.ts`), built
from whichever source is configured. Every page asks that graph, so a change
made in `/admin` resolves the same way everywhere: the homepage Market
Intelligence panel, the dashboard workspace, articles and strategies.

B1A adds explicit **capability** links on Nusantara Views and on Market State
dimensions. Links are declared once and are visible from both sides. Links to
anything that is not live disappear, just as unpublished links always have.

### Preview

1. Save Draft, then use the Preview button. It opens `/api/preview`.
2. The route requires a signed-in Admin Portal user. A cross-site request is
   not authenticated, so it can't start a preview.
3. The route enables Next.js Draft Mode, records the item, and redirects to
   the item's real public page, computed from the stored document.
4. Every preview render re-checks the Admin session. A copied Draft Mode
   cookie alone shows only the live site.

The previewed item is shown as its working copy, and everything else stays
live. Pages carry a "Preview · Not published" banner and are noindex and
`no-store`. Exit preview clears Draft Mode.

### Publishing and revalidation

Public reads use **live versions only**. Each collection is cached under its
own tag (`cms:<collection>`).

Publishing, archiving, unpublishing or deleting revalidates that tag. Saving
drafts, submitting, approving or restoring does not, because none of them
changes the live site.

The next request to any page that uses the collection re-renders it. There is
no rebuild or redeploy.

The legal route renders on demand (`dynamicParams = true`) so it can be
regenerated after a publish. Unknown slugs are still 404.

### Live-write protection

The live version changes only through:

- an explicit **Publish**, validated by the workflow rules, or
- an **Unpublish** by a Reviewer or Admin.

Any other signed-in save, such as an API request without the draft flag,
becomes a draft save.

Time-sensitive interpretation (Views, Market State, Signals) needs a future
"Re-review by" date as part of the approved content before it can be
published.

### Versions and restore

Every save is a version. The version screens show each version's fields,
including the last editor, submitter and approver of record. The audit log
records who submitted, approved, published, restored and unpublished.

Restores always create a **Draft working copy**:

- The API route requests restores as drafts.
- The collections refuse non-draft restores.

The live version is untouched. Restored content goes through review again,
and under Editor ≠ Approver the person who restored it can't approve it.

### Capabilities

Admins create capabilities. Reviewers and Admins set lifecycle and stage.
Editors edit descriptive content and relationships. An investment product
("active-product" / stage "Active") cannot be created or activated in the CMS.

### Administration

The admin uses the Nusantara logo and mark, "Nusantara Administration"
naming and a light theme.

"Forgot password?" is replaced by "ask an Admin" until an email service
exists, and `/admin/forgot` explains this.

The dashboard shows working-copy counts, items requiring review, Nusantara
Views awaiting separate approval, the Market State status, the latest
Insights, recent changes and read-only market-data status.

## 9. B1A.1 — admin usability

### Status line

Every governed item shows one line above the form:

> Workflow: In Review · Classification: Illustrative · Website: A published
> version is live

The Nusantara workflow is the authoritative status. Classification is shown
separately and is never derived from it. Payload's own Draft/Published badge
is replaced by this line, and the Payload draft engine itself is unchanged.

- **Publish to website** and **Withdraw from website** are labelled for what
  they do.
- Only Reviewers and Admins see those buttons. The server enforces the same
  rule.
- The API URL link is hidden.

### Discard draft changes

When an item has a live version and unpublished draft changes, the status
line shows **Unpublished draft changes** with a **Discard draft changes**
button. Payload's "Revert to published" is no longer shown. Discard asks for
confirmation, then calls `POST /api/cms/{collection}/{id}/discard-draft`
(`src/cms/hooks/discard.ts`):

- It removes only the draft versions saved after the last published version,
  ordered by version id.
- The published version becomes the working copy again.
- The live record is never written, republished or restored, so the website
  does not change and no approval or revalidation is needed.
- Any signed-in user may discard, Editors included. The endpoint needs an
  Admin Portal session and passes the same CSRF origin check as the rest of
  `/api/cms`.
- Every discard writes a `discard` entry to the audit log.
- The next edit starts a normal Draft again.
- An item that has never been published has nothing to return to, so discard
  is refused (409).

### Structured Insight content

Insight articles are edited with typed blocks. There is no raw JSON in the
editor:

- Section heading
- Paragraph
- Bulleted / numbered list
- Pull quote
- Research layer (Data · Interpretation · Implication)
- Table (columns and rows of cells)
- Comparison (left/right rows)
- Chart (x labels, one or more series with numeric values, unit, decimals,
  source)
- Scenario (three paths: downside, base and upside, each with label,
  assumption, values and rate, plus years, period, data source and
  methodology)
- Callout box

Lists of words or numbers are entered one value at a time. The CMS loader
maps the blocks back to the exact content types the public renderer already
uses, so the public output is unchanged. `cms:verify-equivalence` confirms
this for every migrated Insight. This is not a page builder: block types,
order rules and rendering stay code-controlled.

### Labels

Admin groups are:

- **Nusantara Intelligence:** Views, Market State, Signals
- **Insights & Research:** Insights, Themes
- **Corporate:** Capabilities, Legal pages
- **Media**
- **Administration:** Users, Audit Log

Workflow values read Draft / In Review / Approved / Published / Archived.
Classification reads Illustrative / Management Review / Approved Corporate
Content. Instrument and indicator pickers show plain names.

### Checks

| Command | What it checks |
|---|---|
| `npm run cms:verify-workflow` | Roles, workflow, separation, live-write guard, restore, discard, capabilities, classification, loader (server-side) |
| `npm run cms:verify-equivalence` | CMS content equals the local files |
| `node scripts/parity/parity.mjs` | Public site vs `e803790` (HTML, CSS, headers, APIs, files, screenshots) |


### Insight cover visual

Insights → **Cover visual**:
- **Visual type:**
  - *Abstract* (default; the generated Nusantara pattern, chosen under
    *Abstract pattern*);
  - *Image* (upload or choose from Media, plus an optional caption);
  - *Research visual* (the article's first chart).

Where the cover shows:

| Surface | Abstract | Image | Research visual |
|---|---|---|---|
| Homepage research cards | pattern | image | the lead chart (decorative) |
| Featured slot (homepage, Insights page) | lead chart if any, else pattern (unchanged) | image, with caption · credit | lead chart if any, else pattern |
| Article header band | pattern | image, with caption · credit below | pattern (the article shows its charts in the text) |

How it behaves:
- **Sizing:** images fill the existing containers with `object-fit: cover`
  around the Media item's focal point. Responsive sizes come from the Media
  library (800 / 1600 px and the original). No card changes size.
- **Governance:**
  - only authorised images, with alt text (required) and source/licence on the
    Media item;
  - an image appears publicly only after *Approved for public use*;
  - granting or withdrawing approval refreshes the public pages at once;
  - previews show the image to signed-in staff before approval.
- **Fallback:** without an approved image, or a chart for a research visual,
  the abstract pattern is shown.
- **Existing Insights** keep the abstract default.

## 10. B1B — online readiness

Deployment, environment matrix, provisioning, migrations, bootstrap, media,
email/MFA assessment, backup and observability: [DEPLOYMENT.md](DEPLOYMENT.md).
The cutover gate: [CMS_CUTOVER_CHECKLIST.md](CMS_CUTOVER_CHECKLIST.md).

### Unknown legal URLs

Unknown `/legal/<slug>` URLs, case variants included, return the site's
styled 404. The response is HTTP 404 with the "Page not found" title and is
complete without JavaScript.

How it works:
- A rewrite in `next.config.ts` sends unknown slugs to the global 404 before
  the dynamic route runs.
- `experimental.caseSensitiveRoutes` makes config matching case-sensitive,
  like the routes themselves.
- The legal route keeps `dynamicParams = true`, so valid pages still
  regenerate after publishing. With `false`, Next.js answers a revalidated
  legal page with a 404.

`scripts/regression/publish-revalidation.mjs` checks both.

### Regression scripts (HTTP, any CMS-source deployment)

| Script | Checks |
|---|---|
| `scripts/regression/publish-revalidation.mjs` | publish/withdraw → every public route stays 200 and updates without a rebuild; legal pages regenerate; unknown legal URLs stay a styled 404 |
| `scripts/regression/bootstrap-and-access.mjs` | anonymous account creation refused; bootstrap window and its closure; CSRF on the session cookie |
| `scripts/regression/media-access.mjs` | unapproved media not public; approval needs a Reviewer and a licence; caching; refused types and sizes |
