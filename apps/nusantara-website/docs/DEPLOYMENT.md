# Deployment — Admin Portal online (B1B)

This page covers how the Nusantara website and its Admin Portal run on
Netlify, with Neon Postgres in Singapore and private AWS S3 media in
Singapore.

The public website keeps reading the typed content files
(`CONTENT_SOURCE=local`) until the separately approved cutover
(`docs/CMS_CUTOVER_CHECKLIST.md`).

`<site>` is the Netlify site name and `<production-domain>` the public domain.
Neither is assumed here.

## 1. Architecture

```
Browser ──► Netlify CDN ──► Next.js server function (one deployment)
                              ├─ public website  (/, /insights, …)   reads content via src/lib/content/source.ts
                              │                                       local files (CONTENT_SOURCE=local) or CMS (cms)
                              └─ Admin Portal    (/admin, /api/cms)  Payload CMS
                                    │
                                    ├──► Neon Postgres, AWS ap-southeast-1 (Singapore)
                                    │      runtime: pooled endpoint (PgBouncer), TLS
                                    │      schema work: direct endpoint, TLS
                                    └──► AWS S3, ap-southeast-1 (private bucket)
                                           browser → S3 uploads with signed URLs (type + size locked)
                                           downloads only through /api/cms/media/file/… (access-controlled)
```

There is one codebase and one deployment per context. The data each
deployment can reach is decided entirely by its environment variables.

| Netlify context | Public content | Admin Portal | Data |
|---|---|---|---|
| **Production** (live site) | `local` (fixed in `netlify.toml`) | Off until `DATABASE_URL` is set; may then run on production data ahead of cutover | production database + production bucket |
| **Branch deploy `claude/admin-portal`** (Admin test site) | `cms` (from `netlify.toml`) | On | **preview** database branch + preview bucket |
| **Deploy previews** (pull requests) | `local` | Off (no database scoped to them) | none |
| **Local development** | `local` by default | On with a local Postgres | development database, local disk |

## 2. What is provisioned and what needs an account owner

No external service has been created from this repository. Accounts,
credentials and URLs come from the account owner. None are invented here.

| Service | Status | Action |
|---|---|---|
| Netlify site | Exists (current review site) | Enable branch deploys for `claude/admin-portal`; add environment variables (§4) |
| Neon Postgres | **Not provisioned** | §3.1 |
| AWS S3 (+ IAM) | **Not provisioned** | §3.2 |
| Transactional email | Not provisioned; not needed yet | Recommendation in §8 |

## 3. Provisioning instructions (account owner)

### 3.1 Neon (Postgres)

1. Create a project in the Neon console:
   - **Name:** `nusantara-cms`
   - **Postgres version:** 16 (the version this release was tested on)
   - **Region:** AWS **Asia Pacific (Singapore) — `ap-southeast-1`**
2. In the default branch (rename it `production`), create:
   - **database** `nusantara_cms`
   - **role** `nusantara_app` (owner of `nusantara_cms`)
3. **Create the preview branch now, while production is still empty.**
   Branches → New branch `preview`, parent `production`.
   - A branch copies its parent's data.
   - Created now, it starts empty.
   - Created after production holds data, it would carry production's
     data-environment marker. The deploy step would then refuse it, which is
     correct, and you would have to recreate it empty.
4. Copy two connection strings for each branch (Connection details):
   - **Pooled connection** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct connection** (no `-pooler`) → `DATABASE_URL_UNPOOLED`
   - In both, set `sslmode=verify-full` (Neon shows `sslmode=require`; Node's
     driver already treats that as full verification, and `verify-full`
     says so explicitly). `channel_binding=require` may stay.
5. Compute: the smallest autoscaling size is enough (0.25–1 CU).
   - Scale-to-zero is acceptable for the preview branch.
   - For production, decide whether to keep a minimum of 0.25 CU (no
     cold-start delay on the first Admin request after idle). This is a
     management decision (docs/CMS_CUTOVER_CHECKLIST.md).
6. Backups: choose a plan whose **point-in-time restore window is at least 7
   days** for production (§11).

### 3.2 AWS S3 (media) and IAM

Create everything in **ap-southeast-1 (Singapore)**. Bucket names are
global: add a suffix if a name is taken, and use the chosen name in
`S3_BUCKET`.

1. **Buckets:** `nusantara-cms-media-production` and
   `nusantara-cms-media-preview`, each with:
   - Object Ownership: **Bucket owner enforced** (ACLs disabled)
   - **Block all public access: On** (all four settings)
   - Default encryption: **SSE-S3**
   - Bucket Versioning:
     - **Enabled** on production.
     - Add a lifecycle rule to delete noncurrent versions after 90 days.
   - No bucket policy granting public read. Nothing is listable or public.
2. **CORS** (Permissions → CORS). Browser uploads PUT directly to the bucket:

   Production bucket:
   ```json
   [{ "AllowedOrigins": ["https://<production-domain>"], "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["*"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3000 }]
   ```
   Preview bucket:
   ```json
   [{ "AllowedOrigins": ["https://claude-admin-portal--<site>.netlify.app"], "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["*"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3000 }]
   ```
3. **IAM:** one user per bucket, `nusantara-cms-production` and
   `nusantara-cms-preview`.
   - Programmatic access only, no console login.
   - Attach this inline policy, with the bucket name substituted. No
     `ListBucket` is needed or granted.
   ```json
   { "Version": "2012-10-17",
     "Statement": [{ "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::nusantara-cms-media-production/*" }] }
   ```
   - Create an access key for each user ("Application running outside AWS").
   - The key pair goes into Netlify as `S3_ACCESS_KEY_ID` /
     `S3_SECRET_ACCESS_KEY`. (Netlify reserves the `AWS_*` names, hence `S3_*`.)

### 3.3 Netlify

1. Branch deploys:
   - Site configuration → Build & deploy → Branches and deploy contexts →
     Branch deploys → *Let me add individual branches* → `claude/admin-portal`.
   - Its URL is `https://claude-admin-portal--<site>.netlify.app`.
2. Environment variables, using the §4 matrix:
   - Site configuration → Environment variables.
   - Use *Different value for each deploy context*.
   - Scopes: Builds + Functions (+ Runtime).
   - Mark the secret ones **Contains secret values** where the plan offers it.
3. Optional: Site configuration → Access & security → protect branch deploys
   with a password (Netlify plan feature). This adds a second gate in front of
   the Admin test site.

## 4. Environment-variable matrix

**Secret** means never shown, logged or committed. **Public** means it is safe
in a browser bundle. Only `NEXT_PUBLIC_*` variables are built into browser
code. `CONTENT_SOURCE` and `CMS_DATA_ENV` are fixed at build time
(`next.config.ts`) and are not secret.

| Variable | Kind | Production | Branch deploy `claude/admin-portal` | Deploy previews | Local |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | `https://<production-domain>` | `https://claude-admin-portal--<site>.netlify.app` | not set | `http://localhost:3000` |
| `CONTENT_SOURCE` | config | `local` (**netlify.toml**; cutover changes it there) | `cms` (netlify.toml) | `local` (netlify.toml) | `local` |
| `CMS_DATA_ENV` | config | `production` | `preview` (netlify.toml) | — | `development` (default) |
| `DATABASE_URL` | **secret** | Neon `production` **pooled** | Neon `preview` **pooled** | **not set** | local Postgres |
| `DATABASE_URL_UNPOOLED` | **secret** | Neon `production` direct | Neon `preview` direct | not set | optional |
| `PAYLOAD_SECRET` | **secret** | unique, `openssl rand -hex 32` | a *different* unique value | not set | any local value |
| `S3_BUCKET` | config | production bucket | preview bucket | not set | not set (local disk) |
| `S3_REGION` | config | `ap-southeast-1` | `ap-southeast-1` | — | — |
| `S3_ACCESS_KEY_ID` | **secret** (identifier) | production IAM user | preview IAM user | — | — |
| `S3_SECRET_ACCESS_KEY` | **secret** | production IAM user | preview IAM user | — | — |
| `CMS_BOOTSTRAP_TOKEN` | **secret**, temporary | only during first-Admin set-up, then delete | same | — | — |
| `CMS_EXTRA_ORIGINS` | config | only for a second domain (e.g. apex + www) | not set | — | — |
| `CMS_MIGRATIONS` | config | not set (= `check`); `apply` only for one deliberate deploy | not set (= `apply`) | — | — |
| `CMS_ALLOW_DESTRUCTIVE_MIGRATION` | config | not set; a migration name for one approved deploy | same | — | — |
| `CMS_IMPORT_ON_DEPLOY` | config | `true` for the initial-load deploy only, then delete | `true` (idempotent) | — | — |
| `NUSANTARA_ENV`, `MARKET_DATA_PROVIDER` | config | netlify.toml (`review`, `illustrative`) — unchanged | same | same | `.env` |
| `CMS_EMAIL_CONFIGURED` | config | not set until email exists (§8) | not set | — | — |

Rules enforced by the deploy step, which fails the build when broken:
- `PAYLOAD_SECRET` must be at least 32 characters.
- TLS is required on every database URL.
- The runtime URL must be Neon's pooled endpoint, and migrations use the
  direct one.
- `NEXT_PUBLIC_SITE_URL` must be https.
- A deployed Admin Portal needs `S3_BUCKET` (functions have no persistent disk).
- The production context must use `CMS_DATA_ENV=production`, and previews
  must not.
- A database already owned by another data environment is refused.

Secrets stay out of Git, build logs and browser bundles:
- They exist only in Netlify's environment settings.
- The build never prints a value.
- Operational logs redact secret-like fields and database query parameters.
- The rehearsal build was searched for every secret value, and none appeared
  in the static output (§10).

## 5. Database, migrations and deployment sequence

Payload never changes the schema on its own:
- `push: false`.
- No migrations at application start-up.

Schema changes are reviewed migration files in `src/cms/migrations`. Each
runs in its own transaction.

**Netlify build = `node scripts/cms/deploy.mjs && npm run build:review`.**

1. **Install** dependencies (Netlify).
2. **Admin Portal deploy step** (`scripts/cms/deploy.mjs` →
   `src/cms/scripts/preflight.ts`). With no `DATABASE_URL` it does nothing.
   Otherwise:
   1. Check the environment rules (§4).
   2. Connect over the direct endpoint, with TLS required.
   3. Data-environment marker. On first deploy the database records which
      `CMS_DATA_ENV` owns it. Any later deploy with a different value is
      refused, so a preview can never migrate or write production.
   4. Destructive-change guard. If a pending migration drops, renames,
      truncates or retypes anything, it needs
      `CMS_ALLOW_DESTRUCTIVE_MIGRATION=<that migration>`.
   5. Migrations:
      - Preview applies them.
      - **Production only checks.** Pending migrations fail the build until
        someone deliberately deploys with `CMS_MIGRATIONS=apply`, after
        taking a Neon backup branch.
   6. Optionally, the idempotent content import (`CMS_IMPORT_ON_DEPLOY=true`).
3. **Site build** (`next build`). In CMS mode it prerenders from the database.
4. **Publish.** Netlify switches traffic to the new deploy atomically. The
   previous deploy serves until that moment.

**If something fails:**

| Failure | Result |
|---|---|
| Environment / connection / marker / guard | Build fails before any change. The live deploy is unchanged. |
| A migration fails | That migration's transaction rolls back and the build fails. Earlier migrations in the same run stay applied. They are additive by rule, so the live deploy keeps working. |
| `next build` fails after migrations | The build fails and the live deploy keeps serving on the migrated schema. This is safe because migrations must be **backward-compatible (expand → contract)**: add first, remove in a later release once no deployed code uses it. The destructive guard enforces the "deliberate" part. |
| Runtime finds the schema behind the code | `/api/cms-health` reports `schema: pending` (HTTP 503). |

**Rollback:**
- Code: Netlify → Deploys → an earlier deploy → *Publish deploy*.
- Data: Neon point-in-time restore, or the pre-migration backup branch (§11).

**Manual production migration (alternative to `CMS_MIGRATIONS=apply`).**
From a trusted machine with the repository:

```bash
DATABASE_URL="<production DIRECT url>" npm run cms:migrate
```

## 6. Admin accounts — bootstrap, verification, closure

There is no self-registration:
- Anonymous account creation is refused through the REST API and through
  Payload's own first-user endpoint.
- Only an Admin creates accounts and assigns roles.

The first Admin is created in a short, deliberate window:

1. **Provision.** Set `CMS_BOOTSTRAP_TOKEN` (`openssl rand -hex 32`) for the
   deployment's context and redeploy.
2. **Create.** Open `https://<deployment>/admin/bootstrap` and enter the token.
   - It works only while the database has **no accounts**.
   - A valid token sets a 15-minute HttpOnly cookie (an HMAC of the token,
     never the token itself). The cookie unlocks Payload's
     *Create first user* form once.
   - The account is always an **Admin**, whatever the form submits.
3. **Verify.** Sign in at `/admin` with the new account.
4. **Disable.** Delete `CMS_BOOTSTRAP_TOKEN` in Netlify and redeploy.
   - The window is already closed for good once an account exists.
   - Until the variable is removed, the deploy log warns about it.

Alternatively, from a trusted machine (the password is prompted, not echoed):

```bash
DATABASE_URL="<DIRECT url>" CMS_SEED_ADMIN_EMAIL=… CMS_SEED_ADMIN_NAME=… npm run cms:seed-admin
```

No TEST or demo accounts, and no TEST content, go to production:
- The test scripts refuse any database not marked `development`.
- The import refuses TEST records.

### Passwords

- Payload stores passwords with salted PBKDF2. The minimum length is 12
  characters.
- After 5 failed attempts an account locks for 15 minutes.
- Sessions are 8 hours, in an HttpOnly, Secure, `SameSite=Strict` cookie.
- Cookie authentication only counts from the site's own origin (CSRF).
- **Reset by email stays off until an email service is configured (§8).**
  Until then an Admin resets a password in Users → the account → *Change
  password*.

## 7. Media

- **Types and size:**
  - Allowed: PNG, JPEG, WebP, AVIF and PDF.
  - No SVG or HTML, which could carry script.
  - At most 10 MB. Browser uploads are signed for the declared type and
    size, and the server re-checks both.
- **Storage:**
  - A private bucket. Block Public Access stays on and objects carry no ACL.
  - Uploads go browser → S3 directly, so large files never pass through a
    function (Netlify limits function request bodies to about 6 MB).
- **Delivery:** only through `/api/cms/media/file/…`, which applies access
  control on every request.
  - Staff see everything.
  - Anonymous visitors see a file only after a Reviewer or Admin ticks
    **Approved for public use**, which requires *Source / licence*.
  - Withdrawing approval stops delivery immediately.
  - An object is never public merely because it exists in S3.
- **Caching:** `Cache-Control: private, no-store`. A shared cache can never
  keep serving a withdrawn file.
  - When the public site starts showing CMS images (after cutover), a
    cacheable delivery path for approved images is a deliberate follow-up.
- **Metadata:** alternative text is required. The Admin stores width, height,
  size and type.
- **Brand masters:** the master brand assets stay in code (`/public`,
  `brand-source/`) and are never CMS media.

## 8. Email (password reset, invitations) — recommendation, not implemented

**Recommended: Amazon SES in ap-southeast-1 (Singapore).**
- It uses the same AWS account as the media bucket.
- Data stays in-region.
- It costs about US$0.10 per 1,000 messages.
- Payload sends through it with the official nodemailer adapter.

What the account owner would set up:
1. SES (Singapore) → *Verified identities* → the sending domain, with Easy
   DKIM: add the 3 CNAME records it shows. Add SPF (`include:amazonses.com`)
   and a DMARC record.
2. *Request production access* (leaves the sandbox; usually approved within a
   day). Describe the use: "staff password reset and account notices, low
   volume".
3. *SMTP settings* → *Create SMTP credentials* (creates a dedicated IAM user).
4. Choose a sender, e.g. `no-reply@<domain>`.

Then provide these values for Netlify:
- `SMTP_HOST=email-smtp.ap-southeast-1.amazonaws.com`
- `SMTP_PORT=587`
- `SMTP_USER` / `SMTP_PASS` (secret)
- `EMAIL_FROM`

A follow-up change adds the adapter and sets `CMS_EMAIL_CONFIGURED=true`.

A simpler-to-start alternative is Resend: one API key and DNS records. Its
processing is US-hosted.

## 9. SSO / MFA — assessment

- **Readiness:**
  - Roles live on Payload user records, matched by email.
  - A Payload auth strategy (OIDC, e.g. Microsoft Entra ID) can authenticate
    against those same records.
  - Local passwords can then be disabled.
  - No content collection changes.
- **MFA now:** Payload has no built-in MFA. Two options exist:
  - Add a community TOTP plugin (third-party code in the login path).
  - Build TOTP ourselves: encrypted secrets, an enrolment screen, a login
    step, recovery codes and Admin reset. That is a few days of work plus a
    security review, for something replaced once SSO arrives.
- **Recommendation:**
  - Don't build bespoke MFA.
  - Make **Entra ID SSO with Conditional-Access MFA** the next identity step.
  - Until then, keep the compensating controls:
    - a handful of named accounts
    - unique 16+ character passwords from a password manager
    - lock-out and 8-hour sessions
    - the audit log and auth events (§12)
    - optionally Netlify password protection on the Admin test site

## 10. Testing the Admin Portal online

After §3 and §4 are done for the branch deploy:

1. Push or redeploy `claude/admin-portal`.
   - The deploy log shows the preflight: `✓ environment`,
     `✓ database reachable (… TLS on)`, `✓ database claimed for
     CMS_DATA_ENV=preview`, the migrations applied, the import counts and
     the bootstrap notice.
2. Open `https://claude-admin-portal--<site>.netlify.app/api/cms-health`. It
   should show `"status":"ok"`.
3. Bootstrap the first Admin (§6). Then create an Editor and a Reviewer in
   Users. They need separate people/accounts, because Nusantara Views need
   Editor ≠ Approver.
4. As the **Editor**, test the draft and review steps:
   1. Open a Nusantara View (e.g. Gold), change *Key risk* and set a future
      *Re-review by* date.
   2. **Save Draft**. The status line says *Unpublished draft changes*.
   3. Click **Preview**. The real page shows the change under
      *Preview · Not published*. A private window shows the live version.
   4. Set Workflow → **In Review** → Save Draft.
5. As the **Reviewer**, publish:
   1. Workflow → **Approved** → Save Draft.
   2. **Publish to website**.
   3. The branch site shows the change on the next request, with no rebuild.
6. Media: as the Editor, upload an image in Media. Check it does not open in a
   private window until a Reviewer approves it for public use.
7. The live production site is untouched throughout (different context,
   database and bucket).

Scripted checks against the branch deploy (credentials via environment
variables):

```bash
node scripts/regression/bootstrap-and-access.mjs --base https://claude-admin-portal--<site>.netlify.app
node scripts/regression/media-access.mjs        --base …   # creates and deletes one TEST image
node scripts/regression/publish-revalidation.mjs --base …   # creates, publishes, withdraws, deletes one TEST Insight
```

The last two refuse a site that reports the production data environment.

## 11. Backup and recovery

- **Database:**
  - Neon point-in-time restore. Plan for at least 7 days of history on
    production.
  - Before every production migration or bulk import, create a branch named
    `backup-YYYYMMDD-HHMM` from production. It is instant and
    copy-on-write.
  - **Restore:** reset production to a timestamp, or to the backup branch,
    in the Neon console. Then redeploy.
  - Optional: a weekly `pg_dump` kept outside Neon, using AWS Backup or a
    scheduled job (management decision — docs/CMS_CUTOVER_CHECKLIST.md).
- **Media:**
  - S3 versioning on the production bucket recovers overwritten or deleted
    objects for 90 days.
  - Database and bucket are restored independently. Media records point at
    object keys that versioning keeps.
- **Content history:**
  - Every save is a version.
  - Restores are drafts and go through review.
  - The audit log is append-only.
- **Code:** Netlify keeps every deploy. *Publish deploy* on an earlier one
  rolls back.
- **Secrets:** if one leaks, rotate it in its source (Neon role password,
  IAM key, `PAYLOAD_SECRET`), update Netlify and redeploy. Rotating
  `PAYLOAD_SECRET` signs everyone out.

## 12. Observability

Operational events are one JSON line each in the Netlify logs:
- **Functions**, for runtime events.
- **Deploy log**, for preflight and migrations.

| Event | Meaning |
|---|---|
| `cms.init` | Admin Portal started; lists configuration problems or warnings (no values) |
| `cms.request.failed` / `cms.request.denied` | CMS API request failed (5xx) / refused (401/403) |
| `cms.db.unreachable` | database connection failure (runtime, health check or preflight) |
| `cms.schema.pending` | the database is behind this deploy's migrations |
| `cms.revalidate` / `cms.revalidate.failed` | publication refreshed the public pages / could not |
| `cms.migration.start` / `cms.migration.done` / `cms.preflight.failed` | deploy-step migrations and their failure reason |
| `media.rejected` / `media.request_failed` | upload refused (type, size, missing licence) / media request failed |
| `auth.login` / `auth.logout` / `auth.login_failed` / `auth.locked` | sign-in activity and lock-outs |
| `auth.refused` / `auth.bootstrap.*` | refused account creation; bootstrap window use |

What is never logged:
- passwords, session or bootstrap tokens, secrets or cookies
- request bodies or content
- database query parameters, which are stripped from Payload's own error
  logs too

**Health:** `GET /api/cms-health` returns aggregate state only. It is 200 when
healthy and 503 otherwise, so any uptime monitor can watch it (management decision — docs/CMS_CUTOVER_CHECKLIST.md).

Audit trail (Admin → Audit Log): who created, edited, submitted, approved,
published, archived, restored, discarded, deleted or changed accounts, and
when.
