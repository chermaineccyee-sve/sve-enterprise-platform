# Admin Portal — Phase B0 (Foundation)

Payload CMS 3 runs inside this Next.js app. **No content has been migrated, and
the public site still reads the typed files in `src/content`**
(`CONTENT_SOURCE=local`, the default). The frozen management-review build is
commit `e803790`. `scripts/parity` checks the public site against it.

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
- **No self-registration.** The first Admin is created by `cms:seed-admin`,
  or through `/admin` only while `CMS_ALLOW_FIRST_USER=true` and no user
  exists.
- **Password reset by email is disabled** until an email service is
  configured. Otherwise Payload would write reset links to the server log.
  Until then, an Admin resets passwords.
- **Admin pages are never indexed or cached.** `/admin` and `/api/cms` send
  `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`, and production
  `robots.txt` disallows `/admin`.
- **No anonymous API access.** Anonymous `/api/cms` requests can read
  nothing. The public site reads only through the content repository, on the
  server.
- **SSO/MFA later.** Payload auth strategies can authenticate against a
  corporate identity provider and resolve to the same user records. Roles stay
  on those records, so content collections do not change.

## 7. Environment variables

See `.env.example`. B0 adds `CONTENT_SOURCE`, `DATABASE_URL`,
`PAYLOAD_SECRET`, `CMS_ALLOW_FIRST_USER`, `CMS_EXTRA_ORIGINS` and `S3_*`.
`NEXT_PUBLIC_SITE_URL` is the public origin; it is also the Admin Portal's
CSRF origin.
