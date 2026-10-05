# Developer Handover — Nusantara Fund Management website + Admin Portal

Scope: `apps/nusantara-website` only. The rest of this monorepo (SVEGIP,
platform services) is unrelated and unaffected. For the repository as a whole
see `README.md`.

| Reference | Commit | Branch |
|---|---|---|
| Frozen management-review public build ("Eric Review Build") | `e803790` | `claude/bold-hopper-w9dmf6` |
| Developer-handover build: public site + Admin Portal | `765c564` | `claude/admin-portal` |

**This is not a static one-time website.**
- Routine editorial and investment-intelligence content is meant to be
  maintained by Nusantara staff through **`/admin`** after deployment:
  Insights, Nusantara Views, the Market State, Signals, Themes and
  Capabilities.
- Publishing goes through an approval workflow. Pages update without a
  rebuild.
- The code is finished to the point of deployment. What remains is
  provisioning company-controlled infrastructure (§13) and the separately
  approved CMS cutover (§14).

---

## 1. What the system is

**Public website** — a Next.js 16 site:
- institutional positioning
- a public Market Dashboard (illustrative market data in review mode)
- Nusantara Insights research
- the "Nusantara View" interpretation per market and the Market State
  assessment
- capabilities, governance and legal pages

**Admin Portal** — Payload CMS 3 inside the same Next.js app, at `/admin`
(REST API at `/api/cms`). Staff use it to author, review, preview, approve and
publish content, with roles, an audit trail and version history.

**The two run as one deployment**, connected by a content-source switch:
- `CONTENT_SOURCE=local`: content comes from typed files in `src/content`.
  This is the default, and how the live site runs today.
- `CONTENT_SOURCE=cms`: content comes from the published versions in the
  Admin Portal's database.

## 2. Architecture overview

```
Browser ─► Netlify CDN ─► Next.js server function (one app, @netlify/plugin-nextjs)
             ├─ public site  (src/app/(site))     → src/lib/content/source.ts → local files | CMS (published only)
             │                                     → src/lib/market/service.ts → market-data provider (server-side)
             └─ Admin Portal (src/app/(payload))  → Payload CMS 3
                    ├─► PostgreSQL — Neon, AWS ap-southeast-1 (pooled endpoint at runtime, direct for migrations, TLS)
                    └─► AWS S3 ap-southeast-1, private bucket (browser→S3 signed uploads; downloads only via access control)
```

How the pieces fit:
- **Public reads:** the site reads **live (published) versions only**. Each
  collection is cached under the tag `cms:<collection>`.
- **Revalidation:** publishing, withdrawing or deleting revalidates that tag,
  so the next request re-renders.
- **Preview:** Draft Mode. It requires a signed-in Admin session on every
  request.

## 3. Repository and application structure

```
apps/nusantara-website/
  src/app/(site)/            public pages (own root layout)
  src/app/(payload)/         /admin, /api/cms, /api/preview, /api/cms-bootstrap, /api/cms-health
  src/app/api/               site APIs: /api/market/*, /api/insights/search-index, /api/contact
  src/content/               typed content files (CONTENT_SOURCE=local) + content models
  src/lib/content/           source switch, CMS loader (cms-source.ts), repository, relationship engine, preview session
  src/lib/market/            market-data service, provider interface, providers/ (illustrative, http)
  src/cms/                   Payload: collections/, fields/, hooks/ (workflow, audit, revalidate, discard,
                             observability), access/roles.ts, migrations/, scripts/, env.ts, bootstrap.ts, log.ts
  src/payload.config.ts      Payload configuration
  next.config.ts             headers/CSP, legal-404 rewrite, build-time CONTENT_SOURCE/CMS_DATA_ENV
  netlify.toml               build command and per-context CONTENT_SOURCE
  scripts/cms/deploy.mjs     deploy step (preflight + migrations [+ import]) run before `next build`
  scripts/parity/            public-site parity check against e803790
  scripts/regression/        HTTP regression suites (publish/revalidation, bootstrap/access, media)
  docs/                      see §15
```

## 4. Running locally

Requirements:
- **Node 22.** Netlify uses 22, and `package-lock.json` is committed.
- **PostgreSQL 16** for the Admin Portal. The public site alone needs no
  database.

Public site only (no database):
```bash
cd apps/nusantara-website
npm ci
npm run dev                        # http://localhost:3000, CONTENT_SOURCE=local
npm run build:review && npm run start:review   # the review build exactly as deployed
```

With the Admin Portal:
1. Create a local database and role.
2. Create `apps/nusantara-website/.env`. It is git-ignored; start from
   `.env.example`.
   ```bash
   DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:5432/nusantara_cms
   PAYLOAD_SECRET=$(openssl rand -hex 32)
   ```
3. Run:
   ```bash
   npm run cms:deploy      # preflight + migrations (development applies them) — or: npm run cms:migrate
   npm run cms:import      # idempotent import of the typed content into the CMS
   CMS_SEED_ADMIN_EMAIL=you@example.com CMS_SEED_ADMIN_NAME="Your Name" npm run cms:seed-admin   # prompts for password
   npm run dev             # /admin
   CONTENT_SOURCE=cms npm run dev   # public site reading the CMS (preview works only in this mode)
   ```

Checks:
- `npm run lint`
- `npm run typecheck`
- `npm run cms:verify-workflow`: server-side rules, 55 checks. It runs only
  against a database marked `development`.
- `npm run cms:verify-equivalence`: CMS content against the typed files.
- `node scripts/parity/parity.mjs --base <e803790 server> --head <this build>`

## 5. Configuring the CMS

- **Schema** lives in code: `src/cms/collections/*` and
  `src/payload.config.ts`. No schema is edited through the UI.
- **After a schema change:**
  1. `npm run cms:migrate:create <name>`
  2. Review the generated SQL.
  3. `npm run cms:generate` (types + admin import map).
  4. Commit the migration, its `.json` snapshot and `migrations/index.ts`.
  - Payload's `push` is off. Migrations are the only path to a schema change.
- **Taxonomies are fixed in code** (`src/cms/taxonomy.ts`): instruments,
  indicators, asset classes, Market State dimensions and Insight categories.
- **S3:** the S3 storage plugin is always registered, so the schema is the
  same with or without S3. It handles files only when `S3_BUCKET` is set.
- **First Admin account:**
  - Online: the bootstrap window, set with `CMS_BOOTSTRAP_TOKEN` and used at
    `/admin/bootstrap`. It works only while no account exists.
  - From a trusted machine: `cms:seed-admin`.
  - After that, Admins create accounts in Users. There is no
    self-registration.

## 6. Environment variables

The full matrix, per Netlify context (production, branch deploy, deploy
previews, local), with secret/public classification, is in
**`apps/nusantara-website/docs/DEPLOYMENT.md` §4**. In summary:

- **Secret:**
  - `DATABASE_URL`: Neon pooled endpoint, TLS.
  - `DATABASE_URL_UNPOOLED`: Neon direct endpoint, used for migrations.
  - `PAYLOAD_SECRET`: at least 32 characters, unique per context.
  - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
  - `CMS_BOOTSTRAP_TOKEN`: temporary.
  - `MARKET_DATA_API_KEY` and `CONTACT_WEBHOOK_SECRET`, when those are used.
- **Configuration:**
  - `CMS_DATA_ENV`: `production` | `preview` | `development`.
  - `S3_BUCKET`, `S3_REGION`.
  - `CMS_EXTRA_ORIGINS`, `CMS_MIGRATIONS`, `CMS_ALLOW_DESTRUCTIVE_MIGRATION`,
    `CMS_IMPORT_ON_DEPLOY`, `CMS_DB_POOL_MAX`.
  - `NUSANTARA_ENV`, `MARKET_DATA_PROVIDER`, `MARKET_DATA_API_URL`,
    `SITE_INDEXING`, `CONTACT_DELIVERY`, `CONTACT_WEBHOOK_URL`.
- **Public:** `NEXT_PUBLIC_SITE_URL` is the only variable built into browser
  code. It is also the Admin Portal's CSRF origin.
- **`CONTENT_SOURCE` is set in `netlify.toml` per context**, not in the
  Netlify UI. The build fixes it into the code (`next.config.ts`).

## 7. Database migration and import sequence

The Netlify build command is `node scripts/cms/deploy.mjs && npm run build:review`.

1. **Deploy step** (`scripts/cms/deploy.mjs` → `src/cms/scripts/preflight.ts`).
   With no `DATABASE_URL` it does nothing (public site only). Otherwise:
   1. **Environment rules:** TLS required, Neon pooled vs direct URLs, an https
      site URL, S3 present when deployed, and the context matching
      `CMS_DATA_ENV`.
   2. **Connectivity** over the direct endpoint.
   3. **Data-environment marker:** the database records which `CMS_DATA_ENV`
      owns it, and refuses any other.
   4. **Destructive-migration guard:** a DROP, RENAME, TRUNCATE or type change
      needs `CMS_ALLOW_DESTRUCTIVE_MIGRATION=<migration name>`.
   5. **Migrations**, each in its own transaction:
      - preview and development apply them;
      - **production only checks them**, unless deployed once with
        `CMS_MIGRATIONS=apply` after taking a Neon backup branch.
   6. **Optional import** with `CMS_IMPORT_ON_DEPLOY=true`:
      `src/cms/scripts/import-content.ts`.
2. **`next build`.** In CMS mode it prerenders from the database.
3. **Netlify publishes atomically.** Any failure above fails the build, and
   the previous deploy stays live.

Migrations must be backward-compatible (expand, then contract). Schema changes
never happen at application start-up.

**About the import.** It is idempotent:
- **What it preserves:** ids/slugs, wording, relationships, dates, legacy
  status and sample flags.
- **Classification:** Views, Market State and Signals become Illustrative;
  Insights, Themes and Capabilities become Management Review.
- **What it never does:** set Approved Corporate Content, import TEST
  records, or overwrite records edited in the Admin.
- **Proof:** a production-style rehearsal imported 62 records identical to the
  typed files. A re-run changed nothing, and no accounts or approvals were
  created.

## 8. Roles and publication workflow

**Roles** (`src/cms/access/roles.ts`):
- **Editor:** creates, edits and submits work.
- **Reviewer:** approves and publishes.
- **Admin:** everything a Reviewer can do, plus users, settings, deletion and
  the Approved Corporate Content classification.

All checks are server-side, for the UI, REST and Local API alike.

**Workflow** (authoritative): Draft → In Review → Approved → Published →
Archived. **Classification** is separate: Illustrative / Management Review /
Approved Corporate Content.
Public Insight dates are the CMS publication date, never the current date.
Unless an Insight is Approved Corporate Content, its date carries a quiet
"Illustrative" qualifier (e.g. `1 October 2026 · Illustrative · 3 min`).

- **Nusantara Views and Market State: Editor ≠ Approver.**
  - The approver or publisher must differ from the creator, submitter and
    last editor.
  - Publishing requires exactly the approved content (a content hash).
  - Time-sensitive items need a future "Re-review by" date.
- **Other collections:** a Reviewer or Admin may approve and publish in one
  step.
- **Editing published content** creates a Draft working copy. The live version
  stays until someone republishes.
- **Preview:** the real page in Draft Mode, with a "Preview · Not published"
  banner, `noindex` and `no-store`.
- **Discard draft changes:** returns the working copy to the published version
  without touching the live one.
- **Version restore:** always produces a Draft that goes back through review.
- **Audit Log:** append-only. It records create, edit, submit, approve,
  publish, archive, restore, discard, delete and account changes.

Details: `docs/ADMIN_PORTAL.md`.

## 9. CMS-managed vs code-controlled

| Managed in `/admin` (after cutover) | Code-controlled |
|---|---|
| Insights (structured blocks: text, research layers, tables, comparisons, charts, scenarios) | Market data, instruments, providers, timestamps, MYT/SGT handling |
| Nusantara Views | Design system, components, charts, ticker, Market Dashboard behaviour |
| Market State (edition + dimensions) | Taxonomies (§5) |
| Signals, Themes | Homepage copy, About, Contact, navigation, footer, corporate information |
| Capabilities (descriptive content, relationships; lifecycle by Reviewer/Admin; no investment products) | Legal pages (`src/content/legal.ts`; a `legalPages` collection and `siteSettings` global exist in the schema but the site does not read them yet) |
| Media (editorial images/PDFs) | Brand master assets (`public/brand`, `brand-source/`) |

## 10. Market-data architecture

- **Entry point:** `src/lib/market/service.ts` is the single entry point. A
  provider implements `MarketDataProvider` (`src/lib/market/types.ts`). It is
  selected by `MARKET_DATA_PROVIDER` and called server-side only.
- **Providers:**
  - `illustrative`: deterministic sample data, the review default.
  - `http`: an approved API or vendor gateway, using `MARKET_DATA_API_URL`
    and `MARKET_DATA_API_KEY`.
  - A vendor SDK can be added as a sibling adapter in
    `src/lib/market/providers/`.
- **Data states:** `illustrative · delayed · live · unavailable`, plus
  licensing and staleness. Every label on screen derives from these, so a
  page never claims a status its data doesn't have. An unlicensed value
  never reaches the page.
- **Environments:** `NUSANTARA_ENV` (`review` | `staging` | `production`)
  controls banners, indexing and whether illustrative data is permitted.
  Market pages revalidate every 300 s and the market APIs every 60 s.
- **Not CMS content:** market data is never editable in the CMS. The Admin
  dashboard shows its status read-only.

Details: `docs/ARCHITECTURE.md` §2 and §8.

## 11. Production deployment sequence

The step-by-step version, including exact Neon, S3/IAM/CORS and Netlify
settings, is in `docs/DEPLOYMENT.md` §3–§5 and §10. In outline:

1. **Provision** under company accounts:
   - Neon project `nusantara-cms`, AWS Singapore, Postgres 16, with
     `production` and `preview` branches. Create `preview` while production is
     empty.
   - Private S3 buckets for production and preview in `ap-southeast-1`, plus
     one scoped IAM user each.
2. **Netlify:**
   - base directory `apps/nusantara-website`;
   - enable branch deploys for the CMS test branch;
   - set environment variables per context (§6). Leave the production
     `DATABASE_URL` unset to keep production `/admin` inactive until cutover.
3. **Deploy the branch** (CMS mode, preview data):
   1. Deploy with `CMS_IMPORT_ON_DEPLOY=true`.
   2. Bootstrap the first Admin: `CMS_BOOTSTRAP_TOKEN`, then
      `/admin/bootstrap`, then sign in, then remove the token and redeploy.
   3. Create a second account for separate approval.
4. **Online acceptance:** Login → Edit → Draft → Preview → Submit → separate
   approval → Publish → verify → Discard/restore.
   - Then run `scripts/regression/*.mjs` against the branch URL. The scripts
     refuse a site reporting the production data environment.
   - Watch `/api/cms-health`.
5. **Production database (at cutover):**
   1. Set the production variables.
   2. Deploy once with `CMS_MIGRATIONS=apply` and `CMS_IMPORT_ON_DEPLOY=true`.
   3. Remove both flags.
   4. Bootstrap the production Admin the same way.

Verify which branch Netlify's **production** context builds from. The frozen
review build lives on `claude/bold-hopper-w9dmf6`; the Admin Portal code is on
`claude/admin-portal` and has not been merged anywhere. Choosing a
merge/promotion strategy is part of the handover.

## 12. Security considerations

- **Authentication:** Payload's server-side passwords.
  - Salted PBKDF2; minimum 12 characters.
  - Lock-out after 5 failures, for 15 minutes.
  - 8-hour sessions in HttpOnly, Secure, `SameSite=Strict` cookies.
  - Cookie authentication is accepted only from allowed origins (CSRF/CORS).
- **Account creation:**
  - No self-registration; anonymous account creation is refused, including
    Payload's first-register endpoint.
  - The bootstrap cookie is an HMAC, valid 15 minutes, and only while no
    account exists.
- **Email password reset is disabled** until an email service exists, so reset
  links are never written to logs. Admins reset passwords.
- **`/admin` and `/api/cms`:**
  - `noindex` and `private, no-store`, plus a dedicated CSP.
  - Anonymous API reads return nothing, except media approved for public use.
- **Drafts:** never public. Preview re-checks the Admin session on every
  render.
- **Media:**
  - Private bucket; allow-listed types (no SVG/HTML); 10 MB limit.
  - Public only after Reviewer/Admin approval with a recorded licence.
- **Logs** are JSON events (`cms.*`, `auth.*`, `media.*`). They never contain
  passwords, tokens, secrets, cookies, request bodies or database query
  parameters.
- **Secrets** live only in Netlify environment settings. They are never in Git
  or the build output (verified).
- **SSO/MFA:** none yet. Roles stay on Payload user records, so an Entra ID
  (OIDC) auth strategy can be added without content changes. The
  recommendation is Entra ID SSO with MFA rather than bespoke MFA
  (`docs/DEPLOYMENT.md` §9).

## 13. Outstanding production dependencies (not provisioned)

| Dependency | Needed for |
|---|---|
| Neon Postgres project (production + preview branches) | Admin Portal and CMS content |
| AWS S3 buckets + IAM users (production + preview) | Media uploads |
| Netlify branch deploy + per-context environment variables | Online Admin test site |
| Real Admin/Reviewer accounts (named people) | Editor ≠ Approver workflow |
| Uptime monitor on `/api/cms-health` | Operations |
| Transactional email (Amazon SES Singapore recommended; `docs/DEPLOYMENT.md` §8) | Self-service password reset (optional) |
| Entra ID SSO + MFA | Corporate identity (later phase) |
| Approved market-data provider and licence | Leaving illustrative data (`NUSANTARA_ENV` staging/production) |

Nothing here has been tested on the real hosted services. The architecture was
rehearsed locally:
- Netlify's own build and `netlify serve` runtime;
- PostgreSQL with TLS;
- an S3-compatible stand-in for browser uploads;
- the production-style import.

## 14. Cutover and rollback

**Cutover** means the live public site reads the CMS. It is a separate
management approval: complete the GO/NO-GO list in
`docs/CMS_CUTOVER_CHECKLIST.md` first. The mechanics:

1. Take a Neon backup branch.
2. Change one line in `netlify.toml`: `[context.production.environment]
   CONTENT_SOURCE = "cms"`.
3. Make that a reviewed commit, then deploy.

**Rollback:**
- **Code:** Netlify → Deploys → previous deploy → *Publish deploy*. That
  returns the typed-file site within about a minute. Or revert the commit.
- **Data:** Neon point-in-time restore, or the backup branch. S3 versioning
  restores media.

## 15. Key documentation (in `apps/nusantara-website/`)

| File | Contents |
|---|---|
| `README.md` | Public site: features, design phases, how to build the review build |
| `docs/ARCHITECTURE.md` | Information chain, market-data service and states, publication governance, content models, relationship engine, environments, security |
| `docs/ADMIN_PORTAL.md` | Admin Portal: roles, workflow/classification, preview, revalidation, versions, discard, structured Insights, legal-404 fix, regression scripts |
| `docs/DEPLOYMENT.md` | Infrastructure, provisioning steps, environment matrix, migrations/deploy sequence, bootstrap, media, email/MFA assessment, online test, backup, observability |
| `docs/CMS_CUTOVER_CHECKLIST.md` | GO/NO-GO cutover gate and open decisions |
| `docs/PRODUCTION_ROADMAP.md`, `docs/MANAGEMENT_DECISIONS.md` | Path to public launch; content/legal/data decisions owned by management |
| `.env.example` | Every environment variable with comments |
| `scripts/parity/README.md` | Parity check against `e803790` |

## 16. Known limitations and open management decisions

**Limitations**
- Not yet deployed on real Neon/S3/Netlify (§13). Expect the first branch
  deploy to surface account-level settings.
- The public site is a management-review build:
  - illustrative market data;
  - sample/review content, labelled as such;
  - no indexing;
  - legal text pending counsel review.
- Pages outside the CMS (§9) still need a code change.
- After cutover, a cacheable delivery path for public CMS images is a
  deliberate follow-up. Media is currently served `private, no-store`.
- Netlify's local `netlify serve` shows some 403 responses as 404. The
  regression scripts accept that when `NETLIFY_LOCAL_PROXY=1`.
- In local-disk media mode (development only), a deleted file returns 500
  rather than 404. S3 returns 404.

**Open decisions** (`docs/CMS_CUTOVER_CHECKLIST.md`)
- Neon plan, restore window (at least 7 days recommended) and production
  warm compute.
- Production `/admin`: currently intended to stay inactive until cutover.
- Email provider.
- MFA position before cutover (SSO vs. interim controls).
- Uptime monitoring owner.
- Off-Neon backups.
- Named Admin/Editor/Reviewer accounts.
- Password protection of the branch deploy.
- Approval of the CMS cutover itself.
- Approved market-data provider and licence.
